export type LashEyeName = 'rightEye' | 'leftEye'

export type LashMapEntry = {
  position: number
  length: number
}

export type LashPreviewStickerTransform = {
  assetSide: 'left' | 'right'
  xPct: number
  yPct: number
  scale: number
  rotationDeg: number
}

/** Persisted Preview try-on transforms (shared Lashes details state). */
export type LashPreviewStickersState = {
  a: LashPreviewStickerTransform
  b: LashPreviewStickerTransform
}

export type LashesDetails = {
  style?: string
  variant?: string
  eyeShape?: string
  volume?: string
  curl?: string
  thickness?: string
  defaultLength?: string
  lashMapLength?: number
  activeLashEye?: LashEyeName
  lashMap?: Partial<Record<LashEyeName, LashMapEntry[]>>
  rightSide?: number
  leftSide?: number
  /** Preview overlay transforms — survives navigation within the Lashes flow. */
  lashPreviewStickers?: LashPreviewStickersState
  photoLocalPreviewUrl?: string
  photoPreviewUrl?: string
  photoStorageKey?: string
  photoConsent?: boolean
  mediaItems?: Array<Record<string, unknown>>
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
}

/** Keys allowed in a lashes appointment draft — excludes all nails-specific fields. */
export const LASHES_DETAIL_KEYS = [
  'style',
  'variant',
  'eyeShape',
  'volume',
  'curl',
  'thickness',
  'defaultLength',
  'lashMapLength',
  'activeLashEye',
  'lashMap',
  'rightSide',
  'leftSide',
  'lashPreviewStickers',
  'photoLocalPreviewUrl',
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
  'registrationStep',
  'photoCapturePending',
] as const
