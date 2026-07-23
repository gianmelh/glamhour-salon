const iconsBase = '/Glamhour - Assets/Registration flow/Home/Lashes/icons'

/** Exact icon dimensions from Figma 335:10351 / 650:6083. */
export type LashInlineIconSpec = {
  src: string
  width: number
  height: number
}

export const lashVolumeIconSpecs: Record<string, LashInlineIconSpec> = {
  Classic: { src: `${iconsBase}/volume-classic.svg`, width: 29, height: 12.053 },
  '2D': { src: `${iconsBase}/volume-2d.svg`, width: 30, height: 12.053 },
  '3D': { src: `${iconsBase}/volume-3d.svg`, width: 30, height: 12.053 },
  '4D': { src: `${iconsBase}/volume-4d.svg`, width: 29.5, height: 11.059 },
  '5D': { src: `${iconsBase}/volume-5d.svg`, width: 29.5, height: 11.059 },
  '6D': { src: `${iconsBase}/volume-6d.svg`, width: 29.5, height: 11.059 },
  '7D': { src: `${iconsBase}/volume-7d.svg`, width: 29, height: 11.059 },
  '8D': { src: `${iconsBase}/volume-8d.svg`, width: 29, height: 11.059 },
  '9D': { src: `${iconsBase}/volume-9d.svg`, width: 29, height: 12.548 },
  '10D': { src: `${iconsBase}/volume-10d.svg`, width: 29, height: 14.548 },
}

export const lashCurlIconSpecs: Record<string, LashInlineIconSpec> = {
  A: { src: `${iconsBase}/curl-a.svg`, width: 25, height: 10.539 },
  B: { src: `${iconsBase}/curl-b.svg`, width: 26, height: 16.506 },
  C: { src: `${iconsBase}/curl-c.svg`, width: 22.5, height: 17 },
  CC: { src: `${iconsBase}/curl-cc.svg`, width: 19, height: 19.087 },
  D: { src: `${iconsBase}/curl-d.svg`, width: 16.394, height: 25 },
  U: { src: `${iconsBase}/curl-u.svg`, width: 13.251, height: 25.5 },
  L: { src: `${iconsBase}/curl-l.svg`, width: 18, height: 23.353 },
  'L+': { src: `${iconsBase}/curl-l-plus.svg`, width: 19.167, height: 23.517 },
}
