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
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('glamhour-client-clinical-forms-'))
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null')
  const databaseUrl = new URL(process.env.DATABASE_URL!)
  assert.equal(databaseUrl.hostname, 'localhost')
  assert.equal(databaseUrl.searchParams.get('host'), path.join(path.dirname(expectedDirectory), 'socket'))
  globalThis.fetch = async () => { throw new Error('HTTP is forbidden in isolated client clinical form tests') }

  const { pool } = await import('../server/db.ts')
  const { dataService } = await import('../server/services/data-service.ts')
  const { clientClinicalFormSchema } = await import('../server/validation.ts')
  const { healthQuestionnaires, allQuestionIds } = await import('../src/pages/app/appointment-booking/health-questionnaires.ts')
  type Category = keyof typeof healthQuestionnaires
  const completeDetails = (category: Category, overrides: Record<string, unknown> = {}) => ({
    healthAnswers: Object.fromEntries(allQuestionIds(healthQuestionnaires[category]).map(key => [key, 'no'])),
    consentItems: Object.fromEntries(healthQuestionnaires[category].consentItems.map(item => [item.id, true])),
    consentAccepted: true,
    professionalSignature: '12,24 35,40 56,24',
    clientSignature: '15,20 31,35 45,20',
    healthFullName: 'Clinical test client', healthPhone: '+525500000001', healthEmail: 'clinical@example.test',
    consentDate: '2030-01-01', consentTime: '10:30',
    ...(healthQuestionnaires[category].showPhototype ? { phototype: 'Type I' } : {}),
    ...overrides,
  })
  const status = (expected: number) => (error: unknown) => (error as { status?: number }).status === expected

  try {
    assert.equal((await pool.query('SHOW data_directory')).rows[0].data_directory, expectedDirectory)
    assert.equal((await pool.query('SHOW listen_addresses')).rows[0].listen_addresses, '')
    const migrationsPath = path.join(repo, 'database/migrations')
    const migrations = (await readdir(migrationsPath)).filter(name => /^0(0[1-9]|1[0-7])_.*\.sql$/.test(name)).sort()
    assert.equal(migrations.length, 17)
    for (const name of migrations) {
      await pool.query(await readFile(path.join(migrationsPath, name), 'utf8'))
      if (name.startsWith('003_')) {
        const seed = await readFile(path.join(repo, 'database/seeds/001_mockup_seed_data.sql'), 'utf8')
        const statuses = seed.match(/INSERT INTO appointment_statuses[\s\S]*?;/)?.[0]
        assert.ok(statuses)
        await pool.query(statuses)
      }
    }
    // Deploying the new snapshot columns a second time must be harmless.
    await pool.query(await readFile(path.join(migrationsPath, migrations.find(name => name.startsWith('017_'))!), 'utf8'))

    const salonId = randomUUID(), otherSalonId = randomUUID()
    await pool.query('INSERT INTO salons(id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)', [
      salonId, 'Clinical test salon', 'clinical-test-salon', otherSalonId, 'Other test salon', 'other-clinical-test-salon',
    ])
    await pool.query('INSERT INTO salon_settings(salon_id) VALUES ($1), ($2)', [salonId, otherSalonId])
    const client = async (name: string, owningSalon = salonId, createdAt = '2020-01-01T00:00:00Z') => {
      const id = randomUUID()
      await pool.query('INSERT INTO clients(id, salon_id, full_name, created_at) VALUES ($1, $2, $3, $4)', [id, owningSalon, name, createdAt])
      return id
    }
    const clientId = await client('Main client'), otherClientId = await client('Other client')
    const foreignClientId = await client('Foreign client', otherSalonId)
    const categoryIds = {} as Record<Category, string>, serviceIds = {} as Record<Category, string>
    for (const code of Object.keys(healthQuestionnaires) as Category[]) {
      categoryIds[code] = randomUUID()
      serviceIds[code] = randomUUID()
      await pool.query('INSERT INTO service_categories(id, code, name) VALUES ($1, $2, $3)', [categoryIds[code], code, code])
      await pool.query('INSERT INTO salon_service_categories(salon_id, category_id) VALUES ($1, $2)', [salonId, categoryIds[code]])
      await pool.query(`INSERT INTO services(id, salon_id, category_id, name, slug, duration_minutes, price_minor)
        VALUES ($1, $2, $3, $4, $4, 60, 1000)`, [serviceIds[code], salonId, categoryIds[code], code])
    }
    const save = async (id: string, category: Category, details: Record<string, unknown>, expectedProfileId: string | null = null, notes = '', expectedRevision?: string | null) => {
      const revision = expectedRevision === undefined
        ? (await dataService.listClientClinicalForms(salonId, id)).find(item => item.category === category)?.revision ?? null
        : expectedRevision
      return dataService.saveClientClinicalForm(salonId, id, category, { details, notes, expectedProfileId, expectedRevision: revision })
    }
    const list = (id: string) => dataService.listClientClinicalForms(salonId, id)
    const rows = async (table: string, id: string) => (await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0]

    assert.deepEqual(await list(clientId), [])
    const nailsDetails = completeDetails('nails')
    const nails = await save(clientId, 'nails', nailsDetails, null, 'Original nail history')
    assert.ok(nails.id)
    assert.ok(nails.questionnaire_id)
    assert.equal(nails.appointment_id, null)
    assert.equal(nails.is_valid, true)
    assert.deepEqual(nails.form_details.healthAnswers, nailsDetails.healthAnswers)
    assert.equal(nails.form_details.professionalSignature, nailsDetails.professionalSignature)
    assert.equal(nails.form_details.healthPhone, nailsDetails.healthPhone)
    assert.equal(nails.notes, 'Original nail history')
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM appointments')).rows[0].count, 0)
    const lashes = await save(clientId, 'lashes', completeDetails('lashes'), null, 'Separate lash history')
    assert.deepEqual((await list(clientId)).map(item => item.category).sort(), ['lashes', 'nails'])
    const priorQuestionnaire = await rows('health_questionnaires', nails.questionnaire_id)
    const changedNails = completeDetails('nails', {
      healthAnswers: { ...nailsDetails.healthAnswers, chemical_allergies: 'yes' },
      healthPhone: '+525500000002', clientSignature: '',
    })
    const changed = await save(clientId, 'nails', changedNails, nails.id, '')
    assert.notEqual(changed.id, nails.id)
    assert.notEqual(changed.questionnaire_id, nails.questionnaire_id)
    assert.equal(changed.notes, '', 'clearing clinical notes must persist')
    assert.equal(changed.form_details.clientSignature, '', 'clearing optional signature must persist')
    assert.equal((await rows('health_profile_versions', nails.id)).status, 'superseded')
    assert.deepEqual(await rows('health_questionnaires', nails.questionnaire_id), priorQuestionnaire)
    assert.equal((await list(clientId)).find(item => item.category === 'lashes')?.id, lashes.id)
    const appointmentProfile = await dataService.getHealthProfile(salonId, clientId, 'nails')
    assert.equal(appointmentProfile?.id, changed.id, 'saved client form is available for the existing appointment flow')
    assert.ok([true, 'yes'].includes((appointmentProfile?.answers as Record<string, unknown>).chemical_allergies as boolean | string))
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM health_profile_versions WHERE client_id = $1 AND category = $2 AND status = $3', [clientId, 'nails', 'active'])).rows[0].count, 1)
    console.log('PASS forms without appointments persist per client/category, preserve every form field, clear optional data and version edits')

    const countBeforeConflicts = (await pool.query('SELECT count(*)::int AS count FROM health_questionnaires')).rows[0].count
    await assert.rejects(save(clientId, 'nails', nailsDetails, nails.id), status(409))
    await assert.rejects(save(clientId, 'nails', nailsDetails, null), status(409))
    await assert.rejects(save(otherClientId, 'nails', nailsDetails, changed.id), status(409))
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM health_questionnaires')).rows[0].count, countBeforeConflicts)
    const competing = await Promise.allSettled([
      save(clientId, 'nails', changedNails, changed.id, 'Concurrent first'),
      save(clientId, 'nails', changedNails, changed.id, 'Concurrent second'),
    ])
    assert.equal(competing.filter(item => item.status === 'fulfilled').length, 1)
    const rejected = competing.find(item => item.status === 'rejected') as PromiseRejectedResult
    assert.equal(rejected.reason.status, 409)
    await assert.rejects(save(otherClientId, 'nails', { ...nailsDetails, healthAnswers: {} }), status(400))
    await assert.rejects(save(otherClientId, 'nails', { ...nailsDetails, professionalSignature: '' }), status(400))
    await assert.rejects(save(otherClientId, 'nails', { ...nailsDetails, consentItems: {} }), status(400))
    await assert.rejects(save(otherClientId, 'cosmetology', { ...completeDetails('cosmetology'), phototype: '' }), status(400))
    console.log('PASS stale and concurrent writes reject without extra versions; incomplete forms are rejected server-side')

    await assert.rejects(list(foreignClientId), status(404))
    await assert.rejects(dataService.listClientClinicalForms(otherSalonId, clientId), status(404))
    await assert.rejects(save(foreignClientId, 'nails', nailsDetails), status(404))
    await assert.rejects(save(randomUUID(), 'nails', nailsDetails), status(404))
    await pool.query('UPDATE salon_service_categories SET is_active = false WHERE salon_id = $1 AND category_id = $2', [salonId, categoryIds.lashes])
    await assert.rejects(save(otherClientId, 'lashes', completeDetails('lashes')), status(400))
    const disabledEdit = await save(clientId, 'lashes', completeDetails('lashes'), lashes.id, 'Edit historical disabled category')
    assert.equal(disabledEdit.notes, 'Edit historical disabled category')
    await pool.query('UPDATE salon_service_categories SET is_active = true WHERE salon_id = $1 AND category_id = $2', [salonId, categoryIds.lashes])
    console.log('PASS client/salon ownership is enforced; disabled categories retain existing forms but prevent new ones')

    let day = 0
    const dates = () => {
      const startsAt = new Date(Date.UTC(2035, 0, ++day, 10)).toISOString()
      return { startsAt, endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString() }
    }
    const appointmentClient = await client('Appointment intake client')
    const originalDetails = completeDetails('cosmetology', { treatmentPlan: 'Preserved appointment treatment' })
    const origin = await dataService.createAppointment({
      salonId, clientId: appointmentClient, professionalId: null, serviceIds: [serviceIds.cosmetology],
      source: 'internal', ...dates(), treatmentDetails: originalDetails, treatmentNotes: 'Appointment clinical notes',
    })
    const appointmentSnapshot = async (appointmentId: string) => ({
      appointment: await rows('appointments', appointmentId),
      details: (await pool.query('SELECT * FROM appointment_category_details WHERE appointment_id = $1 ORDER BY id', [appointmentId])).rows,
      treatments: (await pool.query(`SELECT tr.* FROM treatment_records tr JOIN appointment_services aps ON aps.id = tr.appointment_service_id
        WHERE aps.appointment_id = $1 ORDER BY tr.id`, [appointmentId])).rows,
      questionnaires: (await pool.query('SELECT * FROM health_questionnaires WHERE appointment_id = $1 ORDER BY id', [appointmentId])).rows,
    })
    const originalSnapshot = await appointmentSnapshot(origin.id)
    const loaded = (await list(appointmentClient)).find(item => item.category === 'cosmetology')!
    assert.ok(loaded.id)
    assert.equal(loaded.appointment_id, origin.id)
    assert.equal(loaded.form_details.healthPhone, originalDetails.healthPhone)
    assert.equal(loaded.form_details.phototype, originalDetails.phototype)
    assert.equal(loaded.form_details.professionalSignature, originalDetails.professionalSignature)
    assert.equal(loaded.notes, 'Appointment clinical notes')
    const editedAppointmentProfile = await save(appointmentClient, 'cosmetology', completeDetails('cosmetology', { healthPhone: '+525500009999' }), loaded.id, 'Updated client history')
    assert.equal(editedAppointmentProfile.form_details.healthPhone, '+525500009999')
    assert.deepEqual(await appointmentSnapshot(origin.id), originalSnapshot, 'editing the client profile must not rewrite the historical appointment or questionnaire')
    console.log('PASS appointment intake hydrates full form and notes; editing creates a separate version without changing appointment history')

    const fallbackClient = await client('Started appointment client')
    const fallbackDetails = completeDetails('micropigmentation')
    const quick = await dataService.createAppointment({
      salonId, clientId: fallbackClient, professionalId: null, serviceIds: [serviceIds.micropigmentation], source: 'internal', ...dates(),
    })
    await dataService.updateAppointmentTreatmentDetails(salonId, quick.id, {
      categoryCode: 'micropigmentation', treatmentDetails: fallbackDetails, treatmentNotes: 'Started appointment notes',
    })
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM health_profile_versions WHERE client_id = $1', [fallbackClient])).rows[0].count, 0)
    const fallback = (await list(fallbackClient))[0]
    assert.ok(fallback)
    assert.equal(fallback.id, null)
    assert.equal(fallback.category, 'micropigmentation')
    assert.equal(fallback.appointment_id, quick.id)
    assert.equal(fallback.is_valid, false)
    assert.deepEqual(fallback.form_details.healthAnswers, fallbackDetails.healthAnswers)
    assert.equal(fallback.notes, 'Started appointment notes')
    const changedFallbackDetails = { ...fallbackDetails, healthPhone: '+525500009991' }
    await dataService.updateAppointmentTreatmentDetails(salonId, quick.id, {
      categoryCode: 'micropigmentation', treatmentDetails: changedFallbackDetails, treatmentNotes: 'Updated while client editor is open',
    })
    const currentFallback = (await list(fallbackClient))[0]
    assert.equal(currentFallback.id, fallback.id)
    assert.notEqual(currentFallback.revision, fallback.revision)
    await assert.rejects(save(fallbackClient, 'micropigmentation', fallbackDetails, null, fallback.notes, fallback.revision), status(409))
    assert.equal((await list(fallbackClient))[0].form_details.healthPhone, '+525500009991')
    // Restore the source for the independent treatment-only fallback scenario.
    await dataService.updateAppointmentTreatmentDetails(salonId, quick.id, {
      categoryCode: 'micropigmentation', treatmentDetails: fallbackDetails, treatmentNotes: 'Started appointment notes',
    })
    await pool.query('DELETE FROM appointment_category_details WHERE appointment_id = $1', [quick.id])
    const treatmentOnly = (await list(fallbackClient))[0]
    assert.ok(treatmentOnly, 'legacy treatment-only data also loads')
    assert.deepEqual(treatmentOnly.form_details.healthAnswers, fallbackDetails.healthAnswers)
    assert.equal(treatmentOnly.notes, 'Started appointment notes')
    const fallbackSnapshot = await appointmentSnapshot(quick.id)
    const promoted = await save(fallbackClient, 'micropigmentation', fallbackDetails, null, fallback.notes)
    assert.ok(promoted.id)
    assert.equal(promoted.is_valid, true)
    assert.deepEqual(await appointmentSnapshot(quick.id), fallbackSnapshot)
    const emptyClient = await client('Non-clinical treatment client')
    await dataService.createAppointment({
      salonId, clientId: emptyClient, professionalId: null, serviceIds: [serviceIds.nails], source: 'internal', ...dates(),
      treatmentDetails: { style: 'Solid polish', healthAnswers: {} },
    })
    // Simulate a historical treatment-only record with no questionnaire/profile.
    await pool.query('DELETE FROM health_profile_versions WHERE client_id = $1', [emptyClient])
    await pool.query('DELETE FROM health_questionnaires WHERE client_id = $1', [emptyClient])
    assert.deepEqual(await list(emptyClient), [], 'non-clinical treatment details must not create a fake blank clinical form')
    console.log('PASS started appointments and legacy treatment-only records load without a profile; unrelated treatment data is excluded')

    const reusedClient = await client('Reused questionnaire client')
    const reusableDetails = completeDetails('cosmetology', { healthPhone: '+525500003333' })
    const firstVisit = await dataService.createAppointment({
      salonId, clientId: reusedClient, professionalId: null, serviceIds: [serviceIds.cosmetology], source: 'internal', ...dates(),
      treatmentDetails: reusableDetails, treatmentNotes: 'Original full clinical history',
    })
    const reusable = (await list(reusedClient))[0]
    assert.ok(reusable.questionnaire_id)
    const repeatedVisit = await dataService.createAppointment({
      salonId, clientId: reusedClient, professionalId: null, serviceIds: [serviceIds.cosmetology], source: 'internal', ...dates(),
      treatmentDetails: { healthAnswers: reusableDetails.healthAnswers, usedExistingHealthProfile: true, existingQuestionnaireId: reusable.questionnaire_id },
      treatmentNotes: 'Later appointment treatment notes',
    })
    assert.equal((await rows('health_questionnaires', reusable.questionnaire_id)).appointment_id, repeatedVisit.id,
      'fixture reproduces existing appointment reuse moving the questionnaire link')
    const reloadedReusable = (await list(reusedClient))[0]
    assert.equal(reloadedReusable.id, reusable.id)
    assert.equal(reloadedReusable.appointment_id, firstVisit.id)
    assert.equal(reloadedReusable.form_details.healthPhone, reusableDetails.healthPhone)
    assert.equal(reloadedReusable.form_details.professionalSignature, reusableDetails.professionalSignature)
    assert.equal(reloadedReusable.notes, 'Original full clinical history')
    console.log('PASS reusing a questionnaire in a later appointment retains the original full form and its notes')

    const updatedAtStartClient = await client('New intake after older profile client')
    const oldStartDetails = completeDetails('nails')
    const oldStartProfile = await save(updatedAtStartClient, 'nails', oldStartDetails, null, 'Old history')
    await pool.query("UPDATE health_profile_versions SET valid_from = now() - interval '1 day' WHERE id = $1", [oldStartProfile.id])
    const newStartVisit = await dataService.createAppointment({
      salonId, clientId: updatedAtStartClient, professionalId: null, serviceIds: [serviceIds.nails], source: 'internal', ...dates(),
    })
    const newerDetails = completeDetails('nails', {
      healthAnswers: { ...oldStartDetails.healthAnswers, chemical_allergies: 'yes' }, healthPhone: '+525500004444',
    })
    await dataService.updateAppointmentTreatmentDetails(salonId, newStartVisit.id, {
      categoryCode: 'nails', treatmentDetails: newerDetails, treatmentNotes: 'New health information at appointment start',
    })
    const newerAtStart = (await list(updatedAtStartClient))[0]
    assert.equal(newerAtStart.id, oldStartProfile.id, 'the older profile id remains the optimistic-write token')
    assert.equal(newerAtStart.appointment_id, newStartVisit.id)
    assert.equal((newerAtStart.form_details.healthAnswers as Record<string, unknown>).chemical_allergies, 'yes')
    assert.equal(newerAtStart.form_details.healthPhone, '+525500004444')
    assert.equal(newerAtStart.notes, 'New health information at appointment start')
    const newerAgainDetails = { ...newerDetails, healthPhone: '+525500009992' }
    await dataService.updateAppointmentTreatmentDetails(salonId, newStartVisit.id, {
      categoryCode: 'nails', treatmentDetails: newerAgainDetails, treatmentNotes: 'Another appointment update',
    })
    const newestAtStart = (await list(updatedAtStartClient))[0]
    assert.equal(newestAtStart.id, newerAtStart.id)
    assert.notEqual(newestAtStart.revision, newerAtStart.revision)
    await assert.rejects(save(updatedAtStartClient, 'nails', newerAtStart.form_details, newerAtStart.id, newerAtStart.notes, newerAtStart.revision), status(409))
    const newerStartSnapshot = await appointmentSnapshot(newStartVisit.id)
    const savedNewerStart = await save(updatedAtStartClient, 'nails', newestAtStart.form_details, newestAtStart.id, newestAtStart.notes, newestAtStart.revision)
    assert.notEqual(savedNewerStart.id, oldStartProfile.id)
    assert.equal((await rows('health_profile_versions', oldStartProfile.id)).status, 'superseded')
    assert.equal((await list(updatedAtStartClient))[0].id, savedNewerStart.id)
    assert.deepEqual(await appointmentSnapshot(newStartVisit.id), newerStartSnapshot)
    console.log('PASS newer appointment-start answers replace stale profile data and can be saved without rewriting their appointment')

    const currentFlowClient = await client('Current specialized forms client')
    const general = {
      generalFullName: 'Current specialized client', generalPhone: '+525500008888', generalDateOfBirth: '02/21/1990',
      generalEmail: 'current@example.test', isFirstTime: 'No', phototype: 'Type III',
      healthHistory: ['Diabetes', 'Cosmetics'],
      professionalSignature: 'Clinical professional', consentDate: '2030-01-01',
    }
    const lashZones = [8, 9, 10, 11, 12, 13, 14].map(position => ({ position, length: 11 }))
    const actualForms: Record<Category, Record<string, unknown>> = {
      nails: { nailServiceType: 'Manicure', nailType: 'Almond', materials: ['Polygel'], materialLabels: ['Polygel'], extraNotes: 'Sensitive cuticles' },
      lashes: {
        style: 'Cat eye', variant: 'Base', eyeShape: 'Almond eyes', volume: 'Classic', curl: 'C', thickness: '0.07',
        defaultLength: '11', lashMap: { rightEye: lashZones, leftEye: lashZones },
      },
      cosmetology: {
        ...general, serviceType: 'Facial Cleansing', negativeExperience: 'No', currentMedications: 'None', smoking: 'No',
        alcohol: 'No', skin_type: 'Sensitive', faceAnnotations: [{ id: 'redness', type: 'Sensitivity/redness', x: 10, y: 20 }],
      },
      micropigmentation: {
        ...general, procedure: 'Microblading', procedures: ['Microblading'], herpesSimplex: 'No',
        pigment_brand: 'Perma Blend', needleType: '18U', clientDesignSignature: '10,10 20,20 30,15', negativeExperience: 'No',
      },
    }
    const { getCosmetologyDetailsMissingItems } = await import('../src/pages/app/appointment-booking/categories/cosmetology/cosmetologyDetailsSpec.ts')
    const { getMicropigmentationDetailsMissingItems } = await import('../src/pages/app/appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec.ts')
    const { getLashesDetailsMissingItems } = await import('../src/pages/app/lashes-booking/lashesDetailsValidation.ts')
    assert.deepEqual(getCosmetologyDetailsMissingItems(actualForms.cosmetology), [])
    assert.deepEqual(getMicropigmentationDetailsMissingItems(actualForms.micropigmentation), [])
    assert.deepEqual(getLashesDetailsMissingItems(actualForms.lashes), [])
    const actualVisitIds = new Map<Category, string>()
    for (const category of Object.keys(actualForms) as Category[]) {
      assert.equal(actualForms[category].healthAnswers, undefined, 'current specialized forms do not use legacy healthAnswers')
      assert.ok(clientClinicalFormSchema.safeParse({ details: actualForms[category], notes: '', expectedProfileId: null, expectedRevision: null }).success,
        `${category} payload must pass the actual route schema`)
      const visit = await dataService.createAppointment({
        salonId, clientId: currentFlowClient, professionalId: null, serviceIds: [serviceIds[category]], source: 'internal', ...dates(),
      })
      await dataService.updateAppointmentTreatmentDetails(salonId, visit.id, {
        categoryCode: category, treatmentDetails: actualForms[category], treatmentNotes: `Current ${category} notes`,
      })
      actualVisitIds.set(category, visit.id)
    }
    const actualLoaded = await list(currentFlowClient)
    assert.deepEqual(actualLoaded.map(item => item.category).sort(), Object.keys(actualForms).sort())
    for (const category of Object.keys(actualForms) as Category[]) {
      const form = actualLoaded.find(item => item.category === category)!
      assert.equal(form.id, null)
      assert.equal(form.appointment_id, actualVisitIds.get(category))
      assert.deepEqual(form.form_details, actualForms[category])
      const historical = await appointmentSnapshot(form.appointment_id!)
      const saved = await save(currentFlowClient, category, form.form_details, null, form.notes)
      assert.ok(saved.id)
      for (const [key, value] of Object.entries(actualForms[category])) assert.deepEqual(saved.form_details[key], value)
      assert.equal(saved.notes, `Current ${category} notes`)
      if (category === 'micropigmentation') {
        const reusable = await dataService.getHealthProfile(salonId, currentFlowClient, category)
        assert.deepEqual(reusable?.answers.healthHistory, actualForms[category].healthHistory,
          'the existing appointment profile reader keeps current-form health information')
        assert.equal(saved.form_details.healthAnswers, undefined, 'structured medical fields must not masquerade as legacy Yes/No answers')
      }
      assert.deepEqual(await appointmentSnapshot(form.appointment_id!), historical)
    }
    const currentSaved = await list(currentFlowClient)
    assert.equal(currentSaved.length, 4)
    await assert.rejects(save(currentFlowClient, 'cosmetology', { ...actualForms.cosmetology, currentMedications: '' },
      currentSaved.find(item => item.category === 'cosmetology')!.id), status(400))
    await assert.rejects(save(currentFlowClient, 'micropigmentation', { ...actualForms.micropigmentation, clientDesignSignature: '' },
      currentSaved.find(item => item.category === 'micropigmentation')!.id), status(400))
    await assert.rejects(save(currentFlowClient, 'lashes', { ...actualForms.lashes, lashMap: {} },
      currentSaved.find(item => item.category === 'lashes')!.id), status(400))
    console.log('PASS all four current specialized forms load and save without legacy healthAnswers, retain appointment snapshots and enforce original validation')

    for (let i = 0; i < 16; i++) await client(`Free client ${i}`, salonId, '2021-01-01T00:00:00Z')
    const lockedClient = await client('Locked Free client', salonId, '2090-01-01T00:00:00Z')
    assert.deepEqual(await list(lockedClient), [], 'clinical records remain readable when a client is subscription-locked')
    await assert.rejects(save(lockedClient, 'nails', nailsDetails), status(403))
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM health_questionnaires WHERE client_id = $1', [lockedClient])).rows[0].count, 0)
    await pool.query('UPDATE clients SET created_at = $2 WHERE id = $1', [clientId, '2091-01-01T00:00:00Z'])
    const lockedExisting = await list(clientId)
    assert.equal(lockedExisting.length, 2, 'subscription locking must not hide existing clinical history')
    await assert.rejects(save(clientId, 'nails', nailsDetails, lockedExisting.find(item => item.category === 'nails')!.id), status(403))
    console.log('PASS Free-plan locked clients can read clinical records but cannot mutate them')
  } finally {
    await pool.end()
  }
}

async function runIsolatedCluster() {
  const bin = await postgresBin()
  const root = await mkdtemp(path.join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'glamhour-client-clinical-forms-'))
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
      cwd: repo, stdio: 'inherit', timeout: 90_000,
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
