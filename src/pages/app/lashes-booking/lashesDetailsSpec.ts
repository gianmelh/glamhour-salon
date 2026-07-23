/** Layout tokens from Figma frame 650:6083 / 335:10351 (section 335:10612). */
export const lashesDetailsLayout = {
  /** iPhone frame width in Figma. */
  frameWidth: 393,
  pageBg: '#f2f5ff',
  paddingX: 16,
  paddingTop: 64,
  sectionGap: 32,
  /** Usable width inside horizontal padding: 393 - 32 = 361. */
  contentWidth: 361,
  headerBlockGap: 24,
  headerTitleGap: 16,
  categoryTabGap: 16,
  cardHeight: 82,
  cardRadius: 16,
  styleCardWidth: 135,
  styleCardGap: 16,
  scrollGap: 26,
  optionGridGap: 16,
  compactCardHeight: 64,
  eyeShapeGap: 16,
  backIconWidth: 18,
} as const

export const lashStyleOptions = [
  { label: 'Cat eye', key: 'Cat eye' },
  { label: 'Fox', key: 'Fox' },
  { label: 'Classica', key: 'Classica' },
  { label: 'Eyeliner', key: 'Eyeliner' },
  { label: 'Doll', key: 'Doll' },
  { label: 'Wispy', key: 'Wispy' },
] as const

export const lashEyeShapeRows = [
  ['Small eyes', 'Almond eyes'],
  ['Close-set eyes', 'Prominent eyes'],
  ['Hooded eyes', 'Asian eyes'],
  ['Downturned eyes'],
] as const

export const lashVolumeOptions = ['Classic', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D'] as const
export const lashCurlOptions = ['A', 'B', 'C', 'CC', 'D', 'U', 'L', 'L+'] as const
export const lashThicknessOptions = ['0.03', '0.05', '0.06', '0.07', '0.10', '0.12', '0.15'] as const
export const lashLengthOptions = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15'] as const

export const lashVariantOptions = [
  {
    key: 'Base',
    title: 'Base',
    description: 'Natural lash enhancement, one-to-one application.',
  },
  {
    key: 'Volume',
    title: 'Volume',
    description: 'Fuller, dramatic look with fan-shaped clusters.',
  },
  {
    key: 'Hybrid',
    title: 'Hybrid',
    description: 'Mix of classic and volume for texture and depth.',
  },
] as const

export const lashMapPositions = 7

/** Zone labels on the cat-eye diagram (Figma 650:6335–6341). */
export const lashMapZoneNumbers = [8, 9, 10, 11, 12, 13, 14] as const
