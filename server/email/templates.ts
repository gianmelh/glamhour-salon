import { readFileSync } from 'node:fs'

const LOGO_CID = 'glamhour-mark@glamhourapp.com'
let logo: Buffer | undefined

export interface BrandedEmail {
  subject: string
  text: string
  html: string
  attachments: {
    filename: string
    content: Buffer
    contentType: 'image/png'
    contentDisposition: 'inline'
    cid: string
  }[]
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function frame(input: { subject: string; preheader: string; text: string; content: string; testMode?: boolean }): BrandedEmail {
  const notice = 'TEST EMAIL — No appointment has been created and this code is not valid.'
  return {
    subject: `${input.testMode ? '[TEST] ' : ''}${input.subject}`,
    text: `${input.testMode ? `${notice}\n\n` : ''}${input.text}\n\nGlamhour`,
    // Local PNG embedded in the message: no external image host or SVG support
    // required. All essential information also remains readable without images.
    attachments: [{
      filename: 'glamhour-mark.png',
      content: logo ??= readFileSync(new URL('../assets/glamhour-mark.png', import.meta.url)),
      contentType: 'image/png',
      contentDisposition: 'inline',
      cid: LOGO_CID,
    }],
    html: `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.subject)}</title>
<style>
  @media only screen and (max-width: 600px) {
    .email-outer { padding: 16px 10px !important; }
    .email-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .email-title { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f4f1f8;color:#241b36;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#f4f1f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.testMode ? notice : input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1f8;">
<tr><td align="center" class="email-outer" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate;border-spacing:0;">
${input.testMode ? `<tr><td style="padding:0 8px 16px;text-align:center;font-size:12px;line-height:18px;color:#705b86;">${notice}</td></tr>` : ''}
<tr><td style="background-color:#ffffff;border:1px solid #e8e1ef;border-radius:24px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
<tr><td class="email-pad" style="padding:30px 40px 26px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="48" style="width:48px;vertical-align:middle;"><img src="cid:${LOGO_CID}" width="48" height="46" alt="" style="display:block;width:48px;height:46px;border:0;"></td>
    <td style="padding-left:12px;vertical-align:middle;font-size:27px;line-height:32px;font-weight:700;letter-spacing:-1px;color:#35224f;">Glamhour</td>
  </tr></table>
</td></tr>
${input.content}
</table>
</td></tr>
<tr><td style="padding:24px 20px 8px;text-align:center;font-size:12px;line-height:20px;color:#82758f;">Sent with care by <strong style="color:#675278;">Glamhour</strong></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`,
  }
}

function detailRow(label: string, value: string) {
  return `<tr><td style="padding:16px 0;border-bottom:1px solid #eee9f3;">
    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1px;color:#887993;">${label}</p>
    <p style="margin:0;font-size:16px;line-height:24px;color:#35224f;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value)}</p>
  </td></tr>`
}

function codePanel(code: string, label: string, hint: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f1ff;border:1px solid #e5d8fa;border-radius:16px;">
  <tr><td style="padding:24px 12px;text-align:center;">
    <p style="margin:0 0 10px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#806599;">${label}</p>
    <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:4px;color:#7036c6;">${escapeHtml(code)}</p>
    <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#7a668e;">${hint}</p>
  </td></tr></table>`
}

export interface AppointmentEmailInput {
  clientName: string
  salonName: string
  services: string
  dateLabel: string
  timeLabel: string
  professionalName: string
  location?: string
  confirmationCode: string
  testMode?: boolean
}

export function renderAppointmentConfirmationEmail(input: AppointmentEmailInput): BrandedEmail {
  const salon = escapeHtml(input.salonName)
  return frame({
    subject: `${input.salonName}: appointment confirmed`,
    preheader: `${input.services} at ${input.salonName} — ${input.dateLabel}, ${input.timeLabel}. Confirmation ${input.confirmationCode}.`,
    testMode: input.testMode,
    text: `Hi ${input.clientName},\n\nYour appointment at ${input.salonName} is confirmed.\n\nService: ${input.services}\nDate: ${input.dateLabel}\nTime: ${input.timeLabel}\nSpecialist: ${input.professionalName}${input.location ? `\nLocation: ${input.location}` : ''}\nConfirmation: ${input.confirmationCode}\n\nPlease keep this email for your records. If you need to make a change, contact your salon directly.`,
    content: `<tr><td class="email-pad" style="padding:32px 40px;background-color:#f2ecfc;">
  <p style="margin:0 0 14px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;color:#7044a6;">APPOINTMENT CONFIRMED</p>
  <h1 class="email-title" style="margin:0;font-size:36px;line-height:42px;font-weight:700;letter-spacing:-1.2px;color:#35224f;">You're all booked.</h1>
  <p style="margin:16px 0 0;font-size:15px;line-height:24px;color:#766586;overflow-wrap:anywhere;word-break:break-word;">Hi ${escapeHtml(input.clientName)}, your appointment at <strong style="color:#51356e;">${salon}</strong> is confirmed. We look forward to seeing you.</p>
</td></tr>
<tr><td class="email-pad" style="padding:30px 40px 0;">
  <p style="margin:0 0 8px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;color:#887993;">YOUR SERVICE</p>
  <h2 style="margin:0 0 10px;font-size:22px;line-height:30px;font-weight:700;color:#35224f;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.services)}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
    ${detailRow('DATE', input.dateLabel)}
    ${detailRow('TIME', input.timeLabel)}
    ${detailRow('SPECIALIST', input.professionalName)}
    ${input.location ? detailRow('LOCATION', input.location) : ''}
  </table>
</td></tr>
<tr><td class="email-pad" style="padding:28px 40px;">${codePanel(input.confirmationCode, 'YOUR CONFIRMATION CODE', 'Keep this code handy for your appointment.')}</td></tr>
<tr><td class="email-pad" style="padding:0 40px 32px;">
  <p style="margin:0;font-size:13px;line-height:21px;color:#887993;">Need to make a change? Contact your salon directly.</p>
</td></tr>`,
  })
}

export function renderBookingVerificationEmail(input: { salonName: string; code: string; testMode?: boolean }): BrandedEmail {
  return frame({
    subject: 'Your Glamhour booking verification code',
    preheader: `Verify your email to continue booking with ${input.salonName}. Your code expires in 10 minutes.`,
    testMode: input.testMode,
    text: `Your verification code for ${input.salonName} is ${input.code}.\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`,
    content: `<tr><td class="email-pad" style="padding:32px 40px;background-color:#f2ecfc;">
  <p style="margin:0 0 14px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;color:#7044a6;">ONE QUICK STEP</p>
  <h1 class="email-title" style="margin:0;font-size:36px;line-height:42px;font-weight:700;letter-spacing:-1.2px;color:#35224f;">Verify your email.</h1>
  <p style="margin:16px 0 0;font-size:15px;line-height:24px;color:#766586;overflow-wrap:anywhere;word-break:break-word;">Use the code below to continue your booking with <strong style="color:#51356e;">${escapeHtml(input.salonName)}</strong>.</p>
</td></tr>
<tr><td class="email-pad" style="padding:32px 40px;">${codePanel(input.code, 'YOUR VERIFICATION CODE', 'This code expires in 10 minutes.')}</td></tr>
<tr><td class="email-pad" style="padding:0 40px 32px;">
  <p style="margin:0;font-size:13px;line-height:21px;color:#887993;">If you didn't request this code, you can safely ignore this email.</p>
</td></tr>`,
  })
}
