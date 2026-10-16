#!/usr/bin/env -S npx tsx
// Exercise the actual settings API handlers with a stateful SQL double. No
// database or network connection is allowed, including rollback scenarios.
import assert from 'node:assert/strict'

process.env.DATABASE_URL = 'postgresql://local-test:local-test@127.0.0.1:1/not-used'
process.env.DOTENV_CONFIG_PATH = '/dev/null'
globalThis.fetch = async () => { throw new Error('Network is forbidden in service settings tests') }
const { pool } = await import('../server/db.ts')
const { dataService } = await import('../server/services/data-service.ts')
const { apiRouter } = await import('../server/routes.ts')
const { createServiceSchema, updateServiceSchema } = await import('../server/validation.ts')

const salonId = '10000000-0000-4000-8000-000000000001'
const otherSalonId = '10000000-0000-4000-8000-000000000002'
const nailsId = '20000000-0000-4000-8000-000000000001'
const lashesId = '20000000-0000-4000-8000-000000000002'
const categories = [
  { id: nailsId, code: 'nails', name: 'Nails', is_active: true },
  { id: lashesId, code: 'lashes', name: 'Lashes', is_active: true },
]
const enabledCategories = new Set([lashesId])
type StoredService = Awaited<ReturnType<typeof dataService.getService>> & { slug: string }
let services: StoredService[] = []
let assignments = new Map<string, boolean>()
let nextId = 1
let failAssignment = false
let transactionOpen = false
let snapshot: { services: StoredService[]; assignments: Map<string, boolean> } | undefined
const sqlCalls: string[] = []

const rows = (values: unknown[]) => ({ rows: structuredClone(values) })
const findService = (values: readonly unknown[]) => services.find(service => service.salon_id === values[0] && service.id === values[1] && !service.deleted_at)

function runQuery(sql: string, values: readonly unknown[] = []) {
  sqlCalls.push(sql)
  if (sql === 'BEGIN') {
    assert.equal(transactionOpen, false)
    transactionOpen = true
    snapshot = { services: structuredClone(services), assignments: new Map(assignments) }
    return rows([])
  }
  if (sql === 'COMMIT') { transactionOpen = false; snapshot = undefined; return rows([]) }
  if (sql === 'ROLLBACK') {
    assert.ok(snapshot)
    services = snapshot.services; assignments = snapshot.assignments
    transactionOpen = false; snapshot = undefined
    return rows([])
  }
  if (/^(CREATE|ALTER|DO)\b/.test(sql)) return rows([])
  if (sql.includes('SELECT id FROM salons')) return rows(values[0] === salonId ? [{ id: salonId }] : [])
  if (sql.includes('SELECT id, code, name FROM service_categories')) {
    assert.match(sql, /WHERE is_active/)
    return rows(categories.filter(category => (!values[0] || category.id === values[0]) && (!values[1] || category.code === values[1])))
  }
  if (sql.includes("SELECT id FROM service_categories WHERE code = 'nails'")) return rows([{ id: nailsId }])
  if (sql.trim().startsWith('SELECT 1 FROM salon_service_categories')) return rows(enabledCategories.has(String(values[1])) ? [{ enabled: true }] : [])
  if (sql.includes('SELECT id FROM services WHERE')) return rows(services.filter(service => service.salon_id === values[0] && service.category_id === values[1]
    && !service.deleted_at && service.name.trim().toLowerCase() === String(values[2]).trim().toLowerCase() && service.id !== values[3]))
  if (sql.includes('UPDATE service_materials')) {
    assert.match(sql, /SET service_id = NULL/)
    assert.match(sql, /WHERE salon_id = \$1 AND service_id = \$2/)
    return rows([])
  }
  if (sql.includes('INSERT INTO salon_service_categories')) return rows([]) // Legacy Nail settings only; must roll back on stale service.
  if (sql.includes('INSERT INTO services')) {
    assert.equal(transactionOpen, true)
    const collision = services.find(service => service.salon_id === values[0] && service.slug === values[3])
    if (sql.includes('DO UPDATE SET')) {
      assert.match(sql, /services.deleted_at IS NULL/)
      return rows(collision && collision.is_active && !collision.deleted_at ? [collision] : [])
    }
    assert.match(sql, /ON CONFLICT \(salon_id, slug\) DO NOTHING/)
    if (collision) return rows([])
    assert.ok(String(values[3]).length <= 160)
    assert.match(String(values[3]), /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    const service: StoredService = {
      id: `30000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
      salon_id: String(values[0]), category_id: String(values[1]), form_template_id: null,
      name: String(values[2]), slug: String(values[3]), description: values[4] as string | null,
      duration_minutes: Number(values[5]), price_minor: Number(values[6]), currency_code: String(values[7]).toUpperCase(),
      is_active: true, is_publicly_bookable: Boolean(values[8]), deleted_at: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    services.push(service)
    return rows([service])
  }
  if (sql.includes('INSERT INTO professional_services')) {
    assert.equal(transactionOpen, true)
    if (failAssignment) throw new Error('Assignment failed')
    assert.match(sql, /p.salon_id = \$1 AND p.status = 'active' AND p.deleted_at IS NULL/)
    assignments.set(String(values[1]), true)
    return rows([])
  }
  if (sql.includes('UPDATE professional_services')) {
    assert.equal(transactionOpen, true)
    assert.match(sql, /WHERE salon_id = \$1 AND service_id = \$2/)
    assignments.set(String(values[1]), false)
    return rows([])
  }
  if (sql.includes('SELECT * FROM services')) {
    assert.match(sql, /salon_id = \$1 AND id = \$2 AND deleted_at IS NULL/)
    assert.match(sql, /FOR UPDATE/)
    const current = findService(values)
    return rows(current ? [current] : [])
  }
  if (sql.includes('UPDATE services')) {
    assert.equal(transactionOpen, true)
    assert.match(sql, /deleted_at IS NULL/)
    const current = sql.includes('category_id = $2')
      ? services.find(service => service.salon_id === values[0] && service.category_id === values[1] && service.id === values[2] && !service.deleted_at)
      : findService(values)
    if (!current) return rows([])
    if (sql.includes('deleted_at = now()')) {
      current.deleted_at = '2026-10-16T12:00:00Z'; current.is_active = false; current.is_publicly_bookable = false
    } else {
      Object.assign(current, {
        name: values[2], description: values[3], duration_minutes: values[4], price_minor: values[5],
        currency_code: String(values[6]).toUpperCase(), is_publicly_bookable: values[7], is_active: values[8],
      })
    }
    assert.doesNotMatch(sql, /SET\s+category_id|SET\s+slug/)
    return rows([current])
  }
  if (sql.includes('FROM services s')) {
    assert.match(sql, /s.deleted_at IS NULL/)
    if (sql.includes('s.id = $2')) {
      const current = findService(values)
      return rows(current ? [current] : [])
    }
    assert.match(sql, /s.is_active OR \(\$6::boolean AND NOT \$5::boolean\)/)
    const publicOnly = values[4] === true
    return rows(services.filter(service => service.salon_id === values[0] && !service.deleted_at
      && (service.is_active || (values[5] && !publicOnly))
      && (!values[1] || categories.find(category => category.id === service.category_id)?.code === values[1])
      && (!publicOnly || (service.is_publicly_bookable && enabledCategories.has(service.category_id))))
      .slice(Number(values[3]), Number(values[3]) + Number(values[2])))
  }
  throw new Error(`Unexpected SQL: ${sql}`)
}

Object.defineProperty(pool, 'query', { value: async (sql: string, values?: readonly unknown[]) => runQuery(sql, values) })
Object.defineProperty(pool, 'connect', { value: async () => ({ query: async (sql: string, values?: readonly unknown[]) => runQuery(sql, values), release() {} }) })

async function route(method: string, path: string, body?: unknown, id?: string, query: Record<string, string> = {}, salon = salonId): Promise<unknown> {
  const found = apiRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method])?.route
  assert.ok(found)
  return new Promise((resolve, reject) => {
    try {
      found.stack[0].handle({ params: { salonId: salon, id }, body, query }, {
        status() { return this },
        json(value: { data: unknown }) { resolve(value.data); return this },
      }, reject)
    } catch (error) { reject(error) }
  })
}

try {
  const input = createServiceSchema.parse({ categoryId: nailsId, name: 'Removal', description: 'Original', durationMinutes: 45, priceMinor: 2500, assignToActiveProviders: true })
  const created = await route('post', '/salons/:salonId/settings/services', input) as StoredService
  assert.equal(created.category_id, nailsId)
  assert.equal(created.category_code, 'nails')
  assert.equal(assignments.get(created.id), true)
  assert.deepEqual([...enabledCategories], [lashesId], 'adding to a disabled category does not enable it')
  assert.ok(!sqlCalls.some(sql => sql.includes('INSERT INTO salon_service_categories')))
  await assert.rejects(dataService.createService(salonId, input), /category is disabled/)
  await assert.rejects(dataService.createServiceInSettings(salonId, { ...input, categoryCode: 'lashes' }), /category is unavailable/)
  await assert.rejects(dataService.createServiceInSettings(otherSalonId, input), /Salon not found/)
  console.log('PASS settings create supports disabled categories without changing membership or weakening booking guards')

  const sameName = await dataService.createServiceInSettings(salonId, { ...input, categoryId: lashesId }) as StoredService
  assert.notEqual(sameName.id, created.id)
  assert.notEqual(sameName.slug, created.slug)
  assert.equal((await dataService.getService(salonId, created.id)).category_id, nailsId)
  const longName = await dataService.createServiceInSettings(salonId, { ...input, name: 'Á'.repeat(160) }) as StoredService
  const longCollision = await dataService.createServiceInSettings(salonId, { ...input, categoryId: lashesId, name: 'Á'.repeat(160) }) as StoredService
  assert.notEqual(longName.slug, longCollision.slug)
  await assert.rejects(dataService.createServiceInSettings(salonId, { ...input, name: ' removal ' }), /already exists in this category/)
  await assert.rejects(dataService.updateService(salonId, longName.id, { name: 'REMOVAL' }), /already exists in this category/)
  failAssignment = true
  const count = services.length
  await assert.rejects(dataService.createServiceInSettings(salonId, { ...input, name: 'Rolled back' }), /Assignment failed/)
  assert.equal(services.length, count)
  failAssignment = false
  console.log('PASS duplicate and long names get distinct bounded slugs; provider assignment failure rolls back service creation')

  const history = Object.freeze({ service_id: created.id, service_name_snapshot: created.name, unit_price_minor: 2500, duration_minutes: 45 })
  const changed = await route('patch', '/salons/:salonId/services/:id', { name: 'New removal', description: null, durationMinutes: 30, priceMinor: 0, isActive: false, isPubliclyBookable: false }, created.id) as StoredService
  assert.equal(changed.price_minor, 0)
  assert.equal(changed.description, null)
  assert.equal(changed.is_active, false)
  assert.equal(changed.slug, created.slug)
  assert.equal(history.service_name_snapshot, 'Removal')
  assert.equal(history.duration_minutes, 45)
  assert.ok(!(await dataService.listServices(salonId, undefined, { limit: 100, offset: 0 })).some(service => service.id === created.id))
  const managed = await route('get', '/salons/:salonId/services', undefined, undefined, { includeInactive: 'true' }) as StoredService[]
  assert.ok(managed.some(service => service.id === created.id))
  const publicServices = await route('get', '/salons/:salonId/services', undefined, undefined, { includeInactive: 'true', publicOnly: 'true' }) as StoredService[]
  assert.deepEqual(publicServices.map(service => service.id), [sameName.id, longCollision.id])
  await assert.rejects(route('patch', '/salons/:salonId/services/:id', { name: 'Other salon' }, created.id, {}, otherSalonId), /Service not found/)
  await assert.rejects(route('delete', '/salons/:salonId/services/:id', undefined, created.id, {}, otherSalonId), /Service not found/)
  for (const invalid of [{}, { categoryId: lashesId }, { name: ' ' }, { durationMinutes: 0 }, { durationMinutes: 1.5 }, { priceMinor: -1 }, { priceMinor: 2_147_483_648 }, { currencyCode: '1$!' }, { isActive: 'false' }]) {
    assert.equal(updateServiceSchema.safeParse(invalid).success, false)
  }
  console.log('PASS edits preserve category/identity/history, inactive catalog stays private, and validation/salon scoping reject invalid changes')

  await route('patch', '/salons/:salonId/services/:id', { isActive: true }, created.id)
  assert.deepEqual(await route('delete', '/salons/:salonId/services/:id', undefined, created.id), { deleted: true })
  assert.equal(assignments.get(created.id), false)
  assert.ok(services.find(service => service.id === created.id)?.deleted_at)
  assert.ok(!(await dataService.listServices(salonId, undefined, { limit: 100, offset: 0, includeInactive: true })).some(service => service.id === created.id))
  await assert.rejects(dataService.getService(salonId, created.id), /Service not found/)
  await assert.rejects(dataService.updateService(salonId, created.id, { isActive: true }), /Service not found/)
  await assert.rejects(dataService.deleteService(salonId, created.id), /Service not found/)
  await assert.rejects(dataService.updateNailSettings(salonId, { categoryEnabled: true, services: [{ id: created.id, name: 'Stale', description: '', priceMinor: 1000, durationMinutes: 30, isActive: true, sortOrder: 0 }], materials: [] }), /selected service was removed/)
  assert.equal(services.find(service => service.id === created.id)?.is_active, false)
  const replacement = await dataService.createServiceInSettings(salonId, input) as StoredService
  assert.notEqual(replacement.id, created.id)
  assert.notEqual(replacement.slug, created.slug)
  assert.equal(history.service_id, created.id)
  assert.ok(!sqlCalls.some(sql => /(?:UPDATE|INSERT INTO|DELETE FROM) (?:appointments|appointment_services|treatment_records)\b/.test(sql)))
  assert.ok(!sqlCalls.some(sql => /DELETE FROM services/.test(sql)))
  console.log('PASS deletion archives without rewriting bookings, blocks stale edits/Nail saves and allows a new independent replacement')
} finally {
  await pool.end()
}
