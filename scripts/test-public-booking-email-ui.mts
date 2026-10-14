#!/usr/bin/env -S npx tsx
// Public email verification UI with local API fixtures; no database or mail server.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { fallbackCategories, fallbackSalon, fallbackServices } from '../src/data/fallback-data.ts'
import type { Appointment } from '../src/types/api.ts'

const apiPrefix = '/__public_email_ui_api__'
const verificationPath = `${apiPrefix}/public-booking/local-salon/email-verification`
const clientPath = `${apiPrefix}/public-booking/local-salon/clients/find-or-create`
const conflictMessage = 'This phone number belongs to a client with a different email. Use that email or contact the salon.'
type Body = Record<string, unknown>
type Call = { action: string; body: Body }
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
function delayed(response: Body) {
  return { release: deferred(), finished: deferred(), response }
}
type Fixture = {
  verified: Set<string>
  calls: Call[]
  clients: Body[]
  appointments: Body[]
  sendFailures: number
  contactConflict: boolean
  confirmationEmail?: Appointment['confirmation_email']
  delays: Map<string, ReturnType<typeof delayed>>
}
// Mount the real public page without compiling unrelated internal app screens.
const publicPageHtml = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicBookingPage } from '/src/pages/public/PublicBookingPage.tsx';
import '/src/index.css';
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, { initialEntries: ['/book/local-salon'] }, React.createElement(Routes, null, React.createElement(Route, { path: '/book/:salonSlug', element: React.createElement(PublicBookingPage) }))));
</script></body></html>`
const server = await createServer({
  logLevel: 'error', cacheDir: 'node_modules/.vite-public-email-ui',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiPrefix) },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'isolated-public-booking-page', configureServer(vite) {
    vite.middlewares.use('/book/local-salon', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, publicPageHtml)) }
      catch (error) { next(error) }
    })
  } }],
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

async function reachDetails(page: Page, origin: string) {
  await page.goto(`${origin}/book/local-salon`, { waitUntil: 'domcontentloaded' })
  await chooseDetails(page)
}
async function chooseDetails(page: Page) {
  await page.getByRole('button', { name: 'Nails', exact: false }).click()
  await page.getByRole('button', { name: '4:00 PM', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: /Local Specialist/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Full name', { exact: true }).fill('Local Client')
  await page.getByLabel('Phone', { exact: true }).fill('5551234567')
}
const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm appointment', exact: true })
const email = (page: Page) => page.getByLabel('Email', { exact: true })
async function waitUnverified(page: Page) {
  await page.getByRole('button', { name: 'Send code', exact: true }).and(page.locator(':enabled')).waitFor()
  assert.equal(await confirm(page).isDisabled(), true)
}
async function assertNoBooking(page: Page, state: Fixture) {
  assert.equal(await confirm(page).isDisabled(), true)
  await confirm(page).evaluate((button: HTMLButtonElement) => button.click())
  assert.deepEqual(state.clients, [], 'unverified email cannot create or match a client')
  assert.deepEqual(state.appointments, [], 'unverified email cannot create an appointment')
}
async function releaseDelayed(page: Page, gate: ReturnType<typeof delayed>) {
  gate.release.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([gate.finished.promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Delayed response was not consumed')), 6000)
    })])
  } finally { clearTimeout(timer) }
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  async function scenario(name: string, run: (page: Page, fixture: Fixture) => Promise<void>) {
    const state: Fixture = { verified: new Set(), calls: [], clients: [], appointments: [], sendFailures: 0, contactConflict: false, delays: new Map() }
    const context = await browser!.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'UTC', serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(60000)
    const errors: string[] = []
    const unexpected: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      if (url.origin !== origin || path.startsWith('/api/')) {
        unexpected.push(`${request.method()} ${url.href}`)
        return route.abort('blockedbyclient')
      }
      if (!path.startsWith(`${apiPrefix}/`)) return route.continue()
      const respond = (data: unknown) => route.fulfill({ json: { data } })
      const reject = (status: number, message: string, code = 'API_ERROR', details?: Body) => route.fulfill({ status, json: { error: { code, message, details } } })
      if (request.method() === 'GET') {
        if (path === `${apiPrefix}/public-booking/local-salon`) return respond({
          salon: { ...fallbackSalon, timezone: 'UTC', allow_public_booking: true },
          categories: [fallbackCategories[0]], services: [fallbackServices[0]],
        })
        if (path.endsWith('/providers/eligible')) return respond([{ id: 'local-provider', full_name: 'Local Specialist', languages: ['English'], durationMinutes: 60 }])
        if (path.endsWith('/availability')) {
          const date = url.searchParams.get('date')
          return respond({ slots: [{ time: '16:00', available: true, label: '4:00 PM', startsAt: `${date}T16:00:00Z`, endsAt: `${date}T17:00:00Z` }] })
        }
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Body
        const normalizedEmail = String(body.email ?? '').trim().toLowerCase()
        if (path.startsWith(`${verificationPath}/`)) {
          const action = path.slice(verificationPath.length + 1)
          state.calls.push({ action, body })
          assert.equal(body.email, normalizedEmail, 'verification uses a normalized email')
          const gate = state.delays.get(`${action}:${normalizedEmail}`)
          if (gate) {
            await gate.release.promise
            try { return await respond(gate.response) } finally { gate.finished.resolve() }
          }
          if (action === 'status') return respond({ verified: state.verified.has(normalizedEmail) })
          if (action === 'request') {
            if (state.sendFailures > 0) { state.sendFailures -= 1; return reject(503, 'Email delivery temporarily unavailable.', 'API_ERROR', { resendAfterSeconds: 1 }) }
            return respond(state.verified.has(normalizedEmail) ? { verified: true } : { verified: false, expiresInSeconds: 600, resendAfterSeconds: 2 })
          }
          if (action === 'verify') {
            if (body.code !== '123456') return reject(400, 'Invalid verification code. Please try again.')
            state.verified.add(normalizedEmail)
            return respond({ verified: true })
          }
        }
        if (path === clientPath) {
          state.clients.push(body)
          assert.ok(state.verified.has(normalizedEmail), 'client matching must only follow server-verified email')
          if (state.contactConflict) {
            state.contactConflict = false
            return reject(409, conflictMessage)
          }
          return respond({ id: 'local-client' })
        }
        if (path.endsWith('/appointments')) {
          state.appointments.push(body)
          assert.ok(state.verified.has(String(body.publicBookingEmail)), 'appointment payload carries the verified email')
          return respond({ id: 'abcde000-0000-0000-0000-000000000000', ...(state.confirmationEmail ? { confirmation_email: state.confirmationEmail } : {}) })
        }
      }
      unexpected.push(`${request.method()} ${path}`)
      return reject(500, 'Unexpected local regression request')
    })
    try {
      await run(page, state)
      assert.deepEqual(errors, [], 'no uncaught browser errors')
      assert.deepEqual(unexpected, [], 'no unmocked or external requests')
      console.log(`PASS ${name}`)
    } finally {
      for (const gate of state.delays.values()) gate.release.resolve()
      await context.close()
    }
  }

  await scenario('required email, delivery retry, resend cooldown, invalid code retry, and verified booking payload', async (page, state) => {
    await reachDetails(page, origin)
    await assertNoBooking(page, state)
    await email(page).fill('invalid@')
    await assertNoBooking(page, state)
    await email(page).fill(' NEW@Example.TEST ')
    await waitUnverified(page)
    assert.equal(state.calls.filter(call => call.action === 'request').length, 0, 'typing an email does not automatically send mail')
    await assertNoBooking(page, state)
    state.sendFailures = 1
    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    await page.getByText('Email delivery temporarily unavailable.', { exact: true }).waitFor()
    await assertNoBooking(page, state)
    assert.equal(await page.getByRole('button', { name: 'Send code', exact: true }).isDisabled(), true, 'delivery failure retains the server retry cooldown')
    await page.getByRole('button', { name: 'Send code', exact: true }).and(page.locator(':enabled')).waitFor()
    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    await page.getByLabel('Verification code', { exact: true }).waitFor()
    const resend = page.getByRole('button', { name: 'Resend code', exact: true })
    assert.equal(await resend.isDisabled(), true, 'server cooldown prevents an immediate resend')
    await resend.evaluate((button: HTMLButtonElement) => button.click())
    assert.equal(state.calls.filter(call => call.action === 'request').length, 2)
    await page.getByLabel('Verification code', { exact: true }).fill('12')
    await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
    await page.screenshot({ path: '/private/tmp/glamhour-pdf-review/public-email-verification.png', fullPage: true })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByLabel('Verification code', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Verification code', { exact: true }).inputValue(), '12', 'returning to Details retains the current verification challenge')
    assert.equal(state.calls.filter(call => call.action === 'request').length, 2, 'back navigation never sends another code')
    await resend.and(page.locator(':enabled')).waitFor()
    const resendResponse = page.waitForResponse(response => response.url().endsWith('/email-verification/request'))
    await resend.click()
    await resendResponse
    await resend.and(page.locator(':disabled')).waitFor()
    assert.equal(state.calls.filter(call => call.action === 'request').length, 3)
    await assertNoBooking(page, state)
    await page.getByLabel('Verification code', { exact: true }).fill('000000')
    await page.getByRole('button', { name: 'Verify email', exact: true }).click()
    await page.getByText('Invalid verification code. Please try again.', { exact: true }).waitFor()
    await assertNoBooking(page, state)
    await page.getByLabel('Verification code', { exact: true }).fill('123456')
    await page.getByRole('button', { name: 'Verify email', exact: true }).click()
    await page.getByText('Email verified.', { exact: true }).waitFor()
    assert.equal(await confirm(page).isEnabled(), true)
    await confirm(page).click()
    await page.getByRole('heading', { name: 'Booking Confirmed!', exact: true }).waitFor()
    assert.equal(state.clients.length, 1)
    assert.equal(state.clients[0].email, 'new@example.test')
    assert.equal(state.appointments.length, 1)
    assert.equal(state.appointments[0].publicBookingEmail, 'new@example.test')
    assert.equal(state.appointments[0].clientId, 'local-client')
    assert.ok(state.calls.filter(call => call.action === 'status').length >= 2, 'confirmation rechecks server verification')
  })

  await scenario('known email needs no new code, reload checks the server, and confirmation rechecks verification', async (page, state) => {
    state.verified.add('known@example.test')
    await reachDetails(page, origin)
    await email(page).fill('known@example.test')
    await page.getByText('Email verified.', { exact: true }).waitFor()
    assert.equal(await confirm(page).isEnabled(), true)
    assert.equal(await page.getByLabel('Verification code', { exact: true }).count(), 0)
    assert.equal(state.calls.some(call => call.action === 'request' || call.action === 'verify'), false)
    await page.reload({ waitUntil: 'domcontentloaded' })
    // The booking form restarts after reload; verification is looked up again on the server.
    await reachDetails(page, origin)
    await email(page).fill('known@example.test')
    await page.getByText('Email verified.', { exact: true }).waitFor()
    assert.equal(await confirm(page).isEnabled(), true)
    assert.equal(state.calls.filter(call => call.action === 'status').length, 2)
    assert.equal(state.calls.some(call => call.action !== 'status'), false)
    state.verified.delete('known@example.test')
    await confirm(page).click()
    await page.getByText('Verify your email before confirming your appointment.', { exact: true }).waitFor()
    await assertNoBooking(page, state)
    // Restore via another server status lookup, then verify that changing the input
    // immediately removes access even before the new email's debounce completes.
    state.verified.add('known@example.test')
    await email(page).fill('temporary@example.test')
    await email(page).fill('known@example.test')
    await page.getByText('Email verified.', { exact: true }).waitFor()
    await email(page).fill('other@example.test')
    assert.equal(await confirm(page).isDisabled(), true, 'editing a verified email invalidates access immediately')
    await waitUnverified(page)
    await assertNoBooking(page, state)
  })

  await scenario('late status, send, and verify responses cannot verify a different edited email', async (page, state) => {
    await reachDetails(page, origin)
    const statusGate = delayed({ verified: true })
    state.delays.set('status:old@example.test', statusGate)
    const oldStatusStarted = page.waitForRequest(request => request.url().endsWith('/email-verification/status') && request.postDataJSON().email === 'old@example.test')
    await email(page).fill('old@example.test')
    await oldStatusStarted
    await email(page).fill('second@example.test')
    await waitUnverified(page)
    await releaseDelayed(page, statusGate)
    assert.equal(await page.getByText('Email verified.', { exact: true }).count(), 0)
    await assertNoBooking(page, state)

    const sendGate = delayed({ verified: true })
    state.delays.set('request:second@example.test', sendGate)
    const sendStarted = page.waitForRequest(request => request.url().endsWith('/email-verification/request'))
    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    await sendStarted
    await email(page).fill('third@example.test')
    await waitUnverified(page)
    await releaseDelayed(page, sendGate)
    assert.equal(await page.getByText('Email verified.', { exact: true }).count(), 0)
    await assertNoBooking(page, state)

    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    await page.getByLabel('Verification code', { exact: true }).fill('123456')
    const verifyGate = delayed({ verified: true })
    state.delays.set('verify:third@example.test', verifyGate)
    const verifyStarted = page.waitForRequest(request => request.url().endsWith('/email-verification/verify'))
    await page.getByRole('button', { name: 'Verify email', exact: true }).click()
    await verifyStarted
    await email(page).fill('final@example.test')
    await waitUnverified(page)
    await releaseDelayed(page, verifyGate)
    assert.equal(await page.getByText('Email verified.', { exact: true }).count(), 0)
    assert.equal(await page.getByLabel('Verification code', { exact: true }).count(), 0)
    await assertNoBooking(page, state)
  })

  await scenario('contact conflict keeps details and can recover without silently replacing client contacts', async (page, state) => {
    state.verified.add('known@example.test')
    state.contactConflict = true
    await reachDetails(page, origin)
    await email(page).fill('known@example.test')
    await page.getByText('Email verified.', { exact: true }).waitFor()
    await confirm(page).click()
    await page.getByText(conflictMessage, { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Details', exact: true }).waitFor()
    assert.equal(await email(page).inputValue(), 'known@example.test')
    assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), 'Local Client')
    assert.equal(await page.getByLabel('Phone', { exact: true }).inputValue(), '5551234567')
    assert.equal(state.clients.length, 1, 'contact errors do not auto-retry a write')
    assert.deepEqual(state.appointments, [])
    await page.getByLabel('Phone', { exact: true }).fill('5559998888')
    await confirm(page).click()
    await page.getByRole('heading', { name: 'Booking Confirmed!', exact: true }).waitFor()
    assert.equal(state.clients.length, 2)
    assert.equal(state.clients[1].phone, '5559998888')
    assert.equal(state.appointments.length, 1)
  })

  await scenario('confirmation reflects sent, failed, not-sent, and legacy delivery without repeating a saved booking', async (page, state) => {
    state.verified.add('known@example.test')
    const outcomes = ['sent', 'failed', 'not_sent', undefined] as const
    const mailFailureCopy = "We couldn't send the confirmation email. Download your PDF ticket below. You don't need to book again."
    for (const [index, outcome] of outcomes.entries()) {
      state.confirmationEmail = outcome ? { status: outcome, reason: outcome === 'sent' ? undefined : 'fixture_transport_unavailable' } : undefined
      if (index === 0) await reachDetails(page, origin)
      else {
        await page.getByRole('button', { name: 'Go back to start', exact: true }).click()
        await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
        await chooseDetails(page)
      }
      assert.equal(await email(page).inputValue(), '', 'another booking resets the previous contact form')
      await email(page).fill('Known@Example.TEST')
      await page.getByText('Email verified.', { exact: true }).waitFor()
      await confirm(page).click()
      await page.getByRole('heading', { name: 'Booking Confirmed!', exact: true }).waitFor()
      assert.equal(state.appointments.length, index + 1, 'one explicit booking creates exactly one appointment')
      assert.equal(await confirm(page).count(), 0, 'delivery outcomes do not reopen the appointment submit action')
      assert.equal(await page.getByText(/will be sent/i).count(), 0, 'success never promises delivery without the API result')
      assert.equal(await page.getByText('fixture_transport_unavailable', { exact: false }).count(), 0, 'internal transport reasons are not shown to clients')
      if (outcome === 'sent') {
        await page.getByText('Confirmation email sent to known@example.test', { exact: true }).waitFor()
        assert.equal(await page.getByText(mailFailureCopy, { exact: true }).count(), 0)
      } else {
        await page.getByText('Your appointment has been scheduled.', { exact: true }).waitFor()
        assert.equal(await page.getByText(/Confirmation email sent to/).count(), 0, 'a prior successful delivery does not leak into another booking')
        if (outcome) {
          await page.getByText(mailFailureCopy, { exact: true }).waitFor()
          const downloadStarted = page.waitForEvent('download')
          await page.getByRole('button', { name: 'Download PDF ticket', exact: true }).click()
          const download = await downloadStarted
          assert.match(download.suggestedFilename(), /-appointment\.pdf$/)
          const downloadPath = await download.path()
          assert.ok(downloadPath)
          assert.equal((await readFile(downloadPath)).subarray(0, 5).toString(), '%PDF-', 'mail failure still provides a valid local PDF ticket')
          assert.equal(state.appointments.length, index + 1, 'downloading the fallback ticket never submits another reservation')
          if (outcome === 'failed') {
            await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
            await page.screenshot({ path: '/private/tmp/glamhour-pdf-review/public-confirmation-email-failed.png', fullPage: true })
          }
        } else {
          assert.equal(await page.getByText(mailFailureCopy, { exact: true }).count(), 0, 'legacy API responses retain neutral copy without stale failure status')
          assert.equal(await page.getByRole('button', { name: 'Download PDF ticket', exact: true }).isEnabled(), true)
        }
      }
    }
  })
} finally {
  await browser?.close()
  await server.close()
}
