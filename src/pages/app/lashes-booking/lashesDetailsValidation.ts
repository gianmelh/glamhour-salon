import type { LashEyeName, LashesDetails } from './types'
import { LASHES_DETAIL_KEYS } from './types'
import { lashMapZoneNumbers } from './lashesDetailsSpec'

const eyeOrder: LashEyeName[] = ['rightEye', 'leftEye']

const PAYLOAD_EXCLUDED_LASHES_DETAIL_KEYS = new Set(['registrationStep', 'photoCapturePending', 'photoLocalPreviewUrl'])

export function sanitizeLashesDetails(details: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set<string>(LASHES_DETAIL_KEYS)
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => allowed.has(key) && !PAYLOAD_EXCLUDED_LASHES_DETAIL_KEYS.has(key)),
  )
}

export function getLashEyeProgress(lashMap: LashesDetails['lashMap']) {
  return eyeOrder.map((eye) => {
    const entries = lashMap?.[eye] ?? []
    const positions = new Set(entries.map((entry) => entry.position))
    const completed = lashMapZoneNumbers.filter((zone) => positions.has(zone)).length
    return { eye, completed, total: lashMapZoneNumbers.length }
  })
}

export function isLashMapComplete(lashMap: LashesDetails['lashMap']) {
  return eyeOrder.every((eye) => {
    const entries = lashMap?.[eye] ?? []
    const positions = new Set(entries.map((entry) => entry.position))
    return lashMapZoneNumbers.every((zone) => positions.has(zone))
  })
}

export function getLashesCompletionSummary(details: Record<string, unknown>) {
  const data = details as LashesDetails
  const progress = getLashEyeProgress(data.lashMap)
  const right = progress.find((item) => item.eye === 'rightEye')
  const left = progress.find((item) => item.eye === 'leftEye')

  return [
    { key: 'style', label: 'Lash style', done: Boolean(data.style) },
    { key: 'variant', label: 'Variant', done: Boolean(data.variant) },
    { key: 'eyeShape', label: 'Eye shape', done: Boolean(data.eyeShape) },
    { key: 'volume', label: 'Volume', done: Boolean(data.volume) },
    { key: 'curl', label: 'Curl', done: Boolean(data.curl) },
    { key: 'thickness', label: 'Thickness', done: Boolean(data.thickness) },
    { key: 'length', label: 'Length', done: Boolean(data.defaultLength || data.lashMapLength) },
    {
      key: 'rightEye',
      label: `Lash map · right eye (${right?.completed ?? 0}/${right?.total ?? lashMapZoneNumbers.length})`,
      done: (right?.completed ?? 0) >= lashMapZoneNumbers.length,
    },
    {
      key: 'leftEye',
      label: `Lash map · left eye (${left?.completed ?? 0}/${left?.total ?? lashMapZoneNumbers.length})`,
      done: (left?.completed ?? 0) >= lashMapZoneNumbers.length,
    },
  ]
}

export function getLashesDetailsMissingItems(details: Record<string, unknown>) {
  return getLashesCompletionSummary(details)
    .filter((item) => !item.done)
    .map((item) => item.label)
}
