export const micropigmentationProcedureGroups = {
  Eyebrows: ['Microblading', 'Microshading', 'Hybrid', 'Removal'],
  Lips: ['Lip Liner', 'Micropigmentation', 'Hydragloss'],
  Eyes: ['Eyeliner'],
} as const

export type MicropigmentationProcedure =
  typeof micropigmentationProcedureGroups[keyof typeof micropigmentationProcedureGroups][number]

export const micropigmentationPhototypes = [
  { value: 'Type I', label: 'Type 1' },
  { value: 'Type II', label: 'Type 2' },
  { value: 'Type III', label: 'Type 3' },
  { value: 'Type IV', label: 'Type 4' },
  { value: 'Type V', label: 'Type 5' },
  { value: 'Type VI', label: 'Type 6' },
] as const

export const micropigmentationHealthHistoryGroups = [
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
    options: ['Dental Implants', 'Hearing Implants', 'Contact Lenses'],
  },
] as const

export const micropigmentationAllergyOptions = [
  'Anesthetics',
  'Medications',
  'Metals / Other',
  'Cosmetics',
  'Foods',
] as const

export const micropigmentationAlcoholOptions = ['Yes', 'No', 'Occasional', 'Frequent'] as const
export const yesNoOptions = ['Yes', 'No'] as const

/** Catalog defaults used when auto-creating a missing micropigmentation service. */
export const micropigmentationServiceCatalog: Record<string, {
  slug: string
  name: string
  durationMinutes: number
  priceMinor: number
  area: keyof typeof micropigmentationProcedureGroups
}> = {
  Microblading: {
    slug: 'micropigmentation-microblading',
    name: 'Micropigmentation - microblading',
    durationMinutes: 90,
    priceMinor: 10500,
    area: 'Eyebrows',
  },
  Microshading: {
    slug: 'micropigmentation-microshading',
    name: 'Micropigmentation - Microshading',
    durationMinutes: 90,
    priceMinor: 11000,
    area: 'Eyebrows',
  },
  Hybrid: {
    slug: 'micropigmentation-hybrid',
    name: 'Micropigmentation - Hybrid',
    durationMinutes: 90,
    priceMinor: 11000,
    area: 'Eyebrows',
  },
  Removal: {
    slug: 'micropigmentation-removal',
    name: 'Micropigmentation - Removal',
    durationMinutes: 60,
    priceMinor: 8500,
    area: 'Eyebrows',
  },
  'Lip Liner': {
    slug: 'micropigmentation-lip-liner',
    name: 'Micropigmentation - Lip Liner',
    durationMinutes: 60,
    priceMinor: 7500,
    area: 'Lips',
  },
  Micropigmentation: {
    slug: 'micropigmentation-lips',
    name: 'Micropigmentation - Lips',
    durationMinutes: 75,
    priceMinor: 9500,
    area: 'Lips',
  },
  Hydragloss: {
    slug: 'micropigmentation-hydragloss',
    name: 'Micropigmentation - Hydragloss',
    durationMinutes: 60,
    priceMinor: 6500,
    area: 'Lips',
  },
  Eyeliner: {
    slug: 'micropigmentation-eyeliner',
    name: 'Micropigmentation - Eyeliner',
    durationMinutes: 60,
    priceMinor: 3500,
    area: 'Eyes',
  },
}

export const micropigmentationRecommendationBlocks = [
  {
    title: 'Recommendations',
    subtitle: 'Eyebrows and Lips',
    intro: 'This process is a controlled wound. The success of the color depends 70% on home care.',
    items: [
      {
        label: 'Hygiene:',
        text: 'Clean the area with a barely damp cotton pad, using mineral or distilled water, to remove excess lymph during the first 24 hours.',
      },
      {
        label: 'Do Not Touch:',
        text: 'Do not scratch or remove the “scabs” or dry skin that may form. If you remove them, you will also remove the pigment and gaps may appear.',
      },
      {
        label: 'Hydration:',
        text: 'Apply only the recommended ointment, Vitamin A&D or specific product, in a very thin layer, 3 times a day.',
      },
      {
        label: 'Avoid:',
        text: 'Do not apply makeup over the area. Do not go to pools, saunas, beaches, or gyms, sweat, for 10 to 15 days.',
      },
      {
        label: 'Sun:',
        text: 'Direct sun exposure is prohibited during the first month.',
      },
      {
        label: 'Specific for Lips:',
        text: 'Do not eat very hot, spicy, or acidic foods during the first 3 days. Drink with a straw.',
      },
    ],
  },
] as const

export function normalizeMicropigmentationHistoryLabel(value: string) {
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
    Dental: 'Dental Implants',
    Hearing: 'Hearing Implants',
    'Lip liner': 'Lip Liner',
    microblading: 'Microblading',
    Microblading: 'Microblading',
  }
  return aliases[value] ?? value
}

export function micropigmentationServiceSlug(procedure: string) {
  const normalized = normalizeMicropigmentationHistoryLabel(procedure)
  return micropigmentationServiceCatalog[normalized]?.slug
    ?? `micropigmentation-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function micropigmentationServiceDisplayName(procedure: string) {
  const normalized = normalizeMicropigmentationHistoryLabel(procedure)
  return micropigmentationServiceCatalog[normalized]?.name ?? `Micropigmentation - ${normalized}`
}

export function micropigmentationServiceDefaults(procedure: string) {
  const normalized = normalizeMicropigmentationHistoryLabel(procedure)
  return micropigmentationServiceCatalog[normalized] ?? {
    slug: micropigmentationServiceSlug(normalized),
    name: micropigmentationServiceDisplayName(normalized),
    durationMinutes: 60,
    priceMinor: 0,
    area: 'Eyebrows' as const,
  }
}

function normalizeServiceKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function serviceMatchesProcedure(serviceName: string, procedure: string) {
  const name = normalizeServiceKey(serviceName)
  const proc = normalizeServiceKey(normalizeMicropigmentationHistoryLabel(procedure))
  const slug = micropigmentationServiceSlug(procedure)

  if (name.includes(normalizeServiceKey(slug.replace(/-/g, ' ')))) return true
  if (proc === 'micropigmentation') {
    return (name.includes('lip') && name.includes('micropigmentation'))
      || name === 'micropigmentation lips'
      || name.endsWith(' lips')
  }
  if (proc === 'lip liner') return name.includes('lip liner') || name.includes('lipliner')
  return name.includes(proc)
}

type MicropigmentationMatchableService = {
  id: string
  name: string
  slug?: string | null
  is_active?: boolean
}

export function matchMicropigmentationService(
  services: MicropigmentationMatchableService[],
  procedure: string | undefined,
) {
  if (!procedure) return undefined
  const slug = micropigmentationServiceSlug(procedure)
  const bySlug = services.find((service) => (service.slug ?? '').toLowerCase() === slug)
  if (bySlug) return bySlug.is_active === false ? undefined : bySlug

  const matches = services.filter((service) => serviceMatchesProcedure(service.name, procedure))
  return matches.find((service) => service.is_active !== false) ?? matches[0]
}

export function resolveMicropigmentationServiceId(
  services: MicropigmentationMatchableService[],
  procedure: string | undefined,
  selectedServiceId?: string | undefined,
) {
  void selectedServiceId
  const matched = matchMicropigmentationService(services, procedure)
  if (!matched || matched.is_active === false) return ''
  return matched.id
}

export function micropigmentationServiceMatchError(procedure: string) {
  return `No active Micropigmentation service matches “${normalizeMicropigmentationHistoryLabel(procedure)}”. Activate or create it in Services before booking.`
}

export function procedureAreaFor(procedure: string | undefined) {
  if (!procedure) return ''
  const normalized = normalizeMicropigmentationHistoryLabel(procedure)
  for (const [area, procedures] of Object.entries(micropigmentationProcedureGroups)) {
    if ((procedures as readonly string[]).includes(normalized)) return area
  }
  return micropigmentationServiceCatalog[normalized]?.area ?? ''
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getMicropigmentationFieldErrors(details: Record<string, unknown>) {
  const errors: Record<string, string> = {}
  const skipHealth = details.usedExistingHealthProfile === true

  if (!skipHealth) {
    if (!String(details.generalFullName ?? '').trim()) errors.generalFullName = 'Full name is required'
    if (!String(details.generalPhone ?? '').trim()) errors.generalPhone = 'Phone number is required'
    if (!String(details.generalDateOfBirth ?? '').trim()) errors.generalDateOfBirth = 'Date of birth is required'
    const email = String(details.generalEmail ?? '').trim()
    if (!email) errors.generalEmail = 'Email is required'
    else if (!emailPattern.test(email)) errors.generalEmail = 'Enter a valid email'
    if (!details.isFirstTime) errors.isFirstTime = 'Select Yes or No'
  }

  if (!details.procedure) errors.procedure = 'Select a service type'
  if (!details.phototype) errors.phototype = 'Select a skin phototype'
  if (!details.herpesSimplex) errors.herpesSimplex = 'Select Yes or No'
  if (!String(details.pigment_brand ?? '').trim()) errors.pigment_brand = 'Pigment brand is required'
  if (!String(details.needle ?? details.needleType ?? '').trim()) errors.needleType = 'Needle type is required'
  if (!String(details.professionalSignature ?? '').trim()) errors.professionalSignature = 'Professional signature is required'
  if (!String(details.consentDate ?? '').trim()) errors.consentDate = 'Date is required'
  if (!String(details.clientDesignSignature ?? '').trim()) {
    errors.clientDesignSignature = 'Client design approval/signature is required'
  }

  if (details.negativeExperience === 'Yes' && !String(details.negativeExperienceDetails ?? '').trim()) {
    errors.negativeExperienceDetails = 'Describe the previous reaction'
  }

  return errors
}

export function getMicropigmentationDetailsMissingItems(details: Record<string, unknown>) {
  const errors = getMicropigmentationFieldErrors(details)
  return Object.values(errors)
}

/** Legacy keys kept for older drafts still in session storage. */
export const micropigmentationUndertones = ['Warm', 'Cool', 'Neutral'] as const
export const micropigmentationSessionTypes = ['Initial session', 'Touch-up'] as const
