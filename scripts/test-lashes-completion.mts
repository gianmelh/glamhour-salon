#!/usr/bin/env -S npx tsx
// Real lashes registration + parent booking flow. All APIs and photos are local.
import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { fallbackAppointments, fallbackCategories, fallbackClients, fallbackProfessionals, fallbackSalon, fallbackServices } from '../src/data/fallback-data.ts'
import type { AppointmentDraft } from '../src/pages/app/appointment-booking/types.ts'

const apiPrefix = '/__lashes_completion_api__'
const cacheDir = 'node_modules/.vite-lashes-completion'
const draftKey = 'glamhour:new-appointment-draft'
const appointmentId = '70000000-0000-0000-0000-000000000099'
const category = fallbackCategories.find(category => category.code === 'lashes')!
const service = fallbackServices.find(service => service.category_id === category.id)!
const client = fallbackClients[0]
const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
const zones = [8, 9, 10, 11, 12, 13, 14]
const entries = zones.map(position => ({ position, length: 10 }))
const previewStickers = {
  a: { assetSide: 'left', xPct: 30, yPct: 45, scale: 1, rotationDeg: -4, warpPoints: [{ xPct: 12, yPct: 45 }, { xPct: 50, yPct: 35 }, { xPct: 88, yPct: 44 }] },
  b: { assetSide: 'right', xPct: 70, yPct: 46, scale: 1, rotationDeg: 3, warpPoints: [{ xPct: 10, yPct: 44 }, { xPct: 49, yPct: 36 }, { xPct: 89, yPct: 46 }] },
}
const completeDetails = {
  style: 'Anime', variant: 'Classic', eyeShape: 'Almond eyes', volume: 'Classic', curl: 'C', thickness: '0.07',
  defaultLength: '10', lashMapLength: 10, registrationStep: 'lash-map', activeLashEye: 'rightEye',
  photoPreviewUrl: '/__lash_photo__.svg', photoStorageKey: 'local/lashes-photo.svg',
  lashMap: { rightEye: entries, leftEye: entries }, lashPreviewStickers: previewStickers,
}
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewAppointmentPage } from '/src/pages/app/appointment-booking/NewAppointmentPage.tsx';
import '/src/index.css';
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, { initialEntries: ['/app/appointments/new'] },
  React.createElement(Routes, null,
    React.createElement(Route, { path: '/app/appointments/new', element: React.createElement(NewAppointmentPage) }),
    React.createElement(Route, { path: '/app/appointments/:id', element: React.createElement('h1', null, 'Saved appointment fixture') }))));
</script></body></html>`
const server = await createServer({
  logLevel: 'error', cacheDir,
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiPrefix), 'import.meta.env.VITE_SALON_ID': JSON.stringify(fallbackSalon.id) },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'lashes-completion-fixture', configureServer(vite) {
    vite.middlewares.use('/__lash_photo__.svg', (_req, res) => {
      res.setHeader('Content-Type', 'image/svg+xml')
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="393" height="431"><rect width="393" height="431" fill="#e6d4ca"/></svg>')
    })
    vite.middlewares.use('/__lashes_completion__', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html)) }
      catch (error) { next(error) }
    })
  } }],
})

type Mutation = { method: string; path: string; body: Record<string, unknown> }
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let origin: string
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
async function fixture(mode: 'new' | 'edit-retry' | 'create-service-retry', detailsOverride: Record<string, unknown> = {}) {
  const context = await browser!.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'UTC', serviceWorkers: 'block' })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const errors: string[] = []
  const unexpected: string[] = []
  const mutations: Mutation[] = []
  const firstResponse = deferred()
  let attempts = 0
  let catalog = mode === 'create-service-retry' ? [] : fallbackServices
  const draft: AppointmentDraft = {
    categoryId: category.id, categoryCode: 'lashes', serviceId: mode === 'edit-retry' ? service.id : '',
    clientId: client.id, providerId: '', date, startsAt: '', endsAt: '', notes: 'Preserve lash treatment notes',
    details: { ...(mode === 'new' ? { ...completeDetails, registrationStep: 'photo-preview', lashMap: {} } : completeDetails), ...detailsOverride },
    ...(mode === 'edit-retry' ? { appointmentId } : {}),
  }
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(({ draft, salonId, draftKey }) => {
    sessionStorage.setItem('glamhour:active-salon-id', salonId)
    // Reload must restore the user's latest draft, not reseed this initial fixture.
    if (!sessionStorage.getItem(draftKey)) sessionStorage.setItem(draftKey, JSON.stringify(draft))
  }, { draft, salonId: fallbackSalon.id, draftKey })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) { unexpected.push(`external ${url.origin}`); return route.abort('blockedbyclient') }
    if (!url.pathname.startsWith(apiPrefix)) return route.continue()
    const path = url.pathname.slice(apiPrefix.length)
    const respond = (data: unknown) => route.fulfill({ json: { data } })
    if (request.method() === 'GET') {
      if (path.endsWith(`/salons/${fallbackSalon.id}`)) return respond(fallbackSalon)
      if (path.endsWith('/service-categories')) return respond(fallbackCategories)
      if (path.endsWith('/services')) return respond(catalog)
      if (path.endsWith('/clients')) return respond(fallbackClients)
      if (path.endsWith('/professionals')) return respond(fallbackProfessionals)
      if (path.endsWith('/appointments')) return respond([])
      if (path.endsWith('/providers/eligible')) return respond([])
      if (path.endsWith('/subscription')) return respond({ hasPremiumAccess: true, clientUsage: { canCreateClient: true, count: 1, limit: null } })
    }
    if ((mode === 'edit-retry' && request.method() === 'PATCH' && path.endsWith('/treatment-details'))
      || (mode === 'create-service-retry' && request.method() === 'POST' && path.endsWith('/services'))) {
      attempts++
      mutations.push({ method: request.method(), path, body: request.postDataJSON() })
      if (attempts === 1) {
        await firstResponse.promise
        return route.fulfill({ status: 503, json: { error: { code: 'LOCAL_FAILURE', message: 'Local fixture: save failed. Please retry.' } } })
      }
      if (mode === 'create-service-retry') { catalog = [service]; return respond(service) }
      return respond({ ...fallbackAppointments[0], id: appointmentId, treatment_details_by_category: { lashes: request.postDataJSON().treatmentDetails } })
    }
    unexpected.push(`${request.method()} ${path}`)
    return route.fulfill({ status: 500, json: { error: { message: 'Unexpected local request' } } })
  })
  await page.goto(`${origin}/__lashes_completion__`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  return {
    page, mutations, errors, firstResponse,
    done: async () => { firstResponse.resolve(); assert.deepEqual(errors, [], 'No uncaught promise or React errors'); assert.deepEqual(unexpected, [], 'All requests use local mocks'); await context.close() },
  }
}
const readDraft = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), draftKey)
function treatmentDetails(details: Record<string, unknown>) {
  const { registrationStep: _step, previewReturnStep: _returnStep, ...treatment } = details
  return treatment
}
async function assertMapRestored(page: Page, expected: Record<string, unknown>) {
  const side = expected.activeLashEye === 'leftEye' ? 'Left' : 'Right'
  await page.getByText(`${side} side · 7/7 zones`, { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Preview', exact: true }).waitFor()
  const restored = (await readDraft(page)).details
  assert.equal(restored.registrationStep, 'lash-map')
  assert.ok(!restored.previewReturnStep, 'returning from preview clears its navigation marker')
  assert.deepEqual(treatmentDetails(restored), treatmentDetails(expected), 'map, lengths, eye, photo and sticker state survive the preview round trip')
}
async function waitForPreview(page: Page) {
  await page.getByRole('button', { name: 'Use this combination', exact: true }).waitFor()
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('.lash-preview-sticker img')]
    return images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0)
  })
}
async function mapEye(page: Page) {
  for (const position of zones) await page.getByRole('button', { name: new RegExp(`^Lash map position ${position}(?:,|$)`) }).click()
}
async function assertPending(page: Page, scenario: Awaited<ReturnType<typeof fixture>>) {
  const busy = page.getByRole('button', { name: 'Saving...', exact: true })
  await busy.waitFor()
  assert.equal(await busy.isDisabled(), true)
  assert.equal(await busy.getAttribute('aria-busy'), 'true')
  await busy.evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  assert.equal(scenario.mutations.length, 1, 'pending completion cannot create duplicate requests')
}

try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  const fresh = await fixture('new')
  await fresh.page.getByRole('button', { name: 'Use this combination', exact: true }).click()
  const nextEye = fresh.page.getByRole('button', { name: 'Continue to left eye', exact: true })
  assert.equal(await nextEye.isDisabled(), true)
  await mapEye(fresh.page)
  assert.equal(await nextEye.isEnabled(), true)
  await nextEye.click()
  await fresh.page.getByText('Left side · 0/7 zones', { exact: true }).waitFor()
  await mapEye(fresh.page)
  assert.deepEqual((await readDraft(fresh.page)).details.lashMap, { rightEye: entries, leftEye: entries })
  // Distinct lengths and a non-Classic volume make accidental resets observable.
  await fresh.page.getByRole('button', { name: '12', exact: true }).click()
  await fresh.page.getByRole('button', { name: /^Lash map position 8,/ }).click()
  await fresh.page.getByRole('button', { name: '3D', exact: true }).click()
  const completedMap = (await readDraft(fresh.page)).details
  assert.equal(completedMap.activeLashEye, 'leftEye')
  assert.equal(completedMap.defaultLength, '12')
  assert.equal(completedMap.lashMapLength, 12)
  assert.equal(completedMap.volume, '3D')
  for (const eye of ['a', 'b']) assert.equal(completedMap.lashPreviewStickers[eye].warpPoints.length, 3)
  await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
  await fresh.page.getByRole('button', { name: 'Preview', exact: true }).scrollIntoViewIfNeeded()
  await fresh.page.screenshot({ path: '/private/tmp/glamhour-pdf-review/lashes-map-preview-button.png', fullPage: true })
  await fresh.page.screenshot({ path: '/private/tmp/glamhour-pdf-review/lashes-map-preview-button-mobile.png' })

  await fresh.page.getByRole('button', { name: 'Preview', exact: true }).click()
  await waitForPreview(fresh.page)
  const reopened = (await readDraft(fresh.page)).details
  assert.equal(reopened.registrationStep, 'photo-preview')
  assert.equal(reopened.previewReturnStep, 'lash-map')
  assert.deepEqual(treatmentDetails(reopened), treatmentDetails(completedMap), 'opening Preview does not reset an existing 3D volume or other details')
  const leftSticker = fresh.page.getByRole('button', { name: 'left eye lash sticker', exact: true })
  await leftSticker.press('Enter')
  assert.equal(await leftSticker.locator('.lash-preview-warp-point').count(), 3)
  await fresh.page.getByRole('button', { name: 'Increase lash size', exact: true }).click()
  await fresh.page.waitForFunction(({ key, previous }) => JSON.parse(sessionStorage.getItem(key)!).details.lashPreviewStickers.a.scale !== previous, {
    key: draftKey, previous: completedMap.lashPreviewStickers.a.scale,
  })
  const adjusted = (await readDraft(fresh.page)).details
  assert.deepEqual(adjusted.lashPreviewStickers.a.warpPoints, completedMap.lashPreviewStickers.a.warpPoints, 'resizing preserves all three curve control points')
  assert.deepEqual(adjusted.lashPreviewStickers.b, completedMap.lashPreviewStickers.b, 'adjusting one sticker leaves the other eye intact')
  assert.deepEqual(adjusted.lashMap, completedMap.lashMap)
  assert.equal(adjusted.volume, '3D')
  await fresh.page.getByRole('button', { name: 'Use this combination', exact: true }).click()
  await assertMapRestored(fresh.page, adjusted)

  await fresh.page.getByRole('button', { name: 'Preview', exact: true }).click()
  await waitForPreview(fresh.page)
  await fresh.page.reload({ waitUntil: 'domcontentloaded' })
  await waitForPreview(fresh.page)
  const afterReload = (await readDraft(fresh.page)).details
  assert.equal(afterReload.previewReturnStep, 'lash-map', 'reload retains the return destination')
  assert.deepEqual(treatmentDetails(afterReload), treatmentDetails(adjusted))
  await fresh.page.getByRole('button', { name: 'Back', exact: true }).click()
  await assertMapRestored(fresh.page, adjusted)
  assert.deepEqual(fresh.mutations, [], 'opening, adjusting, reloading and leaving Preview cannot save a booking early')
  await fresh.page.getByRole('button', { name: 'Mark service as complete', exact: true }).click()
  await fresh.page.getByRole('heading', { name: 'Appointment Details', exact: true }).waitFor()
  assert.deepEqual(fresh.mutations, [], 'finishing treatment details must not create or update an appointment yet')
  const afterTransition = await readDraft(fresh.page)
  assert.deepEqual(afterTransition.details.lashMap, completedMap.lashMap)
  assert.deepEqual(afterTransition.details.lashPreviewStickers, adjusted.lashPreviewStickers)
  assert.equal(afterTransition.details.volume, '3D')
  assert.ok(!afterTransition.details.registrationStep, 'completion clears the lashes registration step')
  assert.ok(!afterTransition.details.previewReturnStep, 'completion clears the Preview return destination')
  assert.equal(afterTransition.serviceId, service.id)
  await fresh.done()
  console.log('PASS completed maps reopen Preview, preserve 3D volume/lengths/eye/photo, retain adjusted three-point stickers through confirm/Back/reload and complete without premature booking')

  for (const variant of ['Classic', '']) {
    const missingPhoto = await fixture('new', {
      ...completeDetails, variant, volume: '3D', activeLashEye: 'leftEye', photoPreviewUrl: '', photoStorageKey: '',
    })
    await missingPhoto.page.getByRole('button', { name: 'Preview', exact: true }).waitFor()
    const before = (await readDraft(missingPhoto.page)).details
    await missingPhoto.page.getByRole('button', { name: 'Preview', exact: true }).click()
    await missingPhoto.page.getByRole('heading', { name: variant ? 'Add photo' : 'Select variant', exact: true }).waitFor()
    assert.equal((await readDraft(missingPhoto.page)).details.previewReturnStep, 'lash-map')
    await missingPhoto.page.getByRole('button', { name: 'Back', exact: true }).click()
    await assertMapRestored(missingPhoto.page, before)
    assert.deepEqual(missingPhoto.mutations, [])
    await missingPhoto.done()
    console.log(`PASS map Preview with ${variant ? 'no photo' : 'no photo or variant'} returns with Back and preserves completed maps without an API mutation`)
  }

  const edit = await fixture('edit-retry')
  const mark = edit.page.getByRole('button', { name: 'Mark service as complete', exact: true })
  await mark.click()
  await assertPending(edit.page, edit)
  edit.firstResponse.resolve()
  await edit.page.getByText('Local fixture: save failed. Please retry.', { exact: true }).waitFor()
  await mark.waitFor()
  assert.equal(await mark.isEnabled(), true)
  assert.equal(await edit.page.getByRole('button', { name: /^Lash map position / }).count(), 7)
  const failedDraft = await readDraft(edit.page)
  assert.equal(failedDraft.appointmentId, appointmentId)
  assert.deepEqual(failedDraft.details, completeDetails, 'failed save retains the exact treatment and registration step')
  assert.equal(edit.mutations.length, 1)
  assert.deepEqual(edit.errors, [])
  await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
  await edit.page.getByText('Local fixture: save failed. Please retry.', { exact: true }).scrollIntoViewIfNeeded()
  await edit.page.screenshot({ path: '/private/tmp/glamhour-pdf-review/lashes-completion-retry.png' })
  await mark.click()
  await edit.page.getByRole('heading', { name: 'Saved appointment fixture', exact: true }).waitFor()
  assert.equal(edit.mutations.length, 2)
  assert.deepEqual(edit.mutations[1], edit.mutations[0], 'retry sends the same treatment exactly once')
  assert.equal(edit.mutations[0].method, 'PATCH')
  assert.equal(edit.mutations[0].path, `/salons/${fallbackSalon.id}/appointments/${appointmentId}/treatment-details`)
  const payload = edit.mutations[0].body.treatmentDetails as Record<string, unknown>
  assert.deepEqual(payload.lashMap, completeDetails.lashMap)
  assert.deepEqual(payload.lashPreviewStickers, previewStickers)
  assert.equal(payload.registrationStep, undefined, 'UI-only navigation state is not sent in the treatment payload')
  assert.equal(payload.previewReturnStep, undefined, 'Preview return navigation is not sent in the treatment payload')
  const clearedDraft = await readDraft(edit.page)
  if (clearedDraft) {
    assert.equal(clearedDraft.appointmentId, undefined)
    assert.equal(clearedDraft.serviceId, '')
    assert.deepEqual(clearedDraft.details, {}, 'successful save clears clinical data even if the storage effect writes an empty draft')
  }
  await edit.done()
  console.log('PASS failed clinical save remains on the lash map, exposes the error, prevents duplicate clicks and retries with identical three-point data')

  const create = await fixture('create-service-retry')
  const createMark = create.page.getByRole('button', { name: 'Mark service as complete', exact: true })
  await createMark.click()
  await assertPending(create.page, create)
  create.firstResponse.resolve()
  await create.page.getByRole('alert').filter({ hasText: 'Local fixture: save failed. Please retry.' }).waitFor()
  assert.equal(await createMark.isEnabled(), true)
  assert.deepEqual((await readDraft(create.page)).details, completeDetails)
  await createMark.click()
  await create.page.getByRole('heading', { name: 'Appointment Details', exact: true }).waitFor()
  assert.equal(create.mutations.length, 2)
  assert.ok(create.mutations.every(mutation => mutation.method === 'POST' && mutation.path.endsWith('/services')))
  assert.deepEqual(create.mutations[1], create.mutations[0])
  assert.deepEqual((await readDraft(create.page)).details.lashPreviewStickers, previewStickers)
  await create.done()
  console.log('PASS missing service creation failure exposes an actionable error and retries without creating an appointment early')
} finally {
  await browser?.close()
  await server.close()
  await rm(cacheDir, { recursive: true, force: true })
}
