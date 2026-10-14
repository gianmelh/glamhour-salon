#!/usr/bin/env -S npx tsx
import assert from 'node:assert/strict'
import {
  WARP_POINT_COUNT, DEFAULT_WARP_POINTS, createDefaultWarpPoints,
  normalizeWarpPoints, clampWarpPoint, createLashWarpMapping,
} from '../src/pages/app/lashes-booking/lashPreviewCurve.ts'

const near = (actual: number, expected: number, message: string, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`)
}
const anchors = createDefaultWarpPoints()
assert.equal(WARP_POINT_COUNT, 3)
assert.deepEqual(anchors, [{ xPct: 4, yPct: 54 }, { xPct: 50, yPct: 41 }, { xPct: 96, yPct: 54 }])
anchors[0].yPct = 53
assert.equal(DEFAULT_WARP_POINTS[0].yPct, 54, 'defaults are copied, not shared')
const source = [{ xPct: 7, yPct: 63 }, { xPct: 47, yPct: 29 }, { xPct: 91, yPct: 55 }]

const identity = createLashWarpMapping(source, source)
for (let x = -20; x <= 120; x += 0.25) {
  near(identity(x).sourceXPct, x, 'no-op mapping preserves source x')
  near(identity(x).offsetYPct, 0, 'no-op mapping preserves source y')
}
console.log('PASS three controls and identity deformation, including outside the corners')

const legacy = [
  { xPct: 6, yPct: 57 }, { xPct: 19, yPct: 48 }, { xPct: 35, yPct: 43 },
  { xPct: 51, yOffsetPct: -12 }, { xPct: 65, yPct: 43 }, { xPct: 81, yPct: 48 }, { xPct: 94, yPct: 59 },
]
assert.deepEqual(normalizeWarpPoints(legacy), [{ xPct: 6, yPct: 57 }, { xPct: 51, yPct: 38 }, { xPct: 94, yPct: 59 }])
assert.deepEqual(normalizeWarpPoints([{ yOffsetPct: 3 }, { yOffsetPct: -10 }, { yOffsetPct: 7 }]), [{ xPct: 4, yPct: 53 }, { xPct: 50, yPct: 40 }, { xPct: 96, yPct: 57 }])
for (const bad of [undefined, null, {}, [], [{ xPct: 4, yPct: 54 }]]) assert.deepEqual(normalizeWarpPoints(bad), DEFAULT_WARP_POINTS)
assert.deepEqual(normalizeWarpPoints([null, 'bad', { xPct: NaN, yPct: Infinity }]), DEFAULT_WARP_POINTS)
const reordered = normalizeWarpPoints([{ xPct: 95, yPct: -30 }, { xPct: 2, yPct: 400 }, { xPct: 10, yPct: NaN }])
assert.ok(reordered[1].xPct - reordered[0].xPct >= 10)
assert.ok(reordered[2].xPct - reordered[1].xPct >= 10)
assert.ok(reordered.every((point) => point.yPct >= 0 && point.yPct <= 100))
assert.deepEqual(legacy[3], { xPct: 51, yOffsetPct: -12 }, 'migration never mutates a saved draft')
console.log('PASS legacy seven-point/vertical-offset migration and malformed saved data')

for (let moved = 0; moved < 3; moved += 1) {
  const controls = source.map((point) => ({ ...point }))
  controls[moved] = clampWarpPoint(moved, { xPct: controls[moved].xPct + (moved === 2 ? -9 : 9), yPct: controls[moved].yPct + 18 }, source[moved], controls)
  const mapping = createLashWarpMapping(source, controls)
  controls.forEach((control, index) => {
    const mapped = mapping(control.xPct)
    near(mapped.sourceXPct, source[index].xPct, 'each handle maps exactly to its anchor')
    near(control.yPct - mapped.offsetYPct, source[index].yPct, 'each handle has exact vertical displacement')
    if (index !== moved) near(mapped.offsetYPct, 0, 'moving one node keeps the other nodes fixed')
  })
  const h = 0.0001
  const x = controls[1].xPct
  for (const field of ['sourceXPct', 'offsetYPct'] as const) {
    const leftSlope = (mapping(x)[field] - mapping(x - h)[field]) / h
    const rightSlope = (mapping(x + h)[field] - mapping(x)[field]) / h
    near(leftSlope, rightSlope, 'the center joins with a continuous first derivative', 0.0001)
  }
}
console.log('PASS exact anchor mapping, independent handles, and smooth center joins')

// Flat source isolates the target curve so overshoot is directly observable.
const flatSource = source.map((point) => ({ ...point, yPct: 50 }))
for (const ys of [[0, 100, 0], [100, 0, 100], [15, 25, 90], [90, 25, 15], [50, 50, 50]]) {
  const controls = source.map((point, index) => ({ ...point, yPct: ys[index] }))
  const mapping = createLashWarpMapping(flatSource, controls)
  for (let x = controls[0].xPct; x <= controls[2].xPct; x += 0.1) {
    const segment = x < controls[1].xPct ? 0 : 1
    const y = 50 + mapping(x).offsetYPct
    assert.ok(y >= Math.min(ys[segment], ys[segment + 1]) - 1e-8 && y <= Math.max(ys[segment], ys[segment + 1]) + 1e-8, 'curve does not overshoot neighboring handle heights')
  }
}
console.log('PASS shape-preserving heights without overshoot')

for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2]]) {
  for (const extreme of [-1000, 1000]) {
    let controls = source.map((point) => ({ ...point }))
    for (const index of order) {
      controls = controls.map((point, i) => i === index ? clampWarpPoint(i, { xPct: extreme, yPct: -extreme }, source[i], controls) : point)
      assert.ok(controls[1].xPct - controls[0].xPct >= 10)
      assert.ok(controls[2].xPct - controls[1].xPct >= 10)
      const mapping = createLashWarpMapping(source, controls)
      let previousX = mapping(-20).sourceXPct
      for (let x = -19.9; x <= 120; x += 0.1) {
        const mapped = mapping(x)
        assert.ok(Number.isFinite(mapped.sourceXPct) && Number.isFinite(mapped.offsetYPct))
        assert.ok(mapped.sourceXPct > previousX, 'horizontal mapping never folds after constrained extreme drags')
        previousX = mapped.sourceXPct
      }
      for (const side of [-1, 1]) {
        const x1 = side === -1 ? controls[0].xPct - 10 : controls[2].xPct + 10
        const x2 = x1 + side * 100
        near(mapping(x1).offsetYPct, mapping(x2).offsetYPct, 'vertical extrapolation remains bounded')
        near(mapping(x1).sourceXPct - x1, mapping(x2).sourceXPct - x2, 'horizontal extrapolation uses bounded displacement')
      }
    }
  }
}
assert.ok(Number.isFinite(createLashWarpMapping(source, source)(NaN).sourceXPct))
console.log('PASS no folding under extreme constrained drags and bounded extrapolation')
