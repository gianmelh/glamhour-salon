import type { LashInlineIconSpec } from '../lashIconSpecs'

export function LashInlineIcon({ spec, alt = '' }: { spec: LashInlineIconSpec; alt?: string }) {
  return (
    <img
      alt={alt}
      className="block max-w-none shrink-0 object-contain"
      src={spec.src}
      style={{ width: spec.width, height: spec.height }}
    />
  )
}
