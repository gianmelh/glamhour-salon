import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Export sizes from the owner's unchanged artwork. No tracing, recoloring or cropping.
const source = await readFile(new URL('../public/brand/glamhour-logo.jpg', import.meta.url))
const imageUrl = `data:image/jpeg;base64,${source.toString('base64')}`
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

try {
  const page = await browser.newPage()
  await page.route('**/*', (route) => route.abort())
  await page.setContent('<!doctype html><html><body></body></html>')
  for (const [size, relativePath] of [
    [32, '../public/glamhour-favicon.png'],
    [180, '../public/glamhour-touch-icon.png'],
    [192, '../server/assets/glamhour-logo.png'],
  ]) {
    const dataUrl = await page.evaluate(async ({ size, imageUrl }) => {
      const image = new Image()
      image.src = imageUrl
      await image.decode()
      if (image.naturalWidth !== image.naturalHeight) throw new Error('Expected square source artwork.')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, size, size)
      return canvas.toDataURL('image/png')
    }, { size, imageUrl })
    const destination = new URL(relativePath, import.meta.url)
    const png = Buffer.from(dataUrl.split(',')[1], 'base64')
    if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) throw new Error('Unexpected PNG dimensions.')
    await mkdir(new URL('.', destination), { recursive: true })
    await writeFile(destination, png)
    console.log(`Exported ${fileURLToPath(destination)} (${size}×${size})`)
  }
  // Keep the previous favicon URL compatible without retaining the old lightning mark.
  await writeFile(new URL('../public/favicon.svg', import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280" viewBox="0 0 1280 1280"><image width="1280" height="1280" href="${imageUrl}"/></svg>\n`)
} finally {
  await browser.close()
}
