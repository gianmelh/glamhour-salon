export const cosmetologyServiceTypes = ['Dermapen', 'Peeling', 'Facial Cleansing'] as const

export const cosmetologySkinTypes = ['Normal', 'Combination', 'Dry', 'Sensitive', 'Oily'] as const

/** Stored values stay Type I–VI for compatibility with existing health/phototype data. */
export const cosmetologyPhototypes = [
  { value: 'Type I', label: 'Type 1' },
  { value: 'Type II', label: 'Type 2' },
  { value: 'Type III', label: 'Type 3' },
  { value: 'Type IV', label: 'Type 4' },
  { value: 'Type V', label: 'Type 5' },
  { value: 'Type VI', label: 'Type 6' },
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
    title: 'Endocrine Dysfunction',
    key: 'endocrine',
    options: ['Diabetes', 'Insulin Resistance', 'Hyperglycemia', 'Thyroid conditions'],
  },
  {
    title: 'Cardiovascular health',
    key: 'cardiovascular',
    options: ['High Blood Pressure', 'Pacemaker', 'Arrhythmias', 'Heart Murmurs'],
  },
  {
    title: 'Systems',
    key: 'systems',
    options: ['Kidney Disease', 'Respiratory Disease', 'Hepatitis', 'HIV'],
  },
  {
    title: 'Neurological',
    key: 'neurological',
    options: ['Epilepsy', 'Seizures'],
  },
  {
    title: 'Other',
    key: 'other',
    options: ['Oncological History', 'Facial Fractures', 'Pregnancy', 'Breastfeeding'],
  },
  {
    title: 'Implants',
    key: 'implants',
    options: ['Dental', 'Hearing', 'Contact Lenses'],
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
    options: ['Hyperpigmentation', 'Vitiligo', 'Dark Circles'],
  },
  {
    title: 'Texture/acne',
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
    options: ['Wrinkles / Expression Lines', 'Sagging'],
  },
  {
    title: 'Sensitivity',
    key: 'sensitivity',
    options: ['Hives', 'Blisters / Bullae'],
  },
] as const

export const cosmetologyReactionOptions = ['Mild Erythema', 'Edema', 'Whitening, Peeling', 'Normal'] as const
export const cosmetologyFinalMaskOptions = ['Hydrating', 'Decongestant', 'Occlusive'] as const
export const cosmetologyAlcoholOptions = ['Yes', 'No', 'Occasional', 'Frequent'] as const
export const cosmetologyHighFrequencyModes = ['Sparkling', 'Effluvium, Calming'] as const
export const cosmetologyRadiofrequencyModes = ['Monopolar', 'Bipolar | Max'] as const
export const cosmetologyOzoneSteamModes = ['With Ozone', 'Steam Only'] as const
export const cosmetologyUltrasonicModes = ['Hygiene', 'Sonophoresis'] as const
export const cosmetologyDermapenNeedles = ['12', '36', 'Nano'] as const
export const cosmetologyLedColors = ['Red', 'Blue', 'Green', 'Yellow'] as const
export const yesNoOptions = ['Yes', 'No'] as const

export const cosmetologyRecommendationBlocks = [
  {
    title: 'Recommendations: cosmetology and dermo aesthetics',
    subtitle: 'For facial cleansing, diamond tip, mild peeling, and ultrasound',
    items: [
      { label: 'Sun Protection, Essential:', text: 'Apply SPF 50+ sunscreen every 3 or 4 hours, even if you do not leave home or if it is cloudy.' },
      { label: 'Cleansing:', text: 'Use a gentle soap, syndet, or cleansing milk. Do not use alcohol based toners for 48 hours.' },
      { label: 'Hydration:', text: 'Increase water intake and use repairing moisturizing creams.' },
      { label: 'Makeup:', text: 'It is recommended to wait 24 hours before applying heavy foundation.' },
      { label: 'Heat:', text: 'Avoid very hot showers directly on the face and do not use saunas on the day of the treatment.' },
    ],
  },
  {
    title: 'Special recommendations: dermapen and chemical peeling',
    subtitle: 'These treatments leave the skin more sensitive and exposed.',
    items: [
      { label: 'First 24 to 48 hours:', text: 'Do not apply any strong active ingredients, such as Retinol, pure Vitamin C, or Glycolic Acid, until the skin has recovered.' },
      { label: 'Inflammation:', text: 'It is normal for the skin to feel “burned” or tight. Use thermal water or decongestant gels with pure aloe vera.' },
      { label: 'Do Not Exfoliate:', text: 'Do not use physical exfoliants, granules, or facial brushes for at least 7 days.' },
      { label: 'Extreme Protection:', text: 'If peeling occurs, do not pull off the skin. Let it fall off naturally to avoid spots, post inflammatory hyperpigmentation.' },
    ],
  },
  {
    title: 'Recommendations: radio frequency',
    subtitle: undefined,
    items: [
      { label: 'Flash Effect:', text: 'To maintain the tightening effect, deeply hydrate the skin.' },
      { label: 'Temperature:', text: 'The skin may remain pink. Do not apply cold compresses immediately after treatment, so the collagen stimulation generated by heat is not interrupted.' },
    ],
  },
] as const

/** Map legacy option labels so older drafts still match checkbox groups. */
export function normalizeCosmetologyHistoryLabel(value: string) {
  const aliases: Record<string, string> = {
    'Insulin resistance': 'Insulin Resistance',
    Hypoglycemia: 'Hyperglycemia',
    'High blood pressure': 'High Blood Pressure',
    'Heart murmurs': 'Heart Murmurs',
    'Kidney disease': 'Kidney Disease',
    'Respiratory disease': 'Respiratory Disease',
    'Oncological history': 'Oncological History',
    'Facial fractures': 'Facial Fractures',
    'Contact lenses': 'Contact Lenses',
    'Facial cleanse': 'Facial Cleansing',
    Cleansing: 'Facial Cleansing',
    Facial: 'Facial Cleansing',
    'Dark circles': 'Dark Circles',
    'Wrinkles / expression lines': 'Wrinkles / Expression Lines',
    'Blisters / bullae': 'Blisters / Bullae',
    'Mild erythema': 'Mild Erythema',
    'Whitening / peeling': 'Whitening, Peeling',
    Sparking: 'Sparkling',
    Cautery: 'Effluvium, Calming',
    Effluvium: 'Effluvium, Calming',
    'Bipolar / Max': 'Bipolar | Max',
    'With ozone': 'With Ozone',
    'Steam only': 'Steam Only',
  }
  return aliases[value] ?? value
}

export function getCosmetologyDetailsMissingItems(_details: Record<string, unknown>) {
  void _details
  const missing: string[] = []
  return missing
}

function serviceNameMatchesType(serviceName: string, serviceType: string) {
  const name = serviceName.toLowerCase()
  const type = normalizeCosmetologyHistoryLabel(serviceType).toLowerCase()

  if (type === 'dermapen') return name.includes('dermapen')
  if (type === 'peeling') return name.includes('peel')
  if (type === 'facial cleansing') {
    return name.includes('facial cleans')
      || name.includes('facial cleaning')
      || (name.includes('facial') && name.includes('clean'))
  }
  return name.includes(type)
}

type CosmetologyMatchableService = {
  id: string
  name: string
  is_active?: boolean
}

/** Prefer an active catalog match. Never book an inactive service id. */
export function matchCosmetologyService(
  services: CosmetologyMatchableService[],
  serviceType: string | undefined,
) {
  if (!serviceType) return undefined
  const matches = services.filter((service) => serviceNameMatchesType(service.name, serviceType))
  return matches.find((service) => service.is_active !== false) ?? matches[0]
}

/**
 * Resolve the bookable serviceId for a cosmetology service type.
 * Returns '' when there is no active match — callers must not fall back to another type.
 */
export function resolveCosmetologyServiceId(
  services: CosmetologyMatchableService[],
  serviceType: string | undefined,
  selectedServiceId?: string | undefined,
) {
  void selectedServiceId
  const matched = matchCosmetologyService(services, serviceType)
  if (!matched) return ''
  if (matched.is_active === false) return ''
  return matched.id
}

export function cosmetologyServiceDisplayName(serviceType: string) {
  const normalized = normalizeCosmetologyHistoryLabel(serviceType)
  return `Cosmetology - ${normalized}`
}

export function cosmetologyServiceMatchError(serviceType: string) {
  const normalized = normalizeCosmetologyHistoryLabel(serviceType)
  return `No active Cosmetology service matches “${normalized}”. Activate or create it in Services before booking.`
}
