const serviceAssetsBase = '/Glamhour - Assets/Registration flow/Services/nails'
const homeNailsAssetsBase = '/Glamhour - Assets/Registration flow/Home/services/nails'
const fullHandAssetsBase = '/Glamhour - Assets/Registration flow/Home/nails/full hand'
const nailTypesAssetsBase = '/Glamhour - Assets/Nails types'

export const nailsBookingAssets = {
  categories: {
    nails: `${serviceAssetsBase}/Image-7.png`,
    lashes: `${serviceAssetsBase}/Image-1.png`,
    cosmetology: `${serviceAssetsBase}/Image.png`,
    micropigmentation: '/Glamhour - Assets/Registration flow/Health Questionnaire Form/micropigmentation.png',
  },
  icons: {
    chevronRight: `${serviceAssetsBase}/Icon-12.png`,
    clock: `${serviceAssetsBase}/Icon-11.png`,
    dollar: `${serviceAssetsBase}/Icon-9.png`,
    trending: `${serviceAssetsBase}/Icon-18.png`,
    calendar: `${serviceAssetsBase}/Vector-3.png`,
    search: `${serviceAssetsBase}/MagnifyingGlass.png`,
    info: `${serviceAssetsBase}/Icon-6.png`,
    phone: `${serviceAssetsBase}/Icon-8.png`,
    alert: `${serviceAssetsBase}/Icon-10.png`,
    user: `${serviceAssetsBase}/Icon-17.png`,
    success: `${homeNailsAssetsBase}/Icon-16.png`,
  },
  serviceTypes: {
    dualSystem: `${homeNailsAssetsBase}/image 23.png`,
    pressOn: `${homeNailsAssetsBase}/image 22.png`,
  },
  nailTypes: {
    stiletto: `${nailTypesAssetsBase}/Stilleto.png`,
    coffin: `${nailTypesAssetsBase}/Coffin.png`,
    almond: `${nailTypesAssetsBase}/Almond.png`,
    oval: `${nailTypesAssetsBase}/Oval.png`,
    squoval: `${nailTypesAssetsBase}/Squoval.png`,
    square: `${nailTypesAssetsBase}/Square.png`,
    round: `${nailTypesAssetsBase}/Round.svg`,
    custom: `${nailTypesAssetsBase}/Custom.png`,
  },
  materials: {
    polygel: `${homeNailsAssetsBase}/image 17.png`,
    acrylic: `${homeNailsAssetsBase}/image 18.png`,
    dipPowder: `${homeNailsAssetsBase}/image 21.png`,
    builderGel: `${homeNailsAssetsBase}/image 20.png`,
  },
  hands: {
    right: `${homeNailsAssetsBase}/Gemini_Generated_Image_eddyfreddyfreddy 1.png`,
    left: `${homeNailsAssetsBase}/Gemini_Generated_Image_a3i81wa3i81wa3i8 1.png`,
    singleFinger: `${homeNailsAssetsBase}/image 11.png`,
    fullHandIcon: `${homeNailsAssetsBase}/Hand.png`,
    fingerToFingerIcon: `${homeNailsAssetsBase}/HandPointing.png`,
    swap: `${homeNailsAssetsBase}/Swap.png`,
    questionMark: `${fullHandAssetsBase}/QuestionMark.png`,
    ellipse1: `${homeNailsAssetsBase}/Ellipse 1.png`,
    ellipse3: `${homeNailsAssetsBase}/Ellipse 3.png`,
  },
} as const

export type NailTypeImageVariant =
  | 'stiletto'
  | 'coffin'
  | 'almond'
  | 'oval'
  | 'squoval'
  | 'square'
  | 'round'
  | 'custom'

export const nailTypeImageVariants: Record<string, NailTypeImageVariant> = {
  Stilleto: 'stiletto',
  Stiletto: 'stiletto',
  Coffin: 'coffin',
  Almond: 'almond',
  Oval: 'oval',
  Squoval: 'squoval',
  Square: 'square',
  Round: 'round',
  Custom: 'custom',
}
