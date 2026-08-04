import { nailsBookingAssets } from '../../../nails-booking/assets'
import type { NailTypeImageVariant } from '../../../nails-booking/assets'

/** Layout values extracted from Figma node 335:7164 — specification only, not component structure. */
export const nailsDetailsLayout = {
  pageMaxWidth: 375,
  pageBg: '#f2f5ff',
  paddingX: 16,
  paddingTop: 64,
  sectionGap: 32,
  contentMaxWidth: 351,
} as const

export const serviceTypeOptions = [
  {
    label: 'Dual system',
    variant: 'dual-system' as const,
    imageSrc: nailsBookingAssets.serviceTypes.dualSystem,
  },
  {
    label: 'Press on',
    variant: 'press-on' as const,
    imageSrc: nailsBookingAssets.serviceTypes.pressOn,
  },
  {
    label: 'Fill',
    variant: 'dual-system' as const,
    imageSrc: nailsBookingAssets.serviceTypes.dualSystem,
  },
  {
    label: 'Full set',
    variant: 'press-on' as const,
    imageSrc: nailsBookingAssets.serviceTypes.pressOn,
  },
  {
    label: 'Gel polish',
    variant: 'dual-system' as const,
    imageSrc: nailsBookingAssets.serviceTypes.dualSystem,
  },
  {
    label: 'Manicure',
    variant: 'press-on' as const,
    imageSrc: nailsBookingAssets.serviceTypes.pressOn,
  },
  {
    label: 'Pedicure',
    variant: 'dual-system' as const,
    imageSrc: nailsBookingAssets.serviceTypes.dualSystem,
  },
  {
    label: 'Removal',
    variant: 'press-on' as const,
    imageSrc: nailsBookingAssets.serviceTypes.pressOn,
  },
] as const

export type NailTypeRowItem = {
  label: string
  variant: NailTypeImageVariant
  imageSrc: string
  className?: string
}

/** Grid rows for nail types (Figma 335:7183). */
export const nailTypeRows: NailTypeRowItem[][] = [
  [
    { label: 'Stilleto', variant: 'stiletto', imageSrc: nailsBookingAssets.nailTypes.stiletto, className: 'h-[50px] w-full min-w-0' },
    { label: 'Coffin', variant: 'coffin', imageSrc: nailsBookingAssets.nailTypes.coffin, className: 'h-[50px] w-full min-w-0' },
  ],
  [
    { label: 'Almond', variant: 'almond', imageSrc: nailsBookingAssets.nailTypes.almond, className: 'h-[50px] w-full min-w-0' },
    { label: 'Oval', variant: 'oval', imageSrc: nailsBookingAssets.nailTypes.oval, className: 'h-[50px] w-full min-w-0' },
  ],
  [
    { label: 'Squoval', variant: 'squoval', imageSrc: nailsBookingAssets.nailTypes.squoval, className: 'h-[50px] w-full min-w-0' },
    { label: 'Square', variant: 'square', imageSrc: nailsBookingAssets.nailTypes.square, className: 'h-[50px] w-full min-w-0' },
  ],
  [
    { label: 'Round', variant: 'round', imageSrc: nailsBookingAssets.nailTypes.round, className: 'h-[50px] w-full min-w-0' },
    { label: 'Custom', variant: 'custom', imageSrc: nailsBookingAssets.nailTypes.custom, className: 'h-[50px] w-full min-w-0' },
  ],
]

export type MaterialSpec = {
  id: string
  label: string
  imageSrc: string
  imageFrame: string
  imageCrop?: string
  col: 1 | 2
  row: 1 | 2 | 3
  width?: string
}

/** Material card layout from Figma 335:7214. */
export const materialGridLayout = {
  gapX: 16,
  gapY: 16,
  height: 112,
  width: 351,
} as const

export const defaultMaterialSpecs: MaterialSpec[] = [
  {
    id: 'polygel',
    label: 'Polygel',
    imageSrc: nailsBookingAssets.materials.polygel,
    imageFrame: 'h-[67px] w-[37px]',
    imageCrop: 'absolute h-full left-[-42.59%] max-w-none top-0 w-[181.48%]',
    col: 1,
    row: 1,
  },
  {
    id: 'acrylic',
    label: 'Acrylic',
    imageSrc: nailsBookingAssets.materials.acrylic,
    imageFrame: 'h-[63px] w-[35px]',
    imageCrop: 'absolute h-full left-[-42.59%] max-w-none top-0 w-[181.48%]',
    col: 2,
    row: 1,
  },
  {
    id: 'dip-powder',
    label: 'Did Powder',
    imageSrc: nailsBookingAssets.materials.dipPowder,
    imageFrame: 'h-[49px] w-[31px]',
    col: 1,
    row: 2,
    width: 'w-[162.5px]',
  },
  {
    id: 'builder-gel',
    label: 'Builder Gel',
    imageSrc: nailsBookingAssets.materials.builderGel,
    imageFrame: 'h-[61px] w-[42px]',
    col: 2,
    row: 2,
    width: 'w-[162.5px]',
  },
  {
    id: 'other',
    label: 'Other',
    imageSrc: '',
    imageFrame: '',
    col: 1,
    row: 3,
    width: 'w-full col-span-2',
  },
]

export function buildMaterialSpecs(apiMaterials?: Array<{ id: string; name: string }>): MaterialSpec[] {
  if (!apiMaterials?.length) return defaultMaterialSpecs

  const apiMaterialsByName = new Map(apiMaterials.map((material) => [material.name.trim().toLowerCase(), material]))
  return defaultMaterialSpecs.map((defaultSpec) => {
    const material = apiMaterialsByName.get(defaultSpec.label.toLowerCase())
    if (!material) return defaultSpec

    return { ...defaultSpec, id: material.id, label: material.name }
  })
}
