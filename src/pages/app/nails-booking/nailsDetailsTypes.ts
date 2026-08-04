import type { FingerName, HandName, TreatmentMediaItem } from '../appointment-booking/types'

export type NailsHandMode = 'finger' | 'hand'

export type NailFingerMeasurement = {
  widthMm?: string
  capsuleNumber?: string
  lengthMm?: string
}

export type NailsHandMap = Partial<Record<FingerName, NailFingerMeasurement>>

export type NailsDetails = {
  nailServiceType?: string
  nailType?: string
  materialIds?: string[]
  materialLabels?: string[]
  materials?: string[]
  otherMaterialName?: string
  handMode?: NailsHandMode
  activeHand?: HandName
  activeFinger?: FingerName
  rightHand?: NailsHandMap
  leftHand?: NailsHandMap
  lengthPreference?: string
  photoPreviewUrl?: string
  photoStorageKey?: string
  photoConsent?: boolean
  mediaItems?: TreatmentMediaItem[]
  healthAnswers?: Record<string, string>
  consentItems?: Record<string, boolean>
  consentAccepted?: boolean
  consentDate?: string
  consentTime?: string
  consents?: Array<Record<string, unknown>>
  professionalSignature?: string
  clientSignature?: string
  healthFullName?: string
  healthPhone?: string
  healthEmail?: string
  usedExistingHealthProfile?: boolean
  existingQuestionnaireId?: string
  appointmentPriceMinor?: number
  appointmentNotes?: string
}

/** Keys allowed in a nails appointment draft — excludes lashes/cosmo/micro-specific fields. */
export const NAILS_DETAIL_KEYS = [
  'nailServiceType',
  'nailType',
  'materialIds',
  'materialLabels',
  'materials',
  'otherMaterialName',
  'handMode',
  'activeHand',
  'activeFinger',
  'rightHand',
  'leftHand',
  'lengthPreference',
  'photoPreviewUrl',
  'photoStorageKey',
  'photoConsent',
  'mediaItems',
  'healthAnswers',
  'consentItems',
  'consentAccepted',
  'consentDate',
  'consentTime',
  'consents',
  'professionalSignature',
  'clientSignature',
  'healthFullName',
  'healthPhone',
  'healthEmail',
  'usedExistingHealthProfile',
  'existingQuestionnaireId',
  'appointmentPriceMinor',
  'appointmentNotes',
] as const

export type NailsDetailKey = (typeof NAILS_DETAIL_KEYS)[number]

export function hasNailsDownstreamSelections(details: Record<string, unknown>) {
  const materials = (details.materialLabels as string[] | undefined)
    ?? (details.materials as string[] | undefined)
    ?? []
  if (materials.length > 0) return true

  const right = details.rightHand as Record<string, unknown> | undefined
  const left = details.leftHand as Record<string, unknown> | undefined
  return Boolean((right && Object.keys(right).length) || (left && Object.keys(left).length))
}
