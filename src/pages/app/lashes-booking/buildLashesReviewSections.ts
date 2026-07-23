import type { LashesDetails } from './types'

function formatLashMap(lashMap: LashesDetails['lashMap']) {
  if (!lashMap) return []
  return Object.entries(lashMap).flatMap(([eye, entries]) => {
    if (!entries?.length) return []
    const label = eye === 'rightEye' ? 'Right eye' : 'Left eye'
    return [{ label: `Lash map · ${label}`, value: entries.map((e) => `${e.position}:${e.length}mm`).join(', ') }]
  })
}

export function buildLashesTreatmentReviewRows(details: Record<string, unknown>) {
  const data = details as LashesDetails
  const rows: Array<{ label: string; value: string }> = []

  if (data.style) rows.push({ label: 'Lash style', value: data.style })
  if (data.variant) rows.push({ label: 'Variant', value: data.variant })
  if (data.eyeShape) rows.push({ label: 'Eye shape', value: data.eyeShape })
  if (data.volume) rows.push({ label: 'Volume', value: data.volume })
  if (data.curl) rows.push({ label: 'Curl', value: data.curl })
  if (data.thickness) rows.push({ label: 'Thickness', value: `${data.thickness} mm` })
  if (data.defaultLength) rows.push({ label: 'Default length', value: `${data.defaultLength} mm` })
  rows.push(...formatLashMap(data.lashMap))

  return rows
}
