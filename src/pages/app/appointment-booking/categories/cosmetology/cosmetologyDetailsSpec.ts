export const cosmetologyServiceTypes = ['Dermapen', 'Peeling', 'Facial cleanse'] as const

export const cosmetologySkinTypes = ['Normal', 'Combination', 'Dry', 'Sensitive', 'Oily'] as const

export const cosmetologyPhototypes = ['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI'] as const

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

export const cosmetologyHealthHistoryGroups = [
  {
    title: 'Endocrine dysfunction',
    key: 'endocrine',
    options: ['Diabetes', 'Insulin resistance', 'Hypoglycemia', 'Thyroid conditions'],
  },
  {
    title: 'Cardiovascular health',
    key: 'cardiovascular',
    options: ['High blood pressure', 'Pacemaker', 'Arrhythmias', 'Heart murmurs'],
  },
  {
    title: 'Systems',
    key: 'systems',
    options: ['Kidney disease', 'Respiratory disease', 'Hepatitis', 'HIV'],
  },
  {
    title: 'Neurological',
    key: 'neurological',
    options: ['Epilepsy', 'Seizures'],
  },
  {
    title: 'Other',
    key: 'other',
    options: ['Oncological history', 'Facial fractures', 'Pregnancy', 'Breastfeeding'],
  },
  {
    title: 'Implants',
    key: 'implants',
    options: ['Dental', 'Hearing', 'Contact lenses'],
  },
  {
    title: 'Allergies and adverse reactions',
    key: 'allergies',
    options: ['Anesthetics', 'Medications', 'Metals / Other', 'Cosmetics', 'Foods'],
  },
] as const

export const cosmetologyAlterationGroups = [
  {
    title: 'Pigmentation',
    key: 'pigmentation',
    options: ['Hyperpigmentation', 'Vitiligo', 'Dark circles'],
  },
  {
    title: 'Texture / acne',
    key: 'texture_acne',
    options: ['Active acne', 'Seborrhea', 'Comedones', 'Cysts', 'Keratosis', 'Warts'],
  },
  {
    title: 'Scars',
    key: 'scars',
    options: ['Atrophic', 'Hypertrophic', 'Keloids'],
  },
  {
    title: 'Aging',
    key: 'aging',
    options: ['Wrinkles / expression lines', 'Sagging'],
  },
  {
    title: 'Sensitivity',
    key: 'sensitivity',
    options: ['Hives', 'Blisters / bullae'],
  },
] as const

export const cosmetologyReactionOptions = ['Mild erythema', 'Edema', 'Whitening / peeling', 'Normal'] as const
export const cosmetologyFinalMaskOptions = ['Hydrating', 'Decongestant', 'Occlusive'] as const
export const yesNoOptions = ['Yes', 'No'] as const

export function getCosmetologyDetailsMissingItems(_details: Record<string, unknown>) {
  const missing: string[] = []
  return missing
}
