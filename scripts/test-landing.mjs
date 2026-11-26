import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// Frontend-only checks: never load .env or connect to the app API / database.
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'glamhour-landing-'))
let server
let browser
try {
  server = await createServer({
    envDir: temporaryDirectory,
    cacheDir: join(temporaryDirectory, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0 },
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api-disabled') },
  })
  await server.listen()
  const baseUrl = server.resolvedUrls.local[0]
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  const blockedRequests = []
  page.on('pageerror', (error) => errors.push(error.message))
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(baseUrl).origin || url.pathname.startsWith('/api-disabled')) {
      blockedRequests.push(url.pathname)
      return route.abort()
    }
    return route.continue()
  })

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(baseUrl)
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    const overflow = await page.locator('.landing').evaluate((root) => [...root.querySelectorAll('*')].filter((element) => {
      if (element.classList.contains('landing-skip') || !element.getClientRects().length) return false
      const rect = element.getBoundingClientRect()
      return rect.right > innerWidth + 1 || rect.left < -1
    }).map((element) => element.className))
    assert.deepEqual(overflow, [], `No content overflow at ${width}px`)
    assert.equal(await page.locator('.landing-price').allTextContents().then((items) => items.join('|')), '$0to get started|$14.99/ month|$119.99/ year')
    assert.equal(await page.locator('.landing img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true)
    if (process.env.LANDING_SCREENSHOT_DIR && [1440, 390].includes(width)) {
      await page.screenshot({ path: join(process.env.LANDING_SCREENSHOT_DIR, `landing-${width}.png`), fullPage: true })
    }
    if (width < 761) {
      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Pricing', exact: true }).click()
      assert.equal(new URL(page.url()).hash, '#pricing')
      assert.equal(await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded'), 'false')
    }
    await page.getByText('How does Premium billing work?', { exact: true }).click()
    assert.equal(await page.locator('details[open]').count(), 1)
  }

  // A policy read from the homepage must not accept terms or write sign-up state.
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' }).click()
  await page.getByRole('heading', { name: 'Privacy Policy', exact: true }).waitFor()
  await page.waitForFunction(() => window.scrollY === 0)
  assert.equal(await page.getByRole('button', { name: /I accept/ }).count(), 0)
  assert.equal(await page.evaluate(() => sessionStorage.length), 0)
  await page.getByRole('navigation', { name: 'Legal documents' }).getByRole('link', { name: 'Terms & Conditions' }).click()
  await page.getByRole('heading', { name: 'Terms & Conditions', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /I accept/ }).count(), 0)
  await page.getByRole('link', { name: 'Back to GLAMHOUR' }).click()
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForFunction(() => window.scrollY === 0)
  await page.getByRole('link', { name: 'Start your salon’s next chapter' }).click()
  assert.equal(new URL(page.url()).pathname, '/signup')
  await page.goto(new URL('/terms', baseUrl).href)
  assert.equal(await page.getByRole('button', { name: 'I accept the terms' }).count(), 1)
  assert.equal(await page.getByRole('link', { name: 'Back to sign up' }).count(), 1)
  await page.goto(baseUrl)
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Log in' }).click()
  await page.getByRole('heading', { name: 'Log in to your salon' }).waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(blockedRequests, [], 'Public browsing must not need API or external requests')
  console.log('Landing checks passed: 5 widths, navigation, mobile menu, FAQs, pricing, policy reading, registration and login. No API or external requests.')
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporaryDirectory, { recursive: true, force: true })
}
