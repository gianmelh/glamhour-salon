#!/usr/bin/env -S npx tsx
// Database-free regressions for the PDF's provider schedules, languages, and
// disabled-category booking findings. The PostgreSQL pool fails closed through
// an in-memory query double; this script never opens a database connection.
import assert from 'node:assert/strict'

process.env.DATABASE_URL = 'postgresql://local-test:local-test@127.0.0.1:1/not-used'
process.env.DOTENV_CONFIG_PATH = '/dev/null'
const { pool } = await import('../server/db.ts')
const { dataService } = await import('../server/services/data-service.ts')
const { upsertProfessionalSchema, saveOnboardingSchema } = await import('../server/validation.ts')

const salonId = '10000000-0000-4000-8000-000000000001'
const providerId = '20000000-0000-4000-8000-000000000001'
const categoryId = '30000000-0000-4000-8000-000000000001'
const serviceId = '40000000-0000-4000-8000-000000000001'
const appointmentId = '50000000-0000-4000-8000-000000000001'
const clientId = '60000000-0000-4000-8000-000000000001'
const service = { id: serviceId, salon_id: salonId, category_id: categoryId, category_code: 'nails', duration_minutes: 60, price_minor: 1000 }
const provider = { id: providerId, salon_id: salonId, full_name: 'Local provider', status: 'active', languages: ['en', 'English', 'es', 'Spanish', 'PT', 'Portuguese', 'Arabic', 'French'] }
const appointment = { id: appointmentId, salon_id: salonId, client_id: clientId, professional_id: providerId, status_code: 'scheduled' }
const professionalInput = {
  fullName: provider.full_name, languages: ['en', 'English', 'ES', ' Spanish ', 'pt', 'PORTUGUESE'],
  status: 'active' as const, salonEarningsPercent: 50, professionalEarningsPercent: 50,
  useSalonSchedule: false,
  serviceAssignments: [{ serviceId, isActive: true }],
  schedule: { Monday: { enabled: true, open: '10:00', close: '17:00' } },
}
let categoryEnabled = true
let serviceActive = true
let publiclyBookable = true
let salonOpen = true
let customHours: { is_working: boolean; starts_at: string; ends_at: string } | undefined
let queries: { sql: string; values: readonly unknown[] }[] = []

function assertCategoryGuard(sql: string) {
  assert.match(sql, /JOIN service_categories sc ON sc.id = s.category_id AND sc.is_active/)
  assert.match(sql, /JOIN salon_service_categories ssc/)
  assert.match(sql, /ssc.salon_id = s.salon_id AND ssc.category_id = s.category_id AND ssc.is_active/)
}
function runQuery(sql: string, values: readonly unknown[] = []): { rows: Record<string, unknown>[] } {
  queries.push({ sql, values })
  if (/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DO)\b/.test(sql)) return { rows: [] }
  if (sql.includes('INSERT INTO salon_service_categories')) throw new Error('Booking/provider mutation unexpectedly re-enabled a category')
  if (sql.includes('SELECT COUNT(*)::text AS count FROM professionals')) return { rows: [{ count: '1' }] }
  if (sql.includes('FROM salon_working_hours')) return { rows: [{ day_of_week: 1, is_open: salonOpen, opens_at: '09:00:00', closes_at: '18:00:00' }] }
  if (sql.includes('FROM professional_working_hours')) return { rows: customHours ? [customHours] : [] }
  if (sql.includes('INSERT INTO professional_working_hours') || sql.includes('DELETE FROM professional_working_hours')) return { rows: [] }
  if (sql.includes('INSERT INTO professionals')) return { rows: [{ ...provider, languages: values[5] }] }
  if (sql.includes('UPDATE professionals')) return { rows: [{ ...provider, languages: values[6] }] }
  if (sql.includes('FROM professionals WHERE') || sql.includes('FROM professionals p')) return { rows: [provider] }
  if (sql.includes('UPDATE professional_services') || sql.includes('INSERT INTO professional_services')) return { rows: [] }
  if (sql.includes('SELECT 1 FROM salon_service_categories ssc')) {
    assert.match(sql, /sc.is_active/)
    assert.match(sql, /ssc.is_active/)
    return { rows: categoryEnabled ? [{ enabled: true }] : [] }
  }
  if (sql.includes('INSERT INTO services')) {
    assert.match(sql, /WHERE services.is_active AND services.category_id = EXCLUDED.category_id/)
    assert.doesNotMatch(sql.split('DO UPDATE SET')[1], /is_active = true/)
    return { rows: serviceActive ? [service] : [] }
  }
  if (sql.includes('FROM services s')) {
    if (sql.includes('SELECT s.id AS service_id')) return { rows: [{ service_id: serviceId, duration_minutes: 60, duration_override_minutes: null }] }
    assertCategoryGuard(sql)
    if (!categoryEnabled || !serviceActive) return { rows: [] }
    if (sql.includes("$3::text <> 'public_booking'")) {
      assert.match(sql, /FOR SHARE OF ssc, sc, s/, 'booking holds category/service availability stable through commit')
      if (values[2] === 'public_booking' && !publiclyBookable) return { rows: [] }
      return { rows: [service] }
    }
    if (sql.includes('professional_name')) return { rows: [{ duration_minutes: 60, duration_override_minutes: null, professional_name: provider.full_name, timezone: 'UTC' }] }
    return { rows: [{ id: serviceId }] }
  }
  if (sql.includes('FROM professional_services ps')) {
    assertCategoryGuard(sql)
    assert.match(sql, /p.status = 'active' AND p.deleted_at IS NULL/)
    assert.match(sql, /FOR SHARE OF ssc, sc, s/, 'rescheduling locks availability rows through commit')
    return { rows: categoryEnabled && serviceActive ? [{ service_id: serviceId }] : [] }
  }
  if (sql.includes('SELECT * FROM appointments')) return { rows: [appointment] }
  if (sql.includes('FROM appointment_services')) return { rows: [{ service_id: serviceId }] }
  if (sql.includes('FROM appointments') || sql.includes('FROM availability_exceptions')) return { rows: [] }
  throw new Error(`Unexpected local regression SQL: ${sql}`)
}
const queryDouble = async (sql: string, values?: readonly unknown[]) => runQuery(sql, values)
Object.defineProperty(pool, 'query', { value: queryDouble, configurable: true })
Object.defineProperty(pool, 'connect', { value: async () => ({ query: queryDouble, release() {} }), configurable: true })

function reset() {
  queries = []
  categoryEnabled = true
  serviceActive = true
  publiclyBookable = true
  salonOpen = true
  customHours = undefined
}
function assertNoBookingWrites() {
  assert.ok(!queries.some(({ sql }) => /INSERT INTO appointments|UPDATE appointments SET|INSERT INTO professional_services|INSERT INTO services/.test(sql)))
}
async function rejectsApi(promise: Promise<unknown>, message: RegExp) {
  await assert.rejects(promise, (error: unknown) => error instanceof Error && message.test(error.message))
}

try {
  const onboardingInput = {
    step: 'team', completed: false,
    draft: {
      selectedCategoryIds: [], services: [], schedule: {},
      providers: [{
        id: providerId, name: provider.full_name, email: '', phone: '',
        languages: professionalInput.languages, salonPercent: '50', professionalPercent: '50',
        serviceIds: [], schedule: {}, useSalonSchedule: true,
      }],
    },
  }
  assert.deepEqual(upsertProfessionalSchema.parse(professionalInput).languages, ['English', 'Spanish', 'Portuguese'])
  assert.deepEqual(saveOnboardingSchema.parse(onboardingInput).draft.providers[0].languages, ['English', 'Spanish', 'Portuguese'])
  for (const unsupported of ['ar', 'Arabic', 'French', 'de', 'constructor', 'toString']) {
    assert.equal(upsertProfessionalSchema.safeParse({ ...professionalInput, languages: ['English', unsupported] }).success, false, `provider writes reject ${unsupported}`)
    assert.equal(saveOnboardingSchema.safeParse({
      ...onboardingInput,
      draft: { ...onboardingInput.draft, providers: [{ ...onboardingInput.draft.providers[0], languages: ['English', unsupported] }] },
    }).success, false, `onboarding rejects ${unsupported}`)
  }
  assert.deepEqual(upsertProfessionalSchema.parse({ ...professionalInput, languages: undefined }).languages, [], 'provider language selection remains optional')
  assert.equal(saveOnboardingSchema.safeParse({
    ...onboardingInput,
    draft: { ...onboardingInput.draft, providers: [{ ...onboardingInput.draft.providers[0], languages: [] }] },
  }).success, false, 'onboarding still requires a language')
  console.log('PASS provider and onboarding language schemas accept only English, Spanish, Portuguese and normalize legacy codes')

  for (const method of ['createProfessional', 'updateProfessional'] as const) {
    for (const scenario of ['closed', 'early', 'late', 'reversed', 'invalid'] as const) {
      reset()
      salonOpen = scenario !== 'closed'
      const hours = {
        closed: ['10:00', '17:00'], early: ['08:00', '17:00'], late: ['10:00', '19:00'],
        reversed: ['17:00', '10:00'], invalid: ['10:00', '29:00'],
      }[scenario]
      const input = { ...professionalInput, schedule: { Monday: { enabled: true, open: hours[0], close: hours[1] } } }
      const result = method === 'createProfessional'
        ? dataService.createProfessional(salonId, input)
        : dataService.updateProfessional(salonId, providerId, input)
      if (scenario === 'reversed' || scenario === 'invalid') {
        await rejectsApi(result, /valid opening time before the closing time/)
        assert.ok(queries.some(({ sql }) => sql === 'ROLLBACK'))
        assert.ok(!queries.some(({ sql }) => sql.includes('INSERT INTO professional_working_hours')))
      } else {
        await result
        assert.ok(queries.some(({ sql }) => sql === 'COMMIT'))
        const day = queries.find(({ sql, values }) => sql.includes('INSERT INTO professional_working_hours') && values[2] === 1)
        assert.deepEqual(day?.values.slice(3), [true, ...hours], `${scenario}: custom hours remain independent of salon hours`)
      }
    }
    reset()
    const saved = method === 'createProfessional'
      ? await dataService.createProfessional(salonId, professionalInput)
      : await dataService.updateProfessional(salonId, providerId, professionalInput)
    assert.deepEqual(saved.languages, ['English', 'Spanish', 'Portuguese'])
    const days = queries.filter(({ sql }) => sql.includes('INSERT INTO professional_working_hours'))
    assert.equal(days.length, 7, 'custom schedule replaces all seven days')
    assert.equal(days.filter(({ values }) => values[3] === true).length, 1, 'omitted days are closed')
    assert.deepEqual(days.find(({ values }) => values[2] === 1)?.values.slice(3), [true, '10:00', '17:00'])
    assert.ok(queries.some(({ sql }) => sql === 'COMMIT'))
    console.log(`PASS ${method}: independent custom days/hours, invalid time rejection, week replacement, normalized replacement languages`)
  }

  reset()
  assert.deepEqual((await dataService.listProfessionals(salonId, { limit: 100, offset: 0 }))[0].languages, ['English', 'Spanish', 'Portuguese'])
  assert.deepEqual((await dataService.getProfessional(salonId, providerId)).languages, ['English', 'Spanish', 'Portuguese'])
  assert.equal(upsertProfessionalSchema.safeParse({ ...professionalInput, schedule: undefined }).success, false)
  assert.equal(upsertProfessionalSchema.safeParse({ ...professionalInput, schedule: { Monday: { enabled: true, open: '09:00', close: '99:99' } } }).success, false)
  console.log('PASS legacy language reads and malformed/missing custom schedule validation')

  reset()
  const replacement = await dataService.updateProfessional(salonId, providerId, {
    ...professionalInput, languages: ['es'], useSalonSchedule: true,
  })
  assert.deepEqual(replacement.languages, ['Spanish'], 'language selection replaces the stored list')
  assert.ok(queries.some(({ sql }) => sql.includes('DELETE FROM professional_working_hours')))
  assert.ok(!queries.some(({ sql }) => sql.includes('INSERT INTO professional_working_hours')))
  for (const method of ['createProfessional', 'updateProfessional'] as const) {
    reset()
    categoryEnabled = false
    const result = method === 'createProfessional'
      ? dataService.createProfessional(salonId, professionalInput)
      : dataService.updateProfessional(salonId, providerId, professionalInput)
    await rejectsApi(result, /selected services are unavailable/)
    assert.ok(!queries.some(({ sql }) => /INSERT INTO professionals|UPDATE professionals|INSERT INTO professional_services/.test(sql)))
  }
  console.log('PASS replacing languages, returning to salon hours, and rejecting disabled-category provider assignments')


  const booking = {
    salonId, clientId, serviceIds: [serviceId], source: 'internal' as const,
    startsAt: '2026-10-19T10:00:00Z', endsAt: '2026-10-19T11:00:00Z',
  }
  for (const source of ['internal', 'public_booking', 'rebook'] as const) {
    for (const reason of ['category', 'service'] as const) {
      reset()
      categoryEnabled = reason !== 'category'
      serviceActive = reason !== 'service'
      await rejectsApi(dataService.createAppointment({ ...booking, source }), /unavailable/)
      assertNoBookingWrites()
    }
  }
  reset()
  publiclyBookable = false
  await rejectsApi(dataService.createAppointment({ ...booking, source: 'public_booking' }), /unavailable/)
  assertNoBookingWrites()
  console.log('PASS internal/public/rebook creation rejects disabled categories/services; public visibility is enforced')

  const ensureInput = { categoryId, slug: 'local-service', name: 'Local service', durationMinutes: 60, priceMinor: 1000, currencyCode: 'USD', isPubliclyBookable: true }
  reset()
  categoryEnabled = false
  await rejectsApi(dataService.ensureService(salonId, ensureInput), /category is disabled/)
  assertNoBookingWrites()
  reset()
  serviceActive = false
  await rejectsApi(dataService.ensureService(salonId, ensureInput), /service is unavailable/)
  reset()
  assert.equal((await dataService.ensureService(salonId, ensureInput)).id, serviceId)
  console.log('PASS ensure-service cannot reactivate a disabled category/service and still supports active services')

  for (const reason of ['category', 'service'] as const) {
    reset()
    categoryEnabled = reason !== 'category'
    serviceActive = reason !== 'service'
    await rejectsApi(dataService.rescheduleAppointment(salonId, appointmentId, { professionalId: providerId, startsAt: booking.startsAt, endsAt: booking.endsAt }), /unavailable/)
    assertNoBookingWrites()
    await rejectsApi(dataService.getAppointmentAvailability(salonId, { providerId, serviceId, date: '2026-10-19' }), /No active/)
  }
  console.log('PASS rescheduling and availability reject disabled categories/services')

  for (const scenario of ['closedSalon', 'outsideSalon', 'insideSalon', 'providerOff', 'inherited', 'inheritedClosed'] as const) {
    reset()
    salonOpen = scenario !== 'closedSalon' && scenario !== 'inheritedClosed'
    customHours = scenario === 'inherited' || scenario === 'inheritedClosed' ? undefined : {
      is_working: scenario !== 'providerOff',
      starts_at: scenario === 'insideSalon' ? '10:00:00' : '07:00:00',
      ends_at: scenario === 'insideSalon' ? '17:00:00' : '22:00:00',
    }
    const availability = await dataService.getAppointmentAvailability(salonId, { providerId, serviceId, date: '2026-10-19' })
    const slots = availability.slots as { time: string; endsAt: string }[]
    if (scenario === 'inheritedClosed' || scenario === 'providerOff') assert.deepEqual(slots, [])
    else {
      const open = scenario === 'insideSalon' ? '10:00' : scenario === 'inherited' ? '09:00' : '07:00'
      const close = scenario === 'insideSalon' ? '17:00' : scenario === 'inherited' ? '18:00' : '22:00'
      assert.deepEqual(availability.workingWindow, { open, close })
      assert.equal(slots[0].time, open)
      assert.equal(slots.at(-1)?.endsAt, `2026-10-19T${close}:00.000Z`)
    }
  }
  console.log('PASS custom availability takes precedence on closed days/outside salon hours; absent custom hours inherit the salon schedule')
} finally {
  await pool.end()
}
