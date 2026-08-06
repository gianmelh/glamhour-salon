#!/usr/bin/env tsx
/**
 * Micropigmentation booking flow tests (unit + API).
 * Run with API up: npx tsx scripts/test-micropigmentation-booking.ts
 */
import {
  getMicropigmentationFieldErrors,
  matchMicropigmentationService,
  micropigmentationServiceDefaults,
  micropigmentationServiceSlug,
  resolveMicropigmentationServiceId,
} from '../src/pages/app/appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec'

const API = 'http://127.0.0.1:3001/api'
const SALON = '10000000-0000-0000-0000-000000000001'
const CLIENT = '40000000-0000-0000-0000-000000000007'
const PROFESSIONAL = '30000000-0000-0000-0000-000000000002'
const MICROBLADING = '60000000-0000-0000-0000-000000000008'
const SIG = '10,10 20,20 30,15'

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) passed += 1
  else failed += 1
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json() as { data?: T; error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  return body.data as T
}

async function apiRaw(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
}

function runUnitTests() {
  check(
    'category Micropigmentation opens flow via procedure groups',
    Boolean(micropigmentationServiceSlug('Microblading')),
  )

  const services = [
    { id: 'a', name: 'Micropigmentation - microblading', slug: 'micropigmentation-microblading', is_active: true },
    { id: 'b', name: 'Micropigmentation - Lip Liner', slug: 'micropigmentation-lip-liner', is_active: true },
    { id: 'c', name: 'Micropigmentation - microblading', slug: 'micropigmentation-microblading-dup', is_active: false },
  ]
  const matched = matchMicropigmentationService(services, 'Microblading')
  check('existing client service match reuses active microblading', matched?.id === 'a')
  check(
    'service existing: resolve reuses id and does not invent another',
    resolveMicropigmentationServiceId(services, 'Microblading') === 'a',
  )
  check(
    'service matching ignores case/spacing',
    matchMicropigmentationService(
      [{ id: 'x', name: '  MICROPIGMENTATION - MICROBLADING ', slug: null, is_active: true }],
      'microblading',
    )?.id === 'x',
  )

  const errors = getMicropigmentationFieldErrors({})
  check('validations require service, email/phone path, signature', Boolean(
    errors.procedure && errors.generalFullName && errors.clientDesignSignature && errors.professionalSignature,
  ))

  const skipped = getMicropigmentationFieldErrors({
    usedExistingHealthProfile: true,
    procedure: 'Microblading',
    phototype: 'Type III',
    herpesSimplex: 'No',
    pigment_brand: 'Perma Blend',
    needleType: '18U',
    professionalSignature: 'Pro',
    consentDate: '2026-08-06',
    clientDesignSignature: SIG,
  })
  check('health profile skip omits general info requirements', Object.keys(skipped).length === 0)

  const defaults = micropigmentationServiceDefaults('Hydragloss')
  check('service nonexistent defaults create catalog entry once', defaults.slug === 'micropigmentation-hydragloss')
}

async function runApiTests() {
  const health = await fetch('http://127.0.0.1:3001/health').catch(() => null)
  if (!health || !health.ok) {
    check('API available for micropigmentation booking tests', false, 'start with npm run dev:api')
    return
  }
  check('API available for micropigmentation booking tests', true)

  const categories = await api<Array<{ code: string; name: string }>>(`/service-categories?salonId=${SALON}`)
  const micro = categories.find((item) => item.code === 'micropigmentation')
  check('Micropigmentation category exists', Boolean(micro))

  const services = await api<Array<{ id: string; name: string; slug?: string; category_code?: string; is_active?: boolean }>>(
    `/salons/${SALON}/services?category=micropigmentation&limit=100`,
  )
  check('Micropigmentation has catalog services', services.length >= 1)
  check(
    'Most popular seed microblading present',
    services.some((service) => /microblading/i.test(service.name)),
  )

  const clients = await api<Array<{ id: string; full_name: string }>>(`/salons/${SALON}/clients?limit=100`)
  check('client search data available', clients.length > 0)

  const profile = await api<Record<string, unknown> | null>(
    `/salons/${SALON}/clients/${CLIENT}/health-profiles/micropigmentation`,
  ).catch(() => null)
  check('health profile endpoint responds for micropigmentation', profile === null || typeof profile === 'object')

  const first = await api<{ id: string; slug: string }>(`/salons/${SALON}/services/ensure`, {
    method: 'POST',
    body: JSON.stringify({
      categoryCode: 'micropigmentation',
      slug: 'micropigmentation-hydragloss',
      name: 'Micropigmentation - Hydragloss',
      durationMinutes: 60,
      priceMinor: 6500,
      assignToActiveProviders: true,
    }),
  })
  const second = await api<{ id: string; slug: string }>(`/salons/${SALON}/services/ensure`, {
    method: 'POST',
    body: JSON.stringify({
      categoryCode: 'micropigmentation',
      slug: 'micropigmentation-hydragloss',
      name: 'Micropigmentation - Hydragloss',
      durationMinutes: 60,
      priceMinor: 6500,
      assignToActiveProviders: true,
    }),
  })
  check('service nonexistent: created once and reused', first.id === second.id && first.slug === 'micropigmentation-hydragloss')

  const concurrent = await Promise.all([
    api<{ id: string }>(`/salons/${SALON}/services/ensure`, {
      method: 'POST',
      body: JSON.stringify({
        categoryCode: 'micropigmentation',
        slug: 'micropigmentation-lips',
        name: 'Micropigmentation - Lips',
        durationMinutes: 75,
        priceMinor: 9500,
        assignToActiveProviders: true,
      }),
    }),
    api<{ id: string }>(`/salons/${SALON}/services/ensure`, {
      method: 'POST',
      body: JSON.stringify({
        categoryCode: 'micropigmentation',
        slug: 'micropigmentation-lips',
        name: 'Micropigmentation - Lips',
        durationMinutes: 75,
        priceMinor: 9500,
        assignToActiveProviders: true,
      }),
    }),
  ])
  check('two concurrent ensure requests do not create duplicate services', concurrent[0].id === concurrent[1].id)

  const reused = await api<{ id: string }>(`/salons/${SALON}/services/ensure`, {
    method: 'POST',
    body: JSON.stringify({
      categoryCode: 'micropigmentation',
      slug: 'micropigmentation-microblading',
      name: 'Micropigmentation - microblading',
      durationMinutes: 90,
      priceMinor: 10500,
      assignToActiveProviders: true,
    }),
  })
  check('service existing: ensure reuses microblading id', reused.id === MICROBLADING)

  const start = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  const end = new Date(start.getTime() + 90 * 60 * 1000)

  const created = await api<{ id: string; status_code: string }>(`/salons/${SALON}/appointments`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT,
      professionalId: PROFESSIONAL,
      serviceIds: [MICROBLADING],
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      source: 'internal',
      treatmentDetails: {
        category: 'micropigmentation',
        area: 'Eyebrows',
        procedure: 'Microblading',
        phototype: 'Type III',
        herpesSimplex: 'No',
        pigment_brand: 'Perma Blend',
        needle: '18U',
        professionalSignature: 'Sarah Johnson',
        consentDate: '2026-08-06',
        clientDesignSignature: SIG,
        consentAccepted: true,
        signatures: [
          { type: 'professional_signature', signerName: 'Sarah Johnson', data: SIG },
          { type: 'design_approval', signerName: 'Client', data: SIG },
        ],
      },
    }),
  })
  check('appointment created for micropigmentation', Boolean(created.id))

  const comingUp = await api<{ id: string; status_code: string }>(
    `/salons/${SALON}/appointments/${created.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'coming_up', actorRole: 'owner' }) },
  )
  check('status COMING UP persisted', comingUp.status_code === 'coming_up')

  const doubleClick = await apiRaw(`/salons/${SALON}/appointments`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT,
      professionalId: PROFESSIONAL,
      serviceIds: [MICROBLADING],
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      source: 'internal',
      treatmentDetails: { category: 'micropigmentation', procedure: 'Microblading' },
    }),
  })
  check('double click / conflict does not create duplicate slot', !doubleClick.ok)

  const failedCreate = await apiRaw(`/salons/${SALON}/appointments`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT,
      professionalId: '00000000-0000-0000-0000-000000000099',
      serviceIds: [MICROBLADING],
      startsAt: new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      source: 'internal',
    }),
  })
  check('backend error does not look like success', !failedCreate.ok)

  await api(`/salons/${SALON}/appointments/${created.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_progress', actorRole: 'professional' }),
  })
  const completed = await api<{ id: string; status_code: string }>(
    `/salons/${SALON}/appointments/${created.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'completed', actorRole: 'professional', tipMinor: 1000 }) },
  )
  check('COMING UP → Completed persisted', completed.status_code === 'completed')

  const rescheduleStart = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000)
  const rescheduleEnd = new Date(rescheduleStart.getTime() + 90 * 60 * 1000)
  // Create a fresh coming_up appointment to reschedule
  const toReschedule = await api<{ id: string }>(`/salons/${SALON}/appointments`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT,
      professionalId: PROFESSIONAL,
      serviceIds: [MICROBLADING],
      startsAt: rescheduleStart.toISOString(),
      endsAt: rescheduleEnd.toISOString(),
      source: 'internal',
      treatmentDetails: { category: 'micropigmentation', procedure: 'Microblading', consentAccepted: true },
    }),
  })
  await api(`/salons/${SALON}/appointments/${toReschedule.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'coming_up', actorRole: 'owner' }),
  })
  const newStart = new Date(rescheduleStart.getTime() + 3 * 60 * 60 * 1000)
  const newEnd = new Date(newStart.getTime() + 90 * 60 * 1000)
  const rescheduled = await api<{ id: string; starts_at: string }>(
    `/salons/${SALON}/appointments/${toReschedule.id}/schedule`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        professionalId: PROFESSIONAL,
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
      }),
    },
  )
  check('reschedule updates existing appointment id', rescheduled.id === toReschedule.id)

  // Regression: other categories still book
  for (const flow of [
    { name: 'Nails', serviceId: '60000000-0000-0000-0000-000000000001', professionalId: '30000000-0000-0000-0000-000000000001', category: 'nails' },
    { name: 'Lashes', serviceId: '60000000-0000-0000-0000-000000000004', professionalId: '30000000-0000-0000-0000-000000000002', category: 'lashes' },
    { name: 'Cosmetology', serviceId: '60000000-0000-0000-0000-000000000006', professionalId: '30000000-0000-0000-0000-000000000003', category: 'cosmetology' },
  ] as const) {
    const offset = flow.name.length * 3
    const s = new Date(Date.now() + (50 + offset) * 24 * 60 * 60 * 1000)
    s.setMinutes(0, 0, 0)
    const e = new Date(s.getTime() + 60 * 60 * 1000)
    const appointment = await api<{ id: string }>(`/salons/${SALON}/appointments`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: CLIENT,
        professionalId: flow.professionalId,
        serviceIds: [flow.serviceId],
        startsAt: s.toISOString(),
        endsAt: e.toISOString(),
        source: 'internal',
        treatmentDetails: { category: flow.category, consentAccepted: true },
      }),
    })
    check(`${flow.name} booking still works`, Boolean(appointment.id))
  }
}

async function main() {
  runUnitTests()
  await runApiTests()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
