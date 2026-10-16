#!/usr/bin/env node
// Transform the actual API client with Vite; intercept every HTTP request locally.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  cacheDir: 'node_modules/.vite-service-catalog-pagination',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://catalog-test.invalid/api') },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
try {
  const { glamhourApi } = await server.ssrLoadModule('/src/services/glamhour-api.ts')
  const catalog = Array.from({ length: 237 }, (_, index) => ({
    id: `service-${index}`, name: `Service ${index}`, category_id: 'nails', is_active: true,
  }))
  const requests = []
  let scenario = 'success'
  let activeCatalog = catalog
  globalThis.fetch = async input => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'http://catalog-test.invalid')
    assert.equal(url.pathname, '/api/salons/test-salon/services')
    assert.equal(url.searchParams.get('limit'), '100')
    const offset = Number(url.searchParams.get('offset'))
    requests.push({ offset, publicOnly: url.searchParams.get('publicOnly'), includeInactive: url.searchParams.get('includeInactive') })
    if (scenario === 'failure' && offset === 100) {
      return Response.json({ error: { code: 'CATALOG_UNAVAILABLE', message: 'Next catalog page failed.' } }, { status: 503 })
    }
    const data = scenario === 'repeat' && offset > 0 ? activeCatalog.slice(0, 100) : activeCatalog.slice(offset, offset + 100)
    return Response.json({ data })
  }

  assert.deepEqual(await glamhourApi.services('test-salon', { publicOnly: true }), catalog)
  assert.deepEqual(requests, [0, 100, 200].map(offset => ({ offset, publicOnly: 'true', includeInactive: null })))
  console.log('PASS complete service catalog spans three pages and preserves publicOnly')

  requests.length = 0
  assert.deepEqual(await glamhourApi.services('test-salon', { includeInactive: true }), catalog)
  assert.deepEqual(requests, [0, 100, 200].map(offset => ({ offset, publicOnly: null, includeInactive: 'true' })))
  console.log('PASS settings catalog preserves includeInactive on every page without adding a public-only filter')

  requests.length = 0
  activeCatalog = catalog.slice(0, 100)
  assert.deepEqual(await glamhourApi.services('test-salon'), activeCatalog)
  assert.deepEqual(requests, [0, 100].map(offset => ({ offset, publicOnly: null, includeInactive: null })))
  console.log('PASS exact page-size catalog ends on empty page; optional public filter stays omitted')

  requests.length = 0
  activeCatalog = []
  assert.deepEqual(await glamhourApi.services('test-salon'), [])
  assert.deepEqual(requests, [{ offset: 0, publicOnly: null, includeInactive: null }])
  console.log('PASS empty catalog terminates after one request')

  requests.length = 0
  activeCatalog = catalog
  scenario = 'failure'
  await assert.rejects(glamhourApi.services('test-salon', { publicOnly: true }), error => error.status === 503 && error.message === 'Next catalog page failed.')
  assert.deepEqual(requests, [0, 100].map(offset => ({ offset, publicOnly: 'true', includeInactive: null })))
  console.log('PASS next-page failure rejects entire catalog instead of returning a partial result')

  requests.length = 0
  scenario = 'repeat'
  await assert.rejects(glamhourApi.services('test-salon'), /catalog changed while loading/)
  assert.deepEqual(requests, [0, 100].map(offset => ({ offset, publicOnly: null, includeInactive: null })))
  console.log('PASS repeated page fails closed without looping or publishing duplicate assignments')

  // Exercise the real HTTP client for settings mutations, including the selected salon.
  globalThis.window = {
    sessionStorage: { getItem: key => key === 'glamhour:active-salon-id' ? 'selected-salon' : null },
  }
  const createInput = {
    categoryId: 'cosmetology', name: 'Custom facial', description: 'Salon-specific service',
    durationMinutes: 45, priceMinor: 2995, currencyCode: 'MXN', isPubliclyBookable: false,
  }
  const updateInput = { name: 'Updated facial', priceMinor: 0, isActive: false }
  const savedService = { id: 'service-9', name: 'Saved service', is_active: false }
  const mutations = [
    { method: 'POST', path: '/settings/services', body: createInput, result: savedService, invoke: salonId => glamhourApi.createServiceInSettings(createInput, salonId) },
    { method: 'PATCH', path: '/services/service-9', body: updateInput, result: savedService, invoke: salonId => glamhourApi.updateService('service-9', updateInput, salonId) },
    { method: 'DELETE', path: '/services/service-9', body: undefined, result: { deleted: true }, invoke: salonId => glamhourApi.deleteService('service-9', salonId) },
  ]
  for (const salonId of [undefined, 'explicit-salon']) {
    for (const mutation of mutations) {
      let calls = 0
      globalThis.fetch = async (input, init) => {
        calls += 1
        assert.equal(String(input), `http://catalog-test.invalid/api/salons/${salonId ?? 'selected-salon'}${mutation.path}`)
        assert.equal(init.method, mutation.method)
        assert.equal(new Headers(init.headers).get('Content-Type'), 'application/json')
        assert.deepEqual(init.body === undefined ? undefined : JSON.parse(init.body), mutation.body)
        return Response.json({ data: mutation.result })
      }
      assert.deepEqual(await mutation.invoke(salonId), mutation.result)
      assert.equal(calls, 1)
    }
  }
  console.log('PASS settings POST, partial PATCH, and DELETE preserve payloads and scope requests to selected or explicit salon')
} finally {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  await server.close()
}
