import { LASHES_DETAIL_KEYS } from '../lashes-booking/types'
import { mergeLashesDetailsPatch } from '../lashes-booking/mergeLashesDetailsPatch'
import { mergeDetailsPatch as mergeNailsDetailsPatch } from './categories/nails/nailsFingerOptions'

const NAILS_ONLY_KEYS = new Set([
  'nailServiceType',
  'nailType',
  'materialIds',
  'materialLabels',
  'materials',
  'handMode',
  'activeHand',
  'activeFinger',
  'rightHand',
  'leftHand',
  'lengthPreference',
])

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

export function sanitizeDetailsForCategory(categoryCode: string, details: Record<string, unknown>) {
  if (categoryCode === 'lashes') {
    const allowed = new Set<string>(LASHES_DETAIL_KEYS)
    return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.has(key)))
  }
  if (categoryCode === 'nails') {
    return Object.fromEntries(Object.entries(details).filter(([key]) => !LASHES_ONLY_KEYS.has(key)))
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
