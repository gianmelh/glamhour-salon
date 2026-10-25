import type { ClientClinicalForm } from '../../../types/api'
import { getCosmetologyDetailsMissingItems } from '../appointment-booking/categories/cosmetology/cosmetologyDetailsSpec'
import { getMicropigmentationDetailsMissingItems } from '../appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec'
import { isHandComplete } from '../appointment-booking/categories/nails/nailsFingerOptions'
import { getHealthQuestionnaireMissingItems } from '../appointment-booking/health-questionnaires'
import type { BookingCategoryCode } from '../appointment-booking/types'
import { getLashesDetailsMissingItems } from '../lashes-booking/lashesDetailsValidation'

export function isLegacyClinicalForm(category: BookingCategoryCode, details: Record<string, unknown>) {
  const keys = category === 'nails' ? ['nailServiceType', 'nailType', 'materials', 'materialIds', 'materialLabels', 'rightHand', 'leftHand']
    : category === 'lashes' ? ['style', 'variant', 'eyeShape', 'lashMap', 'volume', 'curl', 'thickness']
      : category === 'cosmetology' ? ['serviceType', 'healthHistory', 'currentMedications', 'skin_type', 'equipment', 'alterations', 'faceAnnotations']
        : ['procedure', 'procedures', 'healthHistory', 'currentMedications', 'pigment_brand', 'needle', 'needleType', 'herpesSimplex']
  return !keys.some((key) => details[key] !== undefined)
    && Boolean(details.healthAnswers && Object.keys(details.healthAnswers as object).length)
}

export function clinicalFormSubmission(details: Record<string, unknown>) {
  const transient = new Set(['micropigmentationServiceIds', 'registrationStep', 'previewReturnStep', 'photoCapturePending', 'photoLocalPreviewUrl', 'existingQuestionnaireId', 'usedExistingHealthProfile'])
  return Object.fromEntries(Object.entries(details).filter(([key]) => !transient.has(key)))
}

export function clinicalFormMissingItems(category: BookingCategoryCode, details: Record<string, unknown>, legacy: boolean) {
  if (legacy) return getHealthQuestionnaireMissingItems(category, details)
  if (category === 'cosmetology') return getCosmetologyDetailsMissingItems(details)
  if (category === 'micropigmentation') return getMicropigmentationDetailsMissingItems(details)
  if (category === 'lashes') return getLashesDetailsMissingItems(details)
  const missing: string[] = []
  if (!details.nailServiceType) missing.push('Select a service type.')
  if (details.nailType === 'Custom' && !String(details.customNailTypeName ?? '').trim()) missing.push('Add the custom nail type name.')
  const serviceType = String(details.nailServiceType ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (['dualsystem', 'presson'].includes(serviceType)
    && (!isHandComplete(details.rightHand as Parameters<typeof isHandComplete>[0]) || !isHandComplete(details.leftHand as Parameters<typeof isHandComplete>[0]))) {
    missing.push('Complete hand sizes for this service.')
  }
  return missing
}

export function clinicalFormDetails(record: ClientClinicalForm | undefined): Record<string, unknown> {
  const details = record?.form_details ?? {}
  const savedAnswers = details.healthAnswers && typeof details.healthAnswers === 'object' && !Array.isArray(details.healthAnswers)
    ? details.healthAnswers as Record<string, unknown>
    : {}
  const answers = { ...savedAnswers }
  for (const [key, value] of Object.entries(record?.answers ?? {})) {
    if (typeof value === 'boolean' || value === 'yes' || value === 'no') answers[key] = value
  }
  if (!Object.keys(answers).length) return { ...details }
  return {
    ...details,
    healthAnswers: Object.fromEntries(Object.entries(answers).map(([key, value]) => [
      key, value === true ? 'yes' : value === false ? 'no' : value,
    ])),
  }
}

export function clinicalDate(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}
