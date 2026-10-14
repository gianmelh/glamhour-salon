import { randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { QueryResultRow } from 'pg'
import { pool, withTransaction, type DatabaseClient } from '../db.js'
import { ApiError } from '../errors.js'
import { sendPublicBookingVerificationCode } from './email-service.js'

const hashCode = promisify(scrypt)
const EXPIRY_SECONDS = 10 * 60
const RESEND_SECONDS = 60
const MAX_ATTEMPTS = 5
const MAX_EMAIL_SENDS_PER_HOUR = 5
const MAX_SALON_SENDS_PER_HOUR = 100

interface VerificationRow extends QueryResultRow {
  verified_at: string | null
  active_code_id: string | null
}
interface CodeRow extends QueryResultRow {
  id: string
  code_hash: string | null
  code_salt: string | null
  sent_at: string | null
  consumed_at: string | null
  attempts: number
  unexpired: boolean
}

function normalizedEmail(email: string) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError(400, 'Enter a valid email address.')
  }
  return normalized
}

async function digestCode(salonId: string, email: string, code: string, salt: string) {
  return await hashCode(code, `${salonId}\0${email}\0${salt}`, 64) as Buffer
}

export async function getPublicBookingEmailStatus(salonId: string, email: string): Promise<{ verified: boolean }> {
  const result = await pool.query<VerificationRow>(
    'SELECT verified_at FROM public_booking_email_verifications WHERE salon_id = $1 AND email_normalized = $2',
    [salonId, normalizedEmail(email)],
  )
  return { verified: Boolean(result.rows[0]?.verified_at) }
}

export async function assertPublicBookingEmailVerified(salonId: string, email: string, db: DatabaseClient = pool): Promise<void> {
  const result = await db.query<VerificationRow>(
    'SELECT verified_at FROM public_booking_email_verifications WHERE salon_id = $1 AND email_normalized = $2',
    [salonId, normalizedEmail(email)],
  )
  if (!result.rows[0]?.verified_at) {
    throw new ApiError(403, 'Verify your email address before booking this appointment.', { emailVerificationRequired: true })
  }
}

export async function requestPublicBookingEmailCode(
  salonId: string,
  email: string,
  salonName: string,
): Promise<{ verified: boolean; expiresInSeconds?: number; resendAfterSeconds?: number }> {
  const address = normalizedEmail(email)
  const reservation = await withTransaction(async (client) => {
    // Serialize quota reservations across the salon, but release all locks before
    // SMTP. This also prevents parallel requests for different addresses from
    // bypassing the salon-wide send budget.
    const salon = await client.query(
      'SELECT id FROM salons WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [salonId],
    )
    if (!salon.rows[0]) throw new ApiError(404, 'Salon not found.')
    await client.query(
      `INSERT INTO public_booking_email_verifications (salon_id, email_normalized)
       VALUES ($1, $2) ON CONFLICT (salon_id, email_normalized) DO NOTHING`,
      [salonId, address],
    )
    const identity = await client.query<VerificationRow>(
      `SELECT verified_at, active_code_id FROM public_booking_email_verifications
       WHERE salon_id = $1 AND email_normalized = $2 FOR UPDATE`,
      [salonId, address],
    )
    if (identity.rows[0]?.verified_at) return { verified: true as const }

    const quota = await client.query<QueryResultRow & {
      email_count: number; salon_count: number; resend_after_seconds: number
      email_retry_after_seconds: number; salon_retry_after_seconds: number
    }>(
      `SELECT COUNT(*) FILTER (WHERE email_normalized = $2)::int AS email_count,
              COUNT(*)::int AS salon_count,
              COALESCE(CEIL(EXTRACT(EPOCH FROM (
                MAX(requested_at) FILTER (WHERE email_normalized = $2) + interval '60 seconds' - clock_timestamp()
              ))), 0)::int AS resend_after_seconds,
              COALESCE(CEIL(EXTRACT(EPOCH FROM (
                MIN(requested_at) FILTER (WHERE email_normalized = $2) + interval '1 hour' - clock_timestamp()
              ))), 0)::int AS email_retry_after_seconds,
              COALESCE(CEIL(EXTRACT(EPOCH FROM (
                MIN(requested_at) + interval '1 hour' - clock_timestamp()
              ))), 0)::int AS salon_retry_after_seconds
       FROM public_booking_email_codes
       WHERE salon_id = $1 AND requested_at > clock_timestamp() - interval '1 hour'`,
      [salonId, address],
    )
    const limits = quota.rows[0]
    if (!limits) throw new ApiError(503, 'Email verification is temporarily unavailable.')
    if (limits.email_count >= MAX_EMAIL_SENDS_PER_HOUR || limits.salon_count >= MAX_SALON_SENDS_PER_HOUR) {
      const retryAfter = Math.max(1, limits.email_count >= MAX_EMAIL_SENDS_PER_HOUR ? limits.email_retry_after_seconds : 0,
        limits.salon_count >= MAX_SALON_SENDS_PER_HOUR ? limits.salon_retry_after_seconds : 0)
      throw new ApiError(429, 'Too many verification codes requested. Please try again later.', { resendAfterSeconds: retryAfter })
    }
    if (limits.resend_after_seconds > 0) {
      throw new ApiError(429, 'Please wait before requesting another verification code.', { resendAfterSeconds: limits.resend_after_seconds })
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const salt = randomBytes(32).toString('hex')
    const hash = (await digestCode(salonId, address, code, salt)).toString('hex')
    const id = randomUUID()
    await client.query(
      `UPDATE public_booking_email_codes SET consumed_at = clock_timestamp(), code_hash = NULL, code_salt = NULL
       WHERE salon_id = $1 AND email_normalized = $2 AND consumed_at IS NULL`,
      [salonId, address],
    )
    await client.query(
      `INSERT INTO public_booking_email_codes (id, salon_id, email_normalized, code_hash, code_salt, expires_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp() + ($6::int * interval '1 second'))`,
      [id, salonId, address, hash, salt, EXPIRY_SECONDS],
    )
    await client.query(
      `UPDATE public_booking_email_verifications SET active_code_id = $3, updated_at = clock_timestamp()
       WHERE salon_id = $1 AND email_normalized = $2`,
      [salonId, address, id],
    )
    return { verified: false as const, id, code }
  })
  if (reservation.verified) return { verified: true }

  try {
    await sendPublicBookingVerificationCode({ email: address, salonName, code: reservation.code })
  } catch {
    // Failure cannot leave a usable challenge, even if SMTP partially accepted
    // the message. Never log the code, message body, or SMTP exception payload.
    await pool.query(
      `UPDATE public_booking_email_codes
       SET failed_at = clock_timestamp(), consumed_at = COALESCE(consumed_at, clock_timestamp()), code_hash = NULL, code_salt = NULL
       WHERE id = $1 AND sent_at IS NULL`,
      [reservation.id],
    ).catch(() => undefined)
    throw new ApiError(503, 'We could not send the verification email. Please try again later.', { resendAfterSeconds: RESEND_SECONDS })
  }

  const sent = await pool.query<QueryResultRow & { expires_in_seconds: number }>(
    `UPDATE public_booking_email_codes SET sent_at = clock_timestamp()
     WHERE id = $1 AND consumed_at IS NULL AND failed_at IS NULL AND expires_at > clock_timestamp()
     RETURNING CEIL(EXTRACT(EPOCH FROM (expires_at - clock_timestamp())))::int AS expires_in_seconds`,
    [reservation.id],
  )
  if (!sent.rows[0]) {
    if ((await getPublicBookingEmailStatus(salonId, address)).verified) return { verified: true }
    throw new ApiError(409, 'This verification code has been replaced. Please use the most recently requested code.')
  }
  return { verified: false, expiresInSeconds: Math.max(1, sent.rows[0].expires_in_seconds), resendAfterSeconds: RESEND_SECONDS }
}

export async function verifyPublicBookingEmailCode(salonId: string, email: string, code: string): Promise<{ verified: true }> {
  const address = normalizedEmail(email)
  const outcome = await withTransaction(async (client): Promise<{ verified: true } | { error: ApiError }> => {
    const identity = await client.query<VerificationRow>(
      `SELECT verified_at, active_code_id FROM public_booking_email_verifications
       WHERE salon_id = $1 AND email_normalized = $2 FOR UPDATE`,
      [salonId, address],
    )
    const current = identity.rows[0]
    const invalid = () => ({ error: new ApiError(400, 'This verification code is invalid or expired. Request a new code.') })
    // Status/request endpoints provide the durable bypass for a verified address;
    // the verification endpoint itself never accepts a consumed code again.
    if (!current || current.verified_at || !current.active_code_id) return invalid()
    const codes = await client.query<CodeRow>(
      `SELECT id, code_hash, code_salt, sent_at, consumed_at, attempts,
              (expires_at > clock_timestamp()) AS unexpired
       FROM public_booking_email_codes
       WHERE id = $1 AND salon_id = $2 AND email_normalized = $3 FOR UPDATE`,
      [current.active_code_id, salonId, address],
    )
    const challenge = codes.rows[0]
    if (!challenge) return invalid()
    const exhausted = () => ({ error: new ApiError(429, 'Too many incorrect verification codes. Request a new code.') })
    if (challenge.attempts >= MAX_ATTEMPTS) return exhausted()
    if (!challenge.sent_at || challenge.consumed_at || !challenge.unexpired || !challenge.code_hash || !challenge.code_salt) return invalid()

    const attempts = challenge.attempts + 1
    await client.query('UPDATE public_booking_email_codes SET attempts = $2 WHERE id = $1', [challenge.id, attempts])
    const candidate = typeof code === 'string' ? code.trim() : ''
    const hash = /^\d{6}$/.test(candidate) ? await digestCode(salonId, address, candidate, challenge.code_salt) : null
    const expected = Buffer.from(challenge.code_hash, 'hex')
    const matches = hash !== null && hash.length === expected.length && timingSafeEqual(hash, expected)
    if (!matches) {
      if (attempts >= MAX_ATTEMPTS) {
        await client.query(
          'UPDATE public_booking_email_codes SET consumed_at = clock_timestamp(), code_hash = NULL, code_salt = NULL WHERE id = $1',
          [challenge.id],
        )
      }
      return attempts >= MAX_ATTEMPTS ? exhausted() : invalid()
    }
    await client.query(
      'UPDATE public_booking_email_codes SET consumed_at = clock_timestamp(), code_hash = NULL, code_salt = NULL WHERE id = $1',
      [challenge.id],
    )
    await client.query(
      `UPDATE public_booking_email_verifications
       SET verified_at = clock_timestamp(), active_code_id = NULL, updated_at = clock_timestamp()
       WHERE salon_id = $1 AND email_normalized = $2`,
      [salonId, address],
    )
    return { verified: true }
  })
  // Throw only AFTER the transaction commits: failed attempts must survive.
  if ('error' in outcome) throw outcome.error
  return outcome
}
