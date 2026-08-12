import { defaultMaterialSpecs } from '../app/appointment-booking/categories/nails/nailsDetailsSpec'

/** Nail treatment rows in onboarding services step (Figma: Onboarding / service list / nails). */
export const nailServiceSetupItems = [
  'Full set',
  'Fill in',
  'Removal',
  'Manicure',
  'Gel Polish',
  'Dip Powder',
  'Dual System',
  'Press on',
  'Pedicure',
  'Other',
] as const

export type OnboardingMaterialItem = {
  id: string
  name: string
  imageSrc: string
  imageFrame: string
  imageCrop?: string
}

/** Material rows with visible labels in onboarding (aligned with booking material cards). */
export const nailMaterialSetupItems: OnboardingMaterialItem[] = defaultMaterialSpecs.map((item) => ({
  id: item.id,
  name: item.label,
  imageSrc: item.imageSrc,
  imageFrame: item.imageFrame,
  imageCrop: item.imageCrop,
}))
