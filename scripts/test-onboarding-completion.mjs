#!/usr/bin/env node
// Real setup UI and API client, isolated from Google, SMTP, and the database.
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const salonId = 'salon-onboarding-regression'
const storageKey = `glamhour:onboarding:${salonId}`
const apiPrefix = '/__onboarding_test_api__'
const cacheDir = 'node_modules/.vite-onboarding-completion'
const categories = ['nails', 'lashes'].map(code => ({
  id: `category-${code}`, code, name: code === 'nails' ? 'Nails' : 'Lashes', is_active: true,
}))
const salon = { id: salonId, name: 'Setup fixture', onboarding_status: 'in_progress', booking_enabled: false }
const schedule = Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => [day, { enabled: i < 6, open: '09:00', close: '18:00' }]))
const service = { id: 'category-lashes-service-lash-lift', categoryId: 'category-lashes', name: 'Lash Lift', selected: true, price: '200', duration: '75', section: 'service' }
const completeDraft = {
  selectedCategoryIds: ['category-lashes'], services: [service], schedule,
  providers: [{ id: 'provider-fixture', name: 'Saved Specialist', email: '', phone: '', languages: ['English'], salonPercent: '40', professionalPercent: '60', serviceIds: [service.id], schedule, useSalonSchedule: true }],
}
const emptyDraft = { selectedCategoryIds: [], services: [], schedule, providers: [] }
const session = draft => ({ id: 'session-fixture', salon_id: salonId, current_step: 'team', completed_steps: ['categories', 'services', 'schedule', 'team'], draft_data: draft, completed_at: null })
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SetupPage } from '/src/pages/onboarding/SetupPage.tsx';
import '/src/index.css';
function LocationProbe() { const location = useLocation(); return React.createElement('output', { 'data-testid': 'route', hidden: true }, location.pathname); }
const step = new URLSearchParams(location.search).get('step') || 'categories';
const preserveServiceCatalog = new URLSearchParams(location.search).get('preserveServiceCatalog') === 'true';
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null,
  React.createElement(MemoryRouter, { initialEntries: [{ pathname: '/onboarding/' + step, state: { preserveServiceCatalog, ...(preserveServiceCatalog ? { returnTo: '/app/settings' } : {}) } }] },
    React.createElement(LocationProbe), React.createElement(Routes, null,
      React.createElement(Route, { path: '/onboarding/:step', element: React.createElement(SetupPage) }),
      React.createElement(Route, { path: '/app/settings', element: React.createElement('h1', null, 'Settings fixture') }),
      React.createElement(Route, { path: '/app/home', element: React.createElement('h1', null, 'Home fixture') })))));
</script></body></html>`

const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiPrefix) },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'onboarding-completion-fixture', configureServer(vite) {
    vite.middlewares.use('/__onboarding_completion__', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.originalUrl || req.url, html)) }
      catch (error) { next(error) }
    })
  } }],
})

let browser
let origin
async function fixture({ localDraft, serverDraft, metadata = false, step = 'complete', enabledIds = [], configured = false, failGet = false, failSave = false, catalogServices = [], professionals = [], preserveServiceCatalog = false } = {}) {
  const state = {
    session: serverDraft ? session(serverDraft) : metadata ? session({ salonName: 'Setup fixture', ownerEmail: 'owner@example.test' }) : null,
    puts: [], getCount: 0, failGet, failSave, enabledIds, configured,
  }
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' })
  const errors = []
  const unexpected = []
  await context.addInitScript(({ salonId, storageKey, localDraft }) => {
    sessionStorage.setItem('glamhour:active-salon-id', salonId)
    if (!sessionStorage.getItem('onboarding-fixture-seeded')) {
      if (localDraft !== undefined) localStorage.setItem(storageKey, JSON.stringify(localDraft))
      sessionStorage.setItem('onboarding-fixture-seeded', 'true')
    }
  }, { salonId, storageKey, localDraft })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) { unexpected.push(url.origin); return route.abort('blockedbyclient') }
    if (!url.pathname.startsWith(apiPrefix)) return route.continue()
    const path = url.pathname.slice(apiPrefix.length)
    const respond = data => route.fulfill({ json: { data } })
    const reject = message => route.fulfill({ status: 400, json: { error: { code: 'API_ERROR', message } } })
    if (path === '/service-categories') return respond(url.searchParams.has('includeAll') ? categories : categories.filter(c => state.enabledIds.includes(c.id)))
    if (path === `/salons/${salonId}`) return respond({ ...salon, onboarding_status: state.configured ? 'completed' : 'in_progress', booking_enabled: state.configured })
    if (path === `/salons/${salonId}/services`) return respond(catalogServices)
    if (path === `/salons/${salonId}/professionals`) return respond(professionals)
    if (path === `/salons/${salonId}/onboarding`) {
      if (request.method() === 'GET') {
        state.getCount++
        return state.failGet ? reject('Draft could not be loaded.') : respond(state.session)
      }
      if (request.method() === 'PUT') {
        const input = request.postDataJSON()
        state.puts.push(input)
        if (state.failSave) return reject('The setup could not be saved. Please retry.')
        if (input.completed && !input.draft.selectedCategoryIds.length) return reject('Select at least one service category.')
        state.session = session(input.draft)
        if (input.completed) state.configured = true
        return respond({ ...salon, onboarding_status: state.configured ? 'completed' : 'in_progress' })
      }
    }
    unexpected.push(`${request.method()} ${path}`)
    return reject('Unexpected fixture request.')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/__onboarding_completion__?step=${step}&preserveServiceCatalog=${preserveServiceCatalog}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const done = async () => { assert.deepEqual(errors, [], 'No uncaught promise/React errors'); assert.deepEqual(unexpected, [], 'No real external or unexpected API requests'); await context.close() }
  return { page, state, errors, done }
}
const ready = page => page.getByRole('heading', { name: 'Your salon setup is ready to save', exact: true }).waitFor()
const incomplete = page => page.getByRole('heading', { name: 'Finish your salon setup', exact: true }).waitFor()
const routeIs = (page, path) => page.waitForFunction(expected => document.querySelector('[data-testid="route"]').textContent === expected, path)
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)

try {
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  // Follow every normal step without seeding a draft or changing API state.
  const normal = await fixture({ step: 'categories', metadata: true })
  const p = normal.page
  await p.getByRole('button', { name: /^Lashes / }).click()
  await p.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(p, '/onboarding/services')
  await p.getByRole('spinbutton', { name: 'Lash Lift base price', exact: true }).fill('200')
  await p.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(p, '/onboarding/durations')
  await p.getByRole('spinbutton', { name: 'Lash Lift duration', exact: true }).fill('75')
  await p.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(p, '/onboarding/schedule')
  await p.getByRole('textbox', { name: 'Monday opening time', exact: true }).fill('10:00 AM')
  await p.getByRole('textbox', { name: 'Monday opening time', exact: true }).press('Tab')
  await p.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(p, '/onboarding/team')
  await p.getByRole('button', { name: 'Add New Provider', exact: true }).click()
  await p.getByRole('textbox', { name: 'Full name', exact: true }).fill('New Specialist')
  await p.getByRole('button', { name: 'Add provider', exact: true }).click()
  await p.getByRole('heading', { name: 'New Specialist', exact: true }).waitFor()
  await p.getByRole('button', { name: 'Finish', exact: true }).click()
  await ready(p)
  assert.equal(normal.state.puts.some(input => input.completed), false, 'Complete screen must wait for an explicit successful save')
  assert.ok(normal.state.puts.every(input => input.draft.selectedCategoryIds.join() === 'category-lashes'), 'No category loss between steps')
  assert.equal((await stored(p)).providers[0].name, 'New Specialist')
  await p.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await p.getByRole('heading', { name: 'Home fixture' }).waitFor()
  assert.deepEqual(normal.state.puts.map(input => [input.step, input.completed]), [['categories', false], ['services', false], ['services', false], ['schedule', false], ['team', false], ['team', false], ['complete', true]])
  assert.ok(normal.state.puts.every(input => input.preserveServiceCatalog === undefined), 'Initial onboarding still writes its selected catalog')
  const finalDraft = normal.state.puts.at(-1).draft
  assert.equal(finalDraft.schedule.Monday.open, '10:00')
  assert.equal(finalDraft.providers[0].schedule.Monday.open, '10:00')
  assert.equal(finalDraft.services.find(item => item.id === service.id).duration, '75')
  assert.deepEqual(finalDraft.providers[0].serviceIds, [service.id])
  assert.equal(await stored(p), null, 'Only successful completion clears the browser draft')
  await normal.done()
  console.log('PASS normal consecutive setup keeps categories, services, hours and provider through final save')

  const restored = await fixture({ localDraft: finalDraft, serverDraft: finalDraft })
  await ready(restored.page)
  await restored.page.evaluate(key => localStorage.removeItem(key), storageKey)
  await restored.page.reload({ waitUntil: 'domcontentloaded' })
  await ready(restored.page)
  assert.ok(restored.state.getCount >= 2)
  await restored.page.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await restored.page.getByRole('heading', { name: 'Home fixture' }).waitFor()
  assert.deepEqual(restored.state.puts[0].draft.selectedCategoryIds, ['category-lashes'])
  assert.equal(restored.state.puts[0].draft.providers[0].name, 'New Specialist')
  assert.equal(restored.state.puts[0].draft.schedule.Monday.open, '10:00')
  await restored.done()
  console.log('PASS reload without local storage restores the server draft before catalog membership exists')

  const deliberateEmpty = await fixture({ localDraft: emptyDraft, serverDraft: completeDraft, enabledIds: ['category-lashes'] })
  await incomplete(deliberateEmpty.page)
  assert.deepEqual(deliberateEmpty.state.puts, [])
  await deliberateEmpty.page.getByRole('button', { name: 'Continue setup', exact: true }).click()
  await routeIs(deliberateEmpty.page, '/onboarding/categories')
  assert.equal(await deliberateEmpty.page.getByRole('button', { name: /^Lashes / }).getAttribute('aria-pressed'), 'false')
  assert.deepEqual(deliberateEmpty.state.puts, [])
  assert.deepEqual((await stored(deliberateEmpty.page)).selectedCategoryIds, [])
  await deliberateEmpty.page.reload({ waitUntil: 'domcontentloaded' })
  await incomplete(deliberateEmpty.page)
  await deliberateEmpty.page.getByRole('button', { name: 'Restore saved setup', exact: true }).click()
  await ready(deliberateEmpty.page)
  assert.deepEqual(deliberateEmpty.state.puts, [], 'Accepting recovery does not finalize the setup')
  assert.deepEqual((await stored(deliberateEmpty.page)).selectedCategoryIds, ['category-lashes'])
  assert.equal((await stored(deliberateEmpty.page)).providers[0].name, 'Saved Specialist')
  await deliberateEmpty.page.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await deliberateEmpty.page.getByRole('heading', { name: 'Home fixture' }).waitFor()
  assert.equal(deliberateEmpty.state.puts.length, 1)
  assert.deepEqual(deliberateEmpty.state.puts[0].draft.selectedCategoryIds, ['category-lashes'])
  await deliberateEmpty.done()
  console.log('PASS empty local selection blocks completion and server recovery requires explicit acceptance')

  const unpricedService = { ...service, id: 'category-lashes-service-refill', name: 'Refill', price: '' }
  const unpricedAssignment = await fixture({ localDraft: {
    ...completeDraft,
    services: [{ ...service, price: '10' }, unpricedService],
    providers: completeDraft.providers.map(provider => ({ ...provider, serviceIds: [unpricedService.id] })),
  } })
  await incomplete(unpricedAssignment.page)
  await unpricedAssignment.page.getByText('Review your providers and assigned services before finishing setup.', { exact: true }).waitFor()
  await unpricedAssignment.page.getByRole('button', { name: 'Continue setup', exact: true }).click()
  await routeIs(unpricedAssignment.page, '/onboarding/team')
  assert.equal(await unpricedAssignment.page.getByRole('button', { name: 'Finish', exact: true }).isDisabled(), true)
  assert.deepEqual(unpricedAssignment.state.puts, [], 'An unpriced assignment cannot satisfy provider setup or trigger a save')
  await unpricedAssignment.done()
  console.log('PASS a provider assigned only an unpriced service must return to team setup without a PUT')

  for (const options of [{ metadata: true }, { configured: true, serverDraft: completeDraft }]) {
    const initial = await fixture({ ...options, step: 'categories' })
    await initial.page.getByRole('heading', { name: 'Service Categories', exact: true }).waitFor()
    assert.equal(await initial.page.getByRole('button', { name: /^Lashes / }).getAttribute('aria-pressed'), 'false')
    assert.equal(await initial.page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), true)
    assert.deepEqual(initial.state.puts, [])
    await initial.done()
  }
  console.log('PASS registration metadata and completed salons do not restore an obsolete setup draft')

  const persistedService = {
    id: '40000000-0000-4000-8000-000000000001', category_id: 'category-lashes',
    name: 'Lash Lift', price_minor: 1250, duration_minutes: 75,
    currency_code: 'MXN', is_active: true, is_publicly_bookable: false,
  }
  const hours = await fixture({
    step: 'schedule', configured: true, preserveServiceCatalog: true,
    enabledIds: ['category-lashes'], catalogServices: [persistedService],
    professionals: [{
      id: '20000000-0000-4000-8000-000000000001', full_name: 'Existing Specialist', languages: ['English'],
      salon_earnings_percent: '40.00', professional_earnings_percent: '60.00',
      service_assignments: [{ service_id: persistedService.id, is_active: true, duration_override_minutes: null }],
    }],
  })
  await hours.page.getByRole('textbox', { name: 'Monday opening time', exact: true }).fill('10:00 AM')
  await hours.page.getByRole('textbox', { name: 'Monday opening time', exact: true }).press('Tab')
  await hours.page.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(hours.page, '/onboarding/team')
  await hours.page.getByRole('button', { name: 'Finish', exact: true }).click()
  await ready(hours.page)
  await hours.page.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await hours.page.getByRole('heading', { name: 'Home fixture' }).waitFor()
  assert.deepEqual(hours.state.puts.map(input => [input.step, input.completed]), [['schedule', false], ['team', false], ['complete', true]])
  assert.ok(hours.state.puts.every(input => input.preserveServiceCatalog === true), 'Settings preservation survives every schedule/team route transition')
  assert.ok(hours.state.puts.every(input => input.draft.services.find(item => item.id === persistedService.id).price === '12.5'), 'Existing service cents are retained in the setup draft')
  assert.equal(hours.state.puts.at(-1).draft.schedule.Monday.open, '10:00')
  await hours.done()
  console.log('PASS configured salon hours preserve catalog intent and decimal prices through final save')

  const hoursBack = await fixture({ step: 'schedule', configured: true, preserveServiceCatalog: true })
  await hoursBack.page.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(hoursBack.page, '/onboarding/team')
  await hoursBack.page.getByRole('button', { name: 'Go back', exact: true }).click()
  await routeIs(hoursBack.page, '/onboarding/schedule')
  await hoursBack.page.getByRole('button', { name: 'Go back', exact: true }).click()
  await hoursBack.page.getByRole('heading', { name: 'Settings fixture' }).waitFor()
  assert.equal(hoursBack.state.puts.length, 1, 'Returning to Settings does not finalize or edit the catalog')
  await hoursBack.done()
  console.log('PASS configured team Back returns to hours and hours Back returns to Settings')

  const getFailure = await fixture({ serverDraft: completeDraft, failGet: true })
  await getFailure.page.getByText('Salon setup data could not be loaded.', { exact: true }).waitFor()
  assert.equal(await getFailure.page.getByRole('button', { name: 'Go to calendar', exact: true }).count(), 0)
  assert.deepEqual(getFailure.state.puts, [])
  getFailure.state.failGet = false
  await getFailure.page.getByRole('button', { name: 'Try again', exact: true }).click()
  await ready(getFailure.page)
  await getFailure.done()
  console.log('PASS failed server draft loading blocks writes and can retry safely')

  const failedSave = await fixture({ localDraft: completeDraft, serverDraft: completeDraft, failSave: true })
  await ready(failedSave.page)
  await failedSave.page.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await failedSave.page.getByRole('alert').filter({ hasText: 'The setup could not be saved. Please retry.' }).waitFor()
  await routeIs(failedSave.page, '/onboarding/complete')
  assert.deepEqual((await stored(failedSave.page)).selectedCategoryIds, ['category-lashes'])
  assert.equal(failedSave.state.puts.length, 1)
  assert.deepEqual(failedSave.errors, [])
  failedSave.state.failSave = false
  await failedSave.page.getByRole('button', { name: 'Go to calendar', exact: true }).click()
  await failedSave.page.getByRole('heading', { name: 'Home fixture' }).waitFor()
  assert.equal(failedSave.state.puts.length, 2)
  assert.deepEqual(failedSave.state.puts[1], failedSave.state.puts[0], 'Retry preserves the complete draft')
  assert.equal(await stored(failedSave.page), null)
  await failedSave.done()
  console.log('PASS rejected completion stays on the form, keeps the draft, has no uncaught rejection, and retries')

  const failedStep = await fixture({ step: 'categories', metadata: true, failSave: true })
  await failedStep.page.getByRole('button', { name: /^Lashes / }).click()
  await failedStep.page.getByRole('button', { name: 'Continue', exact: true }).click()
  await failedStep.page.getByRole('alert').waitFor()
  await routeIs(failedStep.page, '/onboarding/categories')
  assert.deepEqual((await stored(failedStep.page)).selectedCategoryIds, ['category-lashes'])
  failedStep.state.failSave = false
  await failedStep.page.getByRole('button', { name: 'Continue', exact: true }).click()
  await routeIs(failedStep.page, '/onboarding/services')
  await failedStep.done()
  console.log('PASS intermediate save failure preserves selection and advances only after successful retry')
} finally {
  await browser?.close()
  await server.close()
  await rm(cacheDir, { recursive: true, force: true })
}
