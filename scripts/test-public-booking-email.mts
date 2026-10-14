#!/usr/bin/env -S npx tsx
// No real database, SMTP connection, external requests, or environment secrets.
// SQL double serializes transactions and restores snapshots on rollback, so an
// attempt update followed by a thrown/rolled-back error will fail these tests.
import assert from 'node:assert/strict'
process.env.DOTENV_CONFIG_PATH = '/dev/null'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/not-used'
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = 'smtp.local.invalid'
process.env.SMTP_PORT = '2525'
process.env.SMTP_USER = 'local-test'
process.env.SMTP_PASS = 'local-test'
process.env.SMTP_FROM = 'verification@glamhour.test'
globalThis.fetch = async () => { throw new Error('Unexpected external request') }
const { pool } = await import('../server/db.ts')
const { config } = await import('../server/config.ts')
const { default: nodemailer } = await import('nodemailer')

type Identity = { salon_id: string; email_normalized: string; verified_at: string | null; active_code_id: string | null }
type Challenge = {
  id: string; salon_id: string; email_normalized: string; code_hash: string | null; code_salt: string | null
  expires_at: number; requested_at: number; sent_at: string | null; failed_at: string | null; consumed_at: string | null; attempts: number
}
type Mail = { to: string; subject: string; html: string; text: string }
let identities = new Map<string, Identity>()
let codes = new Map<string, Challenge>()
let now = Date.UTC(2026, 9, 14, 12)
const queryLog: { sql: string; values: readonly unknown[] }[] = []
const delivered: { mail: Mail; code: string }[] = []
let mode: 'accept' | 'reject' | 'empty' | 'throw' = 'accept'
let pendingMail: { started: () => void; wait: Promise<void> } | undefined
const key = (salon: unknown, email: unknown) => `${salon}|${email}`
const timestamp = () => new Date(now).toISOString()
const advance = (seconds: number) => { now += seconds * 1000 }

// A mutex models the locking contract. SQL assertions below additionally check
// the actual production reservation and verification paths take FOR UPDATE locks.
let lockTail = Promise.resolve()
async function acquire() {
  let release!: () => void
  const previous = lockTail
  lockTail = new Promise<void>((resolve) => { release = resolve })
  await previous
  return release
}
function execute(sql: string, values: readonly unknown[] = []) {
  queryLog.push({ sql, values })
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] }
  if (sql.includes('SELECT id FROM salons')) {
    assert.match(sql, /FOR UPDATE/, 'salon quotas serialize across different recipient addresses')
    return { rows: values[0] === 'missing-salon' ? [] : [{ id: values[0] }] }
  }
  if (sql.includes('INSERT INTO public_booking_email_verifications')) {
    assert.match(sql, /ON CONFLICT \(salon_id, email_normalized\) DO NOTHING/)
    const id = key(values[0], values[1])
    if (!identities.has(id)) identities.set(id, { salon_id: String(values[0]), email_normalized: String(values[1]), verified_at: null, active_code_id: null })
    return { rows: [] }
  }
  if (sql.includes('SELECT verified_at') && sql.includes('FROM public_booking_email_verifications')) {
    if (sql.includes('active_code_id')) assert.match(sql, /FOR UPDATE/, 'verification and resend serialize on the same address')
    const row = identities.get(key(values[0], values[1]))
    return { rows: row ? [{ ...row }] : [] }
  }
  if (sql.includes('AS email_count')) {
    const recent = [...codes.values()].filter((row) => row.salon_id === values[0] && row.requested_at > now - 3600_000)
    const addressed = recent.filter((row) => row.email_normalized === values[1])
    const min = (rows: Challenge[]) => rows.length ? Math.min(...rows.map((row) => row.requested_at)) : 0
    const max = (rows: Challenge[]) => rows.length ? Math.max(...rows.map((row) => row.requested_at)) : 0
    return { rows: [{
      email_count: addressed.length, salon_count: recent.length,
      resend_after_seconds: addressed.length ? Math.ceil((max(addressed) + 60_000 - now) / 1000) : 0,
      email_retry_after_seconds: addressed.length ? Math.ceil((min(addressed) + 3600_000 - now) / 1000) : 0,
      salon_retry_after_seconds: recent.length ? Math.ceil((min(recent) + 3600_000 - now) / 1000) : 0,
    }] }
  }
  if (sql.includes('INSERT INTO public_booking_email_codes')) {
    assert.match(String(values[3]), /^[a-f0-9]{128}$/)
    assert.match(String(values[4]), /^[a-f0-9]{64}$/)
    assert.equal(values[5], 600, 'challenge expiry is ten minutes')
    codes.set(String(values[0]), { id: String(values[0]), salon_id: String(values[1]), email_normalized: String(values[2]), code_hash: String(values[3]), code_salt: String(values[4]), expires_at: now + Number(values[5]) * 1000, requested_at: now, sent_at: null, failed_at: null, consumed_at: null, attempts: 0 })
    return { rows: [] }
  }
  if (sql.includes('UPDATE public_booking_email_verifications')) {
    const row = identities.get(key(values[0], values[1]))!
    if (sql.includes('SET verified_at')) { row.verified_at = timestamp(); row.active_code_id = null }
    else row.active_code_id = String(values[2])
    return { rows: [] }
  }
  if (sql.includes('SELECT id, code_hash')) {
    assert.match(sql, /FOR UPDATE/)
    const row = codes.get(String(values[0]))
    return { rows: row && row.salon_id === values[1] && row.email_normalized === values[2] ? [{ ...row, unexpired: row.expires_at > now }] : [] }
  }
  if (sql.includes('UPDATE public_booking_email_codes')) {
    if (sql.includes('WHERE salon_id = $1')) {
      for (const row of codes.values()) if (row.salon_id === values[0] && row.email_normalized === values[1] && !row.consumed_at) { row.consumed_at = timestamp(); row.code_hash = row.code_salt = null }
      return { rows: [] }
    }
    const row = codes.get(String(values[0]))!
    if (sql.includes('SET sent_at')) {
      assert.match(sql, /consumed_at IS NULL AND failed_at IS NULL AND expires_at > clock_timestamp\(\)/)
      if (row.consumed_at || row.failed_at || row.expires_at <= now) return { rows: [] }
      row.sent_at = timestamp()
      return { rows: [{ expires_in_seconds: Math.ceil((row.expires_at - now) / 1000) }] }
    }
    if (sql.includes('SET attempts')) { row.attempts = Number(values[1]); return { rows: [] } }
    if (sql.includes('SET failed_at')) { assert.equal(row.sent_at, null); row.failed_at = timestamp() }
    row.consumed_at = timestamp()
    row.code_hash = row.code_salt = null
    return { rows: [] }
  }
  throw new Error(`Unexpected mocked SQL: ${sql}`)
}
Object.defineProperty(pool, 'query', { value: async (sql: string, values?: readonly unknown[]) => {
  const release = await acquire()
  try { return execute(sql, values) } finally { release() }
} })
Object.defineProperty(pool, 'connect', { value: async () => {
  let release: (() => void) | undefined
  let snapshot: { identities: typeof identities; codes: typeof codes } | undefined
  return {
    query: async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'BEGIN') { release = await acquire(); snapshot = structuredClone({ identities, codes }) }
      const result = execute(sql, values)
      if (sql === 'ROLLBACK' && snapshot) { identities = snapshot.identities; codes = snapshot.codes }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') { snapshot = undefined; release?.(); release = undefined }
      return result
    },
    release() { release?.(); release = undefined },
  }
} })
Object.defineProperty(nodemailer, 'createTransport', { value: () => ({
  sendMail: async (mail: Mail) => {
    const code = /\b(\d{6})\b/.exec(mail.text)?.[1]
    assert.ok(code, 'mail contains a six-digit code')
    delivered.push({ mail, code })
    if (pendingMail) { const pending = pendingMail; pendingMail = undefined; pending.started(); await pending.wait }
    if (mode === 'throw') throw new Error(`SMTP rejected secret code ${code}`)
    if (mode === 'reject') return { accepted: [], rejected: [mail.to] }
    if (mode === 'empty') return { accepted: [], rejected: [] }
    return { accepted: [mail.to], rejected: [], messageId: 'local-only' }
  },
}) })
const { getPublicBookingEmailStatus, requestPublicBookingEmailCode, verifyPublicBookingEmailCode, assertPublicBookingEmailVerified } = await import('../server/services/public-booking-email-service.ts')
const salonA = '10000000-0000-4000-8000-000000000001'
const salonB = '10000000-0000-4000-8000-000000000002'
const email = 'customer@validmail.org'
const lastCode = () => delivered.at(-1)!.code
const active = (salon: string, address: string) => codes.get(identities.get(key(salon, address))!.active_code_id!)!
const wrong = (code: string) => ((Number(code) + 1) % 1_000_000).toString().padStart(6, '0')
const rejects = async (promise: Promise<unknown>, status: number) => assert.rejects(promise, (error: unknown) => error instanceof Error && 'status' in error && error.status === status)
const request = (address: string, salon = salonA) => requestPublicBookingEmailCode(salon, address, '<img src=x onerror="alert(1)"> & Salon')

try {
  assert.deepEqual(await getPublicBookingEmailStatus(salonA, email), { verified: false })
  await rejects(assertPublicBookingEmailVerified(salonA, email), 403)
  const start = await request(`  ${email.toUpperCase()} `)
  assert.deepEqual(start, { verified: false, expiresInSeconds: 600, resendAfterSeconds: 60 })
  const code = lastCode()
  assert.equal(delivered.at(-1)!.mail.to, email)
  assert.ok(delivered.at(-1)!.mail.html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Salon'))
  assert.ok(!delivered.at(-1)!.mail.html.includes('<img'))
  assert.deepEqual(await getPublicBookingEmailStatus(salonA, email), { verified: false }, 'sending does not verify the address')
  assert.ok(!queryLog.some(({ values }) => values.some((value) => value === code)), 'plaintext OTP is never a SQL parameter')
  await rejects(request(email), 429)
  assert.equal(delivered.length, 1)
  await rejects(verifyPublicBookingEmailCode(salonA, email, wrong(code)), 400)
  assert.equal(active(salonA, email).attempts, 1, 'wrong attempt is committed despite API error')
  await rejects(verifyPublicBookingEmailCode(salonA, email, 'bad'), 400)
  assert.equal(active(salonA, email).attempts, 2, 'malformed attempt is also committed')
  assert.deepEqual(await verifyPublicBookingEmailCode(salonA, ` ${email.toUpperCase()} `, code), { verified: true })
  const saved = [...codes.values()][0]
  assert.equal(saved.attempts, 3)
  assert.ok(saved.consumed_at)
  assert.equal(saved.code_hash, null)
  await rejects(verifyPublicBookingEmailCode(salonA, email, code), 400)
  await assertPublicBookingEmailVerified(salonA, email, pool)
  advance(2 * 365 * 86400)
  assert.deepEqual(await request(email), { verified: true }, 'verification has no TTL and requests never resend')
  assert.deepEqual(await getPublicBookingEmailStatus(salonA, email), { verified: true })
  assert.equal(delivered.length, 1)
  console.log('PASS normalized address, salted hash-only storage, escaped mail, committed attempts, consumed-code replay, permanent verification/no resend')

  assert.deepEqual(await getPublicBookingEmailStatus(salonB, email), { verified: false })
  await rejects(verifyPublicBookingEmailCode(salonB, email, code), 400)
  await rejects(assertPublicBookingEmailVerified(salonB, email), 403)
  await rejects(assertPublicBookingEmailVerified(salonA, 'changed@validmail.org'), 403)
  assert.deepEqual(await getPublicBookingEmailStatus(salonA, email), { verified: true }, 'changing a client email cannot transfer or revoke verification of the original address')
  console.log('PASS verification is isolated by salon and normalized address, including a changed client email')

  const resendEmail = 'resend@validmail.org'
  await request(resendEmail)
  const previousCode = lastCode()
  const previous = active(salonA, resendEmail)
  const previousSalt = previous.code_salt
  advance(60)
  await request(resendEmail)
  const replacementCode = lastCode()
  assert.ok(previous.consumed_at)
  assert.equal(previous.code_hash, null)
  assert.notEqual(active(salonA, resendEmail).code_salt, previousSalt)
  // A random numerical collision means the same digits belong to the NEW code;
  // the old challenge is still consumed and its hash removed in either case.
  await rejects(verifyPublicBookingEmailCode(salonA, resendEmail, previousCode === replacementCode ? wrong(previousCode) : previousCode), 400)
  await verifyPublicBookingEmailCode(salonA, resendEmail, replacementCode)
  const expiryEmail = 'expired@validmail.org'
  await request(expiryEmail)
  const expiresCode = lastCode()
  advance(600)
  await rejects(verifyPublicBookingEmailCode(salonA, expiryEmail, expiresCode), 400)
  await rejects(assertPublicBookingEmailVerified(salonA, expiryEmail), 403)
  console.log('PASS resend consumes the preceding challenge, uses a fresh salt, and ten-minute expiry is enforced')

  const locked = 'attempts@validmail.org'
  await request(locked)
  const lockedCode = lastCode()
  for (let i = 1; i <= 5; i += 1) {
    await rejects(verifyPublicBookingEmailCode(salonA, locked, wrong(lockedCode)), i === 5 ? 429 : 400)
    assert.equal(active(salonA, locked).attempts, i)
  }
  await rejects(verifyPublicBookingEmailCode(salonA, locked, lockedCode), 429)
  assert.ok(active(salonA, locked).consumed_at)
  await rejects(assertPublicBookingEmailVerified(salonA, locked), 403)
  console.log('PASS five-attempt limit persists through failures and rejects the correct code after exhaustion')

  const limited = 'limit@validmail.org'
  for (let i = 0; i < 5; i += 1) { await request(limited); advance(60) }
  await rejects(request(limited), 429)
  advance(3600)
  await request(limited)
  const quotaSalon = '10000000-0000-4000-8000-000000000099'
  for (let i = 0; i < 99; i += 1) {
    const address = `history${i}@validmail.org`
    const id = `history-${i}`
    identities.set(key(quotaSalon, address), { salon_id: quotaSalon, email_normalized: address, verified_at: null, active_code_id: null })
    codes.set(id, { id, salon_id: quotaSalon, email_normalized: address, code_hash: null, code_salt: null, expires_at: now, requested_at: now, sent_at: timestamp(), failed_at: null, consumed_at: timestamp(), attempts: 0 })
  }
  const quotaRace = await Promise.allSettled([
    request('last-slot@validmail.org', quotaSalon), request('other-last-slot@validmail.org', quotaSalon),
  ])
  assert.equal(quotaRace.filter((result) => result.status === 'fulfilled').length, 1, 'different addresses cannot race past the salon send quota')
  await rejects(request('new-address@validmail.org', quotaSalon), 429)
  console.log('PASS sixty-second cooldown, five sends/hour per address, and hundred sends/hour per salon')

  for (const failure of ['reject', 'empty', 'throw', 'unconfigured'] as const) {
    const address = `${failure}@validmail.org`
    mode = failure === 'unconfigured' ? 'accept' : failure
    const smtpHost = config.SMTP_HOST
    if (failure === 'unconfigured') config.SMTP_HOST = undefined
    try {
      await assert.rejects(request(address), (error: unknown) => {
        assert.ok(error instanceof Error && 'status' in error && error.status === 503)
        assert.deepEqual((error as Error & { details: unknown }).details, { resendAfterSeconds: 60 })
        return true
      })
    } finally { config.SMTP_HOST = smtpHost }
    const challenge = active(salonA, address)
    assert.equal(challenge.sent_at, null)
    assert.ok(challenge.failed_at && challenge.consumed_at)
    assert.equal(challenge.code_hash, null)
    await rejects(verifyPublicBookingEmailCode(salonA, address, lastCode()), 400)
    await rejects(request(address), 429)
    assert.deepEqual(await getPublicBookingEmailStatus(salonA, address), { verified: false })
  }
  mode = 'accept'
  console.log('PASS SMTP rejection/empty acceptance/exception/missing configuration fail closed, invalidate codes, and retain rate limits in test mode')

  const pending = 'pending@validmail.org'
  let mailStarted!: () => void
  const started = new Promise<void>((resolve) => { mailStarted = resolve })
  let finishMail!: () => void
  pendingMail = { started: mailStarted, wait: new Promise<void>((resolve) => { finishMail = resolve }) }
  const pendingRequest = request(pending)
  await started
  const pendingCode = lastCode()
  assert.equal(active(salonA, pending).sent_at, null)
  await rejects(verifyPublicBookingEmailCode(salonA, pending, pendingCode), 400)
  finishMail()
  await pendingRequest
  await verifyPublicBookingEmailCode(salonA, pending, pendingCode)
  console.log('PASS a reserved code cannot verify before SMTP accepts the message')

  const concurrent = 'concurrent@validmail.org'
  const beforeConcurrent = delivered.length
  const requests = await Promise.allSettled([request(concurrent), request(concurrent)])
  assert.equal(requests.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(delivered.length, beforeConcurrent + 1)
  const concurrentCode = lastCode()
  const verifications = await Promise.allSettled([
    verifyPublicBookingEmailCode(salonA, concurrent, concurrentCode),
    verifyPublicBookingEmailCode(salonA, concurrent, concurrentCode),
  ])
  assert.equal(verifications.filter((result) => result.status === 'fulfilled').length, 1)
  assert.deepEqual(await getPublicBookingEmailStatus(salonA, concurrent), { verified: true })
  await rejects(request('not-sent@validmail.org', 'missing-salon'), 404)
  await rejects(getPublicBookingEmailStatus(salonA, 'invalid'), 400)
  console.log('PASS concurrent requests cannot duplicate delivery, concurrent verification cannot replay, and invalid inputs fail closed')
} finally {
  await pool.end()
}
