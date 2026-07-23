#!/usr/bin/env tsx
const API = 'http://127.0.0.1:3001/api'
const SALON = '10000000-0000-0000-0000-000000000001'
const CLIENT = '40000000-0000-0000-0000-000000000007'
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const SIG = '10,10 20,20 30,15'

const flows = [
  {
    name: 'Nails',
    professionalId: '30000000-0000-0000-0000-000000000001',
    serviceId: '60000000-0000-0000-0000-000000000001',
    category: 'nails',
    startsAt: '2026-07-27T10:00:00-04:00',
    endsAt: '2026-07-27T11:30:00-04:00',
    details: {
      category: 'nails',
      nailServiceType: 'Full set',
      nailType: 'Almond',
      handMode: 'finger',
      materialLabels: ['Polygel'],
      materials: ['Polygel'],
      rightHand: { thumb: { widthMm: '10', lengthMm: '12' } },
      healthAnswers: { chemical_allergies: 'no', diabetic: 'no' },
      consentAccepted: true,
      photoConsent: true,
    },
  },
  {
    name: 'Lashes',
    professionalId: '30000000-0000-0000-0000-000000000002',
    serviceId: '60000000-0000-0000-0000-000000000004',
    category: 'lashes',
    startsAt: '2026-07-27T12:00:00-04:00',
    endsAt: '2026-07-27T13:30:00-04:00',
    details: {
      category: 'lashes',
      style: 'Cat Eye',
      volume: '3D',
      curl: 'C',
      thickness: '0.15',
      defaultLength: '12',
      lashMap: { rightEye: [{ position: 1, length: 10 }] },
      healthAnswers: { adhesive_allergies: 'no' },
      consentAccepted: true,
      photoConsent: true,
    },
  },
  {
    name: 'Cosmetology',
    professionalId: '30000000-0000-0000-0000-000000000003',
    serviceId: '60000000-0000-0000-0000-000000000006',
    category: 'cosmetology',
    startsAt: '2026-07-27T14:00:00-04:00',
    endsAt: '2026-07-27T15:00:00-04:00',
    details: {
      category: 'cosmetology',
      phototype: 'Type III',
      skin_type: 'Combination',
      equipment: ['Dermapen'],
      faceAnnotations: [{ x: 50, y: 40, type: 'Active acne' }],
      products: 'Vitamin C serum',
      aftercare: 'SPF daily',
      healthAnswers: { active_acne: 'no' },
      consentAccepted: true,
      photoConsent: true,
    },
  },
  {
    name: 'Micropigmentation',
    professionalId: '30000000-0000-0000-0000-000000000002',
    serviceId: '60000000-0000-0000-0000-000000000008',
    category: 'micropigmentation',
    startsAt: '2026-07-27T16:00:00-04:00',
    endsAt: '2026-07-27T18:00:00-04:00',
    details: {
      category: 'micropigmentation',
      area: 'Eyebrows',
      procedure: 'Microblading',
      brow_width_mm: '45',
      undertone: 'Warm',
      pigment_brand: 'Permablend',
      needle: '18U',
      touch_up_date: '2026-08-01',
      healthAnswers: { blood_disorders: 'no' },
      consentAccepted: true,
      photoConsent: true,
      clientDesignSignature: SIG,
    },
  },
] as const

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json() as { data?: T; error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  return body.data as T
}

async function uploadPhoto(category: string) {
  return api<{ storageKey: string; url: string; mimeType: string }>(`/salons/${SALON}/treatment-media/upload`, {
    method: 'POST',
    body: JSON.stringify({
      dataBase64: TINY_PNG,
      mimeType: 'image/png',
      originalFilename: 'test.png',
      mediaType: 'reference',
      category,
    }),
  })
}

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
  if (ok) passed += 1
  else failed += 1
}

async function main() {
  const materials = await api<unknown[]>(`/salons/${SALON}/service-materials?categoryCode=nails&serviceId=60000000-0000-0000-0000-000000000001`)
  check('service-materials endpoint', Array.isArray(materials))

  const base = Date.now() + 7 * 24 * 60 * 60 * 1000

  for (const [index, flow] of flows.entries()) {
    const start = new Date(base + index * 3 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 90 * 60 * 1000)
    const startsAt = start.toISOString()
    const endsAt = end.toISOString()

    const photo = await uploadPhoto(flow.category)
    const treatmentDetails = {
      ...flow.details,
      professionalSignature: SIG,
      clientSignature: SIG,
      signatures: [
        { type: 'professional_signature', signerName: 'Pro', data: SIG },
        { type: 'client_signature', signerName: 'Client', data: SIG },
        ...(flow.category === 'micropigmentation'
          ? [{ type: 'design_approval', signerName: 'Client', data: SIG }]
          : []),
      ],
      consents: [{ type: 'appointment_consent', text: 'Consent text', accepted: true, version: 1 }],
      mediaItems: [{
        storageKey: photo.storageKey,
        url: photo.url,
        mimeType: photo.mimeType,
        mediaType: 'reference',
      }],
    }

    const created = await api<{ id: string }>(`/salons/${SALON}/appointments`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: CLIENT,
        professionalId: flow.professionalId,
        serviceIds: [flow.serviceId],
        startsAt,
        endsAt,
        source: 'internal',
        treatmentDetails,
        treatmentNotes: `${flow.name} E2E note`,
      }),
    })

    const appointment = await api<Record<string, unknown>>(`/salons/${SALON}/appointments/${created.id}`)
    const category = (appointment.services as Array<{ category_code_snapshot: string }> | undefined)?.[0]?.category_code_snapshot
    const details = (appointment.treatment_details_by_category as Record<string, Record<string, unknown>> | undefined)?.[category ?? '']

    check(`${flow.name} treatment_details_by_category`, Boolean(details && Object.keys(details).length))
    check(`${flow.name} health_questionnaire_answers`, Boolean(appointment.health_questionnaire_answers))
    check(`${flow.name} clinical_signatures`, ((appointment.clinical_signatures as unknown[]) ?? []).length >= 2)
    check(`${flow.name} clinical_consents`, ((appointment.clinical_consents as unknown[]) ?? []).length >= 1)
    check(`${flow.name} clinical_media`, ((appointment.clinical_media as unknown[]) ?? []).length >= 1)

    const mediaUrl = ((appointment.clinical_media as Array<{ url?: string }> | undefined) ?? [])[0]?.url
    if (mediaUrl) {
      const mediaResponse = await fetch(mediaUrl)
      check(`${flow.name} media URL persists (${mediaResponse.status})`, mediaResponse.ok)
    } else {
      check(`${flow.name} media URL present`, false)
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
