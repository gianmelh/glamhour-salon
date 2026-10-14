#!/usr/bin/env node
// Local browser regression: no API server or database is used.
// npm ci && npx playwright install chromium
// node scripts/test-browser-translation.mjs
// Set PLAYWRIGHT_CHANNEL=chrome to use an existing Chrome installation instead.
// An existing installation can be supplied with PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Button } from '/src/components/ui/Button.tsx';
import { PublicBookingPage } from '/src/pages/public/PublicBookingPage.tsx';
import '/src/index.css';
function ButtonHarness() {
  const [loading, setLoading] = useState(false);
  window.finishLoading = () => setLoading(false);
  const variant = new URLSearchParams(location.search).get('variant');
  const icon = (name) => React.createElement('svg', { 'data-test-icon': name, 'aria-hidden': true, width: 16, height: 16, viewBox: '0 0 16 16' }, React.createElement('path', { d: 'M2 8h12' }));
  const children = variant === 'icon-only' ? icon('child')
    : variant === 'rich' ? React.createElement(React.Fragment, null, icon('child'), 'Confirm appointment')
    : 'Confirm appointment';
  return React.createElement(Button, {
    loading, onClick: () => setLoading(true),
    'aria-label': variant === 'icon-only' ? 'Open menu' : undefined,
    leadingIcon: variant === 'adornments' ? icon('leading') : undefined,
    trailingIcon: variant === 'adornments' ? icon('trailing') : undefined,
  }, children);
}
createRoot(document.getElementById('root')).render(
  new URLSearchParams(location.search).has('button')
    ? React.createElement(ButtonHarness)
    : React.createElement(MemoryRouter, { initialEntries: ['/book/local-salon'] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/book/:salonSlug', element: React.createElement(PublicBookingPage) })))
);
</script></body></html>`

const server = await createServer({
  cacheDir: 'node_modules/.vite-browser-translation-regression',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/__mock_api__') },
  server: { host: '127.0.0.1', port: 5187, hmr: false, watch: null },
  plugins: [{
    name: 'local-translation-regression',
    configureServer(vite) {
      vite.middlewares.use('/__translation_test__', async (req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await vite.transformIndexHtml(req.originalUrl || req.url, html))
        } catch (error) { next(error) }
      })
    },
  }],
})

let browser
try {
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  // Translators detach React's text nodes and replace them with nested <font>
  // elements. A subsequent spinner insertion used to reference the detached node.
  async function translateText(locator) {
    await locator.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      const nodes = []
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode)
      for (const text of nodes) {
        if (text.parentElement.closest('script, style, option')) continue
        const outer = document.createElement('font')
        const inner = document.createElement('font')
        outer.style.verticalAlign = 'inherit'
        inner.style.verticalAlign = 'inherit'
        inner.textContent = text.textContent.replace('Confirm appointment', 'Confirmar cita')
        outer.append(inner)
        text.replaceWith(outer)
      }
    })
  }

  async function createPage() {
    const context = await browser.newContext({ viewport: { width: 393, height: 850 } })
    // Fail closed: the browser can only reach this isolated Vite server.
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort('blockedbyclient'))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    return { context, page, errors }
  }

  async function checkButton(translated, variant = 'plain') {
    const { context, page, errors } = await createPage()
    try {
      await page.goto(`${origin}/__translation_test__?button&variant=${variant}`)
      const button = page.getByRole('button')
      await button.waitFor()
      if (translated) await translateText(button)
      const sizeBefore = await button.boundingBox()
      if (variant === 'adornments') {
        const leading = await button.locator('[data-test-icon="leading"]').boundingBox()
        const trailing = await button.locator('[data-test-icon="trailing"]').boundingBox()
        assert.ok(leading.x < trailing.x)
      }
      await button.click()
      await page.locator('button svg.animate-spin').waitFor({ timeout: 3000 }).catch(() => {
        throw new Error(`Button disappeared when loading started: ${errors.join('; ')}`)
      })
      assert.equal(await button.isDisabled(), true)
      assert.equal(await button.locator('[data-test-icon="leading"], [data-test-icon="trailing"]').count(), 0)
      assert.equal(await button.locator('[data-test-icon="child"]').count(), variant === 'rich' || variant === 'icon-only' ? 1 : 0)
      await page.evaluate(() => window.finishLoading())
      await page.waitForFunction(() => !document.querySelector('button').disabled)
      assert.equal(await button.innerText(), variant === 'icon-only' ? '' : translated ? 'Confirmar cita' : 'Confirm appointment')
      assert.equal(await button.locator('[data-test-icon="leading"], [data-test-icon="trailing"]').count(), variant === 'adornments' ? 2 : 0)
      const sizeAfter = await button.boundingBox()
      assert.equal(sizeAfter.width, sizeBefore.width)
      assert.equal(sizeAfter.height, sizeBefore.height)
      assert.deepEqual(errors, [])
      console.log(`PASS shared Button ${variant} loading start/end (${translated ? 'translated' : 'original'})`)
    } finally { await context.close() }
  }

  async function checkPublicBooking({ translated, outcome }) {
    const { context, page, errors } = await createPage()
    const requests = []
    let releaseClient
    const clientGate = new Promise((resolve) => { releaseClient = resolve })
    let conflict = outcome === 'conflict'
    let availabilityRequests = 0
    const service = { id: 'service-local', category_id: 'category-local', name: 'Manicure', category_name: 'Nails', category_code: 'nails', duration_minutes: 60, is_active: true, is_publicly_bookable: true }
    await page.route(`${origin}/__mock_api__/**`, async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      const respond = (data) => route.fulfill({ json: { data } })
      if (path === '/__mock_api__/public-booking/local-salon') return respond({
        salon: { id: 'salon-local', name: 'Local regression salon', timezone: 'UTC', booking_enabled: true, allow_public_booking: true },
        services: [service], categories: [{ id: 'category-local', code: 'nails', name: 'Nails', is_active: true }],
      })
      if (path.endsWith('/providers/eligible')) return respond([
        { id: 'provider-local', full_name: 'Local Specialist', languages: ['en', 'English', 'es', ' Spanish ', 'pt', 'Portuguese', 'Arabic', 'French'], services_offered: ['Manicure'], durationMinutes: 60 },
      ])
      if (path.endsWith('/availability')) {
        availabilityRequests += 1
        const date = url.searchParams.get('date')
        return respond({ slots: [{ startsAt: `${date}T16:00:00Z`, endsAt: `${date}T17:00:00Z`, available: true, label: '4:00 PM' }] })
      }
      if (path.endsWith('/public-booking/local-salon/email-verification/status')) return respond({ verified: true })
      if (path.endsWith('/public-booking/local-salon/clients/find-or-create')) {
        requests.push({ path, body: request.postDataJSON() })
        await clientGate
        return respond({ id: 'client-local' })
      }
      if (path.endsWith('/appointments') && request.method() === 'POST') {
        requests.push({ path, body: request.postDataJSON() })
        if (conflict) {
          conflict = false
          return route.fulfill({ status: 409, json: { error: { code: 'APPOINTMENT_CONFLICT', message: 'The professional is unavailable for that time.' } } })
        }
        if (outcome === 'error') return route.fulfill({ status: 500, json: { error: { code: 'TEST_FAILURE', message: 'Please retry your appointment.' } } })
        return respond({ id: 'abcde000-0000-0000-0000-000000000000' })
      }
      errors.push(`Unexpected mock API request: ${request.method()} ${path}`)
      return route.fulfill({ status: 500, json: { error: { message: 'Unexpected test request' } } })
    })
    try {
      await page.goto(`${origin}/__translation_test__`)
      await page.getByRole('button', { name: 'Nails' }).click()
      await page.getByRole('button', { name: '4:00 PM', exact: true }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      const providerCard = page.getByRole('button', { name: /Local Specialist/ })
      await providerCard.waitFor()
      for (const language of ['English', 'Spanish', 'Portuguese']) {
        assert.equal(await providerCard.getByText(language, { exact: true }).count(), 1, `public provider card displays ${language} once`)
      }
      for (const unsupported of ['en', 'es', 'pt', 'Arabic', 'French']) {
        assert.equal(await providerCard.getByText(unsupported, { exact: true }).count(), 0, `public provider card hides ${unsupported}`)
      }
      await providerCard.click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByLabel('Email', { exact: true }).fill('local@example.test')
      await page.getByLabel('Full name', { exact: true }).fill('Local Client')
      await page.getByLabel('Phone', { exact: true }).fill('5551234567')
      await page.getByRole('button', { name: 'Confirm appointment' }).and(page.locator(':enabled')).waitFor()
      if (translated) await translateText(page.locator('main'))
      await page.getByRole('button', { name: translated ? 'Confirmar cita' : 'Confirm appointment' }).click()
      await page.locator('button svg.animate-spin').waitFor({ timeout: 3000 }).catch(() => {
        throw new Error(`Public confirmation disappeared when loading started: ${errors.join('; ')}`)
      })
      releaseClient()
      if (outcome === 'success') {
        await page.getByRole('heading', { name: 'Booking Confirmed!' }).waitFor()
        assert.equal(await page.getByText('AABCDE', { exact: true }).count(), 1)
        await page.getByRole('button', { name: 'Go back to start' }).click()
        await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
      } else if (outcome === 'conflict') {
        await page.getByText('That time was just booked.', { exact: false }).waitFor()
        await page.getByRole('heading', { name: 'Choose your schedule' }).waitFor()
        await page.getByRole('button', { name: '4:00 PM', exact: true }).waitFor()
        assert.ok(availabilityRequests >= 2)
      } else {
        await page.getByText('Please retry your appointment.').waitFor()
        assert.equal(await page.getByLabel('Full name').inputValue(), 'Local Client')
        assert.equal(await page.getByRole('button', { name: translated ? 'Confirmar cita' : 'Confirm appointment' }).isEnabled(), true)
      }
      assert.deepEqual(errors, [])
      assert.equal(requests.length, 2)
      assert.equal(requests[0].body.fullName, 'Local Client')
      assert.equal(requests[0].body.email, 'local@example.test')
      assert.equal(requests[1].body.clientId, 'client-local')
      assert.equal(requests[1].body.professionalId, 'provider-local')
      assert.deepEqual(requests[1].body.serviceIds, ['service-local'])
      assert.equal(requests[1].body.source, 'public_booking')
      assert.equal(requests[1].body.publicBookingEmail, 'local@example.test')
      console.log(`PASS public booking ${outcome} (${translated ? 'translated' : 'original'})`)
    } finally {
      releaseClient()
      await context.close()
    }
  }

  await checkButton(false)
  await checkButton(true)
  await checkButton(true, 'adornments')
  await checkButton(true, 'rich')
  await checkButton(true, 'icon-only')
  await checkPublicBooking({ translated: false, outcome: 'success' })
  await checkPublicBooking({ translated: true, outcome: 'success' })
  await checkPublicBooking({ translated: true, outcome: 'conflict' })
  await checkPublicBooking({ translated: true, outcome: 'error' })
} finally {
  await browser?.close()
  await server.close()
}
