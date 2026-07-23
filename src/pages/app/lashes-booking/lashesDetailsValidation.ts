import type { LashEyeName, LashesDetails } from './types'
import { LASHES_DETAIL_KEYS } from './types'
import { lashMapPositions } from './lashesDetailsSpec'

const eyeOrder: LashEyeName[] = ['rightEye', 'leftEye']

const PAYLOAD_EXCLUDED_LASHES_DETAIL_KEYS = new Set(['registrationStep', 'photoCapturePending'])

export function sanitizeLashesDetails(details: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set<string>(LASHES_DETAIL_KEYS)
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => allowed.has(key) && !PAYLOAD_EXCLUDED_LASHES_DETAIL_KEYS.has(key)),
  )
}

export function getLashEyeProgress(lashMap: LashesDetails['lashMap']) {
  return eyeOrder.map((eye) => {
    const entries = lashMap?.[eye] ?? []
    return { eye, completed: entries.length }
  })
}

export function isLashMapComplete(lashMap: LashesDetails['lashMap'], requiredPositions = lashMapPositions) {
  return eyeOrder.every((eye) => (lashMap?.[eye]?.length ?? 0) >= requiredPositions)
}

export function getLashesCompletionSummary(details: Record<string, unknown>) {
  const data = details as LashesDetails
  const lashMap = data.lashMap
  const right = lashMap?.rightEye?.length ?? 0
  const left = lashMap?.leftEye?.length ?? 0

  return [
    { key: 'style', label: 'Lash style', done: Boolean(data.style) },
    { key: 'variant', label: 'Variant', done: Boolean(data.variant) },
    { key: 'eyeShape', label: 'Eye shape', done: Boolean(data.eyeShape) },
    { key: 'volume', label: 'Volume', done: Boolean(data.volume) },
    { key: 'curl', label: 'Curl', done: Boolean(data.curl) },
    { key: 'thickness', label: 'Thickness', done: Boolean(data.thickness) },
    { key: 'length', label: 'Length', done: Boolean(data.defaultLength || data.lashMapLength) },
    { key: 'rightEye', label: `Lash map · right eye (${right}/${lashMapPositions})`, done: right >= lashMapPositions },
    { key: 'leftEye', label: `Lash map · left eye (${left}/${lashMapPositions})`, done: left >= lashMapPositions },
  ]
}

export function getLashesDetailsMissingItems(details: Record<string, unknown>) {
  return getLashesCompletionSummary(details)
    .filter((item) => !item.done)
    .map((item) => item.label)
}
