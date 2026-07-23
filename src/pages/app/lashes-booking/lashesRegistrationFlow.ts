import type { LashesDetails } from './types'
import { isLashMapComplete } from './lashesDetailsValidation'

/**
 * Lashes registration sub-flow derived from Figma section 335:10612.
 *
 * Frame mapping (left-to-right flow in Figma):
 * - details          → 335:10351 Home/Lashes/details of service
 * - style-preview    → 426:4224 Preview row (Cat Eye · Apply the style to your photo)
 * - select-variant   → 487:3447 / 487:3086 SelectVariantScreen
 * - photo-method     → 487:3640 AddFacePhotoScreen
 * - photo-capture    → 493:4256 CapturePhotoScreen
 * - photo-confirm    → 493:4295 ReviewPhotoScreen (Confirm photo)
 * - photo-preview    → 493:4455 ReviewPhotoScreen (Preview)
 * - lash-map         → 650:6083 Lash map
 * - thickness        → 650:6083 Thickness
 * - length           → 650:6083 Length (mm)
 */
export type LashesRegistrationStep =
  | 'details'
  | 'style-preview'
  | 'select-variant'
  | 'photo-method'
  | 'photo-capture'
  | 'photo-confirm'
  | 'photo-preview'
  | 'lash-map'
  | 'thickness'
  | 'length'
  | 'complete'

export const LASHES_REGISTRATION_STEPS: LashesRegistrationStep[] = [
  'details',
  'style-preview',
  'select-variant',
  'photo-method',
  'photo-capture',
  'photo-confirm',
  'photo-preview',
  'lash-map',
  'thickness',
  'length',
  'complete',
]

export const LASHES_REGISTRATION_STEP_KEY = 'registrationStep'

export function readLashesRegistrationStep(details: Record<string, unknown>): LashesRegistrationStep {
  const step = details[LASHES_REGISTRATION_STEP_KEY]
  if (step === 'complete') return 'length'
  if (typeof step === 'string' && LASHES_REGISTRATION_STEPS.includes(step as LashesRegistrationStep)) {
    return step as LashesRegistrationStep
  }
  return 'details'
}

export function isDetailsCoreComplete(details: Record<string, unknown>) {
  const data = details as LashesDetails
  return Boolean(data.style && data.eyeShape && data.volume && data.curl)
}

export function canAdvanceLashesStep(step: LashesRegistrationStep, details: Record<string, unknown>) {
  const data = details as LashesDetails
  switch (step) {
    case 'details':
      return isDetailsCoreComplete(details)
    case 'style-preview':
      return Boolean(data.style)
    case 'select-variant':
      return Boolean(data.variant)
    case 'photo-method':
      return true
    case 'photo-capture':
      return true
    case 'photo-confirm':
      return Boolean(data.photoPreviewUrl)
    case 'photo-preview':
      return Boolean(data.photoPreviewUrl)
    case 'lash-map':
      return isLashMapComplete(data.lashMap)
    case 'thickness':
      return Boolean(data.thickness)
    case 'length':
      return Boolean(data.defaultLength || data.lashMapLength)
    default:
      return false
  }
}

/** Linear next step; photo upload skips capture. */
export function getNextLashesRegistrationStep(
  step: LashesRegistrationStep,
  _details: Record<string, unknown>,
  options?: { skipCapture?: boolean },
): LashesRegistrationStep | null {
  switch (step) {
    case 'details':
      return 'style-preview'
    case 'style-preview':
      return 'select-variant'
    case 'select-variant':
      return 'photo-method'
    case 'photo-method':
      return options?.skipCapture ? 'photo-confirm' : 'photo-capture'
    case 'photo-capture':
      return 'photo-confirm'
    case 'photo-confirm':
      return 'photo-preview'
    case 'photo-preview':
      return 'lash-map'
    case 'lash-map':
      return 'thickness'
    case 'thickness':
      return 'length'
    case 'length':
      return null
    default:
      return null
  }
}

export function getPreviousLashesRegistrationStep(
  step: LashesRegistrationStep,
  details: Record<string, unknown>,
): LashesRegistrationStep | 'exit' {
  switch (step) {
    case 'details':
      return 'exit'
    case 'style-preview':
      return 'details'
    case 'select-variant':
      return 'style-preview'
    case 'photo-method':
      return 'select-variant'
    case 'photo-capture':
      return 'photo-method'
    case 'photo-confirm':
      return details.photoCapturePending ? 'photo-capture' : 'photo-method'
    case 'photo-preview':
      return 'photo-confirm'
    case 'lash-map':
      return 'photo-preview'
    case 'thickness':
      return 'lash-map'
    case 'length':
      return 'thickness'
    default:
      return 'exit'
  }
}

export function getLashesStepTitle(step: LashesRegistrationStep) {
  switch (step) {
    case 'details':
    case 'style-preview':
    case 'lash-map':
    case 'thickness':
    case 'length':
      return 'Details of service'
    case 'select-variant':
      return 'Select variant'
    case 'photo-method':
      return 'Add photo'
    case 'photo-capture':
      return 'Take photo'
    case 'photo-confirm':
      return 'Confirm photo'
    case 'photo-preview':
      return 'Preview'
    default:
      return 'Details of service'
  }
}

export function usesDetailsHeader(step: LashesRegistrationStep) {
  return ['details', 'style-preview', 'lash-map', 'thickness', 'length'].includes(step)
}
