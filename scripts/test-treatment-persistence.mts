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
  // Only the parent creates this environment, with a freshly initialized DB.
  const expectedDirectory = process.env.GLAMHOUR_TEST_DATA_DIRECTORY
  assert.ok(expectedDirectory && path.basename(expectedDirectory) === 'cluster')
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('glamhour-treatment-'))
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null')
  const databaseUrl = new URL(process.env.DATABASE_URL!)
  assert.equal(databaseUrl.searchParams.get('host'), path.join(path.dirname(expectedDirectory), 'socket'))
  globalThis.fetch = async () => { throw new Error('HTTP is forbidden in isolated treatment persistence tests') }

  const { pool } = await import('../server/db.ts')
  const { dataService } = await import('../server/services/data-service.ts')
  try {
    assert.equal((await pool.query('SHOW data_directory')).rows[0].data_directory, expectedDirectory)
    assert.equal((await pool.query('SHOW listen_addresses')).rows[0].listen_addresses, '')
    const migrationsPath = path.join(repo, 'database/migrations')
    const migrations = (await readdir(migrationsPath)).filter(name => /^0(0[1-9]|1[0-4])_.*\.sql$/.test(name)).sort()
    assert.equal(migrations.length, 14)
    for (const name of migrations) {
      await pool.query(await readFile(path.join(migrationsPath, name), 'utf8'))
      if (name.startsWith('003_')) {
        // Migration 010 references these status rows, normally present in an
        // existing installation. Seed only reference data, never salon data.
        const seed = await readFile(path.join(repo, 'database/seeds/001_mockup_seed_data.sql'), 'utf8')
        const statuses = seed.match(/INSERT INTO appointment_statuses[\s\S]*?;/)?.[0]
        assert.ok(statuses)
        await pool.query(statuses)
      }
    }

    const salonId = randomUUID(), clientId = randomUUID(), providerId = randomUUID()
    const categoryId = randomUUID(), serviceId = randomUUID()
    await pool.query('INSERT INTO salons(id, name, slug) VALUES ($1, $2, $3)', [salonId, 'Isolated test salon', 'isolated-test-salon'])
    await pool.query('INSERT INTO salon_settings(salon_id) VALUES ($1)', [salonId])
    await pool.query('INSERT INTO professionals(id, salon_id, full_name) VALUES ($1, $2, $3)', [providerId, salonId, 'Test professional'])
    await pool.query('INSERT INTO clients(id, salon_id, full_name) VALUES ($1, $2, $3)', [clientId, salonId, 'Test client'])
    await pool.query('INSERT INTO service_categories(id, code, name) VALUES ($1, $2, $3)', [categoryId, 'lashes', 'Lashes'])
    await pool.query('INSERT INTO salon_service_categories(salon_id, category_id) VALUES ($1, $2)', [salonId, categoryId])
    await pool.query(`INSERT INTO services(id, salon_id, category_id, name, slug, duration_minutes, price_minor)
      VALUES ($1, $2, $3, 'Lashes', 'lashes', 60, 1000)`, [serviceId, salonId, categoryId])

    let day = 0
    const nextDates = () => {
      const startsAt = new Date(Date.UTC(2030, 0, ++day, 10)).toISOString()
      return { startsAt, endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString() }
    }
    const appointment = async (professionalId: string | null) => {
      const id = randomUUID(), appointmentServiceId = randomUUID(), dates = nextDates()
      await pool.query(`INSERT INTO appointments(id, salon_id, client_id, professional_id, status_code, starts_at, ends_at)
        VALUES ($1, $2, $3, $4, 'coming_up', $5, $6)`, [id, salonId, clientId, professionalId, dates.startsAt, dates.endsAt])
      await pool.query(`INSERT INTO appointment_services(id, salon_id, appointment_id, service_id,
        service_name_snapshot, category_code_snapshot, duration_minutes_snapshot, unit_price_minor)
        VALUES ($1, $2, $3, $4, 'Lashes', 'lashes', 60, 1000)`, [appointmentServiceId, salonId, id, serviceId])
      return { id, appointmentServiceId }
    }
    const lashMap = {
      rightEye: [8, 9, 10, 11, 12, 13, 14].map(position => ({ position, length: 12 })),
      leftEye: [8, 9, 10, 11, 12, 13, 14].map(position => ({ position, length: 11 })),
    }
    const details = {
      style: 'Cat eye', lashMap,
      mediaItems: [{ storageKey: 'isolated/lashes/photo.jpg', mediaType: 'reference', mimeType: 'image/jpeg', url: '/api/media/isolated/lashes/photo.jpg' }],
    }
    const save = (appointmentId: string, treatmentDetails: Record<string, unknown> = details) => dataService.updateAppointmentTreatmentDetails(
      salonId, appointmentId, { categoryCode: 'lashes', treatmentDetails },
    )
    const record = async (appointmentServiceId: string) => (await pool.query(
      'SELECT id, professional_id, details_json FROM treatment_records WHERE appointment_service_id = $1', [appointmentServiceId],
    )).rows[0]
    const unassigned = await appointment(null)
    await assert.rejects(save(unassigned.id), (error: unknown) => {
      const failure = error as { code?: string; table?: string; column?: string }
      return failure.code === '23502' && failure.table === 'treatment_records' && failure.column === 'professional_id'
    })
    assert.equal(await record(unassigned.appointmentServiceId), undefined)
    for (const table of ['appointment_category_details', 'treatment_visual_annotations', 'appointment_events']) {
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE appointment_id = $1`, [unassigned.id])).rows[0].count, 0)
    }
    console.log('PASS migrations 001–014 reproduce missing-professional 23502 and roll back the entire clinical save')

    const runnerOutput = execFileSync(process.execPath, ['--import', 'tsx', path.join(repo, 'scripts/migrate-optional-treatment-professional.mts')], {
      cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
      env: {
        PATH: process.env.PATH ?? '', NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null',
        DATABASE_URL: databaseUrl.href, DATABASE_SSL: 'false',
      },
    })
    assert.match(runnerOutput, /Migration 015 applied: treatment details can be saved without an assigned professional\./)
    const migration = await readFile(path.join(migrationsPath, '015_optional_treatment_professional.sql'), 'utf8')
    await pool.query(migration)
    const saved = await save(unassigned.id)
    assert.equal(saved.professional_id, null)
    assert.equal(saved.status_code, 'coming_up')
    const originalRecord = await record(unassigned.appointmentServiceId)
    assert.equal(originalRecord.professional_id, null)
    assert.deepEqual(originalRecord.details_json, details)
    const annotations = (await pool.query(`SELECT body_area, points_json FROM treatment_visual_annotations
      WHERE appointment_id = $1 ORDER BY body_area`, [unassigned.id])).rows
    assert.deepEqual(annotations, [{ body_area: 'leftEye', points_json: lashMap.leftEye }, { body_area: 'rightEye', points_json: lashMap.rightEye }])
    console.log('PASS deployment runner applies migration 015 and repeating it is safe; an unassigned appointment saves both lash maps and photo')

    const changedDetails = { ...details, style: 'Doll eye', mediaItems: [{ ...details.mediaItems[0], storageKey: 'isolated/lashes/replacement.jpg' }] }
    await save(unassigned.id, changedDetails)
    await save(unassigned.id, changedDetails)
    const updatedRecord = await record(unassigned.appointmentServiceId)
    assert.equal(updatedRecord.id, originalRecord.id)
    assert.equal(updatedRecord.professional_id, null)
    assert.deepEqual(updatedRecord.details_json, changedDetails)
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM treatment_visual_annotations WHERE appointment_id = $1', [unassigned.id])).rows[0].count, 2)
    assert.deepEqual((await pool.query('SELECT storage_key FROM treatment_media WHERE treatment_record_id = $1', [updatedRecord.id])).rows, [{ storage_key: 'isolated/lashes/replacement.jpg' }])
    console.log('PASS repeated updates preserve record identity and replace photos/maps without duplicate clinical rows')

    const created = await dataService.createAppointment({
      salonId, clientId, professionalId: null, serviceIds: [serviceId], source: 'internal', ...nextDates(), treatmentDetails: details,
    })
    assert.equal(created.professional_id, null)
    const createdRecord = (await pool.query(`SELECT tr.professional_id FROM treatment_records tr
      JOIN appointment_services aps ON aps.id = tr.appointment_service_id WHERE aps.appointment_id = $1`, [created.id])).rows
    assert.deepEqual(createdRecord, [{ professional_id: null }])
    const assigned = await appointment(providerId)
    await save(assigned.id)
    await save(assigned.id, changedDetails)
    assert.equal((await record(assigned.appointmentServiceId)).professional_id, providerId)
    console.log('PASS real appointment creation supports an unassigned treatment; assigned treatment inserts/updates preserve the professional')

    const otherSalon = randomUUID(), otherProvider = randomUUID()
    await pool.query('INSERT INTO salons(id, name, slug) VALUES ($1, $2, $3)', [otherSalon, 'Other test salon', 'other-test-salon'])
    await pool.query('INSERT INTO professionals(id, salon_id, full_name) VALUES ($1, $2, $3)', [otherProvider, otherSalon, 'Other test professional'])
    await assert.rejects(pool.query('UPDATE treatment_records SET professional_id = $1 WHERE id = $2', [otherProvider, originalRecord.id]), (error: unknown) => {
      const failure = error as { code?: string; constraint?: string }
      return failure.code === '23503' && Boolean(failure.constraint?.includes('professional_id'))
    })
    assert.equal((await record(unassigned.appointmentServiceId)).professional_id, null)
    const flags = (await pool.query('SELECT s.booking_enabled, ss.allow_public_booking FROM salons s JOIN salon_settings ss ON ss.salon_id = s.id WHERE s.id = $1', [salonId])).rows[0]
    assert.deepEqual(flags, { booking_enabled: false, allow_public_booking: false })
    console.log('PASS cross-salon non-null professionals remain rejected by the foreign key; clinical saves preserve public-booking flags')
  } finally {
    await pool.end()
  }
}

async function runIsolatedCluster() {
  const bin = await postgresBin()
  const root = await mkdtemp(path.join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'glamhour-treatment-'))
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
