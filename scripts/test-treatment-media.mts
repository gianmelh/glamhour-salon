#!/usr/bin/env -S npx tsx
// URL-only regressions: no API server, database, network requests, or real uploads.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveTreatmentMediaUrl, resolveTreatmentPhotoUrl } from '../src/lib/treatmentMedia.ts'

globalThis.fetch = async () => { throw new Error('Network requests are forbidden in treatment media tests') }

const storageKey = 'salons/test-salon/treatment-media/lashes/reference.jpg'

if (process.argv.includes('--server-media')) {
  // Importing server config must never read the application's .env.
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null')
  assert.equal(process.env.DATABASE_URL, 'postgresql://unused:unused@127.0.0.1:1/never-connect')
  const { mediaPublicUrl } = await import('../server/services/media-storage.ts')
  const expectedBase = process.env.MEDIA_PUBLIC_BASE?.replace(/\/+$/, '') ?? '/api'
  assert.equal(mediaPublicUrl(storageKey), `${expectedBase}/media/${storageKey}`)
  process.exit(0)
}

let failed = 0
function check(name: string, run: () => void) {
  try {
    run()
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

const productionApi = 'https://api.salon.example/api'
const productionPhoto = `${productionApi}/media/${storageKey}`
const relativePhoto = `/api/media/${storageKey}`

check('new relative upload URLs use the configured production API origin', () => {
  assert.equal(resolveTreatmentMediaUrl({ url: relativePhoto }, productionApi), productionPhoto)
  assert.equal(resolveTreatmentMediaUrl({ url: `/media/${storageKey}` }, `${productionApi}///`), productionPhoto)
  assert.equal(resolveTreatmentMediaUrl({ url: relativePhoto }, '/api/'), relativePhoto)
  assert.equal(resolveTreatmentMediaUrl({ storageKey }, '/backend/api'), `/backend/api/media/${storageKey}`)
  assert.equal(resolveTreatmentMediaUrl({ url: '/preview/reference.svg' }, productionApi), '/preview/reference.svg',
    'page-local reference images must not be redirected to a different API origin')
})

check('persisted localhost and previous API URLs load from the current API', () => {
  for (const savedBase of ['http://127.0.0.1:3001/api', 'http://localhost:3001/api', 'http://[::1]:3001/api']) {
    const media = { url: `${savedBase}/media/${storageKey}` }
    assert.equal(resolveTreatmentMediaUrl(media, productionApi), productionPhoto)
    assert.equal(resolveTreatmentMediaUrl(media, '/api'), relativePhoto)
    assert.equal(media.url, `${savedBase}/media/${storageKey}`, 'resolution never changes a saved record')
  }
  assert.equal(resolveTreatmentMediaUrl({ url: `https://old-api.salon.example/api/media/${storageKey}`, storageKey }, productionApi), productionPhoto)
})

check('storage keys recover missing URLs and override obsolete internal media paths', () => {
  for (const media of [{ storageKey }, { storage_key: storageKey }, { url: '', storageKey }, { url: null, storage_key: `/${storageKey}` }]) {
    assert.equal(resolveTreatmentMediaUrl(media, productionApi), productionPhoto)
  }
  assert.equal(resolveTreatmentMediaUrl({ url: 'http://localhost:3001/api/media/obsolete.jpg', storageKey }, productionApi), productionPhoto)
})

check('external CDN, inline image, and active blob previews remain intact', () => {
  const urls = [
    'https://cdn.salon.example/photos/reference.jpg?signature=a%2Fb&expires=9999#preview',
    'data:image/png;base64,iVBORw0KGgo=',
    'blob:https://salon.example/4aee15d8-a46c-4d43-a420-72e301815111',
  ]
  for (const url of urls) assert.equal(resolveTreatmentMediaUrl({ url, storageKey }, productionApi), url)
  const signedCdn = 'https://cdn.salon.example/api/media/reference.jpg?signature=a%2Fb&expires=9999#preview'
  assert.equal(resolveTreatmentMediaUrl({ url: signedCdn }, productionApi), signedCdn, 'an external media path without a known storage key must retain its signed URL')
})

check('protocol-relative external CDN URLs retain their host', () => {
  const url = '//cdn.salon.example/photos/reference.jpg?signature=abc'
  assert.equal(resolveTreatmentMediaUrl({ url }, productionApi), url)
})

check('malformed saved URLs cannot crash a clinical summary', () => {
  for (const url of ['http://', 'https://[invalid-host]/photo.jpg']) {
    assert.equal(resolveTreatmentMediaUrl({ url, storageKey }, productionApi), productionPhoto)
    assert.equal(resolveTreatmentMediaUrl({ url }, productionApi), '')
  }
})

check('missing photos remain absent without generating broken image URLs', () => {
  for (const media of [{}, { url: null }, { url: '   ' }, { storageKey: '' }]) {
    assert.equal(resolveTreatmentMediaUrl(media, productionApi), '')
  }
  for (const details of [{}, { mediaItems: [] }, { mediaItems: [null, 1, 'invalid', {}] }, { photoPreview: '', photoStorageKey: '' }]) {
    assert.equal(resolveTreatmentPhotoUrl(details), '')
  }
})

check('clinical photos restore modern and legacy fields and reference media', () => {
  const inline = 'data:image/jpeg;base64,cGhvdG8='
  const alternate = 'https://cdn.salon.example/other.jpg'
  assert.equal(resolveTreatmentPhotoUrl({ photoPreviewUrl: inline, photoPreview: alternate }), inline)
  assert.equal(resolveTreatmentPhotoUrl({ photoPreview: inline }), inline)
  assert.equal(resolveTreatmentPhotoUrl({ photoStorageKey: storageKey }), resolveTreatmentMediaUrl({ storageKey }))
  for (const reference of [
    { mediaType: 'reference', storageKey },
    { media_type: 'reference', storage_key: storageKey },
  ]) {
    assert.equal(resolveTreatmentPhotoUrl({ mediaItems: [null, { mediaType: 'after', url: alternate }, reference] }), resolveTreatmentMediaUrl({ storageKey }))
  }
  assert.equal(resolveTreatmentPhotoUrl({ photoPreview: 'http://localhost:3001/api/media/old.jpg', mediaItems: [{ mediaType: 'reference', storageKey }] }), resolveTreatmentMediaUrl({ storageKey }))
  assert.equal(resolveTreatmentPhotoUrl({ mediaItems: [{ mediaType: 'reference', url: alternate }] }), alternate)
})

check('server defaults generate portable URLs and honor configured media bases', () => {
  const script = fileURLToPath(import.meta.url)
  for (const mediaBase of [undefined, '/api/', 'https://media.salon.example/api///']) {
    execFileSync(process.execPath, ['--import', 'tsx', script, '--server-media'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
      env: {
        PATH: process.env.PATH ?? '',
        NODE_ENV: 'test',
        DOTENV_CONFIG_PATH: '/dev/null',
        DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/never-connect',
        DATABASE_SSL: 'false',
        ...(mediaBase === undefined ? {} : { MEDIA_PUBLIC_BASE: mediaBase }),
      },
    })
  }
})

assert.equal(failed, 0, `${failed} treatment media regression group(s) failed`)
console.log('All treatment media regressions passed; no live app or database was accessed.')
