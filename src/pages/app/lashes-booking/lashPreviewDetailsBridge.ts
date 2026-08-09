/**
 * Single mapping layer between Preview try-on (Figma 629:1770) and
 * Details of service Lash style / Volume fields.
 */
import {
  availableVariantsForStyle,
  isLashPreviewComboAvailable,
  normalizeLashPreviewVariant,
  type LashPreviewStyleKey,
  type LashPreviewVariantKey,
} from './lashPreviewStickers'
import { lashStyleOptions, lashVolumeOptions } from './lashesDetailsSpec'

/** Details “Lash style” keys currently supported by the Lashes details pickers. */
export type LashesDetailsStyleKey = (typeof lashStyleOptions)[number]['key']

/** Details “Volume” keys (Classic, 2D…10D). */
export type LashesDetailsVolumeKey = (typeof lashVolumeOptions)[number]

/**
 * Preview Style → Details Lash style.
 * Only entries with a real Details option are non-null.
 */
export const PREVIEW_STYLE_TO_DETAILS_STYLE = {
  Anime: 'Anime',
  'Cat eye': 'Cat eye',
  Clasica: 'Classica',
  Doll: 'Doll',
  Eyeliner: 'Eyeliner',
  Fox: 'Fox',
  Wispy: 'Wispy',
} as const satisfies Record<LashPreviewStyleKey, LashesDetailsStyleKey>

/**
 * Details Lash style → Preview Style.
 * Includes aliases that may appear in stored drafts.
 */
export const DETAILS_STYLE_TO_PREVIEW_STYLE: Record<string, LashPreviewStyleKey> = {
  Anime: 'Anime',
  'Cat eye': 'Cat eye',
  Classica: 'Clasica',
  Clasica: 'Clasica',
  Classic: 'Clasica',
  Doll: 'Doll',
  Eyeliner: 'Eyeliner',
  Airline: 'Eyeliner',
  Fox: 'Fox',
  'Fox eye': 'Fox',
  Wispy: 'Wispy',
}

/**
 * Preview Variant → Details Volume.
 * - Classic maps 1:1 to Volume “Classic”.
 * - Volume / Hybrid have no exact 2D–10D equivalent in Details metadata → null
 *   (variant is still stored; existing volume is left untouched).
 */
export const PREVIEW_VARIANT_TO_DETAILS_VOLUME: Record<
  LashPreviewVariantKey,
  LashesDetailsVolumeKey | null
> = {
  Classic: 'Classic',
  Volume: null,
  Hybrid: null,
}

const DETAILS_STYLE_KEYS = new Set<string>(lashStyleOptions.map((option) => option.key))
const DETAILS_VOLUME_KEYS = new Set<string>(lashVolumeOptions)

export function detailsStyleFromPreviewStyle(
  previewStyle: LashPreviewStyleKey,
): LashesDetailsStyleKey {
  return PREVIEW_STYLE_TO_DETAILS_STYLE[previewStyle]
}

export function previewStyleFromDetailsStyle(
  detailsStyle: string | undefined,
): LashPreviewStyleKey | null {
  if (!detailsStyle) return null
  return DETAILS_STYLE_TO_PREVIEW_STYLE[detailsStyle] ?? null
}

export function detailsVolumeFromPreviewVariant(
  previewVariant: LashPreviewVariantKey,
): LashesDetailsVolumeKey | null {
  return PREVIEW_VARIANT_TO_DETAILS_VOLUME[previewVariant]
}

/**
 * Resolve which Preview chips to show from shared Lashes details.
 * Prefers explicit `variant` / mapped style; never invents an available
 * asset combo when Details has no equivalent (e.g. volume “3D”).
 */
export function resolvePreviewSelectionFromDetails(details: Record<string, unknown>): {
  previewStyle: LashPreviewStyleKey
  previewVariant: LashPreviewVariantKey | null
} {
  const previewStyle =
    previewStyleFromDetailsStyle(String(details.style ?? '')) ??
    (DETAILS_STYLE_TO_PREVIEW_STYLE[String(details.previewStyle ?? '')] ?? 'Cat eye')

  const rawVariant = details.variant
  if (typeof rawVariant === 'string' && rawVariant.trim()) {
    return {
      previewStyle,
      previewVariant: normalizeLashPreviewVariant(rawVariant),
    }
  }

  const volume = String(details.volume ?? '')
  if (volume === 'Classic') {
    return { previewStyle, previewVariant: 'Classic' }
  }

  // 2D–10D (or unknown) have no safe Preview Variant mapping.
  return { previewStyle, previewVariant: null }
}

/**
 * Patch for shared Lashes details from a Preview Style + Variant.
 * Writes Details Lash style; writes Volume only for exact Classic↔Classic.
 * Always persists `variant` so Hybrid/Volume are not lost when unsupported
 * in the Details Volume picker.
 */
export function previewSelectionPatch(
  previewStyle: LashPreviewStyleKey,
  previewVariant: LashPreviewVariantKey,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    style: detailsStyleFromPreviewStyle(previewStyle),
    variant: previewVariant,
  }
  const detailsVolume = detailsVolumeFromPreviewVariant(previewVariant)
  if (detailsVolume && DETAILS_VOLUME_KEYS.has(detailsVolume)) {
    patch.volume = detailsVolume
  }
  return patch
}

/** @deprecated Use previewSelectionPatch — kept for call-site clarity. */
export function applyPreviewSelectionToDetails(
  details: Record<string, unknown>,
  previewStyle: LashPreviewStyleKey,
  previewVariant: LashPreviewVariantKey,
): Record<string, unknown> {
  return { ...details, ...previewSelectionPatch(previewStyle, previewVariant) }
}

/** True when Preview can show real stickers for the resolved Details selection. */
export function detailsSelectionHasPreviewAssets(details: Record<string, unknown>): boolean {
  const { previewStyle, previewVariant } = resolvePreviewSelectionFromDetails(details)
  if (!previewVariant) return false
  return isLashPreviewComboAvailable(previewStyle, previewVariant)
}

export function coercePreviewVariantForStyle(
  previewStyle: LashPreviewStyleKey,
  previewVariant: LashPreviewVariantKey | null,
): LashPreviewVariantKey | null {
  if (!previewVariant) return null
  const available = availableVariantsForStyle(previewStyle)
  if (available.includes(previewVariant)) return previewVariant
  // Keep the requested variant (shows as selected + “not available”) rather than
  // silently switching to another set’s assets.
  return previewVariant
}

export function isKnownDetailsStyle(value: string): value is LashesDetailsStyleKey {
  return DETAILS_STYLE_KEYS.has(value)
}
