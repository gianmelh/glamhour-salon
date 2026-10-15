#!/usr/bin/env -S npx tsx
// Real share/dashboard screens; every API request and clipboard write stays in this fixture.
import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { fallbackCategories, fallbackSalon, fallbackServices, fallbackSettings } from '../src/data/fallback-data.ts'

const salonId = 'a1000000-0000-0000-0000-000000000001'
const fixtureSettings = {
  ...fallbackSettings, salon_id: salonId, allow_public_booking: false,
  settings_json: { logoUrl: '/fixture-logo.svg', unrelatedSetting: { keep: true }, publicBooking: { whatsappPhone: '+15550001111' } },
}
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SharePage } from '/src/pages/app/SharePage.tsx';
import { HomePage } from '/src/pages/app/HomePage.tsx';
import '/src/index.css';
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, { initialEntries: [new URLSearchParams(location.search).has('home') ? '/app/home' : '/app/share'] }, React.createElement(Routes, null,
  React.createElement(Route, { path: '/app/share', element: React.createElement(SharePage) }),
  React.createElement(Route, { path: '/app/home', element: React.createElement(HomePage) }),
  React.createElement(Route, { path: '*', element: React.createElement('h1', null, 'Fixture destination') })
)));
</script></body></html>`
const cacheDir = 'node_modules/.vite-public-booking-activation'
const server = await createServer({
  logLevel: 'error', cacheDir,
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/__activation_api__'),
    'import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL': JSON.stringify('https://booking.example.test'),
  },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'isolated-booking-activation', configureServer(vite) {
    vite.middlewares.use('/__booking_activation__', async (req, res, next) => {
      try {
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html))
      } catch (error) { next(error) }
    })
  } }],
})

type FixtureState = {
  salon: typeof fallbackSalon
  settings: typeof fixtureSettings
  premium: boolean
  failSave: boolean
  failSettings: boolean
  writes: Array<Record<string, unknown>>
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  async function scenario(name: string, run: (page: Page, state: FixtureState) => Promise<void>) {
    const state: FixtureState = {
      salon: { ...fallbackSalon, id: salonId, slug: 'fixture-salon', name: 'Fixture Salon' },
      settings: structuredClone(fixtureSettings), premium: true, failSave: false, failSettings: false, writes: [],
    }
    const context = await browser!.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' })
    const errors: string[] = []
    const unexpected: string[] = []
    await context.addInitScript({ content: `
      sessionStorage.setItem('glamhour:active-salon-id', ${JSON.stringify(salonId)});
      window.__copiedLinks = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async function(value) { window.__copiedLinks.push(value); }
      }});
      document.execCommand = function(command) {
        if (command !== 'copy') throw new Error('Unexpected clipboard command');
        window.__copiedLinks.push(document.activeElement.value);
        return true;
      };
    ` })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(60000)
    page.on('pageerror', (error) => errors.push(error.message))
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) {
        unexpected.push(`external ${url.origin}`)
        return route.abort('blockedbyclient')
      }
      if (!url.pathname.startsWith('/__activation_api__/')) return route.continue()
      const path = url.pathname.replace('/__activation_api__', '')
      const respond = (data: unknown) => route.fulfill({ json: { data } })
      const error = (message: string) => route.fulfill({ status: 503, json: { error: { code: 'API_ERROR', message } } })
      if (request.method() === 'GET' && path === `/salons/${salonId}`) return respond(state.salon)
      if (request.method() === 'GET' && path === `/salons/${salonId}/settings`) {
        return state.failSettings ? error('Fixture settings unavailable.') : respond(state.settings)
      }
      if (request.method() === 'PATCH' && path === `/salons/${salonId}/settings`) {
        const input = request.postDataJSON() as Record<string, unknown>
        state.writes.push(input)
        if (state.failSave) return error('Fixture activation failed. Please retry.')
        assert.deepEqual(input, { allowPublicBooking: true }, 'activation must only change the public-booking flag')
        state.settings.allow_public_booking = true
        return respond(state.settings)
      }
      if (request.method() === 'GET' && path === `/salons/${salonId}/subscription`) {
        return respond({ subscription: null, hasPremiumAccess: state.premium, clientUsage: { count: 0, limit: null, nearLimit: false, canCreateClient: true } })
      }
      if (request.method() === 'GET' && path === `/salons/${salonId}/dashboard`) {
        return respond({
          salon: state.salon, selectedDate: url.searchParams.get('date'), revenue: { amountMinor: 0, currencyCode: 'USD', periodLabel: 'Today' },
          appointmentCount: 0, slotsRemaining: 10, activeStaffCount: 1, staffLimit: 10, upcomingAppointments: [], nextHourAppointmentCount: 0,
          bookingLink: 'https://booking.example.test/book/fixture-salon',
          emptyStateFlags: { noAppointmentsToday: true, noActiveStaff: false, zeroRevenue: true, staffLimitReached: false },
        })
      }
      if (request.method() === 'GET' && path === `/salons/${salonId}/services`) return respond(fallbackServices)
      if (request.method() === 'GET' && path === '/service-categories') return respond(fallbackCategories)
      if (request.method() === 'GET' && path === `/salons/${salonId}/professionals`) return respond([])
      if (request.method() === 'GET' && path === `/salons/${salonId}/settings/nails`) {
        return respond({ salon: state.salon, category: { isEnabled: true }, services: fallbackServices, materials: [], providers: [], salonSchedule: {}, staffLimit: 10, activeStaffCount: 1 })
      }
      unexpected.push(`${request.method()} ${path}`)
      return error('Unexpected local fixture request')
    })
    try {
      await run(page, state)
      assert.deepEqual(errors, [], 'no uncaught browser errors')
      assert.deepEqual(unexpected, [], 'all requests stay in the local fixture')
      console.log(`PASS ${name}`)
    } finally { await context.close() }
  }

  async function visit(page: Page, home = false) {
    await page.goto(`${origin}/__booking_activation__${home ? '?home' : ''}`, { waitUntil: 'domcontentloaded' })
    if (home) await page.getByRole('heading', { name: 'Your Booking Link', exact: true }).waitFor()
    else await page.getByRole('heading', { name: 'Salon link', exact: true }).waitFor()
  }
  const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copiedLinks: string[] }).__copiedLinks)
  async function assertCannotCopy(page: Page) {
    const copy = page.getByRole('button', { name: 'Copy', exact: true })
    if (await copy.count()) {
      assert.equal(await copy.isDisabled(), true)
      await copy.evaluate((element) => (element as HTMLButtonElement).click())
    }
    assert.deepEqual(await copied(page), [])
  }
  async function assertShareDisabled(page: Page) {
    await assertCannotCopy(page)
    for (const name of ['WhatsApp', 'SMS / Message', 'Facebook', 'Instagram']) {
      const button = page.getByRole('button', { name, exact: true })
      assert.equal(await button.isDisabled(), true, `${name} cannot share an unavailable link`)
      await button.evaluate((element) => (element as HTMLButtonElement).click())
    }
  }

  await scenario('disabled link requires explicit activation; failed save can retry without changing other settings', async (page, state) => {
    state.failSave = true
    await visit(page)
    await assertShareDisabled(page)
    assert.deepEqual(state.writes, [])
    if (process.env.BOOKING_ACTIVATION_SCREENSHOT_DIR) {
      await mkdir(process.env.BOOKING_ACTIVATION_SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({ path: join(process.env.BOOKING_ACTIVATION_SCREENSHOT_DIR, 'booking-link-disabled.png'), fullPage: true })
    }
    const enable = page.getByRole('button', { name: 'Enable booking link', exact: true })
    await enable.click()
    await page.getByText('Fixture activation failed. Please retry.', { exact: true }).waitFor()
    await assertShareDisabled(page)
    assert.equal(state.settings.allow_public_booking, false)
    state.failSave = false
    await enable.click()
    await page.getByRole('button', { name: 'Copy', exact: true }).and(page.locator(':enabled')).waitFor()
    assert.deepEqual(state.writes, [{ allowPublicBooking: true }, { allowPublicBooking: true }])
    assert.deepEqual(state.settings, { ...fixtureSettings, allow_public_booking: true })
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await page.getByText('Link copied successfully', { exact: true }).waitFor()
    assert.deepEqual(await copied(page), ['https://booking.example.test/book/fixture-salon'])
    if (process.env.BOOKING_ACTIVATION_SCREENSHOT_DIR) {
      await page.screenshot({ path: join(process.env.BOOKING_ACTIVATION_SCREENSHOT_DIR, 'booking-link-enabled.png'), fullPage: true })
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Copy', exact: true }).and(page.locator(':enabled')).waitFor()
    assert.equal(await enable.count(), 0)
    assert.equal(state.writes.length, 2, 'reload must not activate again')
  })

  await scenario('Premium is required before activating or sharing', async (page, state) => {
    state.premium = false
    state.settings.allow_public_booking = true
    await visit(page)
    await assertShareDisabled(page)
    assert.equal(await page.getByRole('button', { name: 'Enable booking link', exact: true }).count(), 0)
    await page.locator('a[href="/app/settings/subscription"]').waitFor()
    assert.deepEqual(state.writes, [])
  })

  await scenario('unfinished setup cannot be bypassed by an enabled public setting', async (page, state) => {
    state.salon.booking_enabled = false
    state.salon.onboarding_status = 'in_progress'
    state.settings.allow_public_booking = true
    await visit(page)
    await assertShareDisabled(page)
    assert.equal(await page.getByRole('button', { name: 'Enable booking link', exact: true }).count(), 0)
    assert.deepEqual(state.writes, [])
  })

  await scenario('an already enabled link copies without a settings write', async (page, state) => {
    state.settings.allow_public_booking = true
    await visit(page)
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await page.getByText('Link copied successfully', { exact: true }).waitFor()
    assert.deepEqual(await copied(page), ['https://booking.example.test/book/fixture-salon'])
    assert.deepEqual(state.writes, [])
  })

  await scenario('dashboard directs disabled links to configuration without promising public availability', async (page, state) => {
    await visit(page, true)
    await assertCannotCopy(page)
    assert.equal(await page.getByText('Share this link with clients so they can book appointments directly online.', { exact: true }).count(), 0)
    await page.locator('a[href="/app/share"]').click()
    await page.getByRole('heading', { name: 'Salon link', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Enable booking link', exact: true }).click()
    await page.getByRole('button', { name: 'Copy', exact: true }).and(page.locator(':enabled')).waitFor()
    await visit(page, true)
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor()
    assert.deepEqual(await copied(page), ['https://booking.example.test/book/fixture-salon'])
    assert.deepEqual(state.writes, [{ allowPublicBooking: true }])
  })

  await scenario('dashboard keeps setup and Premium guards even with public booking selected', async (page, state) => {
    state.settings.allow_public_booking = true
    state.salon.booking_enabled = false
    state.salon.onboarding_status = 'in_progress'
    await visit(page, true)
    await assertCannotCopy(page)
    state.salon.booking_enabled = true
    state.salon.onboarding_status = 'completed'
    state.premium = false
    await visit(page, true)
    await assertCannotCopy(page)
    await page.locator('a[href="/app/settings/subscription"]').waitFor()
    assert.deepEqual(state.writes, [])
  })

  await scenario('settings load errors do not expose copy or activation and can recover', async (page, state) => {
    state.failSettings = true
    await page.goto(`${origin}/__booking_activation__`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Fixture settings unavailable.', { exact: true }).waitFor()
    await assertCannotCopy(page)
    assert.equal(await page.getByRole('button', { name: 'Enable booking link', exact: true }).count(), 0)
    state.failSettings = false
    await page.getByRole('button', { name: /try again|retry/i }).click()
    await page.getByRole('button', { name: 'Enable booking link', exact: true }).waitFor()
    assert.deepEqual(state.writes, [])
  })
} finally {
  await browser?.close()
  await server.close()
  await rm(cacheDir, { recursive: true, force: true })
}
