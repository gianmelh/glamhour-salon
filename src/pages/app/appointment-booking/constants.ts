import type { BookingCategoryCode } from './types'
import type { Service, ServiceCategory } from '../../../types/api'

export const CATEGORY_ORDER: BookingCategoryCode[] = ['nails', 'lashes', 'cosmetology', 'micropigmentation']

export const categoryDescriptions: Record<BookingCategoryCode, string> = {
  nails: 'Manicures, pedicures, acrylics, and nail art.',
  lashes: 'Eyelash extensions, lifts, and tinting services.',
  cosmetology: 'Facials, skincare treatments, and beauty enhancements.',
  micropigmentation: 'Permanent makeup for brows, lips, and eyeliner.',
}

export const categoryNames: Record<BookingCategoryCode, string> = {
  nails: 'Nails',
  lashes: 'Lashes',
  cosmetology: 'Cosmetology',
  micropigmentation: 'Micropigmentation',
}

export const categoryCopy = {
  nails: {
    title: 'Nail Service Details',
    subtitle: 'Configure hand, finger, material, shape, and safety details.',
    health: [
      'Chemical, polish, gel, acrylic, or remover allergies',
      'Previous allergic reactions',
      'Dermatitis, psoriasis, eczema, or skin condition',
      'Nail infection, inflammation, or open wound',
      'Autoimmune condition',
      'Current medications',
      'Diabetes or healing concern',
      'Latex or nitrile allergy',
      'Pregnancy',
      'Nail biting or chemical exposure',
      'Recent nail service or at-home remover use',
    ],
  },
  lashes: {
    title: 'Lash Design',
    subtitle: 'Build the lash map, photo preview, and safety profile.',
    health: [
      'Adhesive or cyanoacrylate allergy',
      'Dye or synthetic-fiber allergy',
      'Previous lash reaction',
      'Eye irritation, infection, or ocular condition',
      'Recent eye surgery',
      'Contact lenses',
      'Medication causing eye sensitivity',
      'Fume or vapor sensitivity',
      'Diabetes or healing concern',
      'Pregnancy',
      'Oil-based product use or frequent eye rubbing',
    ],
  },
  cosmetology: {
    title: 'Clinical Skin Intake',
    subtitle: 'Record skin analysis, contraindications, and treatment plan.',
    health: [
      'Endocrine condition',
      'Cardiovascular condition',
      'Systemic or neurological condition',
      'Oncology history',
      'Facial fracture, implants, or recent procedure',
      'Pregnancy or breastfeeding',
      'Allergies or previous reactions',
      'Current medications',
      'Smoking or alcohol use',
      'Pigmentation, acne, scars, sensitivity, hives, or blisters',
    ],
  },
  micropigmentation: {
    title: 'Micropigmentation Procedure',
    subtitle: 'Select procedure, clinical information, pigment, and approval.',
    health: [
      'First-time service',
      'Endocrine or cardiovascular history',
      'Systemic or neurological condition',
      'Pregnancy or breastfeeding',
      'Implants',
      'Allergies or previous reactions',
      'Current medications',
      'Smoking or alcohol use',
      'Herpes Simplex',
      'Previous removal treatments',
    ],
  },
} as const

export function buildAppointmentCategories(categories: ServiceCategory[], services: Service[]) {
  return CATEGORY_ORDER.map((code, index) => {
    const category = categories.find((item) => item.code === code)
    if (category) return category
    const service = services.find((item) => item.category_code === code)
    return {
      id: service?.category_id ?? code,
      code,
      name: service?.category_name ?? categoryNames[code],
      description: categoryDescriptions[code],
      icon_key: null,
      sort_order: (index + 1) * 10,
      is_active: true,
      created_at: '',
      updated_at: '',
    } satisfies ServiceCategory
  })
}

export function normalizeServiceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
