import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { resolveTreatmentPhotoUrl } from '../../../lib/treatmentMedia'
import { LashPreviewCanvas } from '../lashes-booking/components/LashPreviewCanvas'
import { getLashPreviewStickerSet } from '../lashes-booking/lashPreviewStickers'
import type { LashPreviewStickersState } from '../lashes-booking/types'

function savedStickers(value: unknown): LashPreviewStickersState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const stickers = value as LashPreviewStickersState
  const valid = (['a', 'b'] as const).every((id) => {
    const item = stickers[id]
    return item && ['left', 'right'].includes(item.assetSide)
      && [item.xPct, item.yPct, item.scale].every(Number.isFinite)
      && (item.rotationDeg === undefined || Number.isFinite(item.rotationDeg))
      && item.scale > 0
  })
  return valid ? {
    ...stickers,
    a: { ...stickers.a, rotationDeg: stickers.a.rotationDeg ?? 0 },
    b: { ...stickers.b, rotationDeg: stickers.b.rotationDeg ?? 0 },
  } : undefined
}

export function ClientClinicalPhoto({ details, category }: { details: Record<string, unknown>; category: string }) {
  const src = resolveTreatmentPhotoUrl(details)
  // A replacement photo remounts this inner component, clearing any previous failure.
  return <SavedPhoto category={category} details={details} key={src} src={src} />
}

function SavedPhoto({ details, category, src }: { details: Record<string, unknown>; category: string; src: string }) {
  const [failed, setFailed] = useState(false)
  const stickers = savedStickers(details.lashPreviewStickers)
  const style = String(details.style ?? '')
  const variant = String(details.variant ?? details.volume ?? '')
  const hasLashPreview = category === 'lashes' && stickers && getLashPreviewStickerSet(style, variant)

  if (!src || failed) return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 p-4 text-center text-sm text-muted" role="status">
      <ImageOff aria-hidden className="size-7" />
      <p>Photo unavailable</p>
      <p className="text-xs">Edit the form to add the reference photo again.</p>
    </div>
  )
  if (hasLashPreview) return <LashPreviewCanvas initialStickers={stickers} onPhotoError={() => setFailed(true)} photoUrl={src} readOnly style={style} variant={variant} />
  return <img alt="Clinical reference" className="max-h-96 w-full rounded-lg object-contain" loading="lazy" onError={() => setFailed(true)} src={src} />
}
