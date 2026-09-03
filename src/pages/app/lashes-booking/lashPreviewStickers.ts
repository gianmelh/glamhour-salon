/**
 * Lash try-on stickers from Figma node 629:1770 (“Set de pestañas”).
 *
 * Exact Figma style names: Anime, Cat eye, Clasica, Doll, Eyeliner, Fox, Wispy
 * Exact Figma variant names: Classic, Hibrida, Volumen
 *
 * App variant labels: Classic, Hybrid (= Hibrida), Volume (= Volumen)
 *
 * Only combinations with BOTH Left and Right symbols in Figma are listed.
 * Missing combinations return null — never fall back to another set.
 */

const stickersBase =
  "/Glamhour - Assets/Registration flow/Home/Lashes/preview-stickers";

export type LashPreviewStyleKey =
  | "Anime"
  | "Cat eye"
  | "Clasica"
  | "Doll"
  | "Eyeliner"
  | "Fox"
  | "Wispy";

export type LashPreviewVariantKey = "Classic" | "Hybrid" | "Volume";
export type LashPreviewSide = "left" | "right";

export type LashPreviewStickerSet = Record<LashPreviewSide, string>;

export const LASH_PREVIEW_STYLE_OPTIONS: ReadonlyArray<{
  label: string;
  value: LashPreviewStyleKey;
}> = [
  { label: "Anime", value: "Anime" },
  { label: "Cat eye", value: "Cat eye" },
  { label: "Clasica", value: "Clasica" },
  { label: "Doll", value: "Doll" },
  { label: "Eyeliner", value: "Eyeliner" },
  { label: "Fox", value: "Fox" },
  { label: "Wispy", value: "Wispy" },
];

export const LASH_PREVIEW_VARIANT_OPTIONS: ReadonlyArray<{
  label: string;
  value: LashPreviewVariantKey;
  figma: "Classic" | "Hibrida" | "Volumen";
}> = [
  { label: "Classic", value: "Classic", figma: "Classic" },
  { label: "Hybrid", value: "Hybrid", figma: "Hibrida" },
  { label: "Volume", value: "Volume", figma: "Volumen" },
];

function pair(styleSlug: string, variantSlug: string): LashPreviewStickerSet {
  return {
    left: `${stickersBase}/${styleSlug}-${variantSlug}-left.png`,
    right: `${stickersBase}/${styleSlug}-${variantSlug}-right.png`,
  };
}

function swappedPair(styleSlug: string, variantSlug: string): LashPreviewStickerSet {
  return {
    left: `${stickersBase}/${styleSlug}-${variantSlug}-right.png`,
    right: `${stickersBase}/${styleSlug}-${variantSlug}-left.png`,
  };
}

/**
 * Explicit map of Style × Variant → left/right assets.
 * Only entries that exist as Figma symbols (both sides) are present.
 */
const AVAILABLE_SETS: Partial<
  Record<LashPreviewStyleKey, Partial<Record<LashPreviewVariantKey, LashPreviewStickerSet>>>
> = {
  Anime: {
    Classic: pair("anime", "classic"),
    Volume: pair("anime", "volume"),
  },
  "Cat eye": {
    Classic: pair("cat-eye", "classic"),
    Volume: pair("cat-eye", "volume"),
  },
  Clasica: {
    Classic: pair("clasica", "classic"),
    Volume: pair("clasica", "volume"),
  },
  Doll: {
    Hybrid: pair("doll", "hybrid"),
    Volume: pair("doll", "volume"),
  },
  Eyeliner: {
    Classic: swappedPair("eyeliner", "classic"),
    Volume: pair("eyeliner", "volume"),
  },
  Fox: {
    Hybrid: pair("fox", "hybrid"),
    Volume: pair("fox", "volume"),
  },
  Wispy: {
    Classic: swappedPair("wispy", "classic"),
    Volume: swappedPair("wispy", "volume"),
  },
};

/** Combinations confirmed missing in Figma 629:1770 (no Left+Right symbols). */
export const UNAVAILABLE_LASH_PREVIEW_COMBOS: ReadonlyArray<{
  style: LashPreviewStyleKey;
  variant: LashPreviewVariantKey;
}> = [
  { style: "Anime", variant: "Hybrid" },
  { style: "Cat eye", variant: "Hybrid" },
  { style: "Clasica", variant: "Hybrid" },
  { style: "Doll", variant: "Classic" },
  { style: "Eyeliner", variant: "Hybrid" },
  { style: "Fox", variant: "Classic" },
  { style: "Wispy", variant: "Hybrid" },
];

export function isLashPreviewStyle(value: string): value is LashPreviewStyleKey {
  return LASH_PREVIEW_STYLE_OPTIONS.some((option) => option.value === value);
}

export function isLashPreviewVariant(value: string): value is LashPreviewVariantKey {
  return LASH_PREVIEW_VARIANT_OPTIONS.some((option) => option.value === value);
}

export function normalizeLashPreviewStyle(style: string): LashPreviewStyleKey {
  if (style === "Classica" || style === "Classic") return "Clasica";
  if (style === "Airline") return "Eyeliner";
  if (style === "Fox eye") return "Fox";
  if (isLashPreviewStyle(style)) return style;
  return "Anime";
}

export function normalizeLashPreviewVariant(variant: string): LashPreviewVariantKey {
  if (variant === "Base" || variant === "Classic") return "Classic";
  if (variant === "Volume" || variant === "Volumen") return "Volume";
  if (variant === "Hybrid" || variant === "Hibrida") return "Hybrid";
  return "Classic";
}

export function getLashPreviewStickerSet(
  style: string,
  variant: string,
): LashPreviewStickerSet | null {
  if (!variant?.trim()) return null;
  const styleKey = normalizeLashPreviewStyle(style);
  const variantKey = normalizeLashPreviewVariant(variant);
  return AVAILABLE_SETS[styleKey]?.[variantKey] ?? null;
}

export function isLashPreviewComboAvailable(style: string, variant: string): boolean {
  return getLashPreviewStickerSet(style, variant) !== null;
}

export function availableVariantsForStyle(
  style: string,
): LashPreviewVariantKey[] {
  const styleKey = normalizeLashPreviewStyle(style);
  const row = AVAILABLE_SETS[styleKey] ?? {};
  return LASH_PREVIEW_VARIANT_OPTIONS.map((option) => option.value).filter(
    (variant) => Boolean(row[variant]),
  );
}

/** Initial / clamp sizes for try-on stickers (width as % of photo × scale). */
export const LASH_PREVIEW_SCALE_LIMITS = {
  baseWidthPct: 12,
  defaultScale: 1,
  minScale: 0.55,
  maxScale: 2.4,
} as const;
