import type { FingerName } from '../../types'

export const fingerOrder: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky']

export const fingerLabels: Record<FingerName, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
}

export const fingerWidthOptions = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].map((value) => ({
  label: `${value}mm`,
  value,
}))

export const capsuleNumberOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index)
  return { label: value, value }
})

/** Positions for finger markers on the 342.5px hand image (right hand, from Figma 335:7164). */
export const fingerMarkerPositions: Record<FingerName, { left: number; top: number; ellipse: 'ellipse1' | 'ellipse3' }> = {
  middle: { left: 164.46, top: 31.86, ellipse: 'ellipse1' },
  index: { left: 126.97, top: 53.41, ellipse: 'ellipse1' },
  thumb: { left: 79.18, top: 143.84, ellipse: 'ellipse1' },
  ring: { left: 199.13, top: 48.73, ellipse: 'ellipse1' },
  pinky: { left: 236.14, top: 88.55, ellipse: 'ellipse3' },
}

export function mirrorFingerMarkerPosition(position: { left: number; top: number; ellipse: 'ellipse1' | 'ellipse3' }, handWidth = 342.5) {
  return { left: handWidth - position.left, top: position.top, ellipse: position.ellipse }
}


export function getHandProgress(handData: Record<string, Record<string, string>> | undefined) {
  const completed = fingerOrder.filter((finger) => {
    const entry = handData?.[finger]
    return Boolean(entry?.widthMm && entry?.capsuleNumber)
  }).length
  return { completed, total: fingerOrder.length }
}

export function isHandComplete(handData: Record<string, Record<string, string>> | undefined) {
  return getHandProgress(handData).completed === fingerOrder.length
}

export function mergeHandData(
  current: Record<string, Record<string, string>> | undefined,
  patch: Record<string, Record<string, string>> | undefined,
) {
  if (!patch) return current
  const merged = { ...(current ?? {}) }
  for (const [finger, values] of Object.entries(patch)) {
    merged[finger] = { ...(merged[finger] ?? {}), ...values }
  }
  return merged
}

export function mergeDetailsPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current, ...patch }
  if (patch.rightHand) {
    merged.rightHand = mergeHandData(
      current.rightHand as Record<string, Record<string, string>> | undefined,
      patch.rightHand as Record<string, Record<string, string>>,
    )
  }
  if (patch.leftHand) {
    merged.leftHand = mergeHandData(
      current.leftHand as Record<string, Record<string, string>> | undefined,
      patch.leftHand as Record<string, Record<string, string>>,
    )
  }
  return merged
}

export function getNailsDetailsMissingItems(details: Record<string, unknown>) {
  const missing: string[] = []
  if (!details.nailServiceType) missing.push('Type of service')
  if (!details.nailType) missing.push('Type of nails')
  const materials = (details.materialLabels as string[] | undefined) ?? (details.materials as string[] | undefined) ?? []
  if (!materials.length) missing.push('At least one material')

  const rightProgress = getHandProgress(details.rightHand as Record<string, Record<string, string>> | undefined)
  if (rightProgress.completed < rightProgress.total) {
    missing.push(`Right hand finger measurements (${rightProgress.completed}/${rightProgress.total})`)
  }

  const leftProgress = getHandProgress(details.leftHand as Record<string, Record<string, string>> | undefined)
  if (leftProgress.completed < leftProgress.total) {
    missing.push(`Left hand finger measurements (${leftProgress.completed}/${leftProgress.total})`)
  }

  return missing
}
