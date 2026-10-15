import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'

// All Google and registration traffic stays mocked, even with a configured API key.
const cacheDir = await mkdtemp(join(tmpdir(), 'glamhour-registration-maps-'))
let server
let baseUrl
let browser

async function createPage(mode = 'healthy') {
  const context = await browser.newContext({ ...devices['iPhone 13'], browserName: undefined })
  const page = await context.newPage()
  const pageErrors = []
  const submissions = []
  let mapsScriptRequests = 0
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/register') && route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON())
      return route.fulfill({ json: { data: { user: { id: 'test-user' }, salon: { id: 'test-salon', name: 'Test salon' } } } })
    }
    if (url.origin === 'https://maps.googleapis.com' && url.pathname === '/maps/api/js') {
      mapsScriptRequests += 1
      if (mode === 'script-error-retry' && mapsScriptRequests === 1) return route.abort('failed')
      // Exercise our actual script/callback loader, but serve a local fixture:
      // no Google script, RPC, key, or billing request ever leaves this test.
      const callback = url.searchParams.get('callback')
      assert.ok(callback, 'Maps loader declares its readiness callback')
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: `window.__installMapsSdk(); window[${JSON.stringify(callback)}]();`,
      })
    }
    if (url.origin !== new URL(baseUrl).origin) return route.abort()
    if (url.pathname === '/src/pages/auth/RegistrationPage.tsx') {
      const response = await route.fetch()
      const source = await response.text()
      // Localhost normally bypasses Maps. Exercise the production branch without a real key.
      const sourceWithMaps = source
        .replace(/const googleMapsApiKey = [^\n]+;/, "const googleMapsApiKey = 'test-key';")
        .replace('const useGoogleMapsLocation = Boolean(googleMapsApiKey) && !canUseManualLocationFallback();', 'const useGoogleMapsLocation = true;')
      assert.ok(sourceWithMaps.includes("const googleMapsApiKey = 'test-key';"), 'Could not replace the Maps key in the dev module')
      assert.ok(sourceWithMaps.includes('const useGoogleMapsLocation = true;'), 'Could not enable the Maps branch in the dev module')
      return route.fulfill({ response, body: sourceWithMaps })
    }
    return route.continue()
  })
  await page.addInitScript((initialMode) => {
    sessionStorage.setItem('glamhour:sign-up-draft', JSON.stringify({
      salonName: 'Test salon', email: 'test@example.com', password: 'local-pass',
      confirmPassword: 'local-pass', acceptedTerms: true, authProvider: 'email',
    }))
    window.__mapsMode = initialMode
    window.__mapsElements = []
    window.__pendingMapsLoads = []
    window.__resolvedMapsLoads = 0
    class TestAutocomplete extends HTMLElement {
      constructor() {
        super()
        const shadow = this.attachShadow({ mode: 'open' })
        shadow.innerHTML = '<style>:host([expanded]) { position: fixed; inset: 0; } input { font-size: inherit; }</style><input part="input" aria-label="Search salon location">'
        window.__mapsElements.push(this)
      }
      set placeholder(value) { this.shadowRoot.querySelector('input').placeholder = value }
      get value() { return this.shadowRoot.querySelector('input').value }
    }
    customElements.define('test-place-autocomplete', TestAutocomplete)
    window.__installMapsSdk = () => {
      window.google = { maps: { importLibrary: async () => {
        if (initialMode === 'initialization-error') throw new Error('Simulated Maps failure')
        if (initialMode === 'delayed') await new Promise((resolve) => { window.__pendingMapsLoads.push(resolve) })
        window.__resolvedMapsLoads += 1
        return { PlaceAutocompleteElement: TestAutocomplete }
      } } }
    }
    if (!['late-auth-error', 'script-error-retry'].includes(initialMode)) window.__installMapsSdk()
  }, mode)
  await page.goto(`${baseUrl}/register`)
  return { context, page, pageErrors, submissions, mapsScriptRequests: () => mapsScriptRequests }
}

async function uploadDocument(page) {
  await page.locator('input[type=file]').setInputFiles({ name: 'ownership.png', mimeType: 'image/png', buffer: Buffer.from('local test fixture') })
  await page.getByText('ownership.png', { exact: true }).waitFor()
}

async function selectPlace(page, reject = false) {
  await page.locator('test-place-autocomplete').evaluate((element, shouldReject) => {
    const event = new Event('gmp-select')
    event.placePrediction = { toPlace: () => ({
      id: 'test-place', formattedAddress: '123 Test Street',
      fetchFields: async () => { if (shouldReject) throw new Error('Simulated details failure') },
    }) }
    element.dispatchEvent(event)
  }, reject)
}

async function checkSubmission(fixture, expectedLocation) {
  await fixture.page.getByRole('button', { name: 'Submit', exact: true }).click()
  await fixture.page.getByText('Account created!', { exact: true }).waitFor()
  assert.equal(fixture.submissions.length, 1)
  assert.deepEqual(fixture.submissions[0].location, expectedLocation)
  assert.equal(fixture.submissions[0].document.originalFilename, 'ownership.png')
  assert.deepEqual(fixture.pageErrors, [])
}

try {
  server = process.env.TEST_BASE_URL ? undefined : await createServer({
    cacheDir, logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: true },
  })
  if (server) await new Promise((resolve, reject) => {
    server.httpServer.once('error', reject)
    server.httpServer.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = process.env.TEST_BASE_URL ?? `http://127.0.0.1:${server.httpServer.address().port}`
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname), 'Use a local dev server')
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })

  const healthy = await createPage()
  await uploadDocument(healthy.page)
  await healthy.page.getByRole('textbox', { name: 'Search salon location' }).fill('123')
  const widgetStyles = await healthy.page.locator('test-place-autocomplete').evaluate((element) => {
    element.setAttribute('expanded', '')
    const position = getComputedStyle(element).position
    const fontSize = getComputedStyle(element.shadowRoot.querySelector('input')).fontSize
    element.removeAttribute('expanded')
    return { position, fontSize }
  })
  assert.deepEqual(widgetStyles, { position: 'fixed', fontSize: '16px' }, 'App CSS must allow the mobile widget to position itself without iOS input zoom')
  await selectPlace(healthy.page)
  await checkSubmission(healthy, { formattedAddress: '123 Test Street', placeId: 'test-place' })
  await healthy.context.close()

  for (const mode of ['initialization-error', 'search-error', 'details-error']) {
    const fixture = await createPage(mode)
    await uploadDocument(fixture.page)
    if (mode !== 'initialization-error') {
      await fixture.page.getByRole('textbox', { name: 'Search salon location' }).fill('123')
      if (mode === 'search-error') {
        await fixture.page.locator('test-place-autocomplete').dispatchEvent('gmp-error')
      } else {
        await selectPlace(fixture.page, true)
      }
    }
    await fixture.page.getByRole('alert').waitFor()
    const address = fixture.page.locator('input[placeholder="Search salon location..."]')
    await address.waitFor()
    assert.equal(await address.inputValue(), mode === 'initialization-error' ? '' : '123')
    assert.equal(await address.evaluate((input) => getComputedStyle(input).fontSize), '16px')
    // Before the fix, the first character cleared the error and replaced this input
    // with an empty Google container that was never initialized again.
    await address.evaluate((input) => {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
    await address.pressSequentially(' Main Street')
    assert.equal(await address.inputValue(), `${mode === 'initialization-error' ? '' : '123'} Main Street`)
    assert.equal(await fixture.page.locator('test-place-autocomplete').count(), 0)
    await fixture.page.getByText('ownership.png', { exact: true }).waitFor()
    await checkSubmission(fixture, { formattedAddress: `${mode === 'initialization-error' ? '' : '123 '}Main Street` })
    await fixture.context.close()
  }

  const lateAuth = await createPage('late-auth-error')
  await uploadDocument(lateAuth.page)
  await lateAuth.page.getByRole('textbox', { name: 'Search salon location' }).fill('123')
  assert.equal(lateAuth.mapsScriptRequests(), 1, 'StrictMode effects share one real loader request')
  await lateAuth.page.evaluate(() => {
    if (typeof window.gm_authFailure !== 'function') throw new Error('Authentication failure bridge was not installed')
    // Authentication can fail after the callback already resolved the loader.
    window.gm_authFailure()
  })
  await lateAuth.page.getByRole('alert').waitFor()
  const lateAuthAddress = lateAuth.page.locator('input[placeholder="Search salon location..."]')
  await lateAuthAddress.waitFor()
  assert.equal(await lateAuthAddress.inputValue(), '123')
  assert.equal(await lateAuth.page.locator('test-place-autocomplete').count(), 0, 'late authentication failure removes the querying widget')
  await lateAuthAddress.fill('123 Manual Street')
  await lateAuth.page.evaluate(() => {
    const staleWidget = window.__mapsElements.at(-1)
    const event = new Event('gmp-select')
    event.placePrediction = { toPlace: () => ({
      id: 'stale-place', formattedAddress: 'Stale result must be ignored', fetchFields: async () => {},
    }) }
    staleWidget.dispatchEvent(event)
    staleWidget.dispatchEvent(new Event('gmp-error'))
    window.gm_authFailure()
  })
  assert.equal(await lateAuthAddress.inputValue(), '123 Manual Street', 'stale widget events and repeated auth failure cannot replace manual input')
  await lateAuth.page.getByText('ownership.png', { exact: true }).waitFor()
  await checkSubmission(lateAuth, { formattedAddress: '123 Manual Street' })
  await lateAuth.context.close()

  const scriptRetry = await createPage('script-error-retry')
  await uploadDocument(scriptRetry.page)
  await scriptRetry.page.getByRole('alert').waitFor()
  const retryAddress = scriptRetry.page.locator('input[placeholder="Search salon location..."]')
  await retryAddress.fill('456 Manual Street')
  assert.equal(scriptRetry.mapsScriptRequests(), 1)
  const retryResult = await scriptRetry.page.evaluate(async () => {
    const { loadGoogleMapsPlaces } = await import('/src/lib/googleMaps.ts')
    let timer
    try {
      await Promise.race([
        loadGoogleMapsPlaces('test-key'),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Loader retry never settled')), 3_000) }),
      ])
      return { ready: typeof window.google?.maps?.importLibrary === 'function' }
    } catch (error) {
      return { error: error.message }
    } finally {
      clearTimeout(timer)
    }
  })
  assert.deepEqual(retryResult, { ready: true }, 'retry must not wait for events on an already-failed script')
  assert.equal(scriptRetry.mapsScriptRequests(), 2, 'retry creates one fresh loader request')
  assert.equal(await scriptRetry.page.locator('script[data-google-maps-places]').count(), 1, 'failed loader script is removed before replacement')
  assert.equal(await scriptRetry.page.locator('test-place-autocomplete').count(), 0, 'loader recovery does not override the chosen manual fallback')
  assert.equal(await retryAddress.inputValue(), '456 Manual Street')
  await checkSubmission(scriptRetry, { formattedAddress: '456 Manual Street' })
  await scriptRetry.context.close()

  const delayed = await createPage('delayed')
  await delayed.page.waitForFunction(() => window.__pendingMapsLoads.length > 0)
  await delayed.page.getByRole('button', { name: 'Back', exact: true }).click()
  await delayed.page.locator('.google-place-autocomplete-shell').waitFor({ state: 'detached' })
  await delayed.page.evaluate(() => window.__pendingMapsLoads.forEach((resolve) => resolve()))
  await delayed.page.waitForFunction(() => window.__resolvedMapsLoads === window.__pendingMapsLoads.length)
  assert.equal(await delayed.page.evaluate(() => window.__mapsElements.length), 0, 'Cancelled loads must not create or mount widgets')
  assert.deepEqual(delayed.pageErrors, [])
  await delayed.context.close()

  const outOfOrder = await createPage('delayed')
  // React StrictMode starts a replacement effect before the first async load finishes.
  await outOfOrder.page.waitForFunction(() => window.__pendingMapsLoads.length === 2)
  await outOfOrder.page.evaluate(() => window.__pendingMapsLoads[1]())
  await outOfOrder.page.locator('test-place-autocomplete').waitFor()
  await outOfOrder.page.getByRole('textbox', { name: 'Search salon location' }).fill('Keep this address')
  await outOfOrder.page.evaluate(() => window.__pendingMapsLoads[0]())
  await outOfOrder.page.waitForFunction(() => window.__resolvedMapsLoads === 2)
  assert.equal(await outOfOrder.page.locator('test-place-autocomplete').count(), 1)
  assert.equal(await outOfOrder.page.getByRole('textbox', { name: 'Search salon location' }).inputValue(), 'Keep this address')
  assert.equal(await outOfOrder.page.evaluate(() => window.__mapsElements.length), 1)
  assert.deepEqual(outOfOrder.pageErrors, [])
  await outOfOrder.context.close()
  console.log('Registration Maps regression checks passed: mobile CSS, selection, three fallbacks, late auth failure, failed-script retry, document retention, cancellation and reversed load order.')
} finally {
  await browser?.close()
  await server?.close()
  await rm(cacheDir, { recursive: true, force: true })
}
