import { LASHES_DETAIL_KEYS } from '../lashes-booking/types'
import { mergeLashesDetailsPatch } from '../lashes-booking/mergeLashesDetailsPatch'
import { NAILS_DETAIL_KEYS } from '../nails-booking/nailsDetailsTypes'
import { mergeDetailsPatch as mergeNailsDetailsPatch } from './categories/nails/nailsFingerOptions'

const NAILS_ONLY_KEYS = new Set<string>(NAILS_DETAIL_KEYS)

const LASHES_ONLY_KEYS = new Set([
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
  'registrationStep',
  'photoCapturePending',
])

const COSMETOLOGY_DETAIL_KEYS = [
  'skin_type',
  'serviceType',
  'generalFullName',
  'generalPhone',
  'generalDateOfBirth',
  'generalEmail',
  'isFirstTime',
  'equipment',
  'healthHistory',
  'allergyReactionNotes',
  'negativeExperience',
  'negativeExperienceDetails',
  'radioBodyTreatmentIssue',
  'currentMedications',
  'smoking',
  'smokingFrequency',
  'alcohol',
  'previousNegativeAestheticExperience',
  'alterations',
  'faceAnnotations',
  'faceMapSavedAt',
  'skinAlterationNotes',
  'treatmentNotes',
  'ozoneSteamTime',
  'ozoneSteamModes',
  'ultrasonicPeelingModes',
  'ultrasonicLevel',
  'microdermHeadGrit',
  'microdermSuction',
  'highFrequencyTime',
  'highFrequencyModes',
  'radiofrequencyModes',
  'radiofrequencyMaxTemp',
  'radiofrequencyLevel',
  'ultrasoundSkinTypes',
  'ultrasoundPower',
  'dermapenNeedle',
  'dermapenDepth',
  'dermapenSpeed',
  'electroporationProduct',
  'electroporationIntensity',
  'ledMaskColors',
  'ledMaskTime',
  'chemicalPeelAcid',
  'chemicalPeelPercent',
  'chemicalPeelLayers',
  'chemicalPeelExposureTime',
  'chemicalPeelNeutralizer',
  'activeIngredients',
  'finalMask',
  'finalMaskTime',
  'cosmeticBrandLine',
  'immediateReaction',
  'professionalControlNotes',
  'recommendations',
  'products',
  'aftercare',
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
  'phototype',
] as const

const MICROPIGMENTATION_DETAIL_KEYS = [
  'area',
  'procedure',
  'procedures',
  'procedureAreas',
  'micropigmentationServiceIds',
  'brow_width_mm',
  'brow_height_mm',
  'lip_width_mm',
  'undertone',
  'session_type',
  'session_number',
  'related_treatment_id',
  'pigment_brand',
  'pigmentBrand',
  'color_mix',
  'colorMix',
  'needle',
  'needleType',
  'needleSize',
  'touch_up_date',
  'touchUpAppointment',
  'firstSessionDate',
  'procedure_notes',
  'appointmentNotes',
  'clientDesignSignature',
  'generalFullName',
  'generalPhone',
  'generalDateOfBirth',
  'generalEmail',
  'isFirstTime',
  'healthHistory',
  'allergies',
  'allergyReactionNotes',
  'negativeExperience',
  'negativeExperienceDetails',
  'currentMedications',
  'smoking',
  'smokingFrequency',
  'alcohol',
  'previousNegativeAestheticExperience',
  'herpesSimplex',
  'previousTreatmentsRemoval',
  'anesthesiaBrand',
  'anesthesiaExposureTime',
  'recommendations',
  'products',
  'aftercare',
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
  'signatures',
  'professionalSignature',
  'clientSignature',
  'healthFullName',
  'healthPhone',
  'healthEmail',
  'usedExistingHealthProfile',
  'existingQuestionnaireId',
  'phototype',
] as const

export function sanitizeDetailsForCategory(categoryCode: string, details: Record<string, unknown>) {
  if (categoryCode === 'lashes') {
    const allowed = new Set<string>(LASHES_DETAIL_KEYS)
    return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.has(key)))
  }
  if (categoryCode === 'nails') {
    const allowed = new Set<string>(NAILS_DETAIL_KEYS)
    return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.has(key)))
  }
  if (categoryCode === 'cosmetology') {
    const allowed = new Set<string>(COSMETOLOGY_DETAIL_KEYS)
    return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.has(key)))
  }
  if (categoryCode === 'micropigmentation') {
    const allowed = new Set<string>(MICROPIGMENTATION_DETAIL_KEYS)
    return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.has(key)))
  }
  return Object.fromEntries(Object.entries(details).filter(([key]) => !NAILS_ONLY_KEYS.has(key) && !LASHES_ONLY_KEYS.has(key)))
}

export function mergeDetailsPatchForCategory(
  categoryCode: string,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  if (categoryCode === 'nails') return mergeNailsDetailsPatch(current, patch)
  if (categoryCode === 'lashes') return mergeLashesDetailsPatch(current, patch)
  return { ...current, ...patch }
}
