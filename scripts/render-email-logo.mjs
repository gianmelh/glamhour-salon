import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Rasterize the existing app mark without changing its paths, colors, or filters.
// The transparent 4× PNG is intended for a 48×46 CSS-pixel inline email image.
const source = new URL('../public/favicon.svg', import.meta.url)
const destination = new URL('../server/assets/glamhour-mark.png', import.meta.url)
const svg = await readFile(source, 'utf8')
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  headless: true,
})

try {
  const page = await browser.newPage({
    viewport: { width: 48, height: 46 },
    deviceScaleFactor: 4,
  })
  await page.route('**/*', (route) => route.abort())
  await page.setContent(`<!doctype html><html><head><style>
    html, body { margin: 0; width: 48px; height: 46px; background: transparent; }
    svg { display: block; }
  </style></head><body>${svg}</body></html>`)
  await mkdir(new URL('../server/assets/', import.meta.url), { recursive: true })
  const png = await page.screenshot({
    path: fileURLToPath(destination),
    omitBackground: true,
    animations: 'disabled',
  })
  if (png.readUInt32BE(16) !== 192 || png.readUInt32BE(20) !== 184) {
    throw new Error('The email logo must be 192×184 pixels (4× its display size).')
  }
  console.log(`Rendered ${fileURLToPath(destination)} (192×184, transparent PNG)`)
} finally {
  await browser.close()
}
