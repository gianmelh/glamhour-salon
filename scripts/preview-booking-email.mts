// Render the actual templates without DB access. SMTP is used only when an
// explicit --send-to address is supplied, and only one TEST message is sent.
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import nodemailer from 'nodemailer'
import { renderAppointmentConfirmationEmail, renderBookingVerificationEmail } from '../server/email/templates.ts'

const { values } = parseArgs({ options: { 'send-to': { type: 'string' }, 'out-dir': { type: 'string' } } })
const recipient = values['send-to']?.trim()
if (values['send-to'] !== undefined && (!recipient || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient))) {
  throw new Error('Use --send-to with one email address.')
}
const output = resolve(values['out-dir'] ?? join(tmpdir(), 'glamhour-email-preview'))
const dateLabel = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Merida', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
}).format(new Date(Date.now() + 86_400_000))
const confirmation = renderAppointmentConfirmationEmail({
  clientName: 'Gianmel', salonName: 'Glamhour Studio', services: 'Lash lift & tint',
  dateLabel, timeLabel: '10:30 AM', professionalName: 'Demo specialist',
  location: 'Mérida, Yucatán', confirmationCode: 'DEMO26', testMode: true,
})
const verification = renderBookingVerificationEmail({ salonName: 'Glamhour Studio', code: '123456', testMode: true })
await mkdir(output, { recursive: true })
const offline = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
try {
  for (const [name, email] of [['confirmation', confirmation], ['verification', verification]] as const) {
    // Browser previews resolve the same CID attachments as data URLs. Real mail
    // keeps CID references and multipart/related PNG parts, never data URLs.
    let preview = email.html
    for (const attachment of email.attachments) {
      preview = preview.replaceAll(`cid:${attachment.cid}`, `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`)
    }
    await writeFile(join(output, `${name}.html`), preview)
    const mime = await offline.sendMail({ from: 'preview@glamhour.test', to: 'preview@example.invalid', ...email })
    await writeFile(join(output, `${name}.eml`), mime.message)
  }
} finally {
  offline.close()
}
console.log(`Email previews saved to ${output}`)

if (recipient) {
  const { config: c } = await import('../server/config.ts')
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].filter(key => !c[key as keyof typeof c])
  if (missing.length) {
    console.error(JSON.stringify({ status: 'not_sent', missing }))
    process.exitCode = 2
  } else {
    const smtp = nodemailer.createTransport({
      host: c.SMTP_HOST, port: c.SMTP_PORT, secure: c.SMTP_SECURE,
      auth: { user: c.SMTP_USER, pass: c.SMTP_PASS },
      connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000,
    })
    try {
      const result = await smtp.sendMail({ from: c.SMTP_FROM, to: recipient, ...confirmation })
      const accepted = Array.isArray(result.accepted) && result.accepted.length > 0 && !result.rejected?.length
      console.log(JSON.stringify({ status: accepted ? 'accepted' : 'rejected', recipient, messageId: result.messageId }))
      if (!accepted) process.exitCode = 2
    } catch (error) {
      const failure = error as { code?: string; responseCode?: number }
      console.error(JSON.stringify({ status: 'failed', code: failure.code, responseCode: failure.responseCode }))
      process.exitCode = 2
    } finally {
      smtp.close()
    }
  }
} else {
  console.log('No email sent. Add --send-to=address to send one marked TEST confirmation; no appointment is created.')
}
