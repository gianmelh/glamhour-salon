// Exercise the real appointment route and confirmation mail function. Booking
// storage, PostgreSQL and SMTP are doubles; no sockets, live DB, or mail are used.
import assert from 'node:assert/strict'
import type { RequestHandler } from 'express'

process.env.DOTENV_CONFIG_PATH = '/dev/null'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/not-used'
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = 'smtp.local.invalid'
process.env.SMTP_PORT = '2525'
process.env.SMTP_USER = 'local-test'
process.env.SMTP_PASS = 'local-test'
process.env.SMTP_FROM = 'appointments@glamhour.test'
globalThis.fetch = async () => { throw new Error('Unexpected external request') }

const { pool } = await import('../server/db.ts')
const { config } = await import('../server/config.ts')
const { default: nodemailer } = await import('nodemailer')
const { dataService } = await import('../server/services/data-service.ts')
const { sendAppointmentConfirmationEmail } = await import('../server/services/email-service.ts')
const { renderAppointmentConfirmationEmail, renderBookingVerificationEmail } = await import('../server/email/templates.ts')
const { apiRouter } = await import('../server/routes.ts')

const salonId = '10000000-0000-4000-8000-000000000001'
const clientId = '20000000-0000-4000-8000-000000000001'
const serviceId = '30000000-0000-4000-8000-000000000001'
const appointmentId = 'abcdef12-3456-4000-8000-000000000001'
const recipient = 'booking-client@glamhour.app'
const appointment = { id: appointmentId, salon_id: salonId, client_id: clientId, source: 'public_booking' }
const baselineRow = {
  appointment_id: appointmentId, salon_id: salonId, client_id: clientId,
  recipient, client_name: 'Client <test>', salon_name: 'Salon & Test',
  timezone: 'America/New_York', city: 'New York', region: 'NY',
  starts_at: '2030-01-01T15:00:00.000Z', professional_name: 'Artist <test>',
  service_names: ['Lash & lift', 'Brows <care>'],
}
type Mail = {
  to: string; subject: string; html: string; text: string
  attachments?: { filename: string; content: Buffer; contentType: string; contentDisposition: string; cid: string }[]
}
type EmailResult = { status: 'sent' | 'failed' | 'not_sent'; reason?: string }
type ResponseBody = { data: typeof appointment & { confirmation_email?: EmailResult } }
let row: (Omit<typeof baselineRow, 'recipient'> & { recipient: string | null }) | undefined
let mailMode: 'accept' | 'reject' | 'empty' | 'throw' = 'accept'
let queryError = false
let notificationError = false
let bookingWrites = 0
let sent: Mail[] = []
let notificationAttempts: string[] = []
let notifications: { status: string; metadata: Record<string, unknown>; sentAtSql: string }[] = []
let warnings: unknown[][] = []
let mailGate: { start: () => void; wait: Promise<void> } | undefined
const originalCreate = dataService.createAppointment
const originalTransport = nodemailer.createTransport
const originalWarn = console.warn

Object.defineProperty(pool, 'query', { configurable: true, value: async (input: string | { text: string; values?: unknown[]; query_timeout?: number }, params: readonly unknown[] = []) => {
  const sql = typeof input === 'string' ? input : input.text
  const values = typeof input === 'string' ? params : input.values ?? []
  assert.equal(typeof input === 'string' ? undefined : input.query_timeout, 5_000, 'auxiliary email queries have a bounded response wait')
  if (sql.includes('FROM appointments a')) {
    assert.deepEqual(values, [salonId, appointmentId])
    if (queryError) throw new Error('Simulated confirmation SELECT failure')
    return { rows: row ? [{ ...row }] : [] }
  }
  if (sql.includes('INSERT INTO notifications')) {
    notificationAttempts.push(String(values[6]))
    if (notificationError) throw new Error('Simulated notification INSERT failure')
    notifications.push({ status: String(values[6]), metadata: JSON.parse(String(values[8])), sentAtSql: sql })
    return { rows: [] }
  }
  throw new Error(`Unexpected query: ${sql}`)
} })
Object.defineProperty(pool, 'connect', { configurable: true, value: async () => { throw new Error('Unexpected real database connection') } })
nodemailer.createTransport = (() => ({
  sendMail: async (mail: Mail) => {
    sent.push(mail)
    if (mailGate) { const gate = mailGate; gate.start(); await gate.wait }
    if (mailMode === 'throw') throw new Error('Simulated SMTP failure')
    return { messageId: 'local-message-id', accepted: mailMode === 'accept' ? [recipient] : [], rejected: mailMode === 'reject' ? [recipient] : [] }
  },
})) as typeof nodemailer.createTransport
dataService.createAppointment = async (input) => {
  bookingWrites += 1
  assert.equal(input.source, 'public_booking')
  assert.equal(input.salonId, salonId)
  return { ...appointment } as Awaited<ReturnType<typeof originalCreate>>
}
console.warn = (...args: unknown[]) => { warnings.push(args) }

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] } }
const layer = (apiRouter.stack as Layer[]).find((candidate) => candidate.route?.path === '/salons/:salonId/appointments' && candidate.route.methods.post)
assert.ok(layer?.route, 'real appointment POST route exists')
const handler = layer.route.stack[0].handle
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
function invokeRoute() {
  let replied = false
  let status = 200
  let resolve!: (result: { status: number; body: ResponseBody }) => void
  let reject!: (error: unknown) => void
  const done = new Promise<{ status: number; body: ResponseBody }>((yes, no) => { resolve = yes; reject = no })
  const response = {
    status(value: number) { status = value; return this },
    json(body: ResponseBody) { replied = true; resolve({ status, body }); return this },
  }
  const request = { params: { salonId }, body: {
    clientId, serviceIds: [serviceId], source: 'public_booking', publicBookingEmail: recipient,
    startsAt: '2030-01-01T15:00:00Z', endsAt: '2030-01-01T16:00:00Z',
  } }
  handler(request as Parameters<RequestHandler>[0], response as unknown as Parameters<RequestHandler>[1], (error) => { if (error) reject(error) })
  return { done, replied: () => replied }
}
function reset() {
  row = { ...baselineRow }
  mailMode = 'accept'
  queryError = notificationError = false
  bookingWrites = 0
  sent = []; notifications = []; notificationAttempts = []; warnings = []; mailGate = undefined
  config.SMTP_HOST = 'smtp.local.invalid'
}
const tests: [string, () => Promise<void>][] = [
  ['confirmation contains the same code, salon-local time and escaped customer/service content', async () => {
    const result = await sendAppointmentConfirmationEmail(salonId, appointmentId) as EmailResult | undefined
    assert.equal(sent.length, 1)
    assert.equal(sent[0].to, recipient)
    assert.match(sent[0].text, /Confirmation: AABCDE/)
    assert.match(sent[0].text, /10:00 AM/)
    assert.match(sent[0].text, /Tuesday, January 1, 2030/)
    assert.match(sent[0].text, /Location: New York, NY/)
    assert.match(sent[0].text, /Specialist: Artist <test>/)
    assert.match(sent[0].html, /Client &lt;test&gt;/)
    assert.match(sent[0].html, /Salon &amp; Test/)
    assert.match(sent[0].html, /Lash &amp; lift, Brows &lt;care&gt;/)
    for (const essential of ['AABCDE', '10:00 AM', 'Tuesday, January 1, 2030', 'New York, NY', 'Artist &lt;test&gt;']) {
      assert.ok(sent[0].html.includes(essential), 'essential details remain text when email images are blocked')
    }
    assert.equal(notifications.at(-1)?.status, 'sent')
    assert.equal(result?.status, 'sent')
  }],
  ['confirmation embeds a real PNG with matching CID and produces valid inline-image MIME without external images', async () => {
    await sendAppointmentConfirmationEmail(salonId, appointmentId)
    const mail = sent[0]
    const imageSources = [...mail.html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1])
    assert.ok(imageSources.length > 0, 'the branded message includes a logo')
    assert.ok(imageSources.every((source) => source.startsWith('cid:')), 'email images do not depend on external hosts or data URLs')
    const attachments = mail.attachments ?? []
    for (const source of imageSources) {
      const matches = attachments.filter((attachment) => attachment.cid === source.slice(4))
      assert.equal(matches.length, 1, 'each HTML image resolves to exactly one attached CID')
      const logo = matches[0]
      assert.equal(logo.contentType, 'image/png')
      assert.equal(logo.contentDisposition, 'inline')
      assert.ok(Buffer.isBuffer(logo.content))
      assert.deepEqual(logo.content.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'the attachment contains PNG bytes, not an SVG renamed .png')
      assert.equal(logo.content.toString('ascii', 12, 16), 'IHDR')
      assert.ok(logo.content.readUInt32BE(16) > 0 && logo.content.readUInt32BE(20) > 0)
    }

    // Nodemailer's real stream transport serializes MIME locally; it cannot
    // connect to SMTP. This checks the message that a mail client would receive.
    const transport = originalTransport({ streamTransport: true, buffer: true, newline: 'unix' })
    const compiled = await transport.sendMail({ ...mail, from: 'test@glamhour.test' })
    const mime = Buffer.from(compiled.message).toString('utf8').replace(/\r\n/g, '\n')
    assert.match(mime, /Content-Type: multipart\/related;/i)
    assert.match(mime, /Content-Type: text\/plain;/i)
    assert.match(mime, /Content-Type: text\/html;/i)
    for (const logo of attachments) {
      const parts = mime.split(/\n--[^\n]+\n/).filter((part) => part.includes(`Content-ID: <${logo.cid}>`))
      assert.equal(parts.length, 1)
      const [headers, ...body] = parts[0].split('\n\n')
      assert.match(headers, /Content-Type: image\/png/i)
      assert.match(headers, /Content-Disposition: inline/i)
      assert.match(headers, /Content-Transfer-Encoding: base64/i)
      assert.deepEqual(Buffer.from(body.join('\n\n').trim(), 'base64'), logo.content, 'encoded image data survives MIME serialization intact')
    }
  }],
  ['all dynamic appointment fields and verification content remain escaped in HTML', async () => {
    const attack = '<img src=x onerror="boom">&\''
    const escaped = '&lt;img src=x onerror=&quot;boom&quot;&gt;&amp;&#39;'
    const fields = ['clientName', 'salonName', 'services', 'dateLabel', 'timeLabel', 'professionalName', 'location', 'confirmationCode'] as const
    const input = Object.fromEntries(fields.map((field) => [field, `${field} ${attack}`])) as Record<typeof fields[number], string>
    const mail = renderAppointmentConfirmationEmail(input)
    for (const field of fields) {
      assert.ok(mail.html.includes(`${field} ${escaped}`), `${field} is rendered safely`)
      assert.ok(mail.text.includes(input[field]), `${field} remains readable in plain text`)
    }
    assert.ok(!mail.html.includes(attack), 'untrusted input cannot add HTML images or event handlers')
    const verification = renderBookingVerificationEmail({ salonName: attack, code: attack })
    assert.ok(!verification.html.includes(attack))
    assert.ok(verification.html.includes(escaped))
    assert.equal(verification.attachments[0].cid, mail.attachments[0].cid)
    assert.deepEqual(verification.attachments[0].content, mail.attachments[0].content, 'verification and confirmation use the same bundled logo')
  }],
  ['manual preview test mode is visibly labeled while normal appointment and OTP messages are not', async () => {
    const appointmentInput = { clientName: 'Client', salonName: 'Salon', services: 'Service', dateLabel: 'Tuesday', timeLabel: '10:00 AM', professionalName: 'Artist', confirmationCode: 'ATEST' }
    for (const [production, preview] of [
      [renderAppointmentConfirmationEmail(appointmentInput), renderAppointmentConfirmationEmail({ ...appointmentInput, testMode: true })],
      [renderBookingVerificationEmail({ salonName: 'Salon', code: '123456' }), renderBookingVerificationEmail({ salonName: 'Salon', code: '123456', testMode: true })],
    ]) {
      assert.match(preview.subject, /^\[TEST\]/)
      assert.match(preview.text, /No appointment has been created/)
      assert.match(preview.html, /No appointment has been created/)
      assert.match(preview.text, /this code is not valid/)
      assert.doesNotMatch(production.subject, /^\[TEST\]/)
      assert.doesNotMatch(production.text, /No appointment has been created/)
    }
  }],
  ['public booking waits for SMTP outcome and returns the created appointment once', async () => {
    let started!: () => void; let release!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    mailGate = { start: started, wait: new Promise<void>((resolve) => { release = resolve }) }
    const request = invokeRoute()
    await startedPromise
    const respondedBeforeSmtp = request.replied()
    release()
    const response = await request.done
    await tick()
    assert.equal(respondedBeforeSmtp, false, '201 must not claim an email outcome while SMTP is still pending')
    assert.equal(response.status, 201)
    assert.equal(response.body.data.id, appointmentId)
    assert.equal(response.body.data.confirmation_email?.status, 'sent')
    assert.equal(bookingWrites, 1)
    assert.equal(sent.length, 1)
  }],
  ['SMTP rejection, zero accepted recipients and thrown errors remain successful bookings with failed email status', async () => {
    for (const mode of ['reject', 'empty', 'throw'] as const) {
      reset(); mailMode = mode
      const response = await invokeRoute().done
      await tick()
      assert.equal(response.status, 201)
      assert.equal(response.body.data.id, appointmentId)
      assert.equal(response.body.data.confirmation_email?.status, 'failed', mode)
      assert.equal(bookingWrites, 1)
      assert.equal(notifications.at(-1)?.status, 'failed')
      assert.ok(!notifications.some((entry) => entry.status === 'sent'))
    }
  }],
  ['missing SMTP configuration is disclosed and never claims a sent email', async () => {
    config.SMTP_HOST = undefined
    const response = await invokeRoute().done
    await tick()
    assert.equal(response.status, 201)
    assert.equal(response.body.data.confirmation_email?.status, 'not_sent')
    assert.equal(response.body.data.confirmation_email?.reason, 'smtp_not_configured')
    assert.equal(sent.length, 0)
    assert.equal(notifications.at(-1)?.status, 'canceled')
    assert.equal(bookingWrites, 1)
  }],
  ['undeliverable recipient is disclosed without attempting SMTP', async () => {
    row = { ...baselineRow, recipient: 'client@example.com' }
    const result = await sendAppointmentConfirmationEmail(salonId, appointmentId) as EmailResult | undefined
    assert.equal(result?.status, 'not_sent')
    assert.equal(result?.reason, 'test_email')
    assert.equal(sent.length, 0)
    assert.equal(notifications.at(-1)?.status, 'canceled')
  }],
  ['confirmation lookup failure cannot erase the successful booking or silently claim an email', async () => {
    queryError = true
    const response = await invokeRoute().done
    await tick()
    assert.equal(response.status, 201)
    assert.equal(response.body.data.id, appointmentId)
    assert.equal(response.body.data.confirmation_email?.status, 'failed')
    assert.equal(bookingWrites, 1)
    assert.equal(sent.length, 0)
  }],
  ['missing recipient records a skipped email while preserving the created appointment', async () => {
    row = { ...baselineRow, recipient: null }
    const response = await invokeRoute().done
    assert.equal(response.status, 201)
    assert.deepEqual(response.body.data.confirmation_email, { status: 'not_sent', reason: 'missing_email' })
    assert.equal(bookingWrites, 1)
    assert.equal(sent.length, 0)
    assert.equal(notifications.at(-1)?.status, 'canceled')
    assert.equal(notifications.at(-1)?.metadata.reason, 'missing_email')
  }],
  ['missing confirmation row is reported without another booking write or SMTP attempt', async () => {
    row = undefined
    const response = await invokeRoute().done
    assert.equal(response.status, 201)
    assert.deepEqual(response.body.data.confirmation_email, { status: 'failed', reason: 'appointment_not_found' })
    assert.equal(bookingWrites, 1)
    assert.equal(sent.length, 0)
    assert.equal(notifications.length, 0, 'cannot audit a missing appointment without its client and salon row')
  }],
  ['invalid timezone or timestamp is caught before SMTP and recorded without rejecting the saved booking', async () => {
    for (const malformed of [{ timezone: 'Not/A_Timezone' }, { starts_at: 'not-a-date' }]) {
      reset(); row = { ...baselineRow, ...malformed }
      const response = await invokeRoute().done
      assert.equal(response.status, 201)
      assert.deepEqual(response.body.data.confirmation_email, { status: 'failed', reason: 'email_dispatch_failed' })
      assert.equal(bookingWrites, 1)
      assert.equal(sent.length, 0)
      assert.equal(notifications.at(-1)?.status, 'failed')
      assert.ok(!JSON.stringify(warnings).includes(recipient), 'failure logs must not include recipient/message data')
    }
  }],
  ['a notification write failure after SMTP acceptance does not relabel delivery as failed or resend', async () => {
    notificationError = true
    const response = await invokeRoute().done
    await tick()
    assert.equal(response.status, 201)
    assert.equal(response.body.data.confirmation_email?.status, 'sent')
    assert.equal(bookingWrites, 1)
    assert.equal(sent.length, 1)
    assert.deepEqual(notificationAttempts, ['sent'], 'an accepted SMTP message must never be recorded as a send failure')
    assert.ok(warnings.length > 0, 'audit persistence failure remains observable')
  }],
]

let failures = 0
try {
  for (const [name, run] of tests) {
    reset()
    try { await run(); console.log(`PASS ${name}`) }
    catch (error) { failures += 1; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`) }
  }
} finally {
  dataService.createAppointment = originalCreate
  nodemailer.createTransport = originalTransport
  console.warn = originalWarn
  await pool.end()
}
if (failures) process.exitCode = 1
