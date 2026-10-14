#!/usr/bin/env -S npx tsx
// Stateful, database-free lifecycle checks. All PostgreSQL calls are intercepted;
// unrecognized SQL and any network request fail the test immediately.
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'postgresql://local-test:local-test@127.0.0.1:1/not-used'
process.env.DOTENV_CONFIG_PATH = '/dev/null'
globalThis.fetch = async () => { throw new Error('Network is forbidden in category lifecycle tests') }
const { pool } = await import('../server/db.ts')
const { dataService } = await import('../server/services/data-service.ts')
const salonId = '10000000-0000-4000-8000-000000000001'
const providerId = '20000000-0000-4000-8000-000000000001'
const ids = ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003']
const categories = ['nails', 'lashes', 'micropigmentation'].map((code, i) => ({ id: ids[i], code, name: code, is_active: true }))
const services = categories.map((category, i) => ({
  id: `40000000-0000-4000-8000-00000000000${i + 1}`, salon_id: salonId, category_id: category.id,
  category_code: category.code, name: `${category.name} service`, slug: `${category.code}-service`,
  is_active: true, is_publicly_bookable: true, duration_minutes: 60, price_minor: 1000, currency_code: 'USD',
}))
services.push({ ...services[0], id: '40000000-0000-4000-8000-000000000004', name: 'Private service', is_publicly_bookable: false })
services.push({ ...services[0], id: '40000000-0000-4000-8000-000000000005', name: 'Inactive service', is_active: false })
const salon = { id: salonId, name: 'Local salon', slug: 'local-salon', currency_code: 'USD', timezone: 'UTC', booking_enabled: true, allow_public_booking: true, onboarding_status: 'completed' }
const provider = { id: providerId, salon_id: salonId, full_name: 'Provider', status: 'active', languages: ['English'] }
const assignments = new Map([[services[0].id, true], [services[1].id, true], [services[2].id, true]])
let enabled = new Set([ids[0], ids[1]])
let transactionOpen = false
let snapshot: Set<string> | undefined
let queries: string[] = []
const effective = (service: typeof services[number]) => service.is_active && enabled.has(service.category_id)

function runQuery(sql: string, values: readonly unknown[] = [], scope: 'pool' | 'client' = 'pool'): { rows: Record<string, unknown>[] } {
  queries.push(sql)
  if (sql === 'BEGIN') { transactionOpen = true; snapshot = new Set(enabled); return { rows: [] } }
  if (sql === 'COMMIT') { transactionOpen = false; snapshot = undefined; return { rows: [] } }
  if (sql === 'ROLLBACK') { enabled = snapshot ?? enabled; transactionOpen = false; snapshot = undefined; return { rows: [] } }
  if (/^(CREATE|ALTER|DO)\b/.test(sql)) return { rows: [] }
  if (sql.includes('FROM salon_subscriptions')) return { rows: [{ plan_code: 'premium_monthly', status: 'active', provider: 'manual', current_period_end: '2099-01-01T00:00:00Z', entitlements_json: {} }] }
  if (sql.includes('SELECT count(*) FROM clients')) return { rows: [{ count: '1' }] }
  if (sql.includes('SELECT c.email FROM clients c')) return { rows: [{ email: 'client@glamhour.test' }] }
  if (sql.includes('FROM public_booking_email_verifications')) return { rows: [{ verified_at: new Date() }] }
  if (sql.includes('FROM salons')) {
    if (scope === 'pool') assert.equal(transactionOpen, false, 'settings/public reads must occur after commit')
    return { rows: [{ ...salon }] }
  }
  if (sql.includes('UPDATE salons')) {
    assert.equal(values[1], 'completed', 'editing setup keeps completed onboarding status')
    assert.match(sql, /WHEN \$4::boolean THEN booking_enabled/, 'editing setup preserves the public booking flag')
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO onboarding_sessions')) return { rows: [] }
  if (sql.includes('SELECT id FROM service_categories WHERE id = ANY')) return { rows: categories.filter((row) => (values[0] as string[]).includes(row.id)).map(({ id }) => ({ id })) }
  if (sql.includes("SELECT id FROM service_categories WHERE code = 'nails'")) return { rows: [{ id: ids[0] }] }
  if (sql.includes('SELECT ssc.category_id')) return { rows: [...enabled].map((category_id) => ({ category_id })) }
  if (sql.trim().startsWith('SELECT 1 FROM salon_service_categories ssc')) return { rows: enabled.has(String(values[1])) ? [{ enabled: true }] : [] }
  if (sql.includes('UPDATE salon_service_categories')) {
    enabled = new Set((values[1] as string[] | undefined) ?? [])
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO salon_service_categories')) {
    const selected = Array.isArray(values[1]) ? values[1] as string[] : [String(values[1])]
    for (const id of selected) values[2] === false ? enabled.delete(id) : enabled.add(id)
    return { rows: [] }
  }
  if (sql.includes('FROM service_categories sc') || sql.includes('SELECT * FROM service_categories')) {
    if (sql.includes("sc.code = 'nails'")) return { rows: [{ ...categories[0], salon_enabled: enabled.has(ids[0]) }] }
    if (sql.includes('JOIN salon_service_categories')) return { rows: categories.filter((category) => enabled.has(category.id)) }
    return { rows: categories }
  }
  if (sql.includes('SELECT COUNT(*)::text AS count') && sql.includes('FROM appointments')) return { rows: [{ count: '0' }] }
  if (sql.includes('FROM professional_working_hours')) return { rows: [] }
  if (sql.includes('FROM salon_working_hours')) return { rows: [] }
  if (sql.includes('INSERT INTO salon_working_hours') || sql.includes('DELETE FROM professional_working_hours')) return { rows: [] }
  if (sql.includes('FROM service_materials')) return { rows: [] }
  if (sql.includes('FROM professionals p') && sql.includes('JOIN professional_services ps') && sql.includes('services_offered')) {
    assert.match(sql, /JOIN service_categories offered_category/)
    assert.match(sql, /JOIN salon_service_categories offered_salon_category/)
    assert.match(sql, /offered_salon_category.is_active/)
    const requested = services.find((service) => service.id === values[1])
    return { rows: requested && effective(requested) && assignments.get(requested.id) ? [{ ...provider, service_duration_minutes: 60, services_offered: services.filter((service) => effective(service) && assignments.get(service.id)).map((service) => service.name) }] : [] }
  }
  if (sql.includes('FROM professionals')) {
    if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] }
    return { rows: [{ ...provider, service_assignments: [...assignments].map(([service_id, is_active]) => ({ service_id, is_active })) }] }
  }
  if (sql.includes('UPDATE professionals')) {
    assert.ok(sql.includes('WHERE salon_id = $1 AND id = $2'), 'configured setup must not deactivate all existing staff')
    return { rows: [{ ...provider, languages: values[6] ?? ['English'] }] }
  }
  if (sql.includes('UPDATE professional_services')) {
    assert.match(sql, /JOIN salon_service_categories ssc/, 'editing staff preserves dormant assignments')
    for (const service of services.filter(effective)) if (assignments.has(service.id)) assignments.set(service.id, false)
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO professional_services')) {
    assignments.set(String(values[2]), true)
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO appointments')) return { rows: [{ id: '50000000-0000-4000-8000-000000000001', salon_id: salonId, status_code: 'scheduled' }] }
  if (sql.includes('INSERT INTO appointment_services')) return { rows: [{ id: '60000000-0000-4000-8000-000000000001' }] }
  if (sql.includes('INSERT INTO appointment_status_history')) return { rows: [] }
  if (sql.includes('FROM appointments')) return { rows: [] }
  if (sql.includes('FROM services s')) {
    if (sql.includes("$3::text <> 'public_booking'")) {
      assert.match(sql, /FOR SHARE OF ssc, sc, s/, 'booking locks category/service status until commit')
      return { rows: services.filter((service) => (values[1] as string[]).includes(service.id) && effective(service) && (values[2] !== 'public_booking' || service.is_publicly_bookable)) }
    }
    if (sql.includes('NOT $5::boolean')) {
      assert.match(sql, /EXISTS \(\s+SELECT 1 FROM salon_service_categories ssc/, 'public filtering happens before pagination')
      return { rows: services.filter((service) => service.is_active && (!values[4] || (effective(service) && service.is_publicly_bookable))) }
    }
    if (sql.includes('SELECT s.id')) return { rows: services.filter((service) => (values[1] as string[]).includes(service.id) && effective(service)).map(({ id }) => ({ id })) }
    // getNailSettings retains all definitions, including inactive services.
    return { rows: services.filter((service) => service.category_id === values[1]) }
  }
  if (sql.includes('SELECT id FROM services')) return { rows: services.filter((service) => service.category_id === values[1] && service.slug === values[2]).map(({ id }) => ({ id })) }
  if (sql.includes('UPDATE services')) {
    assert.ok(enabled.has(services.find((service) => service.id === values[1])!.category_id), 'wizard must not rewrite disabled definitions')
    return { rows: [{ id: values[1] }] }
  }
  if (sql.includes('INSERT INTO services')) {
    assert.ok(enabled.has(String(values[1])), 'cannot create services in disabled categories')
    if (sql.includes('ON CONFLICT')) {
      assert.match(sql, /WHERE services.category_id = EXCLUDED.category_id/, 'onboarding cannot overwrite another category through a slug conflict')
      if (services.some((service) => service.slug === values[3] && service.category_id !== values[1])) return { rows: [] }
    }
    return { rows: [{ ...services[0], category_id: values[1] }] }
  }
  throw new Error(`Unexpected local lifecycle SQL: ${sql}`)
}
Object.defineProperty(pool, 'query', { value: async (sql: string, values?: readonly unknown[]) => runQuery(sql, values, 'pool') })
Object.defineProperty(pool, 'connect', { value: async () => ({ query: async (sql: string, values?: readonly unknown[]) => runQuery(sql, values, 'client'), release() {} }) })
const definitionSnapshot = structuredClone(services)
const publicServices = async () => (await dataService.getPublicBooking(salon.slug)).services.map((service) => service.id)
const createBooking = (source: 'internal' | 'public_booking' | 'rebook') => dataService.createAppointment({ salonId, clientId: '70000000-0000-4000-8000-000000000001', serviceIds: [services[0].id], source, publicBookingEmail: source === 'public_booking' ? 'client@glamhour.test' : undefined, startsAt: '2026-11-01T10:00:00Z', endsAt: '2026-11-01T11:00:00Z' })

try {
  assert.deepEqual(await publicServices(), [services[0].id, services[1].id])
  const initialEligible = await dataService.listEligibleProviders(salonId, { serviceId: services[0].id })
  assert.deepEqual(initialEligible[0].services_offered, [services[0].name, services[1].name])
  const adminCatalog = await dataService.listServices(salonId, undefined, { limit: 100, offset: 0 })
  assert.ok(adminCatalog.some((service) => service.category_id === ids[2]), 'administrative catalog retains disabled category definitions')
  console.log('PASS public payload excludes disabled/private/inactive services; provider advertisements use enabled categories; admin catalog stays complete')

  queries = []
  assert.deepEqual((await dataService.updateServiceCategories(salonId, [])).map((category) => category.id), [])
  assert.ok(!queries.some((sql) => /(?:UPDATE|INSERT INTO|DELETE FROM) (?:services |professionals |professional_services |appointments |salon_working_hours )/.test(sql)), 'category toggle only writes membership')
  assert.deepEqual(await publicServices(), [])
  assert.deepEqual(await dataService.listEligibleProviders(salonId, { serviceId: services[0].id }), [])
  assert.equal((await dataService.listServiceCategories(salonId, true)).length, categories.length, 'all categories remain available in settings')
  for (const source of ['internal', 'public_booking', 'rebook'] as const) await assert.rejects(createBooking(source), /unavailable/)
  const serviceInput = { categoryId: ids[0], name: 'Local service', slug: 'local-service', durationMinutes: 60, priceMinor: 1000, currencyCode: 'USD', isPubliclyBookable: true, assignToActiveProviders: false }
  await assert.rejects(dataService.createService(salonId, serviceInput), /category is disabled/)
  await assert.rejects(dataService.ensureService(salonId, serviceInput), /category is disabled/)
  assert.deepEqual([...enabled], [])
  await assert.rejects(dataService.updateServiceCategories(salonId, ['30000000-0000-4000-8000-000000000099']), /categories are unavailable/)
  assert.deepEqual([...enabled], [], 'invalid membership update rolls back')
  console.log('PASS all categories can be disabled without deleting definitions, mutation bypasses are rejected, invalid updates roll back')

  await dataService.updateProfessional(salonId, providerId, { fullName: provider.full_name, languages: ['es'], status: 'active', salonEarningsPercent: 50, professionalEarningsPercent: 50, useSalonSchedule: true, serviceAssignments: [] })
  assert.equal(assignments.get(services[0].id), true, 'unrelated provider edits retain dormant assignments')
  assert.deepEqual((await dataService.updateServiceCategories(salonId, [ids[0], ids[0]])).map((category) => category.id), [ids[0]])
  assert.deepEqual(await publicServices(), [services[0].id])
  assert.deepEqual((await dataService.listEligibleProviders(salonId, { serviceId: services[0].id }))[0].services_offered, [services[0].name])
  for (const source of ['internal', 'public_booking', 'rebook'] as const) assert.equal((await createBooking(source)).status_code, 'scheduled')
  assert.deepEqual(services, definitionSnapshot)
  console.log('PASS re-enabling restores existing public services/provider assignments and internal/public/rebook creation without changing definitions')

  const off = await dataService.updateNailSettings(salonId, { categoryEnabled: false, services: [], materials: [], forceDisable: true })
  assert.equal(off.category.isEnabled, false)
  assert.deepEqual(await publicServices(), [])
  const on = await dataService.updateNailSettings(salonId, { categoryEnabled: true, services: [], materials: [] })
  assert.equal(on.category.isEnabled, true)
  assert.deepEqual(await publicServices(), [services[0].id])
  assert.deepEqual(services, definitionSnapshot)
  console.log('PASS nail settings returns committed toggle state and preserves existing services across disable/re-enable')

  await dataService.updateServiceCategories(salonId, [ids[0]])
  const populatedStaleDraft = {
    selectedCategoryIds: ids,
    services: services.slice(0, 3).map((service) => ({ id: service.id, categoryId: service.category_id, name: service.name, selected: true, price: '10', duration: '60' })),
    schedule: {},
    providers: [{ id: providerId, name: provider.full_name, email: '', phone: '', languages: ['English'], salonPercent: '50', professionalPercent: '50', serviceIds: services.slice(0, 3).map((service) => service.id), schedule: {}, useSalonSchedule: true }],
  }
  queries = []
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: populatedStaleDraft })
  assert.deepEqual([...enabled], [ids[0]], 'configured setup ignores stale enabled-category draft selection')
  assert.equal(assignments.get(services[2].id), true, 'configured setup retains disabled category assignments')
  assert.deepEqual(services, definitionSnapshot, 'disabled definitions are preserved')
  assert.ok(!queries.some((sql) => sql.includes('INSERT INTO salon_service_categories')))
  console.log('PASS stale configured setup uses current enabled categories and preserves dormant provider assignments')

  const collisionDraft = {
    ...populatedStaleDraft,
    services: [{ id: 'new-draft-service', categoryId: ids[0], name: services[2].name, selected: true, price: '10', duration: '60' }],
    providers: [{ ...populatedStaleDraft.providers[0], serviceIds: ['new-draft-service'] }],
  }
  await assert.rejects(dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: collisionDraft }), /already exists in another category/)
  assert.deepEqual(services, definitionSnapshot, 'slug collisions cannot overwrite disabled-category service definitions')
  console.log('PASS onboarding rejects slug collisions across categories without changing disabled definitions')


  await dataService.updateServiceCategories(salonId, [])
  const staleDraft = { selectedCategoryIds: ids, services: [], schedule: {}, providers: [] }
  await dataService.saveOnboarding(salonId, { step: 'schedule', completed: false, draft: staleDraft })
  queries = []
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: staleDraft })
  assert.deepEqual([...enabled], [], 'stale completed wizard cannot re-enable categories')
  assert.ok(!queries.some((sql) => /UPDATE professionals|UPDATE professional_services|INSERT INTO salon_service_categories/.test(sql)), 'unrelated configured setup save preserves staff and memberships')
  assert.deepEqual(await publicServices(), [])
  console.log('PASS configured setup preserves an empty category selection and existing staff when saving stale schedule/team drafts')

  salon.allow_public_booking = false
  await assert.rejects(dataService.getPublicBooking(salon.slug), /Online booking is not available/)
  salon.allow_public_booking = true
  console.log('PASS public link respects the salon public-booking flag')
} finally {
  await pool.end()
}
