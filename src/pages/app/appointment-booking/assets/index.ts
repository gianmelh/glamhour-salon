export { nailsBookingAssets } from '../../nails-booking/assets'

const lashesBase = '/Glamhour - Assets/Registration flow/Home/Lashes'
const healthBase = '/Glamhour - Assets/Registration flow/Health Questionnaire Form'
const cosmetologyBase = '/Glamhour - Assets/Registration flow'

export const lashesBookingAssets = {
  styles: {
    'Cat Eye': `${lashesBase}/Cat_Eye (2) 1.png`,
    Fox: `${lashesBase}/Fox (2) 1.png`,
    Classic: `${lashesBase}/image 1.png`,
    Eyeliner: `${lashesBase}/ChatGPT Image 25 sept 2025, 03_09_14 p.m. 1.png`,
    Doll: `${lashesBase}/ChatGPT Image 25 sept 2025, 03_17_36 p.m. 1.png`,
    Wispy: `${lashesBase}/Vector-4.png`,
  },
  volumes: {
    Classic: `${lashesBase}/Lash volume.png`,
    '2D': `${lashesBase}/Lash volume-1.png`,
    '3D': `${lashesBase}/Lash volume-2.png`,
    '4D': `${lashesBase}/Lash volume-3.png`,
    '5D': `${lashesBase}/Lash volume-4.png`,
    '6D': `${lashesBase}/Lash volume-5.png`,
    Hybrid: `${lashesBase}/Lash volume-8.png`,
  },
  curls: {
    A: `${lashesBase}/Lash curl.png`,
    B: `${lashesBase}/Lash curl-1.png`,
    C: `${lashesBase}/Lash curl-2.png`,
    CC: `${lashesBase}/Lash curl-3.png`,
    D: `${lashesBase}/Lash curl-4.png`,
    L: `${lashesBase}/Lash curl-6.png`,
    'L+': `${lashesBase}/Lash curl-7.png`,
  },
  eyeDiagram: `${lashesBase}/image 1.png`,
  help: `${lashesBase}/QuestionMark.png`,
  swap: `${lashesBase}/Swap.png`,
  photoPlaceholder: `${cosmetologyBase}/Image (Vista previa de la foto).png`,
} as const

export const cosmetologyBookingAssets = {
  faceDiagram: `${healthBase}/image 1.png`,
  phototypes: {
    'Type I': `${healthBase}/Phototype/type 1.png`,
    'Type II': `${healthBase}/Phototype/type 2.png`,
    'Type III': `${healthBase}/Phototype/type 3.png`,
    'Type IV': `${healthBase}/Phototype/type 4.png`,
    'Type V': `${healthBase}/Phototype/type 5.png`,
    'Type VI': `${healthBase}/Phototype/type 6.png`,
  },
} as const

export const micropigmentationBookingAssets = {
  hero: `${healthBase}/micropigmentation.png`,
  eyebrowDiagram: `${healthBase}/ChatGPT Image 25 sept 2025, 03_09_14 p.m. 1.png`,
  lipDiagram: `${healthBase}/ChatGPT Image 25 sept 2025, 03_17_36 p.m. 1.png`,
} as const
