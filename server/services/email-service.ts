import nodemailer from 'nodemailer'
import type { QueryResultRow } from 'pg'
import { config } from '../config.js'
import { pool } from '../db.js'
import { ApiError } from '../errors.js'

function smtpConfigured() {
  return Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createTransporter() {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  })
}

export function nonDeliverableEmailReason(email: string) {
  const normalized = email.trim().toLowerCase()
  const domain = normalized.split('@')[1]
  if (!domain || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'invalid_email'
  if (
    ['example.com', 'example.net', 'example.org', 'localhost'].includes(domain)
    || domain.endsWith('.example')
    || domain.endsWith('.invalid')
    || domain.endsWith('.localhost')
    || domain.endsWith('.test')
  ) return 'test_email'
  return null
}

export interface AppointmentConfirmationEmailResult {
  /** Sent means SMTP accepted the message; it does not prove inbox delivery. */
  status: 'sent' | 'failed' | 'not_sent'
  reason?: string
}

interface AppointmentConfirmationRow extends QueryResultRow {
  salon_id: string
  appointment_id: string
  client_id: string
  recipient: string | null
  client_name: string
  salon_name: string
  timezone: string
  city: string | null
  region: string | null
  starts_at: string
  professional_name: string | null
  service_names: string[]
}

// The appointment has already committed. Limit these auxiliary database waits
// so a slow confirmation lookup/audit cannot indefinitely hold its HTTP response.
async function queryConfirmation<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[],
): Promise<T[]> {
  // pg supports per-query query_timeout; @types/pg only declares it on clients.
  const queryConfig = { text, values, query_timeout: 5_000 }
  const result = await pool.query<T>(queryConfig)
  return result.rows
}

async function recordAppointmentEmail(input: {
  row: AppointmentConfirmationRow
  status: 'sent' | 'failed' | 'canceled'
  title: string
  body: string
  providerMessageId?: string | null
  reason?: string
}) {
  await queryConfirmation(
    `INSERT INTO notifications (
       salon_id, client_id, appointment_id, channel, event_type, recipient,
       title, body, status, sent_at, provider_message_id, metadata_json
     ) VALUES ($1, $2, $3, 'email', 'appointment_confirmation', $4, $5, $6, $7::varchar,
               CASE WHEN $7::varchar = 'sent' THEN now() ELSE NULL END, $8, $9::jsonb)`,
    [
      input.row.salon_id,
      input.row.client_id,
      input.row.appointment_id,
      input.row.recipient,
      input.title,
      input.body,
      input.status,
      input.providerMessageId ?? null,
      JSON.stringify({ source: 'appointment_confirmation', reason: input.reason ?? null, retry: false }),
    ],
  ).catch(() => {
    // SMTP acceptance and audit persistence are separate outcomes. Do not resend
    // or mark accepted mail as failed when its notification cannot be recorded.
    console.warn('Appointment confirmation email audit failed.', {
      appointmentId: input.row.appointment_id,
      status: input.status,
    })
  })
}

export async function sendAppointmentConfirmationEmail(
  salonId: string,
  appointmentId: string,
): Promise<AppointmentConfirmationEmailResult> {
  let row: AppointmentConfirmationRow | undefined
  let title = 'Appointment confirmation'
  let body = 'Appointment confirmation email could not be prepared.'
  try {
    const rows = await queryConfirmation<AppointmentConfirmationRow>(
      `SELECT a.id AS appointment_id, a.salon_id, a.client_id, a.starts_at,
              c.email AS recipient, c.full_name AS client_name,
              s.name AS salon_name, s.timezone, s.city, s.region,
              p.full_name AS professional_name,
              COALESCE(array_agg(aps.service_name_snapshot ORDER BY aps.created_at)
                FILTER (WHERE aps.id IS NOT NULL), ARRAY[]::varchar[]) AS service_names
       FROM appointments a
       JOIN clients c ON c.salon_id = a.salon_id AND c.id = a.client_id
       JOIN salons s ON s.id = a.salon_id
       LEFT JOIN professionals p ON p.salon_id = a.salon_id AND p.id = a.professional_id
       LEFT JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
       WHERE a.salon_id = $1 AND a.id = $2
       GROUP BY a.id, c.email, c.full_name, s.name, s.timezone, s.city, s.region, p.full_name`,
      [salonId, appointmentId],
    )
    row = rows[0]
    if (!row) return { status: 'failed', reason: 'appointment_not_found' }
    title = `${row.salon_name}: appointment confirmed`
    if (!row.recipient) {
      await recordAppointmentEmail({ row, status: 'canceled', title, body, reason: 'missing_email' })
      return { status: 'not_sent', reason: 'missing_email' }
    }

    const startsAt = new Date(row.starts_at)
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: row.timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(startsAt)
    const timeLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: row.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(startsAt)
    const services = row.service_names.join(', ')
    const location = [row.city, row.region].filter(Boolean).join(', ')
    const confirmationCode = `A${row.appointment_id.replace(/-/g, '').slice(0, 5).toUpperCase()}`
    body = `${services} on ${dateLabel} at ${timeLabel} with ${row.professional_name ?? row.salon_name}. Confirmation ${confirmationCode}.`
    const skipReason = nonDeliverableEmailReason(row.recipient)

    if (skipReason || !smtpConfigured()) {
      await recordAppointmentEmail({
        row,
        status: 'canceled',
        title,
        body,
        reason: skipReason ?? 'smtp_not_configured',
      })
      return { status: 'not_sent', reason: skipReason ?? 'smtp_not_configured' }
    }

    const safeName = escapeHtml(row.client_name)
    const safeSalon = escapeHtml(row.salon_name)
    const safeServices = escapeHtml(services)
    const safeProfessional = escapeHtml(row.professional_name ?? row.salon_name)
    const safeLocation = escapeHtml(location)
    const info = await createTransporter().sendMail({
      from: config.SMTP_FROM,
      to: row.recipient,
      subject: title,
      text: `Hi ${row.client_name},\n\nYour appointment at ${row.salon_name} is confirmed.\n\nService: ${services}\nDate: ${dateLabel}\nTime: ${timeLabel}\nSpecialist: ${row.professional_name ?? row.salon_name}${location ? `\nLocation: ${location}` : ''}\nConfirmation: ${confirmationCode}\n\nPlease keep this email for your records.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:560px;margin:auto">
          <div style="background:#f5f3ff;border-radius:12px;padding:24px">
            <h1 style="font-size:22px;margin:0 0 4px">${safeSalon}</h1>
            <p style="color:#6d28d9;font-size:12px;font-weight:700;margin:0">APPOINTMENT CONFIRMED</p>
          </div>
          <p>Hi ${safeName},</p>
          <p>Your appointment is confirmed. Here are your details:</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6b7280">Service</td><td style="padding:8px 0;font-weight:700">${safeServices}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;font-weight:700">${dateLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;font-weight:700">${timeLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Specialist</td><td style="padding:8px 0;font-weight:700">${safeProfessional}</td></tr>
            ${location ? `<tr><td style="padding:8px 0;color:#6b7280">Location</td><td style="padding:8px 0;font-weight:700">${safeLocation}</td></tr>` : ''}
          </table>
          <div style="background:#fafaff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;text-align:center;margin-top:20px">
            <div style="color:#6b7280;font-size:11px;font-weight:700">CONFIRMATION CODE</div>
            <div style="color:#4c1d95;font-size:24px;font-weight:700;margin-top:4px">${confirmationCode}</div>
          </div>
        </div>
      `,
    })

    if (!Array.isArray(info.accepted) || info.accepted.length === 0 || (Array.isArray(info.rejected) && info.rejected.length > 0)) {
      await recordAppointmentEmail({ row, status: 'failed', title, body, providerMessageId: info.messageId, reason: 'smtp_rejected' })
      return { status: 'failed', reason: 'smtp_rejected' }
    }
    await recordAppointmentEmail({ row, status: 'sent', title, body, providerMessageId: info.messageId })
    return { status: 'sent' }
  } catch {
    // The booking is already saved. Never turn an email failure into a booking
    // error, and never log SMTP errors that may contain customer/message data.
    console.warn('Appointment confirmation email failed.', { appointmentId })
    if (row) {
      await recordAppointmentEmail({ row, status: 'failed', title, body, reason: 'email_dispatch_failed' })
    }
    return { status: 'failed', reason: 'email_dispatch_failed' }
  }
}

export async function sendPasswordResetCode({
  code,
  email,
  name,
}: {
  code: string
  email: string
  name: string
}) {
  if (!smtpConfigured()) {
    if (config.NODE_ENV === 'production') {
      throw new ApiError(500, 'Password reset email is not configured.')
    }

    console.info(`[dev] Password reset code for ${email}: ${code}`)
    return
  }

  const safeName = escapeHtml(name)

  const info = await createTransporter().sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: 'Your Glamhour password reset code',
    text: `Hi ${name},\n\nYour Glamhour password reset code is ${code}.\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
        <h1 style="font-size:20px">Reset your Glamhour password</h1>
        <p>Hi ${safeName},</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })

  console.info('Password reset email accepted by SMTP.', {
    accepted: info.accepted,
    rejected: info.rejected,
    messageId: info.messageId,
  })
}

/** Public booking verification always requires an accepted SMTP delivery. */
export async function sendPublicBookingVerificationCode({
  code,
  email,
  salonName,
}: {
  code: string
  email: string
  salonName: string
}): Promise<void> {
  if (!smtpConfigured() || nonDeliverableEmailReason(email)) {
    throw new ApiError(503, 'Email verification is temporarily unavailable.')
  }
  const safeSalon = escapeHtml(salonName)
  const safeCode = escapeHtml(code)
  try {
    const info = await createTransporter().sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject: 'Your Glamhour booking verification code',
      text: `Your verification code for ${salonName} is ${code}.\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
        <h1 style="font-size:20px">Verify your email for ${safeSalon}</h1>
        <p>Enter this code to continue your booking:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${safeCode}</p>
        <p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>`,
    })
    if (!Array.isArray(info.accepted) || info.accepted.length === 0 || (Array.isArray(info.rejected) && info.rejected.length > 0)) {
      throw new ApiError(503, 'Email verification is temporarily unavailable.')
    }
  } catch {
    // SMTP errors may contain message content; do not expose or log them.
    throw new ApiError(503, 'We could not send the verification email. Please try again later.')
  }
}
