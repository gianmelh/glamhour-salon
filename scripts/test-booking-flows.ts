#!/usr/bin/env tsx
const API = 'http://127.0.0.1:3001/api'
const SALON = '10000000-0000-0000-0000-000000000001'
const CLIENT = '40000000-0000-0000-0000-000000000007'
const OTHER_SALON = '10000000-0000-0000-0000-000000000099'
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const SIG = '10,10 20,20 30,15'

const fullHand = {
  thumb: { widthMm: '12', capsuleNumber: '1' },
  index: { widthMm: '11', capsuleNumber: '2' },
  middle: { widthMm: '11', capsuleNumber: '3' },
  ring: { widthMm: '10', capsuleNumber: '4' },
  pinky: { widthMm: '9', capsuleNumber: '5' },
}

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
      nailServiceType: 'Dual system',
      nailType: 'Almond',
      handMode: 'finger',
      materialLabels: ['Polygel'],
      materials: ['Polygel'],
      rightHand: fullHand,
      leftHand: fullHand,
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
      lashMap: {
        rightEye: [8, 9, 10, 11, 12, 13, 14].map((position) => ({ position, length: 12 })),
        leftEye: [8, 9, 10, 11, 12, 13, 14].map((position) => ({ position, length: 11 })),
      },
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
      skinAlterationNotes: 'Mild redness around the nose',
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
      session_type: 'Initial session',
      session_number: '1',
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

async function apiRaw(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
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

  const base = Date.now() + (14 + Math.floor(Math.random() * 60)) * 24 * 60 * 60 * 1000
  let nailsAppointmentId = ''

  for (const [index, flow] of flows.entries()) {
    const start = new Date(base + index * 4 * 60 * 60 * 1000)
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

    if (flow.category === 'nails') nailsAppointmentId = created.id

    const appointment = await api<Record<string, unknown>>(`/salons/${SALON}/appointments/${created.id}`)
    const category = (appointment.services as Array<{ category_code_snapshot: string }> | undefined)?.[0]?.category_code_snapshot
    const details = (appointment.treatment_details_by_category as Record<string, Record<string, unknown>> | undefined)?.[category ?? '']

    check(`${flow.name} treatment_details_by_category`, Boolean(details && Object.keys(details).length))
    check(`${flow.name} health_questionnaire_answers`, Boolean(appointment.health_questionnaire_answers))
    check(`${flow.name} clinical_signatures`, ((appointment.clinical_signatures as unknown[]) ?? []).length >= 2)
    check(`${flow.name} clinical_consents`, ((appointment.clinical_consents as unknown[]) ?? []).length >= 1)
    check(`${flow.name} clinical_media`, ((appointment.clinical_media as unknown[]) ?? []).length >= 1)

    if (flow.category === 'nails') {
      const annotations = (appointment.clinical_annotations as Array<{ annotation_type?: string; body_area?: string; points_json?: unknown }> | undefined) ?? []
      const nailAnnotations = annotations.filter((item) => item.annotation_type === 'nail_measurements')
      check('Nails nail_measurements annotations', nailAnnotations.length >= 2)
      check('Nails rightHand persisted', Boolean((details as { rightHand?: unknown } | undefined)?.rightHand))
      check('Nails leftHand persisted', Boolean((details as { leftHand?: unknown } | undefined)?.leftHand))
    }

    if (flow.category === 'lashes') {
      const annotations = (appointment.clinical_annotations as Array<{ annotation_type?: string }> | undefined) ?? []
      const lashAnnotations = annotations.filter((item) => item.annotation_type === 'lash_map')
      check('Lashes lash_map annotations', lashAnnotations.length >= 1)
      const map = (details as { lashMap?: { rightEye?: unknown[]; leftEye?: unknown[] } } | undefined)?.lashMap
      check('Lashes rightEye map zones', (map?.rightEye?.length ?? 0) >= 7)
      check('Lashes leftEye map zones', (map?.leftEye?.length ?? 0) >= 7)
    }

    const mediaUrl = ((appointment.clinical_media as Array<{ url?: string }> | undefined) ?? [])[0]?.url
    if (mediaUrl) {
      const mediaResponse = await fetch(mediaUrl)
      check(`${flow.name} media URL persists (${mediaResponse.status})`, mediaResponse.ok)
    } else {
      check(`${flow.name} media URL present`, false)
    }
  }

  if (nailsAppointmentId) {
    const updated = await api<Record<string, unknown>>(`/salons/${SALON}/appointments/${nailsAppointmentId}/treatment-details`, {
      method: 'PATCH',
      body: JSON.stringify({
        categoryCode: 'nails',
        treatmentDetails: {
          nailServiceType: 'Press on',
          nailType: 'Coffin',
          materials: ['Acrylic'],
          materialLabels: ['Acrylic'],
          rightHand: fullHand,
          leftHand: fullHand,
        },
        treatmentNotes: 'Updated nails note',
      }),
    })
    const nailsDetails = (updated.treatment_details_by_category as Record<string, Record<string, unknown>> | undefined)?.nails
    check('Nails partial update without duplicate appointment', updated.id === nailsAppointmentId)
    check('Nails updated nailServiceType', nailsDetails?.nailServiceType === 'Press on')
    check('Nails updated nailType', nailsDetails?.nailType === 'Coffin')

    await api(`/salons/${SALON}/appointments/${nailsAppointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'coming_up', actorRole: 'owner' }),
    })
    await api(`/salons/${SALON}/appointments/${nailsAppointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress', actorRole: 'professional' }),
    })
    await api(`/salons/${SALON}/appointments/${nailsAppointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', actorRole: 'professional', tipMinor: 1000 }),
    })

    const sales = await api<{ records: Array<{ appointment_id: string; tip_minor: number; total_minor: number }> }>(
      `/salons/${SALON}/sales-history?limit=50`,
    )
    const sale = sales.records.find((record) => record.appointment_id === nailsAppointmentId)
    check('Nails completed appears in Sales History', Boolean(sale))
    check('Nails tip snapshotted in Sales History', sale?.tip_minor === 1000)

    const foreign = await apiRaw(`/salons/${OTHER_SALON}/appointments/${nailsAppointmentId}`)
    check('Nails blocked for other salon', foreign.status === 404 || foreign.status === 403 || foreign.status >= 400)
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
