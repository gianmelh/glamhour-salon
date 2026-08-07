import type { Client, EligibleProvider, Service, ServiceCategory } from '../../../types/api'
import { buildLashesTreatmentReviewRows } from '../lashes-booking/buildLashesReviewSections'
import { healthQuestionnaires } from './health-questionnaires'
import type { BookingCategoryCode, FingerName } from './types'

const fingerLabels: Record<FingerName, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
}

export type ReviewSection = {
  title: string
  rows: Array<{ label: string; value: string }>
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

function formatHealthAnswers(categoryCode: string, details: Record<string, unknown>) {
  const answers = details.healthAnswers as Record<string, string> | undefined
  if (!answers) return []
  const definition = healthQuestionnaires[categoryCode as BookingCategoryCode]
  const labelById = definition
    ? Object.fromEntries(definition.sections.flatMap((section) => section.questions.map((q) => [q.id, q.label])))
    : {}
  return Object.entries(answers).map(([key, value]) => ({
    label: labelById[key] ?? key.replace(/_/g, ' '),
    value: value === 'yes' ? 'Yes' : value === 'no' ? 'No' : String(value),
  }))
}

function formatFaceAnnotations(annotations: Array<{ x: number; y: number; type: string }> | undefined) {
  if (!annotations?.length) return []
  const grouped = annotations.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(grouped).map(([type, count]) => ({ label: 'Face map', value: `${type} (${count})` }))
}

function formatMaterialLabels(details: Record<string, unknown>) {
  const labels = Array.isArray(details.materialLabels) && details.materialLabels.length
    ? details.materialLabels
    : Array.isArray(details.materials)
      ? details.materials
      : []
  const otherMaterialName = String(details.otherMaterialName ?? '').trim()
  return labels.map((label) => (
    label === 'Other' && otherMaterialName ? `Other: ${otherMaterialName}` : String(label)
  ))
}

function buildNailsTreatmentReviewRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []
  if (details.nailServiceType) rows.push({ label: 'Service type', value: String(details.nailServiceType) })
  if (details.nailType) rows.push({ label: 'Nail shape', value: String(details.nailType) })
  if (details.handMode) {
    rows.push({ label: 'Hand mode', value: details.handMode === 'finger' ? 'Finger to finger' : 'Full hand' })
  }
  const materialLabels = formatMaterialLabels(details)
  if (materialLabels.length) rows.push({ label: 'Materials', value: materialLabels.join(', ') })
  rows.push(...formatHandMeasurements(details.rightHand as Record<string, Record<string, string>>, 'Right hand'))
  rows.push(...formatHandMeasurements(details.leftHand as Record<string, Record<string, string>>, 'Left hand'))
  if (details.lengthPreference) rows.push({ label: 'Length preference', value: String(details.lengthPreference) })
  return rows
}

function buildCosmetologyTreatmentReviewRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []
  if (details.generalFullName) rows.push({ label: 'Full name', value: String(details.generalFullName) })
  if (details.generalPhone) rows.push({ label: 'Phone number', value: String(details.generalPhone) })
  if (details.generalDateOfBirth) rows.push({ label: 'Date of birth', value: String(details.generalDateOfBirth) })
  if (details.generalEmail) rows.push({ label: 'Email', value: String(details.generalEmail) })
  if (details.isFirstTime) rows.push({ label: 'First time', value: String(details.isFirstTime) })
  if (details.serviceType) rows.push({ label: 'Service type', value: String(details.serviceType) })
  if (details.phototype) rows.push({ label: 'Phototype', value: String(details.phototype) })
  if (details.skin_type) rows.push({ label: 'Skin type', value: String(details.skin_type) })
  if (Array.isArray(details.healthHistory) && details.healthHistory.length) {
    rows.push({ label: 'Health history', value: (details.healthHistory as string[]).join(', ') })
  }
  if (details.currentMedications) rows.push({ label: 'Current medications', value: String(details.currentMedications) })
  if (details.smoking) rows.push({ label: 'Smoking', value: String(details.smoking) })
  if (details.smokingFrequency) rows.push({ label: 'Smoking frequency', value: String(details.smokingFrequency) })
  if (details.alcohol) rows.push({ label: 'Alcohol', value: String(details.alcohol) })
  if (Array.isArray(details.alterations) && details.alterations.length) {
    rows.push({ label: 'Alterations', value: (details.alterations as string[]).join(', ') })
  }
  if (Array.isArray(details.equipment) && details.equipment.length) {
    rows.push({ label: 'Equipment', value: (details.equipment as string[]).join(', ') })
  }
  if (details.cosmeticBrandLine) rows.push({ label: 'Brand / line', value: String(details.cosmeticBrandLine) })
  if (details.products) rows.push({ label: 'Products', value: String(details.products) })
  if (details.recommendations) rows.push({ label: 'Recommendations', value: String(details.recommendations) })
  rows.push(...formatFaceAnnotations(details.faceAnnotations as Array<{ x: number; y: number; type: string }>))
  return rows
}

function buildMicropigmentationTreatmentReviewRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = []
  if (details.generalFullName) rows.push({ label: 'Full name', value: String(details.generalFullName) })
  if (details.area) rows.push({ label: 'Area', value: String(details.area) })
  if (Array.isArray(details.procedures) && details.procedures.length) {
    rows.push({ label: 'Procedures', value: (details.procedures as string[]).join(', ') })
  } else if (details.procedure) {
    rows.push({ label: 'Procedure', value: String(details.procedure) })
  }
  if (details.phototype) rows.push({ label: 'Phototype', value: String(details.phototype) })
  if (details.herpesSimplex) rows.push({ label: 'Herpes Simplex', value: String(details.herpesSimplex) })
  if (details.anesthesiaBrand) rows.push({ label: 'Anesthesia brand', value: String(details.anesthesiaBrand) })
  if (details.pigment_brand || details.pigmentBrand) {
    rows.push({ label: 'Pigment brand', value: String(details.pigment_brand ?? details.pigmentBrand) })
  }
  if (details.color_mix || details.colorMix) {
    rows.push({ label: 'Color mix', value: String(details.color_mix ?? details.colorMix) })
  }
  if (details.needle || details.needleType) {
    rows.push({ label: 'Needle', value: String(details.needle ?? details.needleType) })
  }
  if (details.needleSize) rows.push({ label: 'Needle size', value: String(details.needleSize) })
  if (details.touch_up_date || details.touchUpAppointment) {
    rows.push({ label: 'Touch-up', value: String(details.touch_up_date ?? details.touchUpAppointment) })
  }
  if (details.brow_width_mm) rows.push({ label: 'Brow width', value: `${details.brow_width_mm} mm` })
  if (details.brow_height_mm) rows.push({ label: 'Brow height', value: `${details.brow_height_mm} mm` })
  if (details.lip_width_mm) rows.push({ label: 'Lip width', value: `${details.lip_width_mm} mm` })
  if (details.undertone) rows.push({ label: 'Undertone', value: String(details.undertone) })
  if (Array.isArray(details.healthHistory) && details.healthHistory.length) {
    rows.push({ label: 'Health history', value: (details.healthHistory as string[]).join(', ') })
  }
  if (details.products) rows.push({ label: 'Products', value: String(details.products) })
  if (details.aftercare) rows.push({ label: 'Aftercare', value: String(details.aftercare) })
  return rows
}

function buildCategoryTreatmentReviewRows(categoryCode: string, details: Record<string, unknown>) {
  switch (categoryCode) {
    case 'nails':
      return buildNailsTreatmentReviewRows(details)
    case 'lashes':
      return buildLashesTreatmentReviewRows(details)
    case 'cosmetology':
      return buildCosmetologyTreatmentReviewRows(details)
    case 'micropigmentation':
      return buildMicropigmentationTreatmentReviewRows(details)
    default:
      return []
  }
}

export function buildReviewSections(
  category: ServiceCategory,
  service: Service,
  client: Client,
  provider: EligibleProvider | undefined,
  startsAt: string,
  details: Record<string, unknown>,
  notes: string,
): ReviewSection[] {
  const sections: ReviewSection[] = [
    {
      title: 'Appointment',
      rows: [
        { label: 'Category', value: category.name },
        { label: 'Service', value: service.name },
        { label: 'Client', value: client.full_name },
        { label: 'Amount', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: service.currency_code }).format(service.price_minor / 100) },
        ...(provider ? [{ label: 'Provider', value: provider.full_name }] : []),
        ...(startsAt ? [{ label: 'Scheduled', value: new Date(startsAt).toLocaleString() }] : []),
      ],
    },
  ]

  const serviceRows = buildCategoryTreatmentReviewRows(category.code, details)
  if (serviceRows.length) sections.push({ title: 'Treatment details', rows: serviceRows })

  const healthRows = formatHealthAnswers(category.code, details)
  if (details.phototype && category.code === 'cosmetology') {
    healthRows.push({ label: 'Phototype', value: String(details.phototype) })
  }
  if (details.consentAccepted) healthRows.push({ label: 'Consent', value: 'Accepted' })
  if (details.professionalSignature) healthRows.push({ label: 'Professional signature', value: 'Captured' })
  if (details.clientSignature) healthRows.push({ label: 'Client signature', value: 'Captured' })
  if (details.clientDesignSignature) healthRows.push({ label: 'Design approval', value: 'Signed' })
  if (healthRows.length) sections.push({ title: 'Health & consent', rows: healthRows })

  const mediaItems = details.mediaItems as Array<{ url?: string; mediaType?: string }> | undefined
  if (mediaItems?.length) {
    sections.push({
      title: 'Photos',
      rows: mediaItems.map((item, index) => ({
        label: item.mediaType ?? `Photo ${index + 1}`,
        value: item.url ? 'Uploaded' : 'Pending',
      })),
    })
  }

  if (notes) sections.push({ title: 'Notes', rows: [{ label: 'Clinical notes', value: notes }] })

  return sections
}
