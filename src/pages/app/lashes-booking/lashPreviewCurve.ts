export type LashWarpPoint = {
  xPct: number
  yPct: number
  /** Compatibility with saved vertical-offset previews. */
  yOffsetPct?: number
}

export const WARP_POINT_COUNT = 3
export const DEFAULT_WARP_POINTS: LashWarpPoint[] = [
  { xPct: 4, yPct: 54 },
  { xPct: 50, yPct: 41 },
  { xPct: 96, yPct: 54 },
]

const MIN_NEIGHBOR_GAP_PCT = 10
const MAX_X_DELTA_PCT = 28
const MAX_Y_DELTA_PCT = 36
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createDefaultWarpPoints(): LashWarpPoint[] {
  return DEFAULT_WARP_POINTS.map((point) => ({ ...point }))
}

function readPoint(value: unknown, fallback: LashWarpPoint): LashWarpPoint {
  const point = value && typeof value === 'object' ? value as Partial<LashWarpPoint> : undefined
  const legacyY = Number.isFinite(point?.yOffsetPct) ? 50 + Number(point?.yOffsetPct) : fallback.yPct
  return {
    xPct: clamp(Number.isFinite(point?.xPct) ? Number(point?.xPct) : fallback.xPct, 0, 100),
    yPct: clamp(Number.isFinite(point?.yPct) ? Number(point?.yPct) : legacyY, 0, 100),
  }
}

export function normalizeWarpPoints(
  points: unknown,
  fallbackPoints: LashWarpPoint[] = DEFAULT_WARP_POINTS,
): LashWarpPoint[] {
  const fallback = DEFAULT_WARP_POINTS.map((point, index) => readPoint(fallbackPoints[index], point))
  // Existing previews used seven controls. Keep both corners and the original
  // center instead of discarding the user's saved fit when opening that preview.
  const selected = Array.isArray(points) && points.length === 7
    ? [points[0], points[3], points[6]]
    : Array.isArray(points) && points.length === WARP_POINT_COUNT ? points : fallback
  const normalized = fallback.map((point, index) => readPoint(selected[index], point))
  const startX = clamp(normalized[0].xPct, 0, 100 - 2 * MIN_NEIGHBOR_GAP_PCT)
  const endX = clamp(normalized[2].xPct, startX + 2 * MIN_NEIGHBOR_GAP_PCT, 100)
  normalized[0].xPct = startX
  normalized[1].xPct = clamp(normalized[1].xPct, startX + MIN_NEIGHBOR_GAP_PCT, endX - MIN_NEIGHBOR_GAP_PCT)
  normalized[2].xPct = endX
  return normalized
}

export function clampWarpPoint(
  index: number,
  point: LashWarpPoint,
  anchor: LashWarpPoint,
  points: LashWarpPoint[],
): LashWarpPoint {
  const normalized = normalizeWarpPoints(points)
  const pointIndex = clamp(Number.isFinite(index) ? Math.trunc(index) : 0, 0, WARP_POINT_COUNT - 1)
  const original = normalized[pointIndex]
  const safeAnchor = readPoint(anchor, original)
  const candidate = readPoint(point, original)
  const previous = normalized[pointIndex - 1]
  const next = normalized[pointIndex + 1]
  // Neighbor order takes precedence even for malformed saved anchors whose
  // original movement bounds no longer intersect the available horizontal gap.
  return {
    xPct: clamp(
      clamp(candidate.xPct, safeAnchor.xPct - MAX_X_DELTA_PCT, safeAnchor.xPct + MAX_X_DELTA_PCT),
      previous ? previous.xPct + MIN_NEIGHBOR_GAP_PCT : 0,
      next ? next.xPct - MIN_NEIGHBOR_GAP_PCT : 100,
    ),
    yPct: clamp(candidate.yPct, Math.max(0, safeAnchor.yPct - MAX_Y_DELTA_PCT), Math.min(100, safeAnchor.yPct + MAX_Y_DELTA_PCT)),
  }
}

/** Endpoint derivative for a shape-preserving cubic with three knots. */
function endpointSlope(hereSpan: number, otherSpan: number, hereSlope: number, otherSlope: number) {
  const slope = ((2 * hereSpan + otherSpan) * hereSlope - hereSpan * otherSlope) / (hereSpan + otherSpan)
  if (Math.sign(slope) !== Math.sign(hereSlope)) return 0
  if (Math.sign(hereSlope) !== Math.sign(otherSlope) && Math.abs(slope) > 3 * Math.abs(hereSlope)) return 3 * hereSlope
  return slope
}

/** PCHIP: C1 interpolation without overshooting each pair of adjacent knots. */
function shapePreservingCurve(xs: number[], ys: number[]) {
  const h0 = xs[1] - xs[0]
  const h1 = xs[2] - xs[1]
  const d0 = (ys[1] - ys[0]) / h0
  const d1 = (ys[2] - ys[1]) / h1
  const w0 = 2 * h1 + h0
  const w1 = h1 + 2 * h0
  const middleSlope = d0 === 0 || d1 === 0 || Math.sign(d0) !== Math.sign(d1)
    ? 0
    : (w0 + w1) / (w0 / d0 + w1 / d1)
  const slopes = [endpointSlope(h0, h1, d0, d1), middleSlope, endpointSlope(h1, h0, d1, d0)]

  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[2]) return ys[2]
    const index = x < xs[1] ? 0 : 1
    const span = xs[index + 1] - xs[index]
    const t = (x - xs[index]) / span
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[index]
      + (t3 - 2 * t2 + t) * span * slopes[index]
      + (-2 * t3 + 3 * t2) * ys[index + 1]
      + (t3 - t2) * span * slopes[index + 1]
  }
}

/**
 * Inverse horizontal map plus vertical displacement, in sticker percentages.
 * Sample the source image at (sourceXPct, destinationYPct - offsetYPct).
 * Each control maps exactly to its source anchor; the horizontal map is
 * monotonic, so the image cannot fold over itself between the three controls.
 */
export function createLashWarpMapping(anchors: LashWarpPoint[], controls: LashWarpPoint[]) {
  const source = normalizeWarpPoints(anchors)
  const target = normalizeWarpPoints(controls, source)
  const sourceXs = source.map((point) => point.xPct)
  const targetXs = target.map((point) => point.xPct)
  const inverseX = shapePreservingCurve(targetXs, sourceXs)
  const sourceY = shapePreservingCurve(sourceXs, source.map((point) => point.yPct))
  const targetY = shapePreservingCurve(targetXs, target.map((point) => point.yPct))

  return (destXPct: number): { sourceXPct: number; offsetYPct: number } => {
    const x = Number.isFinite(destXPct) ? destXPct : target[1].xPct
    // Continue with a constant displacement outside the corner controls.
    // Polynomial extrapolation would amplify tiny corner changes at the edges.
    if (x <= targetXs[0]) return { sourceXPct: x + sourceXs[0] - targetXs[0], offsetYPct: target[0].yPct - source[0].yPct }
    if (x >= targetXs[2]) return { sourceXPct: x + sourceXs[2] - targetXs[2], offsetYPct: target[2].yPct - source[2].yPct }
    const sourceXPct = inverseX(x)
    const offsetYPct = targetY(x) - sourceY(sourceXPct)
    return { sourceXPct, offsetYPct: Math.abs(offsetYPct) < 1e-10 ? 0 : offsetYPct }
  }
}
