#!/usr/bin/env -S npx tsx
// Real lash canvas and local sticker assets; the photo is synthetic and no API is used.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright'
import { createServer } from 'vite'
import type { LashPreviewStickersState } from '../src/pages/app/lashes-booking/types.ts'

type Point = { xPct: number; yPct: number }
const legacyPoints: Point[] = [
  { xPct: 8, yPct: 52 }, { xPct: 20, yPct: 58 }, { xPct: 35, yPct: 54 },
  { xPct: 50, yPct: 40 }, { xPct: 65, yPct: 55 }, { xPct: 80, yPct: 60 }, { xPct: 94, yPct: 51 },
]
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LashPreviewCanvas } from '/src/pages/app/lashes-booking/components/LashPreviewCanvas.tsx';
import '/src/index.css';
const legacy = new URLSearchParams(location.search).has('legacy');
const points = ${JSON.stringify(legacyPoints)};
const initial = {
  a: { assetSide: 'left', xPct: 30, yPct: 32, scale: 1, rotationDeg: 0, ...(legacy ? { warpPoints: points } : {}) },
  b: { assetSide: 'right', xPct: 66, yPct: 32, scale: 1, rotationDeg: 0, ...(legacy ? { warpPoints: points } : {}) },
};
window.lashState = initial;
window.lashChanges = 0;
function Harness() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(initial);
  const [swapNonce, setSwapNonce] = useState(0);
  return React.createElement('main', { style: { padding: 16, maxWidth: 720, margin: 'auto' } },
    React.createElement('h1', null, 'Lash photo preview'),
    open ? React.createElement(React.Fragment, null,
      React.createElement(LashPreviewCanvas, { photoUrl: '/__lash_fixture_photo__.svg', style: 'Anime', variant: 'Classic', initialStickers: saved, swapNonce,
        onStickersChange: next => { window.lashState = next; window.lashChanges += 1; } }),
      React.createElement('button', { onClick: () => setSwapNonce(value => value + 1) }, 'Swap lashes'),
      React.createElement('button', { onClick: () => { sessionStorage.setItem('lash-preview-regression', JSON.stringify(window.lashState)); setOpen(false); } }, 'Save preview')
    ) : React.createElement('button', { onClick: () => { setSaved(JSON.parse(sessionStorage.getItem('lash-preview-regression'))); setOpen(true); } }, 'Reopen preview')
  );
}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`
const photo = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="431" viewBox="0 0 720 431"><rect width="720" height="431" fill="#f0d2bf"/><path d="M145 145 Q215 95 285 145 Q215 180 145 145 M405 145 Q475 95 545 145 Q475 180 405 145" fill="#fff8f2" stroke="#9b6d59" stroke-width="4"/><circle cx="215" cy="143" r="24" fill="#7c8472"/><circle cx="475" cy="143" r="24" fill="#7c8472"/><circle cx="215" cy="143" r="11" fill="#292525"/><circle cx="475" cy="143" r="11" fill="#292525"/></svg>`

const server = await createServer({
  logLevel: 'error', cacheDir: 'node_modules/.vite-lash-preview-regression',
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'lash-preview-regression', configureServer(vite) {
    vite.middlewares.use('/__lash_fixture_photo__.svg', (_req, res) => {
      res.setHeader('Content-Type', 'image/svg+xml'); res.end(photo)
    })
    vite.middlewares.use('/__lash_preview__', async (req, res, next) => {
      try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html)) }
      catch (error) { next(error) }
    })
  } }],
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

async function settleCanvas(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function waitForLashAssets(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.lash-preview-sticker img')].length === 2
    && [...document.querySelectorAll<HTMLImageElement>('.lash-preview-sticker img')].every(image => image.complete && image.naturalWidth > 0))
  await settleCanvas(page)
}
async function readPoints(sticker: Locator): Promise<Point[]> {
  return sticker.locator('.lash-preview-warp-point').evaluateAll(points => points.map(point => ({
    xPct: Number.parseFloat((point as HTMLElement).style.left), yPct: Number.parseFloat((point as HTMLElement).style.top),
  })))
}
async function readSticker(sticker: Locator) {
  return sticker.evaluate(element => ({
    left: (element as HTMLElement).style.left,
    top: (element as HTMLElement).style.top,
    width: (element as HTMLElement).style.width,
    transform: (element as HTMLElement).style.transform,
    pixels: element.querySelector('canvas')!.toDataURL(),
  }))
}
async function state(page: Page) {
  return page.evaluate(() => (window as unknown as { lashState: LashPreviewStickersState }).lashState)
}
async function center(locator: Locator) {
  const box = await locator.boundingBox()
  assert.ok(box, 'the interaction target is visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function pointerDrag(page: Page, context: BrowserContext, touch: boolean, start: { x: number; y: number }, delta: { x: number; y: number }) {
  if (touch) {
    const cdp = await context.newCDPSession(page)
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] })
      for (let step = 1; step <= 5; step += 1) await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: start.x + delta.x * step / 5, y: start.y + delta.y * step / 5, id: 1 }],
      })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally { await cdp.detach() }
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 5 })
    await page.mouse.up()
  }
  await settleCanvas(page)
}

try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  for (const scenario of [
    { name: 'mouse', touch: false, legacy: false, width: 900 },
    { name: 'touch', touch: true, legacy: false, width: 393 },
    { name: 'legacy seven-point draft', touch: false, legacy: true, width: 900 },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 852 }, hasTouch: scenario.touch, isMobile: scenario.touch, serviceWorkers: 'block' })
    const errors: string[] = []
    const unexpected: string[] = []
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin || url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return route.abort('blockedbyclient') }
      return route.continue()
    })
    const page = await context.newPage()
    page.setDefaultTimeout(6000)
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/__lash_preview__${scenario.legacy ? '?legacy' : ''}`)
      await page.getByRole('img', { name: 'Lash style preview', exact: true }).waitFor()
      await waitForLashAssets(page)
      const left = page.getByRole('button', { name: 'left eye lash sticker', exact: true })
      const right = page.getByRole('button', { name: 'right eye lash sticker', exact: true })
      assert.equal(await page.locator('.lash-preview-warp-point').count(), 0, 'controls appear only for the selected eye')

      // Start on an unselected sticker so this is an actual move, not a warp.
      const beforeMove = await readSticker(left)
      const otherBeforeMove = await readSticker(right)
      await pointerDrag(page, context, scenario.touch, await center(left), { x: 12, y: 8 })
      const afterMove = await readSticker(left)
      assert.notEqual(afterMove.left, beforeMove.left)
      assert.notEqual(afterMove.top, beforeMove.top)
      assert.equal(afterMove.width, beforeMove.width)
      assert.equal(afterMove.transform, beforeMove.transform)
      assert.deepEqual(await readSticker(right), otherBeforeMove, 'moving one eye leaves the other eye untouched')

      for (const [id, sticker, other] of [['a', left, right], ['b', right, left]] as const) {
        await sticker.press('Enter')
        assert.equal(await sticker.locator('.lash-preview-warp-point').count(), 3, 'each eye has exactly start, middle, and end controls')
        for (const point of ['Start', 'Middle', 'End']) assert.equal(await sticker.getByRole('button', { name: `${point} lash curve point`, exact: true }).count(), 1)
        assert.equal(await other.locator('.lash-preview-warp-point').count(), 0)
        if (scenario.legacy) assert.deepEqual(await readPoints(sticker), [legacyPoints[0], legacyPoints[3], legacyPoints[6]], 'legacy seven-point drafts retain start, middle, and end')
        for (let pointIndex = 0; pointIndex < 3; pointIndex += 1) {
          const before = await readPoints(sticker)
          const shapeBefore = await readSticker(sticker)
          const otherBefore = await readSticker(other)
          await pointerDrag(page, context, scenario.touch, await center(sticker.locator('.lash-preview-warp-point').nth(pointIndex)), { x: pointIndex === 2 ? -3 : 3, y: pointIndex === 1 ? -5 : 5 })
          const after = await readPoints(sticker)
          assert.notDeepEqual(after[pointIndex], before[pointIndex], `${id}: point ${pointIndex} responds to ${scenario.name} drag`)
          for (let fixedIndex = 0; fixedIndex < 3; fixedIndex += 1) if (fixedIndex !== pointIndex) assert.deepEqual(after[fixedIndex], before[fixedIndex], 'dragging a control does not move the other two controls')
          const shapeAfter = await readSticker(sticker)
          assert.notEqual(shapeAfter.pixels, shapeBefore.pixels, 'dragging changes the rendered lash shape')
          assert.deepEqual({ ...shapeAfter, pixels: '' }, { ...shapeBefore, pixels: '' }, 'a warp changes shape without moving, rotating, or scaling the sticker')
          assert.deepEqual(await readSticker(other), otherBefore, 'warping one eye leaves the other eye untouched')
          assert.equal((await state(page))[id].warpPoints?.length, 3, 'persisted warp state uses three points')
        }
      }

      const beforeSize = await state(page)
      await page.getByRole('button', { name: 'Increase lash size', exact: true }).click()
      const afterSize = await state(page)
      assert.ok(afterSize.b.scale > beforeSize.b.scale, 'size remains adjustable')
      assert.deepEqual(afterSize.b.warpPoints, beforeSize.b.warpPoints)
      assert.deepEqual(afterSize.a, beforeSize.a)
      for (let i = 0; i < 5; i += 1) await page.getByRole('button', { name: 'Rotate lash clockwise', exact: true }).click()
      const afterRotate = await state(page)
      assert.equal(afterRotate.b.rotationDeg, afterSize.b.rotationDeg + 25, 'rotation remains adjustable')
      assert.deepEqual(afterRotate.b.warpPoints, afterSize.b.warpPoints)
      assert.deepEqual(afterRotate.a, afterSize.a)

      const rotatedPoints = await readPoints(right)
      await pointerDrag(page, context, scenario.touch, await center(right.locator('.lash-preview-warp-point').nth(1)), { x: 3, y: 4 })
      const rotatedAfter = await readPoints(right)
      assert.notDeepEqual(rotatedAfter[1], rotatedPoints[1], 'the middle control stays draggable after scaling and rotating')
      assert.deepEqual(rotatedAfter[0], rotatedPoints[0])
      assert.deepEqual(rotatedAfter[2], rotatedPoints[2])
      assert.equal((await state(page)).b.rotationDeg, afterRotate.b.rotationDeg, 'warping a rotated sticker does not change rotation')

      const beforeSwap = await state(page)
      for (let swap = 0; swap < 2; swap += 1) {
        const changes = await page.evaluate(() => (window as unknown as { lashChanges: number }).lashChanges)
        await page.getByRole('button', { name: 'Swap lashes', exact: true }).click()
        await page.waitForFunction(previous => (window as unknown as { lashChanges: number }).lashChanges > previous, changes)
      }
      const afterSwap = await state(page)
      for (const id of ['a', 'b'] as const) {
        assert.ok(Math.abs(afterSwap[id].xPct - beforeSwap[id].xPct) < 1e-10, 'swapping twice restores the horizontal position within floating-point precision')
        assert.deepEqual({ ...afterSwap[id], xPct: 0 }, { ...beforeSwap[id], xPct: 0 }, 'swapping twice restores all other transforms and three-point curves')
      }
      const saved = await state(page)
      assert.equal(saved.a.warpPoints?.length, 3)
      assert.equal(saved.b.warpPoints?.length, 3)
      await right.press('Enter')
      await page.getByRole('button', { name: 'Increase lash size', exact: true }).waitFor()
      // Save follows the variable-height toolbar, as it does in the real flow.
      // Deselecting during pointerdown must not move the button before its click.
      await page.getByRole('button', { name: 'Save preview', exact: true }).click()
      await left.waitFor({ state: 'detached' })
      assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('lash-preview-regression')!)), saved)
      await page.getByRole('button', { name: 'Reopen preview', exact: true }).click()
      await left.waitFor()
      await waitForLashAssets(page)
      for (const [id, sticker] of [['a', left], ['b', right]] as const) {
        await sticker.press('Enter')
        const reopened = await readPoints(sticker)
        assert.equal(reopened.length, 3)
        reopened.forEach((point, index) => {
          const expected = saved[id].warpPoints![index]
          assert.ok(Math.abs(point.xPct - expected.xPct) < 0.0001 && Math.abs(point.yPct - expected.yPct) < 0.0001, 'save/reopen retains each adjustment within CSS percentage precision')
        })
      }
      await settleCanvas(page)
      if (scenario.touch) {
        await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
        await page.screenshot({ path: '/private/tmp/glamhour-pdf-review/lash-preview-three-controls.png', fullPage: false })
      }
      assert.deepEqual(errors, [], 'no browser exceptions')
      assert.deepEqual(unexpected, [], 'the test does not access APIs or external data')
      console.log(`PASS ${scenario.name}: three isolated curve controls, movement, size, rotation, and save/reopen`)
    } finally { await context.close() }
  }
} finally {
  await browser?.close()
  await server.close()
}
