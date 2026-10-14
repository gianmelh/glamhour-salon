#!/usr/bin/env -S npx tsx
// Public-link category lifecycle checks. All API requests are local fixtures.
import assert from 'node:assert/strict'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { fallbackCategories, fallbackSalon, fallbackServices } from '../src/data/fallback-data.ts'

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
  logLevel: 'error', cacheDir: 'node_modules/.vite-public-categories',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/__public_catalog_api__') },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'isolated-public-booking-page', configureServer(vite) {
    vite.middlewares.use('/book/local-salon', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, publicPageHtml)) }
      catch (error) { next(error) }
    })
  } }],
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  async function scenario(name: string, run: (page: Page, state: {
    lashesEnabled: boolean
    empty: boolean
    disableAtPost: boolean
    writes: string[]
  }) => Promise<void>) {
    const state = { lashesEnabled: false, empty: false, disableAtPost: false, writes: [] as string[] }
    const context = await browser!.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(60000)
    const errors: string[] = []
    const unexpected: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort('blockedbyclient')
      if (!url.pathname.startsWith('/__public_catalog_api__/')) {
        if (url.pathname.startsWith('/api/')) {
          unexpected.push(`unmocked ${url.pathname}`)
          return route.abort('blockedbyclient')
        }
        return route.continue()
      }
      const respond = (data: unknown) => route.fulfill({ json: { data } })
      if (request.method() === 'GET' && url.pathname.endsWith('/public-booking/local-salon')) {
        return respond({
          salon: { ...fallbackSalon, timezone: 'UTC', allow_public_booking: true },
          categories: state.empty ? [] : fallbackCategories.map((category) => ({
            ...category, is_active: category.code === 'nails' || category.code === 'cosmetology' || (category.code === 'lashes' && state.lashesEnabled),
          })),
          // Deliberately include catalog leftovers: the public UI must filter them.
          services: [...fallbackServices,
            { ...fallbackServices[0], id: 'inactive', name: 'Inactive manicure', is_active: false },
            { ...fallbackServices[0], id: 'private', name: 'Internal manicure', is_publicly_bookable: false },
          ],
        })
      }
      if (request.method() === 'GET' && url.pathname.endsWith('/providers/eligible')) {
        return respond([{ id: 'local-provider', full_name: 'Local Specialist', languages: ['English'], durationMinutes: 60 }])
      }
      if (request.method() === 'GET' && url.pathname.endsWith('/availability')) {
        const date = url.searchParams.get('date')
        return respond({ slots: [{ available: true, time: '16:00', label: '4:00 PM', startsAt: `${date}T16:00:00Z`, endsAt: `${date}T17:00:00Z` }] })
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/public-booking/local-salon/email-verification/status')) {
        return respond({ verified: true })
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/public-booking/local-salon/clients/find-or-create')) {
        state.writes.push('client')
        assert.equal(request.postDataJSON().email, 'local@example.test')
        return respond({ id: 'local-client' })
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/appointments')) {
        state.writes.push('appointment')
        assert.equal(request.postDataJSON().publicBookingEmail, 'local@example.test')
        if (state.disableAtPost) {
          state.lashesEnabled = false
          return route.fulfill({ status: 400, json: { error: { message: 'One or more services are unavailable for this professional.' } } })
        }
        assert.equal(state.lashesEnabled, true, 'a disabled category must never be submitted')
        return respond({ id: 'abcde000-0000-0000-0000-000000000000' })
      }
      unexpected.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 500, json: { error: { message: 'Unexpected local regression request' } } })
    })
    try {
      await run(page, state)
      assert.deepEqual(errors, [], 'no uncaught browser errors')
      assert.deepEqual(unexpected, [], 'all API calls mocked')
      console.log(`PASS ${name}`)
    } finally { await context.close() }
  }
  const visit = (page: Page) => page.goto(`${origin}/book/local-salon`, { waitUntil: 'domcontentloaded' })
  const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')))
  async function reachConfirmation(page: Page) {
    await page.getByRole('button', { name: 'Lashes', exact: false }).click()
    await page.getByRole('button', { name: '4:00 PM', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: /Local Specialist/ }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByLabel('Full name', { exact: true }).fill('Local Client')
    await page.getByLabel('Phone', { exact: true }).fill('5551234567')
    await page.getByLabel('Email', { exact: true }).fill('local@example.test')
    await page.getByRole('button', { name: 'Confirm appointment' }).and(page.locator(':enabled')).waitFor()
  }
  await scenario('public link hides disabled, inactive and private catalog entries', async (page) => {
    await visit(page)
    await page.getByRole('button', { name: 'Nails', exact: false }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Lashes', exact: false }).count(), 0)
    assert.equal(await page.getByText('Micropigmentation', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Nails', exact: false }).click()
    await page.getByRole('heading', { name: 'Choose your schedule' }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0, 'inactive/private services cannot appear in the service picker')
  })
  await scenario('all categories disabled gives an empty public catalog', async (page, state) => {
    state.empty = true
    await visit(page)
    await page.getByText('No services are available for online booking right now.').waitFor()
    assert.deepEqual(state.writes, [])
  })
  await scenario('public link refreshes enabled → disabled → enabled without reload', async (page, state) => {
    state.lashesEnabled = true
    await visit(page)
    await page.getByRole('button', { name: 'Lashes', exact: false }).waitFor()
    state.lashesEnabled = false
    await focus(page)
    await page.getByRole('button', { name: 'Lashes', exact: false }).waitFor({ state: 'detached' })
    state.lashesEnabled = true
    await focus(page)
    await page.getByRole('button', { name: 'Lashes', exact: false }).waitFor()
  })
  await scenario('an open confirmation drops its category when the salon disables it', async (page, state) => {
    state.lashesEnabled = true
    await visit(page)
    await reachConfirmation(page)
    state.lashesEnabled = false
    await focus(page)
    await page.getByText('This service is no longer available.', { exact: false }).waitFor()
    await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Lashes', exact: false }).count(), 0)
    assert.deepEqual(state.writes, [])
  })
  await scenario('confirmation revalidates before any client or appointment write; re-enable permits booking', async (page, state) => {
    state.lashesEnabled = true
    await visit(page)
    await reachConfirmation(page)
    state.lashesEnabled = false
    await page.getByRole('button', { name: 'Confirm appointment' }).click()
    await page.getByText('This service is no longer available.', { exact: false }).waitFor()
    assert.deepEqual(state.writes, [])
    state.lashesEnabled = true
    await focus(page)
    await reachConfirmation(page)
    await page.getByRole('button', { name: 'Confirm appointment' }).click()
    await page.getByRole('heading', { name: 'Booking Confirmed!' }).waitFor()
    assert.deepEqual(state.writes, ['client', 'appointment'])
  })
  await scenario('a server rejection during confirmation removes the newly disabled category', async (page, state) => {
    state.lashesEnabled = true
    state.disableAtPost = true
    await visit(page)
    await reachConfirmation(page)
    await page.getByRole('button', { name: 'Confirm appointment' }).click()
    await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Lashes', exact: false }).count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Booking Confirmed!' }).count(), 0)
  })
} finally {
  await browser?.close()
  await server.close()
}
