#!/usr/bin/env -S npx tsx
// Uses synthetic clinical data and a generated photo. No real API reads or writes.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const photo = `<svg xmlns="http://www.w3.org/2000/svg" width="361" height="431"><rect width="361" height="431" fill="#e5e7eb"/><ellipse cx="180" cy="230" rx="120" ry="175" fill="#e7c4ab"/><path d="M75 170Q108 145 145 170M215 170Q250 145 285 170" fill="none" stroke="#663f35" stroke-width="5"/><circle cx="110" cy="170" r="8"/><circle cx="250" cy="170" r="8"/><path d="M150 310Q180 325 210 310" fill="none" stroke="#b76e6e" stroke-width="5"/></svg>`
const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClientClinicalFormsDialog } from '/src/pages/app/client-clinical-forms/ClientClinicalFormsDialog.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import '/src/index.css';
const scenario = new URLSearchParams(location.search).get('scenario');
const client = { id: 'synthetic-client', full_name: 'Visual Test Client', phone: '5550101', email: 'visual@example.test', date_of_birth: null };
const map = [8, 9, 10, 11, 12, 13, 14].map((position, index) => ({ position, length: 6 + index }));
const profile = (category, details) => ({ id: category, category, status: 'active', valid_from: '2026-01-01', valid_until: '2035-01-01', is_valid: true, notes: 'Preserved clinical note', form_details: details });
const photoKey = scenario === 'unavailable' ? 'missing-clinical-test.svg' : 'clinical-visual-test.svg';
window.forms = [profile('lashes', {
  style: 'Anime', variant: 'Classic', curl: 'C', thickness: '0.07', defaultLength: '12',
  lashMap: { rightEye: map, leftEye: map.map(entry => ({ ...entry, length: entry.length + 1 })) },
  leftSide: 63, rightSide: 63, lashMapLength: 12,
  photoPreviewUrl: 'http://127.0.0.1:3001/api/media/' + photoKey, photoStorageKey: photoKey,
  lashPreviewStickers: {
    a: { assetSide: 'left', xPct: 30.5, yPct: 39.4, scale: 1.05, rotationDeg: -8, warpPoints: [{ xPct: 5, yPct: 65 }, { xPct: 50, yPct: 40 }, { xPct: 95, yPct: 65 }] },
    b: { assetSide: 'right', xPct: 69.3, yPct: 39.4, scale: 1.1, rotationDeg: 9 },
  },
}), profile('cosmetology', { skin_type: 'Dry', currentMedications: 'None', faceAnnotations: [
  { x: 69.7502845941588, y: 64.92354705881984, type: 'Active acne' },
  { x: 32.82098104787428, y: 67.2581469330143, type: 'Active acne' },
  { x: 50, y: 38, type: 'Pigmentation' },
], skinAlterationNotes: 'Retain the clinical assessment' })];
if (scenario === 'legacy-photo') {
  const details = window.forms[0].form_details;
  details.photoPreview = details.photoPreviewUrl;
  delete details.photoPreviewUrl;
  delete details.photoStorageKey;
  delete details.lashPreviewStickers;
}
if (scenario === 'legacy-stickers') {
  delete window.forms[0].form_details.lashPreviewStickers.a.rotationDeg;
  delete window.forms[0].form_details.lashPreviewStickers.b.rotationDeg;
}
window.originalForms = JSON.stringify(window.forms);
window.mutations = [];
glamhourApi.clientClinicalForms = async () => window.forms;
glamhourApi.categories = async () => [{ code: 'lashes', name: 'Lashes', is_active: true }, { code: 'cosmetology', name: 'Cosmetology', is_active: true }];
glamhourApi.saveClientClinicalForm = async (...args) => { window.mutations.push(args); throw new Error('Read-only summary cannot save'); };
createRoot(document.getElementById('root')).render(React.createElement(ClientClinicalFormsDialog, { client, onClose() {} }));
</script></body></html>`

const server = await createServer({
  logLevel: 'error', cacheDir: 'node_modules/.vite-clinical-visual-summary',
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'clinical-summary-regression', configureServer(vite) {
    vite.middlewares.use('/__clinical_visual_summary__', async (req, res, next) => {
      try {
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html))
      } catch (error) { next(error) }
    })
  } }],
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  for (const scenario of ['mobile', 'desktop', 'unavailable', 'legacy-photo', 'legacy-stickers']) {
    const context = await browser.newContext({ viewport: scenario === 'desktop' ? { width: 1280, height: 900 } : { width: 320, height: 740 } })
    context.setDefaultTimeout(15000)
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/clinical-visual-test.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: photo })
      if (url.pathname.endsWith('/missing-clinical-test.svg')) return route.fulfill({ status: 404, body: '' })
      return url.origin === origin ? route.continue() : route.abort('blockedbyclient')
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto(`${origin}/__clinical_visual_summary__?scenario=${scenario}`)
      const dialog = page.getByRole('dialog', { name: 'Clinical forms', exact: true })
      await dialog.getByRole('region', { name: 'Lashes clinical form', exact: true }).getByRole('button', { name: 'View form', exact: true }).click()
      const rightMap = dialog.getByRole('img', { name: 'Right eye lash map', exact: true })
      const leftMap = dialog.getByRole('img', { name: 'Left eye lash map', exact: true })
      await rightMap.waitFor()
      assert.equal(await rightMap.getByLabel('Zone 8: 6 mm', { exact: true }).count(), 1)
      assert.equal(await leftMap.getByLabel('Zone 8: 7 mm', { exact: true }).count(), 1)
      assert.equal(await rightMap.getByLabel('Zone 14: 12 mm', { exact: true }).count(), 1)
      assert.equal(await leftMap.getByLabel('Zone 14: 13 mm', { exact: true }).count(), 1)
      if (scenario === 'mobile') await rightMap.locator('../..').screenshot({ path: '/tmp/glamhour-clinical-lash-map-summary.png' })
      assert.equal(await dialog.getByText(/^(X Pct|Y Pct|Rotation Deg|Lash Preview Stickers|Left Side|Right Side|Lash Map Length)$/).count(), 0)
      assert.equal(await dialog.getByText('Preserved clinical note', { exact: true }).count(), 1)
      const photoCard = dialog.getByRole('heading', { name: 'Reference photo', exact: true }).locator('..')
      await photoCard.scrollIntoViewIfNeeded()
      if (scenario === 'unavailable') {
        await photoCard.getByText('Photo unavailable', { exact: true }).waitFor()
        assert.equal(await photoCard.locator('img').count(), 0, 'broken photo displays a useful state rather than a broken image')
      } else if (scenario === 'legacy-photo') {
        const reference = photoCard.getByRole('img', { name: 'Clinical reference', exact: true })
        await reference.waitFor()
        assert.equal(await reference.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0), true, 'legacy photo-only details still load')
        assert.equal(await dialog.getByText('http://127.0.0.1:3001/api/media/clinical-visual-test.svg', { exact: true }).count(), 0, 'legacy photo URL is not displayed as a clinical value')
        assert.equal(await photoCard.locator('canvas').count(), 0, 'a reference without saved fitting does not invent a lash preview')
      } else {
        const preview = photoCard.getByRole('img', { name: 'Lash style preview', exact: true })
        await preview.waitFor()
        await page.waitForFunction(() => [...document.querySelectorAll('canvas')].length === 2)
        assert.equal(await photoCard.getByRole('button').count(), 0, 'saved preview has no editing controls')
        assert.equal(await photoCard.locator('[tabindex="0"]').count(), 0, 'saved stickers are not keyboard editable')
        assert.equal(await photoCard.locator('canvas').count(), 2, 'both saved eyes use the lash renderer')
        const placements = await photoCard.locator('.lash-preview-sticker').evaluateAll(elements => elements.map(element => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top, transform: (element as HTMLElement).style.transform })))
        assert.equal(placements[0].left, '30.5%')
        assert.equal(placements[1].left, '69.3%')
        assert.ok(placements[0].transform.includes(scenario === 'legacy-stickers' ? '0deg' : '-8deg'))
        assert.ok(placements[1].transform.includes(scenario === 'legacy-stickers' ? '0deg' : '9deg'))
        await preview.click({ force: true })
        assert.equal(await photoCard.getByRole('button').count(), 0)
        if (scenario === 'mobile') await photoCard.screenshot({ path: '/tmp/glamhour-clinical-lash-summary.png' })
      }
      await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()
      await dialog.getByRole('region', { name: 'Cosmetology clinical form', exact: true }).getByRole('button', { name: 'View form', exact: true }).click()
      const faceMap = dialog.getByRole('img', { name: 'Saved face map', exact: true })
      await faceMap.scrollIntoViewIfNeeded()
      assert.equal(await faceMap.getByLabel('Active acne', { exact: true }).count(), 2)
      assert.equal(await faceMap.getByLabel('Pigmentation', { exact: true }).count(), 1)
      assert.equal(await dialog.getByText('Active acne (2)', { exact: true }).count(), 1)
      assert.equal(await dialog.getByText('69.7502845941588', { exact: true }).count(), 0)
      assert.equal(await dialog.getByText('Retain the clinical assessment', { exact: true }).count(), 1)
      const marker = faceMap.getByLabel('Active acne', { exact: true }).first()
      assert.equal(await marker.evaluate(element => (element as HTMLElement).style.left), '69.7503%')
      if (scenario === 'mobile') await faceMap.locator('..').screenshot({ path: '/tmp/glamhour-clinical-face-summary.png' })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'summary fits a narrow phone viewport')
      assert.deepEqual(await page.evaluate(() => (window as unknown as { mutations: unknown[] }).mutations), [])
      assert.equal(await page.evaluate(() => JSON.stringify((window as unknown as { forms: unknown }).forms) === (window as unknown as { originalForms: string }).originalForms), true, 'viewing saved forms leaves persisted details unchanged')
      assert.deepEqual(errors, [])
      console.log(`PASS clinical visual summary: ${scenario}`)
    } finally { await context.close() }
  }
} finally {
  await browser?.close()
  await server.close()
}
