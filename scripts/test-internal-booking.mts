#!/usr/bin/env -S npx tsx
// Local regression for the two internal booking videos. All API calls are mocked;
// no database, email, uploaded files, or remote service is used.
// Run: npx tsx scripts/test-internal-booking.mts
import assert from 'node:assert/strict'
import { chromium, type Locator, type Page } from 'playwright'
import { createServer } from 'vite'
import {
  fallbackAppointments, fallbackCategories, fallbackClients,
  fallbackProfessionals, fallbackSalon, fallbackServices,
} from '../src/data/fallback-data.ts'
import type { AppointmentDraft } from '../src/pages/app/appointment-booking/types.ts'

const draftKey = 'glamhour:new-appointment-draft'
const client = fallbackClients[0]
const service = fallbackServices[0]
const provider = { ...fallbackProfessionals[0], durationMinutes: 90 }
const salon = { ...fallbackSalon, timezone: 'UTC' }
const appointmentId = '70000000-0000-0000-0000-000000000099'
const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const date = futureDate(7)
const editedDate = futureDate(9)
const signature = '10,10 20,20 30,15'
const hand = {
  thumb: { widthMm: '12', capsuleNumber: '1' },
  index: { widthMm: '11', capsuleNumber: '2' },
  middle: { widthMm: '11', capsuleNumber: '3' },
  ring: { widthMm: '10', capsuleNumber: '4' },
  pinky: { widthMm: '9', capsuleNumber: '5' },
}
const clinicalDetails = {
  nailServiceType: 'Dual system', nailType: 'Almond',
  materialIds: ['local-polygel'], materialLabels: ['Polygel'], materials: ['Polygel'],
  handMode: 'finger', rightHand: hand, leftHand: hand,
  healthAnswers: { chemical_allergies: 'yes', diabetic: 'no' },
  healthFullName: client.full_name, healthEmail: client.email,
  consentAccepted: true, consentDate: date, consentTime: '10:00',
  professionalSignature: signature, clientSignature: signature,
  consents: [{ type: 'appointment_consent', text: 'Local regression consent', accepted: true, version: 1 }],
  photoConsent: true,
  mediaItems: [{ storageKey: 'local/regression.png', url: '/local-regression.png', mimeType: 'image/png', mediaType: 'reference' }],
  appointmentNotes: 'Preserve the clinical notes', appointmentPriceMinor: 8750,
}

type Scenario = { flow: 'quick' | 'clinical'; translated: boolean; recovery?: boolean; withProvider?: boolean }
type Mutation = { method: string; path: string; body: Record<string, unknown> }

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function translateText(locator: Locator) {
  await locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const textNodes: Node[] = []
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node.textContent?.trim() && !node.parentElement?.closest('script,style,option,textarea')) textNodes.push(node)
    }
    for (const node of textNodes) {
      const outer = document.createElement('font')
      const inner = document.createElement('font')
      outer.style.verticalAlign = inner.style.verticalAlign = 'inherit'
      inner.textContent = node.textContent?.replace('Create appointment', 'Crear cita').replace(/^Confirm$/, 'Confirmar') ?? ''
      outer.append(inner)
      node.parentNode?.replaceChild(outer, node)
    }
  })
}

async function assertLoading(page: Page, button: Locator, errors: string[], flow: string) {
  try {
    await button.locator('svg.animate-spin').waitFor({ timeout: 3000 })
  } catch {
    throw new Error(`${flow}: the app disappeared when the loading spinner started. Browser errors: ${errors.join('; ') || '(none)'}`)
  }
  assert.equal(await button.isDisabled(), true, 'loading button prevents another submission')
  assert.ok(await page.locator('#root').innerText(), 'the application stays mounted')
}

async function checkPickers(page: Page, flow: Scenario['flow'], errors: string[]) {
  for (const type of flow === 'clinical' ? ['date', 'time'] : ['date']) {
    const input = page.locator(`input[type="${type}"]`)
    for (const mode of ['supported', 'unavailable', 'throws'] as const) {
      await input.evaluate((element: HTMLInputElement, mode) => {
        element.dataset.pickerCalls = '0'
        Object.defineProperty(element, 'showPicker', {
          configurable: true,
          value: mode === 'unavailable' ? undefined : function () {
            element.dataset.pickerCalls = String(Number(element.dataset.pickerCalls) + 1)
            if (mode === 'throws') throw new DOMException('Local embedded-browser simulation', 'NotAllowedError')
          },
        })
      }, mode)
      // Click the field body, away from the browser's calendar/clock affordance.
      await input.click({ position: { x: 8, y: 20 } })
      assert.equal(await input.getAttribute('data-picker-calls'), mode === 'unavailable' ? '0' : '1', `${flow} ${type}: ${mode} picker`)
      assert.equal(await input.evaluate((element) => document.activeElement === element), true, 'fallback preserves focus')
      await input.press('Escape')
      assert.deepEqual(errors, [], `${flow} ${type}: unavailable/rejected native picker cannot crash the app`)
    }
    // Remove the per-element override so subsequent value edits use the browser.
    await input.evaluate((element) => { Reflect.deleteProperty(element, 'showPicker') })
  }
  console.log(`PASS ${flow} native picker clicks, missing API, and rejected API fallback`)
}

const server = await createServer({
  logLevel: 'error',
  cacheDir: 'node_modules/.vite-internal-booking-regression',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/__internal_mock_api__'),
    'import.meta.env.VITE_SALON_ID': JSON.stringify(salon.id),
  },
  server: { host: '127.0.0.1', port: 0 },
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let failed = 0
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  async function runScenario(scenario: Scenario) {
    const { flow, translated, recovery = false, withProvider = false } = scenario
    const label = `${flow}, ${translated ? 'translated' : 'original'}, ${recovery ? 'error and retry' : 'success'}, ${withProvider ? 'assigned provider' : 'optional provider'}`
    const context = await browser!.newContext({ viewport: { width: 393, height: 850 }, timezoneId: 'UTC', serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(6000)
    const errors: string[] = []
    const unexpected: string[] = []
    const mutations: Mutation[] = []
    const firstResponse = deferred()
    let attempts = 0
    let createdAppointment: Record<string, unknown> | undefined
    const initialDraft: AppointmentDraft = {
      categoryId: fallbackCategories[0].id, categoryCode: 'nails', serviceId: service.id,
      clientId: client.id, providerId: withProvider ? provider.id : '',
      date, startsAt: flow === 'clinical' ? `${date}T10:00:00.000Z` : '',
      endsAt: flow === 'clinical' ? `${date}T11:30:00.000Z` : '',
      notes: 'Original note', details: flow === 'clinical' ? clinicalDetails : { consentTime: '10:00' },
      ...(flow === 'quick' ? { entryPoint: 'home' as const } : {}),
    }
    page.on('pageerror', (error) => errors.push(error.message))
    await context.addInitScript(({ initialDraft, salonId, draftKey }) => {
      sessionStorage.setItem('glamhour:active-salon-id', salonId)
      sessionStorage.setItem(draftKey, JSON.stringify(initialDraft))
    }, { initialDraft, salonId: salon.id, draftKey })
    // Fail closed: all API requests are answered here. No other origin is allowed.
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      if (url.origin !== origin) {
        unexpected.push(`external ${request.method()} ${url.origin}${path}`)
        return route.abort('blockedbyclient')
      }
      if (!path.startsWith('/__internal_mock_api__/')) {
        if (path.startsWith('/api/')) {
          unexpected.push(`unmocked ${request.method()} ${path}`)
          return route.abort('blockedbyclient')
        }
        return route.continue()
      }
      const respond = (data: unknown) => route.fulfill({ json: { data } })
      const method = request.method()
      if (method === 'POST' && path.endsWith('/appointments')) {
        attempts += 1
        const body = request.postDataJSON()
        mutations.push({ method, path, body })
        if (attempts === 1) {
          await firstResponse.promise
        }
        if (recovery && attempts === 1) {
          return route.fulfill({ status: 500, json: { error: { code: 'LOCAL_TEST_FAILURE', message: 'Local test: please retry your appointment.' } } })
        }
        createdAppointment = {
          ...fallbackAppointments[0], id: appointmentId, starts_at: body.startsAt, ends_at: body.endsAt,
          professional_id: body.professionalId, professional_name: body.professionalId ? provider.full_name : null,
          client_id: client.id, status_code: 'scheduled',
          ...(body.treatmentDetails ? { treatment_details_by_category: { nails: body.treatmentDetails } } : {}),
        }
        return respond(createdAppointment)
      }
      if (method === 'PATCH' && path.endsWith(`/appointments/${appointmentId}/status`)) {
        const body = request.postDataJSON()
        mutations.push({ method, path, body })
        createdAppointment = { ...createdAppointment, status_code: body.status }
        return respond(createdAppointment)
      }
      if (method === 'GET') {
        if (path.endsWith(`/salons/${salon.id}`)) return respond(salon)
        if (path.endsWith('/service-categories')) return respond(fallbackCategories)
        if (path.endsWith('/services')) return respond(fallbackServices)
        if (path.endsWith('/clients')) return respond(fallbackClients)
        if (path.endsWith('/professionals')) return respond(fallbackProfessionals)
        if (path.endsWith('/subscription')) return respond({
          planCode: 'premium_monthly', hasPremiumAccess: true,
          clientUsage: { limit: null, count: fallbackClients.length, canCreateClient: true, nearLimit: false },
        })
        if (path.endsWith('/providers/eligible')) return respond([provider])
        if (path.endsWith('/availability')) {
          const requestedDate = url.searchParams.get('date') ?? date
          return respond({ slots: [
            { time: '10:00', label: '10:00 AM', available: true, startsAt: `${requestedDate}T10:00:00.000Z`, endsAt: `${requestedDate}T11:30:00.000Z` },
            { time: '14:30', label: '2:30 PM', available: true, startsAt: `${requestedDate}T14:30:00.000Z`, endsAt: `${requestedDate}T16:00:00.000Z` },
          ] })
        }
        if (path.endsWith('/appointments')) return respond(createdAppointment ? [createdAppointment] : [])
        if (path.endsWith(`/appointments/${appointmentId}`)) return respond(createdAppointment)
      }
      unexpected.push(`${method} ${path}`)
      return route.fulfill({ status: 500, json: { error: { message: 'Unexpected local regression request' } } })
    })
    try {
      await page.goto(`${origin}/app/appointments/new`)
      const button = page.getByRole('button', { name: flow === 'quick' ? 'Create appointment' : 'Confirm', exact: true })
      await button.waitFor()
      if (!translated) await checkPickers(page, flow, errors)
      if (flow === 'clinical') {
        // The second video also edits the date/time after filling clinical details.
        await page.locator('input[type="date"]').fill(editedDate)
        await page.locator('input[type="time"]').fill('14:30')
        await page.getByLabel('Additional Notes').fill('Updated before translated confirmation')
      }
      if (translated) await translateText(page.locator('main').last())
      const submit = page.getByRole('button', { name: flow === 'quick' ? (translated ? 'Crear cita' : 'Create appointment') : (translated ? 'Confirmar' : 'Confirm'), exact: true })
      const requestStarted = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/appointments'))
      await submit.click()
      await assertLoading(page, submit, errors, label)
      await requestStarted
      // HTMLButtonElement.click() respects disabled and cannot issue a duplicate.
      await submit.evaluate((element: HTMLButtonElement) => { element.click(); element.click() })
      assert.equal(attempts, 1, 'only one booking request is sent while pending')
      firstResponse.resolve()
      if (recovery) {
        await page.getByText('Local test: please retry your appointment.', { exact: true }).waitFor()
        assert.equal(await submit.isEnabled(), true, 'API error re-enables the translated button')
        const saved = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}'), draftKey)
        assert.equal(saved.clientId, client.id)
        assert.equal(saved.serviceId, service.id)
        if (flow === 'clinical') {
          assert.deepEqual(saved.details.rightHand, hand)
          assert.equal(saved.details.professionalSignature, signature)
          assert.equal(saved.date, editedDate)
        }
        await submit.click()
      }
      await page.waitForURL(flow === 'quick' ? `**/app/calendar?date=${date}` : `**/app/appointments/${appointmentId}`)
      if (flow === 'clinical') await page.getByText(client.full_name, { exact: true }).first().waitFor()
      else await page.locator('main').first().waitFor()
      assert.ok(await page.locator('#root').innerText(), 'success navigation keeps the application mounted')
      assert.deepEqual(errors, [], `${label}: no uncaught browser exception`)
      assert.deepEqual(unexpected, [], `${label}: all requests are safely mocked`)
      assert.equal(attempts, recovery ? 2 : 1)
      const bookingRequests = mutations.filter((item) => item.method === 'POST')
      const expectedSchedule = flow === 'clinical'
        ? { startsAt: `${editedDate}T14:30:00.000Z`, endsAt: `${editedDate}T16:00:00.000Z` }
        : { startsAt: `${date}T10:00:00.000Z`, endsAt: `${date}T11:30:00.000Z` }
      const commonPayload = {
        source: 'internal', clientId: client.id, professionalId: withProvider ? provider.id : null,
        serviceIds: [service.id], ...expectedSchedule,
      }
      const expectedPayload = flow === 'quick' ? commonPayload : {
        ...commonPayload,
        customerNotes: 'Updated before translated confirmation', treatmentNotes: 'Updated before translated confirmation',
        priceOverrideMinor: 8750,
        treatmentDetails: {
          category: 'nails', ...clinicalDetails, consentTime: '14:30', appointmentNotes: 'Updated before translated confirmation',
          signatures: [
            { type: 'professional_signature', signerName: 'Provider', data: signature },
            { type: 'client_signature', signerName: client.full_name, data: signature },
          ],
          consents: [...clinicalDetails.consents, {
            type: 'nails_photography_consent', version: 1, accepted: true,
            text: 'Client authorizes taking and storing photographs for this appointment.',
          }],
        },
      }
      for (const request of bookingRequests) assert.deepEqual(request.body, expectedPayload, 'all clinical/booking fields survive submission and retry')
      const statusRequests = mutations.filter((item) => item.method === 'PATCH')
      assert.equal(statusRequests.length, flow === 'clinical' ? 1 : 0)
      if (statusRequests.length) assert.deepEqual(statusRequests[0].body, { status: 'coming_up', actorRole: 'owner' })
      console.log(`PASS ${label}`)
    } finally {
      firstResponse.resolve()
      await context.close()
    }
  }

  const scenarios: Scenario[] = [
    { flow: 'quick', translated: false, withProvider: true },
    { flow: 'quick', translated: true },
    { flow: 'quick', translated: true, recovery: true },
    { flow: 'clinical', translated: false, withProvider: true },
    { flow: 'clinical', translated: true, withProvider: true },
    { flow: 'clinical', translated: true, recovery: true, withProvider: true },
  ]
  for (const scenario of scenarios) {
    try { await runScenario(scenario) } catch (error) {
      failed += 1
      console.error(`FAIL ${scenario.flow} (${scenario.translated ? 'translated' : 'original'}):`, error)
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
assert.equal(failed, 0, `${failed} internal booking regression scenario(s) failed`)
