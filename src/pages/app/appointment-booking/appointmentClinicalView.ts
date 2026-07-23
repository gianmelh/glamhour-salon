import type { Appointment, ClinicalAnnotation, ClinicalConsent, ClinicalMedia, ClinicalSignature } from '../../../types/api'
import { buildLashesTreatmentReviewRows } from '../lashes-booking/buildLashesReviewSections'
import { healthQuestionnaires } from './health-questionnaires'
import type { BookingCategoryCode, FingerName } from './types'
import type { ReviewSection } from './reviewSummary'

const fingerLabels: Record<FingerName, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
}

const signatureLabels: Record<string, string> = {
  professional_signature: 'Professional signature',
  client_signature: 'Client signature',
  design_approval: 'Design approval',
}

const consentLabels: Record<string, string> = {
  appointment_consent: 'Treatment consent',
  nails_photography_consent: 'Photo consent',
  lashes_photography_consent: 'Photo consent',
  cosmetology_photography_consent: 'Photo consent',
  micropigmentation_photography_consent: 'Photo consent',
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001/api'

function formatAnswerValue(value: unknown): string {
  if (value === true || value === 'yes') return 'Yes'
  if (value === false || value === 'no') return 'No'
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatHandMeasurements(hand: Record<string, Record<string, string>> | undefined, handLabel: string) {
  if (!hand) return []
  return (Object.keys(fingerLabels) as FingerName[]).flatMap((finger) => {
    const data = hand[finger]
    if (!data || (!data.widthMm && !data.lengthMm && !data.capsuleNumber)) return []
    const parts = [
      data.widthMm && `W ${data.widthMm}mm`,
      data.lengthMm && `L ${data.lengthMm}mm`,
      data.capsuleNumber && `#${data.capsuleNumber}`,
    ].filter(Boolean)
    return [{ label: `${handLabel} · ${fingerLabels[finger]}`, value: parts.join(' · ') }]
  })
}

function formatFaceAnnotationsFromDetails(annotations: Array<{ x: number; y: number; type: string }> | undefined) {
  if (!annotations?.length) return []
  const grouped = annotations.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(grouped).map(([type, count]) => ({ label: 'Face map', value: `${type} (${count})` }))
}

function formatClinicalAnnotations(annotations: ClinicalAnnotation[] | undefined) {
  if (!annotations?.length) return []
  const grouped = annotations.reduce<Record<string, number>>((acc, item) => {
    const key = item.annotation_type || item.body_area || 'Annotation'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(grouped).map(([type, count]) => ({
    label: annotations[0]?.category === 'lashes' ? 'Lash map' : 'Visual annotation',
    value: `${type} (${count})`,
  }))
}

function formatHealthAnswers(categoryCode: string, answers: Record<string, unknown> | undefined) {
  if (!answers || !Object.keys(answers).length) return []
  const definition = healthQuestionnaires[categoryCode as BookingCategoryCode]
  const labelById = definition
    ? Object.fromEntries(definition.sections.flatMap((section) => section.questions.map((q) => [q.id, q.label])))
    : {}
  return Object.entries(answers).map(([key, value]) => ({
    label: labelById[key] ?? key.replace(/_/g, ' '),
    value: formatAnswerValue(value),
  }))
}

function buildContraindicationRows(categoryCode: string, answers: Record<string, unknown> | undefined) {
  if (!answers) return []
  const definition = healthQuestionnaires[categoryCode as BookingCategoryCode]
  const labelById = definition
    ? Object.fromEntries(definition.sections.flatMap((section) => section.questions.map((q) => [q.id, q.label])))
    : {}
  return Object.entries(answers)
    .filter(([, value]) => value === true || value === 'yes')
    .map(([key]) => ({
      label: 'Possible contraindication',
      value: labelById[key] ?? key.replace(/_/g, ' '),
    }))
}

function buildTreatmentRows(categoryCode: string, details: Record<string, unknown>) {
  switch (categoryCode) {
    case 'nails':
      return buildNailsTreatmentRows(details)
    case 'lashes':
      return buildLashesTreatmentReviewRows(details)
    case 'cosmetology':
      return buildCosmetologyTreatmentRows(details)
    case 'micropigmentation':
      return buildMicropigmentationTreatmentRows(details)
    default:
      return []
  }
}

function buildNailsTreatmentRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []

  if (details.nailServiceType) rows.push({ label: 'Service type', value: String(details.nailServiceType) })
  if (details.nailType) rows.push({ label: 'Nail shape', value: String(details.nailType) })
  if (details.handMode) rows.push({ label: 'Hand mode', value: details.handMode === 'finger' ? 'Finger to finger' : 'Full hand' })

  const materialLabels = Array.isArray(details.materialLabels)
    ? (details.materialLabels as string[])
    : Array.isArray(details.materials)
      ? (details.materials as string[])
      : []
  if (materialLabels.length) rows.push({ label: 'Materials', value: materialLabels.join(', ') })

  rows.push(...formatHandMeasurements(details.rightHand as Record<string, Record<string, string>>, 'Right hand'))
  rows.push(...formatHandMeasurements(details.leftHand as Record<string, Record<string, string>>, 'Left hand'))

  if (details.lengthPreference) rows.push({ label: 'Length preference', value: String(details.lengthPreference) })

  return rows
}

function buildCosmetologyTreatmentRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []
  if (details.phototype) rows.push({ label: 'Phototype', value: String(details.phototype) })
  if (details.skin_type) rows.push({ label: 'Skin type', value: String(details.skin_type) })
  if (Array.isArray(details.equipment) && details.equipment.length) {
    rows.push({ label: 'Equipment', value: (details.equipment as string[]).join(', ') })
  }
  rows.push(...formatFaceAnnotationsFromDetails(details.faceAnnotations as Array<{ x: number; y: number; type: string }>))
  return rows
}

function buildMicropigmentationTreatmentRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []
  if (details.area) rows.push({ label: 'Area', value: String(details.area) })
  if (details.procedure) rows.push({ label: 'Procedure', value: String(details.procedure) })
  if (details.brow_width_mm) rows.push({ label: 'Brow width', value: `${details.brow_width_mm} mm` })
  if (details.brow_height_mm) rows.push({ label: 'Brow height', value: `${details.brow_height_mm} mm` })
  if (details.lip_width_mm) rows.push({ label: 'Lip width', value: `${details.lip_width_mm} mm` })
  if (details.undertone) rows.push({ label: 'Undertone', value: String(details.undertone) })
  if (details.pigment_brand) rows.push({ label: 'Pigment brand', value: String(details.pigment_brand) })
  if (details.color_mix) rows.push({ label: 'Color mix', value: String(details.color_mix) })
  if (details.needle) rows.push({ label: 'Needle', value: String(details.needle) })
  if (details.touch_up_date) rows.push({ label: 'Touch-up date', value: String(details.touch_up_date) })
  if (details.procedure_notes) rows.push({ label: 'Procedure notes', value: String(details.procedure_notes) })
  if (details.products) rows.push({ label: 'Products', value: String(details.products) })
  if (details.aftercare) rows.push({ label: 'Aftercare', value: String(details.aftercare) })
  return rows
}


export function resolveClinicalMediaUrl(media: ClinicalMedia): string {
  if (media.url) {
    if (media.url.startsWith('http://') || media.url.startsWith('https://')) return media.url
    if (media.url.startsWith('/api/')) return `${API_BASE.replace(/\/api$/, '')}${media.url}`
    return media.url
  }
  if (media.storage_key) return `${API_BASE}/media/${media.storage_key}`
  return ''
}

export function signaturePathData(data: string) {
  const points = data ? data.split(' ').map((pair) => pair.split(',').map(Number)) : []
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}

export type AppointmentClinicalView = {
  sections: ReviewSection[]
  signatures: ClinicalSignature[]
  consents: ClinicalConsent[]
  photos: Array<{ label: string; url: string }>
  contraindications: Array<{ label: string; value: string }>
}

export function buildAppointmentClinicalView(appointment: Appointment): AppointmentClinicalView {
  const service = appointment.services?.[0]
  const categoryCode = service?.category_code_snapshot ?? 'general'
  const details = appointment.treatment_details_by_category?.[categoryCode] ?? {}

  const healthAnswers = appointment.health_questionnaire_answers && Object.keys(appointment.health_questionnaire_answers).length
    ? appointment.health_questionnaire_answers
    : (details.healthAnswers as Record<string, unknown> | undefined)

  const sections: ReviewSection[] = []

  const appointmentRows = [
    { label: 'Category', value: service?.category_code_snapshot ?? categoryCode },
    { label: 'Service', value: service?.service_name_snapshot ?? '—' },
    { label: 'Client', value: appointment.client_name ?? '—' },
    { label: 'Professional', value: appointment.professional_name ?? '—' },
    { label: 'Date', value: new Date(appointment.starts_at).toLocaleDateString() },
    { label: 'Time', value: new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]
  sections.push({ title: 'Appointment information', rows: appointmentRows })

  const treatmentRows = buildTreatmentRows(categoryCode, details)
  if (appointment.clinical_annotations?.length && !treatmentRows.some((row) => row.label.includes('map'))) {
    treatmentRows.push(...formatClinicalAnnotations(appointment.clinical_annotations))
  }
  if (treatmentRows.length) sections.push({ title: 'Treatment details', rows: treatmentRows })

  const healthRows = formatHealthAnswers(categoryCode, healthAnswers)
  if (healthRows.length) sections.push({ title: 'Health questionnaire', rows: healthRows })

  const contraindications = buildContraindicationRows(categoryCode, healthAnswers)
  if (contraindications.length) sections.push({ title: 'Contraindications', rows: contraindications })

  const consentRows = (appointment.clinical_consents ?? []).map((consent) => ({
    label: consentLabels[consent.consent_type] ?? consent.consent_type.replace(/_/g, ' '),
    value: consent.accepted ? `Accepted · ${new Date(consent.accepted_at).toLocaleString()}` : 'Declined',
  }))
  if (consentRows.length) sections.push({ title: 'Consent records', rows: consentRows })

  const signatureRows = (appointment.clinical_signatures ?? []).map((signature) => ({
    label: signatureLabels[signature.signature_type] ?? signature.signature_type.replace(/_/g, ' '),
    value: `${signature.signer_name} · ${new Date(signature.signed_at).toLocaleString()}`,
  }))
  if (signatureRows.length) sections.push({ title: 'Signatures', rows: signatureRows })

  const notes = typeof details.notes === 'string'
    ? details.notes
    : appointment.customer_notes ?? appointment.internal_notes ?? ''
  if (notes) sections.push({ title: 'Notes', rows: [{ label: 'Clinical notes', value: notes }] })

  const mediaFromApi = appointment.clinical_media ?? []
  const mediaFromDetails = (details.mediaItems as ClinicalMedia[] | undefined) ?? []
  const photos = [...mediaFromApi, ...mediaFromDetails]
    .map((item, index) => ({
      label: item.media_type ? String(item.media_type) : `Photo ${index + 1}`,
      url: resolveClinicalMediaUrl(item),
    }))
    .filter((item) => item.url)

  if (photos.length) {
    sections.push({
      title: 'Photos',
      rows: photos.map((photo) => ({ label: photo.label, value: 'Attached' })),
    })
  }

  return {
    sections,
    signatures: appointment.clinical_signatures ?? [],
    consents: appointment.clinical_consents ?? [],
    photos,
    contraindications,
  }
}
