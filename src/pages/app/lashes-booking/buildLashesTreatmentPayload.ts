import { sanitizeLashesDetails } from './lashesDetailsValidation'

export function buildLashesTreatmentPayload(
  details: Record<string, unknown>,
  extras: Record<string, unknown>,
) {
  return {
    category: 'lashes',
    ...sanitizeLashesDetails(details),
    ...extras,
  }
}
