#!/usr/bin/env -S npx tsx
// Booking catalog regression. All API traffic is mocked; no database is used.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fallbackAppointments, fallbackCategories, fallbackClients, fallbackProfessionals, fallbackSalon, fallbackServices } from '../src/data/fallback-data.ts'
import { buildAppointmentCategories } from '../src/pages/app/appointment-booking/constants.ts'
import { emptyDraft } from '../src/pages/app/appointment-booking/draft.ts'
import type { AppointmentDraft, BookingCategoryCode } from '../src/pages/app/appointment-booking/types.ts'
import type { ServiceCategory } from '../src/types/api.ts'

const enabled = fallbackCategories.filter((category) => ['nails', 'cosmetology'].includes(category.code))
const services = [
  ...fallbackServices,
  {
    ...fallbackServices[0], id: '60000000-0000-0000-0000-000000000007',
    category_id: fallbackCategories[3].id, category_name: 'Micropigmentation', name: 'Eyebrow micropigmentation',
  },
]
assert.deepEqual(buildAppointmentCategories(enabled).map((category) => category.code), ['nails', 'cosmetology'])
assert.deepEqual(buildAppointmentCategories([]), [], 'an empty catalog must not synthesize categories')
assert.deepEqual(buildAppointmentCategories([{ ...fallbackCategories[1], is_active: false }]), [])

const server = await createServer({
  logLevel: 'error',
  cacheDir: 'node_modules/.vite-booking-categories-regression',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/__catalog_mock_api__'),
    'import.meta.env.VITE_SALON_ID': JSON.stringify(fallbackSalon.id),
  },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  async function scenario(name: string, options: {
    categories?: ServiceCategory[]
    draft?: AppointmentDraft
    inactiveService?: boolean
    historical?: boolean
    disableOnFocus?: boolean
    failCatalog?: 'service-categories' | 'services'
    detailsScreen?: BookingCategoryCode
    screenshot?: string
  } = {}) {
    const context = await browser!.newContext({ viewport: { width: 393, height: 850 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(6000)
    const errors: string[] = []
    const unexpected: string[] = []
    const schedulingRequests: string[] = []
    const catalogRequests: string[] = []
    let availableCategories = options.categories ?? enabled
    page.on('pageerror', (error) => errors.push(error.message))
    await context.addInitScript(({ salonId, draft }) => {
      sessionStorage.setItem('glamhour:active-salon-id', salonId)
      if (draft) sessionStorage.setItem('glamhour:new-appointment-draft', JSON.stringify(draft))
    }, { salonId: fallbackSalon.id, draft: options.draft })
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort('blockedbyclient')
      const path = url.pathname
      if (!path.startsWith('/__catalog_mock_api__/')) {
        if (path.startsWith('/api/')) {
          unexpected.push(`Unmocked API: ${path}`)
          return route.abort('blockedbyclient')
        }
        return route.continue()
      }
      const respond = (data: unknown) => route.fulfill({ json: { data } })
      if (request.method() === 'GET') {
        if (options.failCatalog && path.endsWith(`/${options.failCatalog}`)) {
          return route.fulfill({ status: 503, json: { error: { message: 'Catalog unavailable' } } })
        }
        if (path.endsWith(`/salons/${fallbackSalon.id}`)) return respond(fallbackSalon)
        if (path.endsWith('/service-categories')) {
          catalogRequests.push(url.searchParams.get('includeAll') ?? 'false')
          return respond(options.historical && url.searchParams.get('includeAll') === 'true'
            ? fallbackCategories : availableCategories)
        }
        if (path.endsWith('/services')) return respond(services.map((service) => (
          options.inactiveService && service.id === fallbackServices[0].id ? { ...service, is_active: false } : service
        )))
        if (path.endsWith('/clients')) return respond(fallbackClients)
        if (path.endsWith('/professionals')) return respond(fallbackProfessionals)
        if (path.endsWith('/appointments')) return respond([])
        if (path.endsWith('/appointments/existing-appointment')) return respond({ ...fallbackAppointments[0], id: 'existing-appointment' })
        if (path.endsWith('/subscription')) return respond({
          hasPremiumAccess: true,
          clientUsage: { limit: null, count: fallbackClients.length, canCreateClient: true, nearLimit: false },
        })
        if (path.endsWith('/providers/eligible')) {
          schedulingRequests.push(path)
          return respond([])
        }
        if (path.endsWith('/availability')) {
          schedulingRequests.push(path)
          return respond({ slots: [] })
        }
        if (path.endsWith('/materials') || path.endsWith('/service-materials')) return respond([])
      }
      unexpected.push(`${request.method()} ${path}`)
      return route.fulfill({ status: 500, json: { error: { message: 'Unexpected regression request' } } })
    })
    async function assertInlineCategories() {
      const group = page.getByRole('group', { name: 'Available service categories', exact: true })
      await group.and(page.locator('[aria-busy="false"]')).waitFor()
      const labels = (await group.locator(':scope > span').allTextContents()).map((label) => label.trim().toLowerCase()).sort()
      const expected = availableCategories.filter((category) => category.is_active).map((category) => category.name.toLowerCase()).sort()
      assert.deepEqual(labels, expected, 'inline details tabs contain exactly the salon enabled categories')
      for (const category of fallbackCategories) {
        assert.equal(
          await group.getByText(new RegExp(`^${category.name}$`, 'i')).count(),
          expected.includes(category.name.toLowerCase()) ? 1 : 0,
          `${category.name} must appear once only when enabled in this salon`,
        )
      }
    }
    try {
      await page.goto(`${origin}/app/appointments/new`)
      if (options.disableOnFocus) {
        await page.getByRole('button', { name: 'Create appointment', exact: true }).waitFor()
        availableCategories = []
        await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      }
      if (options.failCatalog) {
        await page.getByText('Appointment data could not be loaded.', { exact: true }).waitFor()
        assert.deepEqual(schedulingRequests, [], 'catalog failures cannot request provider eligibility or availability')
        assert.equal(await page.getByRole('heading', { name: 'Lashes', exact: true }).count(), 0)
      } else if (options.historical) {
        await page.getByRole('heading', { name: 'Details of service' }).waitFor()
        await assertInlineCategories()
        assert.ok(catalogRequests.includes('true'), 'existing clinical records can load their original category')
        assert.ok(catalogRequests.includes('false'), 'historical details tabs independently load current salon membership')
        assert.equal(await page.getByText('Service no longer available', { exact: true }).count(), 0)
        await page.getByRole('heading', { name: 'Lash style', exact: true }).waitFor()
        await page.getByRole('button', { name: 'Back', exact: true }).click()
        await page.waitForURL('**/app/appointments/existing-appointment')
        assert.equal(await page.getByRole('heading', { name: 'Services', exact: true }).count(), 0, 'leaving historical details cannot open a new booking with disabled categories')
      } else if (options.detailsScreen) {
        const formHeadings: Record<BookingCategoryCode, string> = {
          nails: 'Type of service', lashes: 'Lash style', cosmetology: 'Skin Diagnosis', micropigmentation: 'Procedure details',
        }
        await page.getByRole('heading', { name: formHeadings[options.detailsScreen], exact: true }).waitFor()
        await assertInlineCategories()
        assert.equal(await page.getByText('Service no longer available', { exact: true }).count(), 0)
        if (options.screenshot) {
          await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
          await page.screenshot({ path: `/private/tmp/glamhour-pdf-review/${options.screenshot}`, fullPage: false })
        }
      } else if (options.draft) {
        await page.getByRole('heading', { name: 'Service no longer available' }).waitFor()
        if (!options.disableOnFocus) {
          assert.deepEqual(schedulingRequests, [], 'disabled drafts cannot request provider eligibility or availability')
        }
        if (options.draft.appointmentId) {
          await page.getByRole('button', { name: 'Return to appointment' }).click()
          await page.waitForURL('**/app/appointments/existing-appointment')
        } else {
          await page.getByRole('button', { name: 'Choose an available category' }).click()
          await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
        }
        const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('glamhour:new-appointment-draft') ?? '{}'))
        assert.equal(saved.categoryCode, '')
        assert.equal(saved.serviceId, '')
        assert.equal(saved.appointmentId, undefined, 'the unavailable draft is cleared after returning to its appointment')
      } else {
        await page.getByRole('heading', { name: 'Services', exact: true }).waitFor()
      }
      if (!options.failCatalog && !options.historical && !options.detailsScreen && !options.draft?.appointmentId) {
        assert.equal(await page.getByRole('heading', { name: 'Lashes', exact: true }).count(), 0)
        assert.equal(await page.getByRole('heading', { name: 'Micropigmentation', exact: true }).count(), 0)
        if (availableCategories.length === 0) {
          await page.getByText('No service categories are available.', { exact: false }).waitFor()
          assert.equal(await page.getByRole('heading', { name: 'Nails', exact: true }).count(), 0)
        } else {
          await page.getByRole('heading', { name: 'Nails', exact: true }).waitFor()
          await page.getByRole('heading', { name: 'Cosmetology', exact: true }).waitFor()
        }
      }
      assert.deepEqual(errors, [], 'no browser exceptions')
      assert.deepEqual(unexpected, [], 'all API calls are safely mocked')
      console.log(`PASS ${name}`)
    } finally { await context.close() }
  }

  const disabledDraft: AppointmentDraft = {
    ...emptyDraft(), categoryId: fallbackCategories[1].id, categoryCode: 'lashes', serviceId: fallbackServices[1].id,
    clientId: fallbackClients[0].id, providerId: fallbackProfessionals[0].id,
    date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    startsAt: new Date(Date.now() + 7 * 86400000).toISOString(), details: { style: 'Cat eye' },
  }
  await scenario('only enabled categories appear, even with leftover disabled-category services')
  await scenario('empty salon catalog remains empty', { categories: [] })
  await scenario('failed category catalog never uses demo categories for booking', { draft: disabledDraft, failCatalog: 'service-categories' })
  await scenario('failed service catalog never uses demo services for booking', { draft: disabledDraft, failCatalog: 'services' })
  await scenario('disabled category in a saved clinical booking draft is blocked', { draft: disabledDraft })
  await scenario('disabled category in a saved quick booking draft is blocked', { draft: { ...disabledDraft, entryPoint: 'home' } })
  await scenario('disabled category cannot be rescheduled', { draft: { ...disabledDraft, appointmentId: 'existing-appointment', mode: 'reschedule' } })
  await scenario('an open quick booking discards a category disabled in settings when focus returns', {
    draft: {
      ...disabledDraft, categoryId: fallbackCategories[0].id, categoryCode: 'nails', serviceId: fallbackServices[0].id,
      entryPoint: 'home', details: { consentTime: '10:00' },
    },
    disableOnFocus: true,
  })
  await scenario('inactive service in an enabled category is blocked', {
    draft: { ...disabledDraft, categoryId: fallbackCategories[0].id, categoryCode: 'nails', serviceId: fallbackServices[0].id },
    inactiveService: true,
  })
  await scenario('existing clinical details remain editable after category is disabled', {
    draft: { ...disabledDraft, appointmentId: 'existing-appointment' }, historical: true,
  })
  for (const categoryCodes of [['nails', 'lashes'], ['cosmetology', 'micropigmentation']] as const) {
    const categories = fallbackCategories.filter((category) => categoryCodes.some((code) => code === category.code))
    for (const code of categoryCodes) {
      const category = categories.find((item) => item.code === code)!
      await scenario(`${code} details tabs show only this salon's ${categoryCodes.join(' + ')} categories`, {
        categories,
        draft: { ...emptyDraft(), categoryId: category.id, categoryCode: code, clientId: fallbackClients[0].id },
        detailsScreen: code,
        screenshot: code === 'lashes' || code === 'nails' ? `${code}-enabled-category-tabs.png` : undefined,
      })
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
