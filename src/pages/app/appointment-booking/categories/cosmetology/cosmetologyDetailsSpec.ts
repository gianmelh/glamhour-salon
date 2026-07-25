export const cosmetologySkinTypes = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'] as const

export const cosmetologyEquipmentOptions = [
  'Ozone steam',
  'Ultrasonic peeling',
  'Microdermabrasion',
  'High frequency',
  'Radiofrequency',
  'Ultrasound',
  'Dermapen',
  'LED phototherapy',
  'Chemical peel',
] as const

export const cosmetologyAnnotationTypes = [
  'Active acne',
  'Pigmentation',
  'Sensitivity/redness',
  'Dullness/uneven tone',
  'Fine lines/wrinkles',
  'Contraindicated area',
] as const

export function getCosmetologyDetailsMissingItems(details: Record<string, unknown>) {
  const missing: string[] = []
  const equipment = details.equipment as string[] | undefined
  const annotations = details.faceAnnotations as unknown[] | undefined
  if (!details.skin_type) missing.push('Skin type')
  if (!equipment?.length) missing.push('At least one equipment option')
  if (!annotations?.length) missing.push('At least one face map annotation')
  if (!String(details.products ?? '').trim()) missing.push('Products / chemicals used')
  return missing
}
