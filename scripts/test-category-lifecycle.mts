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
  sort_order: i * 10,
}))
services.push({ ...services[0], id: '40000000-0000-4000-8000-000000000004', name: 'Private service', slug: 'private-service', is_publicly_bookable: false })
services.push({ ...services[0], id: '40000000-0000-4000-8000-000000000005', name: 'Inactive service', slug: 'inactive-service', is_active: false })
const salon = { id: salonId, name: 'Local salon', slug: 'local-salon', currency_code: 'USD', timezone: 'UTC', booking_enabled: true, allow_public_booking: true, onboarding_status: 'completed' }
const provider = { id: providerId, salon_id: salonId, full_name: 'Provider', status: 'active', languages: ['English'] }
const assignments = new Map([[services[0].id, true], [services[1].id, true], [services[2].id, true]])
const assignmentDurations = new Map<string, number | null>()
let enabled = new Set([ids[0], ids[1]])
let transactionOpen = false
type OnboardingSession = NonNullable<Awaited<ReturnType<typeof dataService.getOnboarding>>>
let savedOnboarding: OnboardingSession | null = null
let nextServiceId = 10
let snapshot: { enabled: Set<string>; salon: typeof salon; onboarding: OnboardingSession | null; services: typeof services; assignments: typeof assignments; assignmentDurations: typeof assignmentDurations; nextServiceId: number } | undefined
let queries: string[] = []
const effective = (service: typeof services[number]) => service.is_active && enabled.has(service.category_id)

function runQuery(sql: string, values: readonly unknown[] = [], scope: 'pool' | 'client' = 'pool'): { rows: Record<string, unknown>[] } {
  queries.push(sql)
  if (sql === 'BEGIN') {
    transactionOpen = true
    snapshot = { enabled: new Set(enabled), salon: { ...salon }, onboarding: structuredClone(savedOnboarding), services: structuredClone(services), assignments: new Map(assignments), assignmentDurations: new Map(assignmentDurations), nextServiceId }
    return { rows: [] }
  }
  if (sql === 'COMMIT') { transactionOpen = false; snapshot = undefined; return { rows: [] } }
  if (sql === 'ROLLBACK') {
    if (snapshot) {
      enabled = snapshot.enabled; Object.assign(salon, snapshot.salon); savedOnboarding = snapshot.onboarding
      services.splice(0, services.length, ...snapshot.services)
      assignments.clear()
      for (const [id, active] of snapshot.assignments) assignments.set(id, active)
      assignmentDurations.clear()
      for (const [id, duration] of snapshot.assignmentDurations) assignmentDurations.set(id, duration)
      nextServiceId = snapshot.nextServiceId
    }
    transactionOpen = false; snapshot = undefined
    return { rows: [] }
  }
  if (/^(CREATE|ALTER|DO)\b/.test(sql)) return { rows: [] }
  if (sql.includes('FROM salon_subscriptions')) return { rows: [{ plan_code: 'premium_monthly', status: 'active', provider: 'manual', current_period_end: '2099-01-01T00:00:00Z', entitlements_json: {} }] }
  if (sql.includes('SELECT count(*) FROM clients')) return { rows: [{ count: '1' }] }
  if (sql.includes('SELECT c.email FROM clients c')) return { rows: [{ email: 'client@glamhour.test' }] }
  if (sql.includes('FROM public_booking_email_verifications')) return { rows: [{ verified_at: new Date() }] }
  if (sql.includes('LEFT JOIN onboarding_sessions os')) {
    assert.equal(transactionOpen, false, 'draft recovery is a read outside a mutation')
    assert.match(sql, /os.salon_id = s.id/)
    assert.match(sql, /s.deleted_at IS NULL/)
    return { rows: values[0] === salonId ? [{ session: structuredClone(savedOnboarding) }] : [] }
  }
  if (sql.includes('FROM salons')) {
    if (scope === 'pool') assert.equal(transactionOpen, false, 'settings/public reads must occur after commit')
    return { rows: [{ ...salon }] }
  }
  if (sql.includes('UPDATE salons')) {
    if (values[3]) assert.equal(values[1], 'completed', 'editing setup keeps completed onboarding status')
    assert.match(sql, /WHEN \$4::boolean THEN booking_enabled/, 'editing setup preserves the public booking flag')
    salon.onboarding_status = String(values[1])
    if (!values[3] && values[1] === 'completed') salon.booking_enabled = true
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO onboarding_sessions')) {
    const timestamp = '2030-01-01T00:00:00.000Z'
    savedOnboarding = {
      id: savedOnboarding?.id ?? '80000000-0000-4000-8000-000000000001', salon_id: String(values[0]),
      current_step: String(values[1]), completed_steps: [...values[2] as string[]], draft_data: JSON.parse(String(values[3])),
      completed_at: values[4] as string | null,
      created_at: savedOnboarding?.created_at ?? timestamp, started_at: savedOnboarding?.started_at ?? timestamp, updated_at: timestamp,
    }
    return { rows: [] }
  }
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
    if (!sql.includes('WHERE salon_id = $1 AND id = $2')) {
      assert.equal(values[1], 'inactive')
      assert.equal(snapshot?.salon.booking_enabled, false, 'configured setup must not deactivate all existing staff')
      assert.notEqual(snapshot?.salon.onboarding_status, 'completed')
    }
    return { rows: [{ ...provider, languages: values[6] ?? ['English'] }] }
  }
  if (sql.includes('UPDATE professional_services')) {
    assert.match(sql, /JOIN salon_service_categories ssc/, 'editing staff preserves dormant assignments')
    for (const service of services.filter(effective)) if (assignments.has(service.id)) assignments.set(service.id, false)
    return { rows: [] }
  }
  if (sql.includes('INSERT INTO professional_services')) {
    assignments.set(String(values[2]), true)
    assignmentDurations.set(String(values[2]), values[3] as number | null)
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
  if (sql.includes('SELECT id FROM services')) {
    assert.match(sql, /id = \$3::uuid OR lower\(name\) = lower\(\$4\)/)
    assert.match(sql, /ORDER BY \(id = \$3::uuid\) DESC NULLS LAST/)
    const categoryServices = services.filter(service => service.salon_id === values[0] && service.category_id === values[1])
    const match = categoryServices.find(service => service.id === values[2])
      ?? categoryServices.find(service => service.name.toLowerCase() === String(values[3]).toLowerCase())
    return { rows: match ? [{ id: match.id }] : [] }
  }
  if (sql.includes('UPDATE services')) {
    const service = services.find(service => service.salon_id === values[0] && service.id === values[1])
    assert.ok(service)
    assert.ok(enabled.has(service.category_id), 'wizard must not rewrite disabled definitions')
    assert.doesNotMatch(sql, /\bslug\s*=/, 'updating a saved service must preserve its slug')
    Object.assign(service, {
      name: String(values[2]), duration_minutes: Number(values[3]), price_minor: Number(values[4]),
      sort_order: Number(values[5]), currency_code: 'USD', is_active: true, is_publicly_bookable: true,
    })
    return { rows: [{ id: service.id }] }
  }
  if (sql.includes('INSERT INTO services')) {
    assert.ok(enabled.has(String(values[1])), 'cannot create services in disabled categories')
    assert.match(sql, /ON CONFLICT \(salon_id, slug\) DO NOTHING/, 'a conflicting slug cannot mutate an existing service')
    const slug = values[3]
    assert.ok(typeof slug === 'string' && slug.length > 0 && slug.length <= 160, 'services.slug is nonempty VARCHAR(160)')
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'generated service slugs contain only valid normalized segments')
    if (services.some(service => service.salon_id === values[0] && service.slug === slug)) return { rows: [] }
    const created = {
      ...(services[0] ?? definitionSnapshot[0]), id: `40000000-0000-4000-8000-${String(nextServiceId++).padStart(12, '0')}`,
      salon_id: String(values[0]), category_id: String(values[1]),
      category_code: categories.find(category => category.id === values[1])!.code,
      name: String(values[2]), slug, duration_minutes: Number(values[4]), price_minor: Number(values[5]),
      sort_order: Number(values[6]), is_active: true, is_publicly_bookable: true,
    }
    services.push(created)
    return { rows: [{ ...created }] }
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
  const otherCategoryDefinition = structuredClone(services[2])
  const beforeCollisionCount = services.length
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: collisionDraft })
  const collisionService = services.find(service => service.category_id === ids[0] && service.name === otherCategoryDefinition.name)
  assert.ok(collisionService)
  assert.notEqual(collisionService.id, otherCategoryDefinition.id)
  assert.notEqual(collisionService.slug, otherCategoryDefinition.slug)
  assert.equal(services.length, beforeCollisionCount + 1)
  assert.deepEqual(services.find(service => service.id === otherCategoryDefinition.id), otherCategoryDefinition, 'a same-name service never overwrites the disabled category definition')
  assert.equal(assignments.get(collisionService.id), true, 'the draft assignment uses the newly created category-specific service')
  assert.equal(assignments.get(otherCategoryDefinition.id), true, 'dormant assignments remain unchanged')
  console.log('PASS onboarding accepts a same-name service in another category while preserving the disabled definition')

  await dataService.updateServiceCategories(salonId, [ids[0], ids[1]])
  const legacyRemoval = { ...services[0], id: '40000000-0000-4000-8000-000000000006', name: 'Removal', slug: 'custom-removal-legacy' }
  services.push(legacyRemoval)
  const sameNameDraft = {
    ...populatedStaleDraft,
    selectedCategoryIds: [ids[0], ids[1]],
    services: [
      { id: 'nails-removal-draft', categoryId: ids[0], name: 'Removal', selected: true, price: '15', duration: '30' },
      { id: 'lashes-removal-draft', categoryId: ids[1], name: 'Removal', selected: true, price: '20', duration: '45' },
    ],
    providers: [{ ...populatedStaleDraft.providers[0], serviceIds: ['nails-removal-draft', 'lashes-removal-draft'], serviceDurations: { 'nails-removal-draft': '35', 'lashes-removal-draft': '50' } }],
  }
  const countBeforeSameName = services.length
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: sameNameDraft })
  const removalServices = services.filter(service => service.name === 'Removal')
  assert.equal(removalServices.length, 2)
  assert.equal(services.length, countBeforeSameName + 1, 'the existing same-category name is reused')
  const nailRemoval = removalServices.find(service => service.category_id === ids[0])!
  const lashRemoval = removalServices.find(service => service.category_id === ids[1])!
  assert.equal(nailRemoval.id, legacyRemoval.id)
  assert.equal(nailRemoval.slug, 'custom-removal-legacy', 'existing service slugs remain stable')
  assert.notEqual(nailRemoval.id, lashRemoval.id)
  assert.notEqual(nailRemoval.slug, lashRemoval.slug)
  assert.equal(nailRemoval.price_minor, 1500)
  assert.equal(lashRemoval.price_minor, 2000)
  assert.equal(nailRemoval.duration_minutes, 30)
  assert.equal(lashRemoval.duration_minutes, 45)
  assert.equal(assignments.get(nailRemoval.id), true)
  assert.equal(assignments.get(lashRemoval.id), true)
  assert.equal(assignmentDurations.get(nailRemoval.id), 35)
  assert.equal(assignmentDurations.get(lashRemoval.id), 50)
  const removalSnapshot = structuredClone(removalServices)
  const countBeforeRetry = services.length
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: sameNameDraft })
  assert.equal(services.length, countBeforeRetry, 'retry creates no additional services')
  assert.deepEqual(services.filter(service => service.name === 'Removal'), removalSnapshot)
  assert.equal(assignments.get(nailRemoval.id), true)
  assert.equal(assignments.get(lashRemoval.id), true)
  assert.equal(assignmentDurations.get(nailRemoval.id), 35)
  assert.equal(assignmentDurations.get(lashRemoval.id), 50)
  assert.deepEqual(services.find(service => service.id === otherCategoryDefinition.id), otherCategoryDefinition)
  console.log('PASS active categories share a display name with separate IDs, stable legacy slugs, independent prices and idempotent assignments')

  const renamedDraft = {
    ...sameNameDraft,
    services: [{ ...sameNameDraft.services[0], id: nailRemoval.id, name: 'Removal refresh' }],
    providers: [{ ...populatedStaleDraft.providers[0], serviceIds: [nailRemoval.id] }],
  }
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: renamedDraft })
  assert.equal(services.length, countBeforeRetry, 'renaming a persisted draft UUID updates its existing row')
  assert.equal(services.find(service => service.id === nailRemoval.id)?.name, 'Removal refresh')
  assert.equal(services.find(service => service.id === nailRemoval.id)?.slug, 'custom-removal-legacy')
  assert.deepEqual(services.find(service => service.id === lashRemoval.id), removalSnapshot.find(service => service.id === lashRemoval.id))
  assert.equal(assignments.get(nailRemoval.id), true)
  console.log('PASS persisted draft service IDs preserve identity and slug through a name change')

  const normalizedNames = ['Lash lift', 'Lash-lift', 'A'.repeat(160), 'Á'.repeat(160)]
  assert.ok(normalizedNames.every(name => name.length <= 160), 'fixtures satisfy the service name validation limit')
  const normalizedDraftServices = normalizedNames.map((name, index) => ({ id: `normalized-draft-${index}`, categoryId: ids[0], name, selected: true, price: '10', duration: '30' }))
  const normalizedDraft = {
    ...sameNameDraft, services: normalizedDraftServices,
    providers: [{ ...populatedStaleDraft.providers[0], serviceIds: normalizedDraftServices.map(service => service.id) }],
  }
  const beforeNormalizedCount = services.length
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: normalizedDraft })
  const normalizedServices = services.filter(service => normalizedNames.includes(service.name))
  assert.equal(normalizedServices.length, 4)
  assert.equal(services.length, beforeNormalizedCount + 4, 'different display names remain separate even when their normalized slugs collide')
  assert.equal(new Set(normalizedServices.map(service => service.slug)).size, 4)
  assert.ok(normalizedServices.every(service => service.slug.length <= 160 && assignments.get(service.id)))
  const normalizedSnapshot = structuredClone(normalizedServices)
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: normalizedDraft })
  assert.equal(services.length, beforeNormalizedCount + 4)
  assert.deepEqual(services.filter(service => normalizedNames.includes(service.name)), normalizedSnapshot)
  assert.ok(normalizedServices.every(service => assignments.get(service.id)))
  console.log('PASS same-category normalized-name and long accented-name collisions remain distinct, bounded to 160 characters and retry safely')

  await dataService.updateServiceCategories(salonId, [])
  const staleDraft = { selectedCategoryIds: ids, services: [], schedule: {}, providers: [] }
  await dataService.saveOnboarding(salonId, { step: 'schedule', completed: false, draft: staleDraft })
  queries = []
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: staleDraft })
  assert.deepEqual([...enabled], [], 'stale completed wizard cannot re-enable categories')
  assert.ok(!queries.some((sql) => /UPDATE professionals|UPDATE professional_services|INSERT INTO salon_service_categories/.test(sql)), 'unrelated configured setup save preserves staff and memberships')
  assert.deepEqual(await publicServices(), [])
  console.log('PASS configured setup preserves an empty category selection and existing staff when saving stale schedule/team drafts')

  queries = []
  assert.deepEqual((await dataService.getOnboarding(salonId))?.draft_data.selectedCategoryIds, ids, 'recovery returns the saved draft independently of current category membership')
  assert.deepEqual([...enabled], [], 'reading an old draft cannot re-enable configured categories')
  assert.ok(!queries.some((sql) => /\b(?:INSERT|UPDATE|DELETE)\b/.test(sql)), 'draft recovery never writes settings')
  console.log('PASS recovering an existing draft is read-only and cannot reactivate disabled categories')

  salon.allow_public_booking = false
  await assert.rejects(dataService.getPublicBooking(salon.slug), /Online booking is not available/)
  salon.allow_public_booking = true
  console.log('PASS public link respects the salon public-booking flag')

  salon.onboarding_status = 'in_progress'
  salon.booking_enabled = false
  enabled = new Set()
  savedOnboarding = null
  assert.equal(await dataService.getOnboarding(salonId), null, 'an existing salon without a session can start setup')
  await assert.rejects(dataService.getOnboarding('10000000-0000-4000-8000-000000000099'), (error: unknown) => error instanceof Error && 'status' in error && error.status === 404)
  savedOnboarding = {
    id: '80000000-0000-4000-8000-000000000001', salon_id: salonId, current_step: 'service_categories',
    completed_steps: [], draft_data: {}, completed_at: null,
    created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z', started_at: '2030-01-01T00:00:00.000Z',
  }
  assert.deepEqual((await dataService.getOnboarding(salonId))?.draft_data, {}, 'initial registration sessions need not contain setup selections yet')
  console.log('PASS recovery distinguishes no session, initial registration session and nonexistent salon')

  const resumableDraft = {
    selectedCategoryIds: [ids[1]],
    services: [populatedStaleDraft.services[1]],
    schedule: { Monday: { enabled: true, open: '09:00', close: '17:00' } },
    providers: [{ ...populatedStaleDraft.providers[0], serviceIds: [services[1].id] }],
  }
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: false, draft: resumableDraft })
  assert.deepEqual([...enabled], [], 'new salon category membership is not materialized before completion')
  assert.equal(salon.booking_enabled, false)
  const recovered = await dataService.getOnboarding(salonId)
  assert.ok(recovered)
  assert.deepEqual(recovered.draft_data, resumableDraft, 'categories, services, hours and providers survive a new browser session')
  assert.equal(recovered.current_step, 'complete')
  assert.equal(recovered.completed_at, null)
  console.log('PASS incomplete setup recovers its full saved draft even while persisted category membership is empty')

  for (const [invalid, message] of [
    [{ ...resumableDraft, selectedCategoryIds: [] }, /Select at least one service category/],
    [{ ...resumableDraft, services: [] }, /Select at least one service\./],
    [{ ...resumableDraft, providers: [] }, /Add at least one provider/],
  ] as const) {
    await assert.rejects(dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: invalid }), message)
    assert.deepEqual((await dataService.getOnboarding(salonId))?.draft_data, resumableDraft, 'invalid completion rolls back instead of replacing the recoverable draft')
    assert.equal(salon.onboarding_status, 'in_progress')
    assert.equal(salon.booking_enabled, false)
    assert.deepEqual([...enabled], [])
  }
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: recovered.draft_data as typeof resumableDraft })
  assert.equal(salon.onboarding_status, 'completed')
  assert.equal(salon.booking_enabled, true)
  assert.deepEqual([...enabled], [ids[1]], 'first completion uses recovered draft selections rather than empty membership')
  assert.ok((await dataService.getOnboarding(salonId))?.completed_at)
  console.log('PASS completion validates required selections, preserves the saved draft on failure and activates recovered new-salon categories')

  const { apiRouter } = await import('../server/routes.ts')
  const getRoute = apiRouter.stack.find((layer) => layer.route?.path === '/salons/:salonId/onboarding' && layer.route.methods.get)?.route
  assert.ok(getRoute, 'onboarding recovery is available as a GET endpoint')
  const headers = new Map<string, string>()
  const response = await new Promise<{ data: OnboardingSession | null }>((resolve, reject) => {
    getRoute.stack[0].handle({ params: { salonId } }, {
      set(name: string, value: string) { headers.set(name.toLowerCase(), value); return this },
      json(body: { data: OnboardingSession | null }) { resolve(body); return this },
    }, reject)
  })
  assert.equal(headers.get('cache-control'), 'no-store')
  assert.deepEqual(response.data?.draft_data, resumableDraft)
  console.log('PASS real GET handler returns the recoverable session without caching it')

  // A brand-new salon has no persisted memberships or services until completion.
  salon.onboarding_status = 'in_progress'
  salon.booking_enabled = false
  enabled = new Set()
  savedOnboarding = null
  services.splice(0)
  assignments.clear()
  assignmentDurations.clear()
  const newSalonResult = await dataService.saveOnboarding(salonId, {
    step: 'complete', completed: true,
    draft: { ...sameNameDraft, schedule: { Monday: { enabled: true, open: '09:00', close: '18:00' } } },
  })
  assert.equal(newSalonResult.onboarding_status, 'completed')
  assert.equal(newSalonResult.booking_enabled, true)
  assert.deepEqual([...enabled], [ids[0], ids[1]])
  assert.equal(services.length, 2)
  assert.ok(services.every(service => service.name === 'Removal'))
  assert.equal(new Set(services.map(service => service.id)).size, 2)
  assert.equal(new Set(services.map(service => service.slug)).size, 2)
  assert.deepEqual(new Set(services.map(service => service.category_id)), new Set([ids[0], ids[1]]))
  assert.ok(services.every(service => assignments.get(service.id)), 'the provider receives both category-specific service IDs')
  assert.equal(assignmentDurations.get(services.find(service => service.category_id === ids[0])!.id), 35)
  assert.equal(assignmentDurations.get(services.find(service => service.category_id === ids[1])!.id), 50)
  const newSalonServices = structuredClone(services)
  await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: sameNameDraft })
  assert.deepEqual(services, newSalonServices, 'retry after first completion preserves both services and their identities')
  assert.ok(services.every(service => assignments.get(service.id)))
  console.log('PASS new-salon completion activates both categories with same-name services, distinct provider assignments and idempotent retry')
} finally {
  await pool.end()
}
