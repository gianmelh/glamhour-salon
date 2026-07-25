function titleCase(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatHandSummary(hand: unknown) {
  if (!hand || typeof hand !== 'object') return null
  const entries = Object.entries(hand as Record<string, Record<string, string>>)
    .filter(([, value]) => value && (value.widthMm || value.capsuleNumber || value.lengthMm))
    .map(([finger, value]) => {
      const parts = [
        value.widthMm ? `${value.widthMm}mm` : null,
        value.capsuleNumber != null && value.capsuleNumber !== '' ? `#${value.capsuleNumber}` : null,
        value.lengthMm ? `L${value.lengthMm}` : null,
      ].filter(Boolean)
      return `${titleCase(finger)}: ${parts.join(' · ')}`
    })
  return entries.length ? entries.join('; ') : null
}

function formatLashMap(lashMap: unknown) {
  if (!lashMap || typeof lashMap !== 'object') return null
  const rows = Object.entries(lashMap as Record<string, Array<{ position?: number; length?: number }>>)
    .filter(([, entries]) => Array.isArray(entries) && entries.length)
    .map(([eye, entries]) => {
      const label = eye === 'rightEye' ? 'Right eye' : eye === 'leftEye' ? 'Left eye' : titleCase(eye)
      return `${label}: ${entries.map((entry) => `${entry.position}:${entry.length}mm`).join(', ')}`
    })
  return rows.length ? rows.join(' · ') : null
}

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (Array.isArray(value)) {
    if (!value.length) return null
    if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
      return value.join(', ')
    }
    return JSON.stringify(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const KEYS_BY_CATEGORY: Record<string, string[]> = {
  nails: [
    'nailServiceType',
    'nailType',
    'materials',
    'materialLabels',
    'lengthPreference',
    'rightHand',
    'leftHand',
  ],
  lashes: [
    'style',
    'variant',
    'eyeShape',
    'volume',
    'curl',
    'thickness',
    'defaultLength',
    'lashMap',
  ],
  cosmetology: [
    'phototype',
    'skin_type',
    'equipment',
    'products',
    'aftercare',
    'skinAlterationNotes',
    'faceAnnotations',
  ],
  micropigmentation: [
    'area',
    'procedure',
    'session_type',
    'session_number',
    'related_treatment_id',
    'undertone',
    'pigment_brand',
    'color_mix',
    'needle',
    'touch_up_date',
    'procedure_notes',
  ],
}

const LABEL_OVERRIDES: Record<string, string> = {
  nailServiceType: 'Service type',
  nailType: 'Nail shape',
  materialLabels: 'Materials',
  materials: 'Materials',
  lengthPreference: 'Length preference',
  rightHand: 'Right hand',
  leftHand: 'Left hand',
  defaultLength: 'Default length',
  eyeShape: 'Eye shape',
  lashMap: 'Lash map',
  skin_type: 'Skin type',
  faceAnnotations: 'Face map',
  pigment_brand: 'Pigment brand',
  color_mix: 'Color mix',
  touch_up_date: 'Touch-up date',
  procedure_notes: 'Procedure notes',
}

/** Map live treatment_details keys (registration payloads) to Sales History rows. */
export function detailEntries(details: Record<string, unknown> | null, categoryCode: string) {
  if (!details) return []

  const keys = KEYS_BY_CATEGORY[categoryCode] ?? Object.keys(details)
  const rows: Array<{ label: string; value: string }> = []
  const seenLabels = new Set<string>()

  for (const key of keys) {
    let value: string | null = null
    if (key === 'rightHand' || key === 'leftHand') {
      value = formatHandSummary(details[key])
    } else if (key === 'lashMap') {
      value = formatLashMap(details[key])
    } else if (key === 'materials' || key === 'materialLabels') {
      value = formatValue(details.materialLabels ?? details.materials)
    } else {
      value = formatValue(details[key])
    }
    if (!value) continue

    const label = LABEL_OVERRIDES[key] ?? titleCase(key)
    if (seenLabels.has(label)) continue
    seenLabels.add(label)
    rows.push({ label, value })
  }

  return rows
}
