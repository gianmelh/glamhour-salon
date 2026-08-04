const lashesBase = '/Glamhour - Assets/Registration flow/Home/Lashes'
const iconsBase = `${lashesBase}/icons`
const cosmetologyBase = '/Glamhour - Assets/Registration flow'

export const lashesBookingAssets = {
  categories: {
    nails: `${iconsBase}/category-nails.png`,
    lashes: `${iconsBase}/category-lash.png`,
    cosmetology: `${iconsBase}/category-cosmetology.png`,
    micropigmentation: `${iconsBase}/category-micropigmentation.png`,
  },
  lashMap: {
    catEye: `${lashesBase}/lash-map-cat-eye.png`,
    clean: `${lashesBase}/lash-map-clean.svg`,
    diagram: `${lashesBase}/lash-map-diagram.svg`,
  },
  variants: {
    Base: `${lashesBase}/variants/base.png`,
    Volume: `${lashesBase}/variants/volume.png`,
    Hybrid: `${lashesBase}/variants/hybrid.png`,
  },
  swap: `${iconsBase}/swap.svg`,
  help: `${lashesBase}/QuestionMark.png`,
  photoPlaceholder: `${cosmetologyBase}/Image (Vista previa de la foto).png`,
} as const
