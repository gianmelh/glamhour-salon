import type { LashEyeName } from './types'

function mergeEyeEntries(
  current: Array<{ position: number; length: number }> | undefined,
  patch: Array<{ position: number; length: number }> | undefined,
) {
  if (!patch) return current
  const merged = new Map((current ?? []).map((entry) => [entry.position, entry]))
  patch.forEach((entry) => merged.set(entry.position, entry))
  return [...merged.values()].sort((a, b) => a.position - b.position)
}

function mergeLashMap(
  current: Partial<Record<LashEyeName, Array<{ position: number; length: number }>>> | undefined,
  patch: Partial<Record<LashEyeName, Array<{ position: number; length: number }>>> | undefined,
) {
  if (!patch) return current
  return {
    ...(current ?? {}),
    ...(patch.rightEye ? { rightEye: mergeEyeEntries(current?.rightEye, patch.rightEye) } : {}),
    ...(patch.leftEye ? { leftEye: mergeEyeEntries(current?.leftEye, patch.leftEye) } : {}),
  }
}

export function mergeLashesDetailsPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current, ...patch }
  if (patch.lashMap) {
    merged.lashMap = mergeLashMap(
      current.lashMap as Partial<Record<LashEyeName, Array<{ position: number; length: number }>>> | undefined,
      patch.lashMap as Partial<Record<LashEyeName, Array<{ position: number; length: number }>>>,
    )
  }
  return merged
}
