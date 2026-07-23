export type LashEyeName = 'rightEye' | 'leftEye'

export type LashMapEntry = {
  position: number
  length: number
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
  photoPreviewUrl?: string
  photoStorageKey?: string
  photoConsent?: boolean
  mediaItems?: Array<Record<string, unknown>>
  healthAnswers?: Record<string, string>
  consentItems?: Record<string, boolean>
  consentAccepted?: boolean
  consents?: Array<Record<string, unknown>>
  professionalSignature?: string
  clientSignature?: string
  healthFullName?: string
  healthPhone?: string
  healthEmail?: string
  usedExistingHealthProfile?: boolean
  existingQuestionnaireId?: string
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
  'photoPreviewUrl',
  'photoStorageKey',
  'photoConsent',
  'mediaItems',
  'healthAnswers',
  'consentItems',
  'consentAccepted',
  'consents',
  'professionalSignature',
  'clientSignature',
  'healthFullName',
  'healthPhone',
  'healthEmail',
  'usedExistingHealthProfile',
  'existingQuestionnaireId',
  'registrationStep',
  'photoCapturePending',
] as const
