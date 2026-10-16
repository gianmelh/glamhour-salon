import type { ServiceCategory } from '../types/api'
import { cosmetologyServiceTypes } from '../pages/app/appointment-booking/categories/cosmetology/cosmetologyDetailsSpec'
import { micropigmentationProcedureGroups } from '../pages/app/appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec'
import { lashStyleOptions, lashVariantOptions } from '../pages/app/lashes-booking/lashesDetailsSpec'
import { nailMaterialSetupItems, nailServiceSetupItems } from '../pages/onboarding/onboardingNailsSpec'

export type ServiceSetupSection = {
  title: string
  subtitle: string
  servicesLabel: string
  materialsLabel: string
  materialItemLabel: string
  serviceItems: readonly string[]
  materialItems: readonly string[]
}

const serviceSetupSections: Record<string, ServiceSetupSection> = {
  nails: {
    title: 'Nail Services',
    subtitle: 'Main treatments and services',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    materialItemLabel: 'material',
    serviceItems: nailServiceSetupItems,
    materialItems: nailMaterialSetupItems.map((material) => material.name),
  },
  lashes: {
    title: 'Lash Services',
    subtitle: 'Extensions, lifts, tinting, and lash styling',
    servicesLabel: 'Services',
    materialsLabel: 'Style',
    materialItemLabel: 'style',
    serviceItems: [
      ...lashVariantOptions.map((option) => option.title),
      'Lash Lift',
      'Lash Tint',
      'Removal',
      'Refill',
      'Other',
    ],
    materialItems: [
      ...lashStyleOptions.map((option) => option.label),
      'Lash Adhesive',
      'Lash Cleanser',
      'Other',
    ],
  },
  cosmetology: {
    title: 'Cosmetology Services',
    subtitle: 'Facials, skincare treatments, and beauty enhancements',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    materialItemLabel: 'material',
    serviceItems: [...cosmetologyServiceTypes, 'Hydrating Facial', 'Radiofrequency', 'Other'],
    materialItems: ['Serums', 'Peels', 'Masks', 'LED Therapy', 'Ozone Steam', 'Other'],
  },
  micropigmentation: {
    title: 'Micropigmentation Services',
    subtitle: 'Brows, lips, eyes, removal, and enhancement procedures',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    materialItemLabel: 'material',
    serviceItems: [...Object.values(micropigmentationProcedureGroups).flat(), 'Other'],
    materialItems: ['Pigments', 'Needles', 'Anesthetics', 'Aftercare', 'Other'],
  },
}

export function getServiceSetupSection(category: Pick<ServiceCategory, 'code'>): ServiceSetupSection | undefined {
  return serviceSetupSections[category.code]
}

export function getServiceSuggestions(category: Pick<ServiceCategory, 'code'>): string[] {
  return (getServiceSetupSection(category)?.serviceItems ?? []).filter((name) => name.trim().toLowerCase() !== 'other')
}
