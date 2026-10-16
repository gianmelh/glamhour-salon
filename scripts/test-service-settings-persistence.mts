#!/usr/bin/env -S npx tsx
// Real PostgreSQL regression. Always creates and removes its own temporary
// cluster, uses only a private Unix socket, and never reads the app's .env.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repo = path.resolve(path.dirname(scriptPath), '..')
const exists = (file: string) => access(file).then(() => true, () => false)

async function postgresBin() {
  const candidates = [
    process.env.GLAMHOUR_TEST_POSTGRES_BIN,
    '/opt/homebrew/opt/postgresql@17/bin',
    '/opt/homebrew/opt/postgresql@16/bin',
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    ...(process.env.PATH ?? '').split(path.delimiter),
  ].filter((entry): entry is string => Boolean(entry))
  for (const candidate of candidates) {
    if (await exists(path.join(candidate, 'initdb')) && await exists(path.join(candidate, 'pg_ctl'))) return candidate
  }
  throw new Error('PostgreSQL initdb/pg_ctl are required. Set GLAMHOUR_TEST_POSTGRES_BIN to their directory.')
}

async function isolatedRegression() {
  const expectedDirectory = process.env.GLAMHOUR_TEST_DATA_DIRECTORY
  assert.ok(expectedDirectory && path.basename(expectedDirectory) === 'cluster')
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('glamhour-service-settings-'))
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null')
  const databaseUrl = new URL(process.env.DATABASE_URL!)
  assert.equal(databaseUrl.searchParams.get('host'), path.join(path.dirname(expectedDirectory), 'socket'))
  globalThis.fetch = async () => { throw new Error('HTTP is forbidden in isolated service settings tests') }
  const { pool } = await import('../server/db.ts')
  const { dataService } = await import('../server/services/data-service.ts')
  try {
    assert.equal((await pool.query('SHOW data_directory')).rows[0].data_directory, expectedDirectory)
    assert.equal((await pool.query('SHOW listen_addresses')).rows[0].listen_addresses, '')
    const migrationsPath = path.join(repo, 'database/migrations')
    const migrations = (await readdir(migrationsPath)).filter(name => /^0(0[1-9]|1[0-5])_.*\.sql$/.test(name)).sort()
    assert.equal(migrations.length, 15)
    for (const name of migrations) {
      await pool.query(await readFile(path.join(migrationsPath, name), 'utf8'))
      if (name.startsWith('003_')) {
        const seed = await readFile(path.join(repo, 'database/seeds/001_mockup_seed_data.sql'), 'utf8')
        const statuses = seed.match(/INSERT INTO appointment_statuses[\s\S]*?;/)?.[0]
        assert.ok(statuses)
        await pool.query(statuses)
      }
    }
    const output = execFileSync(process.execPath, ['--import', 'tsx', path.join(repo, 'scripts/migrate-service-archival.mts')], {
      cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_URL: databaseUrl.href, DATABASE_SSL: 'false' },
    })
    assert.match(output, /Migration 016 applied/)
    await pool.query(await readFile(path.join(migrationsPath, '016_service_archival.sql'), 'utf8'))
    console.log('PASS migration 016 runner applies to the real schema and repeats safely')

    const salonId = randomUUID(), otherSalonId = randomUUID(), clientId = randomUUID(), providerId = randomUUID()
    const nailsId = randomUUID(), lashesId = randomUUID()
    await pool.query("INSERT INTO salons(id, name, slug, onboarding_status, booking_enabled) VALUES ($1, 'Settings test', 'settings-test', 'completed', true), ($2, 'Other', 'other', 'completed', true)", [salonId, otherSalonId])
    await pool.query('INSERT INTO salon_settings(salon_id) VALUES ($1)', [salonId])
    await pool.query("INSERT INTO professionals(id, salon_id, full_name) VALUES ($1, $2, 'Provider')", [providerId, salonId])
    await pool.query("INSERT INTO clients(id, salon_id, full_name) VALUES ($1, $2, 'Client')", [clientId, salonId])
    await pool.query("INSERT INTO service_categories(id, code, name) VALUES ($1, 'nails', 'Nails'), ($2, 'lashes', 'Lashes')", [nailsId, lashesId])
    const input = { categoryId: nailsId, name: 'Removal', description: 'Catalog', durationMinutes: 45, priceMinor: 1250, currencyCode: 'MXN', isPubliclyBookable: false, assignToActiveProviders: true }
    const original = await dataService.createServiceInSettings(salonId, input)
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM salon_service_categories WHERE salon_id = $1', [salonId])).rows[0].count, 0)
    assert.equal((await pool.query('SELECT duration_override_minutes FROM professional_services WHERE service_id = $1', [original.id])).rows[0].duration_override_minutes, null)
    await assert.rejects(dataService.createService(salonId, input), /category is disabled/)
    await assert.rejects(dataService.createServiceInSettings(salonId, { ...input, name: ' removal ' }), /already exists/)
    const otherCategory = await dataService.createServiceInSettings(salonId, { ...input, categoryId: lashesId })
    const slugs = (await pool.query('SELECT slug FROM services WHERE id = ANY($1::uuid[])', [[original.id, otherCategory.id]])).rows
    assert.notEqual(slugs[0].slug, slugs[1].slug)
    const raced = await Promise.allSettled([0, 1].map(() => dataService.createServiceInSettings(salonId, { ...input, name: 'Concurrent name' })))
    assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM services WHERE salon_id = $1 AND name = 'Concurrent name'", [salonId])).rows[0].count, 1)
    await assert.rejects(dataService.updateService(otherSalonId, original.id, { name: 'Wrong salon' }), /Service not found/)
    await assert.rejects(dataService.deleteService(otherSalonId, original.id), /Service not found/)
    console.log('PASS real disabled-category management, distinct category identities, concurrent duplicate prevention and salon scoping')

    const appointmentId = randomUUID(), appointmentServiceId = randomUUID(), materialId = randomUUID()
    await pool.query("INSERT INTO appointments(id, salon_id, client_id, professional_id, status_code, starts_at, ends_at) VALUES ($1, $2, $3, $4, 'completed', '2026-01-01T10:00Z', '2026-01-01T10:45Z')", [appointmentId, salonId, clientId, providerId])
    await pool.query("INSERT INTO appointment_services(id, salon_id, appointment_id, service_id, service_name_snapshot, category_code_snapshot, duration_minutes_snapshot, unit_price_minor) VALUES ($1, $2, $3, $4, 'Removal', 'nails', 45, 1250)", [appointmentServiceId, salonId, appointmentId, original.id])
    await pool.query("INSERT INTO treatment_records(salon_id, appointment_service_id, client_id, professional_id, category_code, details_json) VALUES ($1, $2, $3, $4, 'nails', '{\"notes\":\"preserve\"}')", [salonId, appointmentServiceId, clientId, providerId])
    await pool.query("INSERT INTO service_materials(id, salon_id, category_id, service_id, name) VALUES ($1, $2, $3, $4, 'Gel')", [materialId, salonId, nailsId, original.id])
    const history = (await pool.query('SELECT * FROM appointment_services WHERE id = $1', [appointmentServiceId])).rows[0]
    const clinical = (await pool.query('SELECT * FROM treatment_records WHERE appointment_service_id = $1', [appointmentServiceId])).rows[0]
    await dataService.updateServiceCategories(salonId, [nailsId, lashesId])
    await dataService.updateService(salonId, original.id, { name: 'Updated removal', priceMinor: 1575, durationMinutes: 35, isActive: false })
    const before = await dataService.getService(salonId, original.id)
    const staleDraft = { selectedCategoryIds: [nailsId], services: [{ id: original.id, categoryId: nailsId, name: 'Stale name', price: '99', duration: '10', selected: true }], schedule: {}, providers: [] }
    await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, preserveServiceCatalog: true, draft: staleDraft })
    assert.deepEqual(await dataService.getService(salonId, original.id), before)
    await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: { ...staleDraft, services: [{ ...staleDraft.services[0], name: 'Updated removal', price: '15.75', duration: '35' }] } })
    const normalOnboarding = await dataService.getService(salonId, original.id)
    assert.equal(normalOnboarding.currency_code, 'MXN')
    assert.equal(normalOnboarding.is_active, false)
    assert.equal(normalOnboarding.is_publicly_bookable, false)
    await dataService.updateNailSettings(salonId, { categoryEnabled: true, services: [{ id: original.id, name: 'Updated removal', description: 'Catalog', priceMinor: 1575, durationMinutes: 35, isActive: true, sortOrder: 0 }], materials: [] })
    assert.equal((await dataService.getService(salonId, original.id)).is_publicly_bookable, false)
    const visible = await dataService.listServices(salonId, undefined, { limit: 100, offset: 0, includeInactive: true, publicOnly: true })
    assert.ok(!visible.some(service => service.id === original.id))
    console.log('PASS schedule/team saves preserve exact catalog values; ordinary onboarding and Nail saves retain currency and public visibility')

    await dataService.deleteService(salonId, original.id)
    const archived = (await pool.query('SELECT deleted_at, is_active FROM services WHERE id = $1', [original.id])).rows[0]
    assert.ok(archived.deleted_at)
    assert.equal(archived.is_active, false)
    assert.equal((await pool.query('SELECT is_active FROM professional_services WHERE service_id = $1', [original.id])).rows[0].is_active, false)
    assert.equal((await pool.query('SELECT service_id FROM service_materials WHERE id = $1', [materialId])).rows[0].service_id, null)
    assert.deepEqual((await pool.query('SELECT * FROM appointment_services WHERE id = $1', [appointmentServiceId])).rows[0], history)
    assert.deepEqual((await pool.query('SELECT * FROM treatment_records WHERE appointment_service_id = $1', [appointmentServiceId])).rows[0], clinical)
    await assert.rejects(dataService.getService(salonId, original.id), /Service not found/)
    await assert.rejects(dataService.updateService(salonId, original.id, { isActive: true }), /Service not found/)
    await assert.rejects(dataService.ensureService(salonId, { ...input, slug: 'removal' }), /unavailable/)
    await dataService.saveOnboarding(salonId, { step: 'complete', completed: true, preserveServiceCatalog: true, draft: staleDraft })
    await assert.rejects(dataService.saveOnboarding(salonId, { step: 'complete', completed: true, draft: staleDraft }), /selected service was removed/)
    await assert.rejects(dataService.updateNailSettings(salonId, { categoryEnabled: true, services: [{ id: original.id, name: 'Stale', priceMinor: 1, durationMinutes: 1, isActive: true, sortOrder: 0 }], materials: [] }), /selected service was removed/)
    assert.ok(!(await dataService.listServices(salonId, undefined, { limit: 100, offset: 0, includeInactive: true })).some(service => service.id === original.id))
    const nailSettings = await dataService.getNailSettings(salonId)
    assert.ok(!nailSettings.services.some(service => service.id === original.id))
    const replacement = await dataService.createServiceInSettings(salonId, input)
    assert.notEqual(replacement.id, original.id)
    console.log('PASS real archival retains appointment/clinical FKs and snapshots, detaches reusable materials, blocks resurrection and permits replacement')
  } finally { await pool.end() }
}

async function runIsolatedCluster() {
  const bin = await postgresBin()
  const root = await mkdtemp(path.join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'glamhour-service-settings-'))
  const data = path.join(root, 'cluster'), socket = path.join(root, 'socket')
  const port = 52000 + Math.floor(Math.random() * 6000), user = userInfo().username
  const environment = { PATH: process.env.PATH ?? '', LANG: 'C', LC_ALL: 'C', TMPDIR: root }
  const command = (name: string, args: string[]) => execFileSync(path.join(bin, name), args, { env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })
  let started = false
  try {
    await mkdir(socket)
    command('initdb', ['-D', data, '-A', 'trust', '-U', user, '--no-locale', '--encoding=UTF8'])
    await writeFile(path.join(data, 'postgresql.conf'), `listen_addresses = ''\nunix_socket_directories = '${socket.replaceAll("'", "''")}'\nport = ${port}\nfsync = off\n`)
    started = true
    command('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-w', 'start'])
    execFileSync(process.execPath, ['--import', 'tsx', scriptPath, '--isolated-child'], {
      cwd: repo, stdio: 'inherit', timeout: 60_000,
      env: {
        ...environment, NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_SSL: 'false',
        DATABASE_URL: `postgresql://${encodeURIComponent(user)}@localhost:${port}/postgres?host=${encodeURIComponent(socket)}`,
        GLAMHOUR_TEST_DATA_DIRECTORY: data,
      },
    })
  } finally {
    // Never remove a live cluster if shutdown fails: leave its path visible.
    if (started && await exists(path.join(data, 'postmaster.pid'))) {
      try { command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']) }
      catch { throw new Error(`Temporary PostgreSQL shutdown failed. Cluster retained at ${data}`) }
    }
    await rm(root, { recursive: true, force: true })
    console.log('CLEANUP temporary PostgreSQL stopped and all isolated test files removed')
  }
}

if (process.argv.includes('--isolated-child')) await isolatedRegression()
else await runIsolatedCluster()
