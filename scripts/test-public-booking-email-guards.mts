// No database, SMTP, or external network: exercise the actual booking mutations
// against a strict query double, including the final transactional email guard.
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

process.env.DATABASE_URL = 'postgresql://local-test:local-test@127.0.0.1:1/not-used'
process.env.DOTENV_CONFIG_PATH = '/dev/null'
globalThis.fetch = async () => { throw new Error('Network is forbidden in booking email guard checks') }
const { pool } = await import('../server/db.ts')
const { dataService } = await import('../server/services/data-service.ts')
const { ApiError } = await import('../server/errors.ts')
const { createAppointmentSchema, publicBookingEmailRequestSchema, publicBookingEmailVerifySchema, publicFindOrCreateClientSchema } = await import('../server/validation.ts')

const salonId = '10000000-0000-4000-8000-000000000001'
const otherSalonId = '10000000-0000-4000-8000-000000000002'
const clientId = '20000000-0000-4000-8000-000000000001'
const serviceId = '30000000-0000-4000-8000-000000000001'
const appointmentId = '40000000-0000-4000-8000-000000000001'
const email = 'client@glamhour.test'
const client = { id: clientId, salon_id: salonId, full_name: 'Original Name', email, phone: '5551234567' }
const service = { id: serviceId, category_code: 'nails', name: 'Manicure', duration_minutes: 60, price_minor: 1000 }
let currentClientEmail: string | null = email
let contacts: Record<string, unknown>[] = [client]
let verified = true
let publicLinkEnabled = true
let queries: { sql: string; values: readonly unknown[]; transactional: boolean }[] = []

async function runQuery(sql: string, values: readonly unknown[] = [], transactional = false) {
  queries.push({ sql, values, transactional })
  const empty = { rows: [] }
  if (/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DO)\b/.test(sql)) return empty
  if (sql.includes('FROM public_booking_email_verifications')) {
    assert.equal(values[1], email, 'verification uses normalized email')
    return { rows: verified && values[0] === salonId ? [{ verified_at: new Date(), verified: true }] : [] }
  }
  if (sql.includes('SELECT c.email FROM clients c')) {
    assert.match(sql, /FOR SHARE OF c, s, ss/, 'client email and public link stay stable until commit')
    assert.equal(transactional, true)
    assert.match(sql, /s.booking_enabled/)
    assert.match(sql, /ss.allow_public_booking/)
    return { rows: publicLinkEnabled ? [{ email: currentClientEmail }] : [] }
  }
  if (sql.includes('SELECT * FROM clients')) return { rows: contacts }
  if (sql.includes('UPDATE clients')) return { rows: [{ ...contacts[0], email: values[2] }] }
  if (sql.includes('INSERT INTO clients')) return { rows: [{ ...client, email: values[2] }] }
  if (sql.includes('FROM salon_subscriptions')) return { rows: [{ status: 'active', plan_code: 'premium_monthly', provider: 'manual', entitlements_json: {} }] }
  if (sql.includes('SELECT count(*) FROM clients')) return { rows: [{ count: '1' }] }
  if (sql.includes('FROM services s')) return { rows: [service] }
  if (sql.includes('FROM appointments')) return empty
  if (sql.includes('INSERT INTO appointments')) return { rows: [{ id: appointmentId, status_code: 'scheduled' }] }
  if (sql.includes('INSERT INTO appointment_services')) return { rows: [{ id: 'local-appointment-service' }] }
  if (sql.includes('INSERT INTO appointment_status_history')) return empty
  throw new Error(`Unexpected SQL in email guard test: ${sql}`)
}
Object.defineProperty(pool, 'query', { configurable: true, value: (sql: string, values?: readonly unknown[]) => runQuery(sql, values) })
Object.defineProperty(pool, 'connect', { configurable: true, value: async () => ({ query: (sql: string, values?: readonly unknown[]) => runQuery(sql, values, true), release() {} }) })
const booking = { salonId, clientId, serviceIds: [serviceId], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z', source: 'public_booking' as const, publicBookingEmail: email }
const contact = { fullName: 'New Name', phone: '5551234567', email }
const noWrites = () => assert.ok(!queries.some(({ sql }) => /(?:INSERT INTO|UPDATE) (?:clients|appointments|professional_services)\b/.test(sql)), 'rejected identity must not mutate clients or bookings')
async function rejects(action: () => Promise<unknown>, status: number) {
  queries = []
  await assert.rejects(action, (error) => error instanceof ApiError && error.status === status)
  noWrites()
}

try {
  assert.equal(publicBookingEmailRequestSchema.parse({ email: `  ${email.toUpperCase()}  ` }).email, email)
  for (const invalid of ['', 'not-email', 'a@', 'a b@domain.com']) {
    assert.equal(publicBookingEmailRequestSchema.safeParse({ email: invalid }).success, false)
  }
  assert.equal(publicBookingEmailVerifySchema.safeParse({ email, code: '123456' }).success, true)
  for (const code of ['12345', '1234567', '12x456', 123456]) assert.equal(publicBookingEmailVerifySchema.safeParse({ email, code }).success, false)
  assert.equal(publicFindOrCreateClientSchema.safeParse({ ...contact, email: undefined }).success, false)
  assert.equal(createAppointmentSchema.safeParse({ ...booking, publicBookingEmail: undefined }).success, false)
  assert.equal(createAppointmentSchema.safeParse({ ...booking, source: 'internal', publicBookingEmail: undefined }).success, true)
  console.log('PASS schemas require a valid email and six-digit code; internal booking does not require public verification')

  verified = false
  await rejects(() => dataService.findOrCreatePublicBookingClient(salonId, contact), 403)
  await rejects(() => dataService.createAppointment(booking), 403)
  verified = true
  await rejects(() => dataService.createAppointment({ ...booking, publicBookingEmail: undefined }), 403)
  await rejects(() => dataService.createAppointment({ ...booking, salonId: otherSalonId }), 403)
  currentClientEmail = 'different@glamhour.test'
  await rejects(() => dataService.createAppointment(booking), 403)
  currentClientEmail = null
  await rejects(() => dataService.createAppointment(booking), 403)
  currentClientEmail = email
  publicLinkEnabled = false
  await rejects(() => dataService.createAppointment(booking), 403)
  publicLinkEnabled = true
  console.log('PASS direct public booking rejects missing, unverified, mismatched, changed and cross-salon emails before writes')

  contacts = [{ ...client, email: 'different@glamhour.test' }]
  await rejects(() => dataService.findOrCreatePublicBookingClient(salonId, contact), 409)
  contacts = [client, { ...client, id: 'other-client' }]
  await rejects(() => dataService.findOrCreatePublicBookingClient(salonId, contact), 409)
  console.log('PASS conflicting phone/email contact matches cannot overwrite another client')

  for (const priorEmail of [null, `  ${email.toUpperCase()}  `]) {
    contacts = [{ ...client, email: priorEmail }]
    const resolved = await dataService.findOrCreatePublicBookingClient(salonId, { ...contact, email: email.toUpperCase() })
    assert.equal(resolved.id, clientId)
    assert.equal(resolved.email, email)
    assert.equal(resolved.full_name, client.full_name, 'public contact lookup preserves existing client details')
  }
  contacts = []
  assert.equal((await dataService.findOrCreatePublicBookingClient(salonId, contact)).id, clientId)
  console.log('PASS verified contact reuse, empty legacy email, and new client creation')

  queries = []
  assert.equal((await dataService.createAppointment({ ...booking, publicBookingEmail: ` ${email.toUpperCase()} ` })).id, appointmentId)
  assert.ok(queries.some(({ sql, transactional }) => sql.includes('FROM public_booking_email_verifications') && transactional), 'final verification runs inside booking transaction')
  verified = false
  queries = []
  assert.equal((await dataService.createAppointment({ ...booking, source: 'internal', publicBookingEmail: undefined })).id, appointmentId)
  assert.ok(!queries.some(({ sql }) => sql.includes('FROM public_booking_email_verifications')), 'internal bookings retain current behavior')
  console.log('PASS verified public booking commits and internal salon booking remains independent')

  const { app } = await import('../server/app.ts')
  const originalPublicBooking = dataService.getPublicBooking
  let linkAvailable = true
  const slugs: string[] = []
  dataService.getPublicBooking = async (slug) => {
    slugs.push(slug)
    if (!linkAvailable) throw new ApiError(404, 'Online booking is not available for this salon.')
    return { salon: { id: salonId, name: 'Local salon' }, services: [], categories: [] } as Awaited<ReturnType<typeof originalPublicBooking>>
  }
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const post = (path: string, body: unknown) => new Promise<{ status: number; headers: Record<string, unknown>; body: { data?: Record<string, unknown> } }>((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: address.port, path: `/api/public-booking/local-salon/${path}`, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (response) => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: JSON.parse(data) }))
    })
    request.on('error', reject)
    request.end(JSON.stringify(body))
  })
  try {
    verified = false
    const status = await post('email-verification/status', { email: email.toUpperCase(), salonId: otherSalonId, verified: true })
    assert.equal(status.status, 200)
    assert.equal(status.headers['cache-control'], 'no-store')
    assert.deepEqual(status.body.data, { verified: false }, 'public input cannot mark an email verified or override the salon')
    assert.equal((await post('email-verification/request', { email: 'invalid' })).status, 400)
    assert.equal((await post('email-verification/verify', { email, code: '12345' })).status, 400)
    assert.equal((await post('clients/find-or-create', contact)).status, 403)
    verified = true
    const known = await post('email-verification/status', { email })
    assert.deepEqual(known.body.data, { verified: true })
    contacts = [client]
    const resolved = await post('clients/find-or-create', contact)
    assert.equal(resolved.status, 200)
    assert.deepEqual(resolved.body.data, { id: clientId }, 'public contact lookup returns no existing client PII')
    linkAvailable = false
    for (const action of ['status', 'request', 'verify']) {
      assert.equal((await post(`email-verification/${action}`, { email, code: '123456' })).status, 404, 'disabled booking link blocks verification endpoints')
    }
    assert.ok(slugs.length > 0 && slugs.every((slug) => slug === 'local-salon'))
    console.log('PASS HTTP routes validate input, resolve salon from slug, honor disabled links, and keep verification responses uncached')
  } finally {
    dataService.getPublicBooking = originalPublicBooking
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
} finally {
  await pool.end()
}
