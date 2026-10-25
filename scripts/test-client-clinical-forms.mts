#!/usr/bin/env -S npx tsx
// Isolated browser regression. All API methods use fixtures and external HTTP
// requests are blocked; no salon, client, or clinical data is read or changed.
import assert from 'node:assert/strict'
import type { Locator, Page } from 'playwright'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')

const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ClientsPage } from '/src/pages/app/ClientsPage.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import { ApiClientError } from '/src/lib/api.ts';
import { healthQuestionnaires, allQuestionIds } from '/src/pages/app/appointment-booking/health-questionnaires.ts';
import '/src/index.css';
const scenario = new URLSearchParams(location.search).get('scenario') || 'normal';
sessionStorage.setItem('glamhour:active-salon-id', 'local-salon-clinical-forms');
const client = { id: 'client-one', salon_id: 'local-salon-clinical-forms', full_name: 'Alice Clinical', email: 'alice@example.test', phone: '+1 555 010 1234', notes: 'Ordinary client note', date_of_birth: null, preferred_language: 'English', created_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-01T00:00:00Z' };
const otherClient = { ...client, id: 'client-two', full_name: 'Beatrice Separate', email: 'beatrice@example.test', phone: '+1 555 010 5678', created_at: '2021-01-01T00:00:00Z' };
function profile(category, person = client) {
  const definition = healthQuestionnaires[category];
  const answers = Object.fromEntries(allQuestionIds(definition).map(id => [id, 'no']));
  return {
    id: person.id + '-' + category + '-profile', revision: person.id + '-' + category + '-revision', category, status: 'active', valid_from: '2026-01-01T00:00:00Z', valid_until: '2035-01-01T00:00:00Z', completed_at: '2026-01-01T00:00:00Z', questionnaire_type: 'appointment_intake', questionnaire_id: person.id + '-' + category + '-questionnaire', is_valid: true, answers,
    appointment_id: 'original-appointment-' + category, notes: 'Original ' + category + ' clinical note',
    form_details: { healthAnswers: answers, consentItems: Object.fromEntries(definition.consentItems.map(item => [item.id, true])), professionalSignature: '10,10 20,20 40,10', clientSignature: '5,5 15,15 25,5', healthFullName: person.full_name, healthPhone: person.phone, healthEmail: person.email, phototype: definition.showPhototype ? 'III' : undefined, consentDate: '2026-01-01', consentTime: '10:30' },
  };
}
const byClient = new Map([
  [client.id, scenario === 'empty' ? [] : [profile('nails'), profile('cosmetology')]],
  [otherClient.id, scenario === 'locked' ? [profile('nails', otherClient)] : []],
]);
if (scenario === 'current-category' || scenario === 'recovered-category') {
  byClient.set(client.id, [{ ...profile('cosmetology'),
    ...(scenario === 'recovered-category' ? { id: null, questionnaire_id: null, is_valid: false } : {}),
    answers: {}, form_details: {
    serviceType: 'Facial Cleansing', generalFullName: client.full_name, generalPhone: client.phone,
    generalDateOfBirth: '01/01/1990', generalEmail: client.email, isFirstTime: 'No',
    healthHistory: ['Diabetes'], negativeExperience: 'No', currentMedications: 'Original medication',
    smoking: 'No', alcohol: 'Never', skin_type: 'Normal', phototype: 'Type III',
    professionalSignature: 'Local Specialist', consentDate: '2026-01-01',
  } }]);
}
if (scenario === 'current-micro') {
  byClient.set(client.id, [{ ...profile('micropigmentation'), answers: {}, form_details: {
    procedure: 'Microblading', procedures: ['Microblading', 'Eyeliner'],
    generalFullName: client.full_name, generalPhone: client.phone, generalDateOfBirth: '01/01/1990',
    generalEmail: client.email, isFirstTime: 'No', healthHistory: ['Diabetes'],
    currentMedications: 'Original micro medication', phototype: 'Type III', herpesSimplex: 'No',
    pigment_brand: 'Perma Blend', needleType: '18U', professionalSignature: 'Local Specialist',
    consentDate: '2026-01-01', clientDesignSignature: '5,5 15,15 25,5',
  } }]);
}
if (scenario === 'current-lashes') {
  const entries = [8, 9, 10, 11, 12, 13, 14].map(position => ({ position, length: 10 }));
  byClient.set(client.id, [{ ...profile('lashes'), answers: {}, form_details: {
    style: 'Anime', variant: 'Classic', eyeShape: 'Almond eyes', volume: 'Classic', curl: 'C',
    thickness: '0.07', defaultLength: '10', lashMapLength: 10, lashMap: { rightEye: entries, leftEye: entries },
  } }]);
}
window.clinicalReads = [];
window.clinicalWrites = [];
window.completedClinicalWrites = [];
window.unexpectedMutations = [];
let listAttempts = 0;
glamhourApi.clients = async () => [client, otherClient];
glamhourApi.subscription = async () => ({ subscription: null, hasPremiumAccess: scenario !== 'locked', clientUsage: { count: 2, limit: scenario === 'locked' ? 1 : null, canCreateClient: scenario !== 'locked' } });
glamhourApi.categories = async () => scenario === 'empty' ? [] : [
  { id: 'category-nails', code: 'nails', name: 'Nails', is_active: true },
  { id: 'category-lashes', code: 'lashes', name: 'Lashes', is_active: true },
];
glamhourApi.services = async () => [];
glamhourApi.serviceMaterials = async () => [];
for (const method of ['createService', 'ensureService', 'createAppointment', 'updateAppointmentTreatmentDetails']) {
  glamhourApi[method] = async () => { window.unexpectedMutations.push(method); throw new Error('Clinical forms must not call ' + method); };
}
glamhourApi.clientClinicalForms = async clientId => {
  window.clinicalReads.push(clientId);
  if (scenario === 'load-error' && listAttempts++ === 0) throw new Error('Temporary clinical profile loading failure');
  return structuredClone(byClient.get(clientId) || []);
};
glamhourApi.saveClientClinicalForm = async (clientId, category, input) => {
  window.clinicalWrites.push(structuredClone({ clientId, category, input }));
  await new Promise(resolve => setTimeout(resolve, 150));
  if (scenario === 'save-error' && window.clinicalWrites.length === 1) throw new Error('Temporary clinical save failure');
  if (scenario === 'conflict' && window.clinicalWrites.length === 1) {
    byClient.set(clientId, byClient.get(clientId).map(form => form.category === category ? { ...form, id: 'external-new-profile', notes: 'Changed in another session' } : form));
    throw new ApiClientError(409, 'CONFLICT', 'This clinical form was updated in another session.');
  }
  const saved = { ...profile(category, clientId === client.id ? client : otherClient), id: 'saved-profile-' + window.clinicalWrites.length, revision: 'saved-revision-' + window.clinicalWrites.length, questionnaire_type: 'client_clinical_form', questionnaire_id: 'saved-questionnaire-' + window.clinicalWrites.length, appointment_id: null, form_details: structuredClone(input.details), answers: structuredClone(input.details.healthAnswers), notes: input.notes };
  byClient.set(clientId, [...(byClient.get(clientId) || []).filter(form => form.category !== category), saved]);
  window.completedClinicalWrites.push(structuredClone(saved));
  return saved;
};
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, null, React.createElement(ClientsPage)));
</script></body></html>`

const server = await createServer({
  logLevel: 'error', cacheDir: 'node_modules/.vite-client-clinical-forms',
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{
    name: 'client-clinical-forms-regression',
    configureServer(vite) {
      vite.middlewares.use('/__client_clinical_forms__', async (req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html))
        } catch (error) { next(error) }
      })
    },
  }],
})

type ClinicalWrite = {
  clientId: string
  category: string
  input: { expectedProfileId: string | null; expectedRevision: string | null; notes: string; details: Record<string, unknown> }
}

function categoryCard(dialog: Locator, category: string) {
  return dialog.getByRole('region', { name: `${category} clinical form`, exact: true })
}

async function openForms(page: Page, clientName = 'Alice Clinical') {
  await page.getByRole('button', { name: `Clinical forms for ${clientName}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clinical forms', exact: true })
  await dialog.waitFor({ state: 'visible' })
  return dialog
}

async function openEditor(dialog: Locator, category: string) {
  await categoryCard(dialog, category).getByRole('button', { name: 'View form', exact: true }).click()
  await dialog.getByRole('button', { name: 'Edit form', exact: true }).click()
  await dialog.getByLabel('Additional clinical notes').waitFor()
}

async function waitForSave(page: Page, count: number) {
  await page.waitForFunction(expected => (window as unknown as { completedClinicalWrites: unknown[] }).completedClinicalWrites.length === expected, count)
}

async function writes(page: Page) {
  return page.evaluate(() => (window as unknown as { clinicalWrites: ClinicalWrite[] }).clinicalWrites)
}

async function assertMobileLayout(page: Page, dialog: Locator) {
  const bounds = await dialog.boundingBox()
  assert.ok(bounds)
  const viewport = page.viewportSize()!
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, 'dialog remains within the mobile viewport')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal page overflow')
  const footer = dialog.locator('footer')
  if (await footer.count()) {
    const footerBounds = await footer.boundingBox()
    assert.ok(footerBounds && footerBounds.y + footerBounds.height <= viewport.height + 1, 'actions remain visible above the mobile viewport edge')
  }
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

  const scenarios = process.argv.slice(2)
  for (const scenario of scenarios.length ? scenarios : ['normal', 'load-error', 'save-error', 'conflict', 'locked', 'empty', 'current-category', 'recovered-category', 'current-micro', 'current-lashes']) {
    const context = await browser.newContext({ viewport: scenario === 'normal' ? { width: 320, height: 640 } : { width: 393, height: 852 } })
    context.setDefaultTimeout(15000)
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/__client_clinical_forms__?scenario=${scenario}`)
      const dialog = await openForms(page, scenario === 'locked' ? 'Beatrice Separate' : undefined)

      if (scenario === 'load-error') {
        await dialog.getByText('Could not load clinical forms. Temporary clinical profile loading failure', { exact: true }).waitFor()
        assert.equal(await dialog.getByRole('button', { name: 'Add form', exact: true }).count(), 0, 'load failure never becomes an empty editable record')
        await dialog.getByRole('button', { name: 'Retry', exact: true }).click()
        await categoryCard(dialog, 'Nails').getByRole('button', { name: 'View form', exact: true }).waitFor()
        assert.equal(await page.evaluate(() => (window as unknown as { clinicalReads: string[] }).clinicalReads.length), 2)
      } else if (scenario === 'empty') {
        await page.waitForFunction(() => (window as unknown as { clinicalReads: string[] }).clinicalReads.length > 0)
        assert.equal(await dialog.getByRole('button', { name: /^(Add form|Edit form)$/ }).count(), 0, 'no disabled or absent category is offered for new forms')
      } else if (scenario === 'locked') {
        await categoryCard(dialog, 'Nails').getByRole('button', { name: 'View form', exact: true }).click()
        await dialog.getByText('Original nails clinical note', { exact: true }).waitFor()
        assert.equal(await dialog.getByRole('button', { name: /^(Add form|Edit form|Save form)$/ }).count(), 0, 'locked clients retain read-only clinical access')
        assert.deepEqual(await writes(page), [])
      } else if (scenario === 'current-category' || scenario === 'recovered-category') {
        await openEditor(dialog, 'Cosmetology')
        assert.equal(await dialog.getByRole('heading', { name: 'Health Questionnaire', exact: true }).count(), 0, 'current appointment forms use the category editor')
        assert.equal(await dialog.getByLabel('Full name', { exact: false }).inputValue(), 'Alice Clinical')
        assert.equal(await dialog.getByLabel('Current medications', { exact: false }).inputValue(), 'Original medication')
        await dialog.getByLabel('Current medications', { exact: false }).fill('Updated medication')
        await dialog.getByLabel('Additional clinical notes').fill('Updated current category form')
        await assertMobileLayout(page, dialog)
        await dialog.getByRole('button', { name: scenario === 'current-category' ? 'Confirm and Submit' : 'Save form', exact: true }).click()
        await waitForSave(page, 1)
        const updated = (await writes(page))[0]
        assert.equal(updated.input.details.currentMedications, 'Updated medication')
        assert.equal(updated.input.details.generalFullName, 'Alice Clinical')
        assert.equal(updated.input.details.skin_type, 'Normal')
        assert.equal(updated.input.details.phototype, 'Type III')
        assert.deepEqual(updated.input.details.healthHistory, ['Diabetes'])
        assert.equal(updated.input.expectedProfileId, scenario === 'recovered-category' ? null : 'client-one-cosmetology-profile')
        assert.equal(updated.input.expectedRevision, 'client-one-cosmetology-revision', 'recovered appointment forms retain their concurrency revision')
        await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()
        await categoryCard(dialog, 'Nails').getByRole('button', { name: 'Add form', exact: true }).click()
        await dialog.getByRole('button', { name: 'Manicure', exact: true }).click()
        await dialog.getByRole('button', { name: 'Round', exact: true }).click()
        await dialog.getByLabel('Additional clinical notes').fill('New independent nail form')
        await assertMobileLayout(page, dialog)
        await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
        await waitForSave(page, 2)
        const added = (await writes(page))[1]
        assert.equal(added.clientId, 'client-one')
        assert.equal(added.category, 'nails')
        assert.equal(added.input.expectedProfileId, null)
        assert.equal(added.input.expectedRevision, null)
        assert.equal(added.input.details.nailServiceType, 'Manicure')
        assert.equal(added.input.details.nailType, 'Round')
        assert.equal(added.input.details.currentMedications, undefined, 'new categories do not inherit unrelated clinical data')
        await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()
        await categoryCard(dialog, 'Nails').getByRole('button', { name: 'View form', exact: true }).waitFor()
        await categoryCard(dialog, 'Cosmetology').getByRole('button', { name: 'View form', exact: true }).waitFor()
        await openEditor(dialog, 'Cosmetology')
        assert.equal(await dialog.getByLabel('Current medications', { exact: false }).inputValue(), 'Updated medication', 'editing another category preserves the original category')
        await page.screenshot({ path: '/tmp/glamhour-current-clinical-form.png', fullPage: true })
      } else if (scenario === 'current-micro') {
        await openEditor(dialog, 'Micropigmentation')
        assert.equal(await dialog.getByLabel('Current medications', { exact: false }).inputValue(), 'Original micro medication')
        await dialog.getByLabel('Current medications', { exact: false }).fill('Updated micro medication')
        await dialog.getByLabel('Additional clinical notes').fill('Updated micropigmentation note')
        await dialog.getByRole('button', { name: 'Confirm and Submit', exact: true }).click()
        await waitForSave(page, 1)
        const saved = (await writes(page))[0]
        assert.equal(saved.category, 'micropigmentation')
        assert.equal(saved.input.details.currentMedications, 'Updated micro medication')
        assert.equal(saved.input.details.generalFullName, 'Alice Clinical')
        assert.equal(saved.input.details.clientDesignSignature, '5,5 15,15 25,5')
        assert.deepEqual(saved.input.details.procedures, ['Microblading', 'Eyeliner'])
        assert.equal(saved.input.details.micropigmentationServiceIds, undefined, 'temporary catalogue ids are not saved to client records')
      } else if (scenario === 'current-lashes') {
        await openEditor(dialog, 'Lashes')
        assert.equal(await dialog.getByRole('button', { name: 'Anime', exact: true }).getAttribute('aria-pressed'), 'true')
        await dialog.getByRole('button', { name: '0.10', exact: true }).click()
        await dialog.getByLabel('Additional clinical notes').fill('Updated lash note')
        await dialog.getByRole('button', { name: 'Save form', exact: true }).click()
        await waitForSave(page, 1)
        const saved = (await writes(page))[0]
        assert.equal(saved.category, 'lashes')
        assert.equal(saved.input.details.style, 'Anime')
        assert.equal(saved.input.details.thickness, '0.10')
        const lashMap = saved.input.details.lashMap as { rightEye: unknown[]; leftEye: unknown[] }
        assert.equal(lashMap.rightEye.length, 7)
        assert.equal(lashMap.leftEye.length, 7)
        assert.equal(saved.input.details.registrationStep, undefined, 'editor navigation is not stored in the client profile')
      } else {
        await openEditor(dialog, 'Nails')
        assert.equal(await dialog.getByLabel('Full name', { exact: true }).inputValue(), 'Alice Clinical')
        assert.equal(await dialog.getByLabel('Phone number', { exact: true }).inputValue(), '+1 555 010 1234')
        assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), 'alice@example.test')
        assert.equal(await dialog.locator('input[name="nails-chemical_allergies"][value="no"]').isChecked(), true)
        assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Original nails clinical note')
        assert.equal(await dialog.getByRole('checkbox').evaluateAll(elements => elements.every(element => (element as HTMLInputElement).checked)), true, 'appointment consents are prefilled')
        assert.equal(await dialog.locator('svg path[d="M 10 10 L 20 20 L 40 10"]').count(), 1, 'appointment professional signature is prefilled')
        await assertMobileLayout(page, dialog)

        await dialog.locator('input[name="nails-chemical_allergies"][value="yes"]').check()
        await dialog.getByLabel('Additional clinical notes').fill('Updated allergy details from client module')
        const save = dialog.getByRole('button', { name: 'Save form', exact: true })
        await save.click()
        assert.equal(await save.isDisabled(), true, 'save prevents duplicate submissions while pending')
        if (scenario === 'conflict') {
          await dialog.getByText('This clinical form was updated in another session.', { exact: true }).waitFor()
          assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Updated allergy details from client module', 'conflict retains the unsaved draft for review')
          assert.equal(await save.isDisabled(), true, 'stale forms cannot overwrite newer data')
          await dialog.getByRole('button', { name: 'Reload saved forms', exact: true }).click()
          await openEditor(dialog, 'Nails')
          assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Changed in another session')
          assert.equal((await writes(page)).length, 1, 'reload does not repeat a stale write')
          assert.deepEqual(errors, [])
          console.log('PASS client clinical forms: conflict')
          continue
        }
        if (scenario === 'save-error') {
          await dialog.getByText('Temporary clinical save failure', { exact: true }).waitFor()
          assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Updated allergy details from client module')
          assert.equal(await dialog.locator('input[name="nails-chemical_allergies"][value="yes"]').isChecked(), true)
          await save.click()
        }
        await waitForSave(page, 1)
        const savedWrites = await writes(page)
        assert.equal(savedWrites.length, scenario === 'save-error' ? 2 : 1)
        const saved = savedWrites.at(-1)!
        assert.equal(saved.clientId, 'client-one')
        assert.equal(saved.category, 'nails')
        assert.equal(saved.input.expectedProfileId, 'client-one-nails-profile')
        assert.equal(saved.input.expectedRevision, 'client-one-nails-revision')
        assert.equal(saved.input.notes, 'Updated allergy details from client module')
        assert.equal((saved.input.details.healthAnswers as Record<string, string>).chemical_allergies, 'yes')
        assert.equal(saved.input.details.professionalSignature, '10,10 20,20 40,10')
        assert.equal(saved.input.details.clientSignature, '5,5 15,15 25,5')
        if (scenario === 'save-error') assert.deepEqual(savedWrites[0], savedWrites[1], 'retry submits the identical clinical values')

        await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()
        await openEditor(dialog, 'Nails')
        assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Updated allergy details from client module')
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()

        if (scenario === 'normal') {
          assert.equal(await categoryCard(dialog, 'Micropigmentation').count(), 0, 'disabled category without history remains absent')
          await openEditor(dialog, 'Cosmetology')
          assert.equal(await dialog.getByLabel('Additional clinical notes').inputValue(), 'Original cosmetology clinical note', 'existing disabled-category form remains available')
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
          await dialog.getByRole('button', { name: 'Back to forms', exact: true }).click()
          await page.screenshot({ path: '/tmp/glamhour-client-clinical-forms.png', fullPage: true })
          await dialog.getByRole('button', { name: 'Close', exact: true }).click()

          const secondDialog = await openForms(page, 'Beatrice Separate')
          await categoryCard(secondDialog, 'Nails').getByRole('button', { name: 'Add form', exact: true }).click()
          await secondDialog.getByRole('button', { name: 'Manicure', exact: true }).waitFor()
          assert.equal(await secondDialog.getByLabel('Additional clinical notes').inputValue(), '')
          assert.equal(await secondDialog.getByRole('radio', { checked: true }).count(), 0, 'changing client never leaks another client answers')
          assert.equal(await secondDialog.locator('svg path[d="M 10 10 L 20 20 L 40 10"]').count(), 0, 'changing client never leaks signatures')
          assert.equal((await writes(page)).length, 1)
          await secondDialog.getByLabel('Additional clinical notes').fill('Unsent draft')
          await secondDialog.getByRole('button', { name: 'Close', exact: true }).click()
          await secondDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
          assert.equal(await secondDialog.getByLabel('Additional clinical notes').inputValue(), 'Unsent draft', 'dismissal protection retains the unsaved draft')
          await secondDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
          await secondDialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
          await categoryCard(secondDialog, 'Nails').getByRole('button', { name: 'Add form', exact: true }).waitFor()
          assert.equal((await writes(page)).length, 1, 'discarding a draft does not create a record')
          await secondDialog.getByRole('button', { name: 'Close', exact: true }).click()
          await page.getByRole('button', { name: 'View Alice Clinical', exact: true }).click()
          await page.getByRole('dialog').getByRole('button', { name: 'Clinical forms', exact: true }).click()
          await categoryCard(page.getByRole('dialog', { name: 'Clinical forms', exact: true }), 'Nails').getByRole('button', { name: 'View form', exact: true }).waitFor()
        }
      }
      assert.deepEqual(await page.evaluate(() => (window as unknown as { unexpectedMutations: string[] }).unexpectedMutations), [], 'clinical forms never create services or mutate appointments')
      assert.deepEqual(errors, [], 'clinical form flows do not raise React or browser errors')
      console.log(`PASS client clinical forms: ${scenario}`)
    } catch (error) {
      await page.screenshot({ path: `/tmp/glamhour-clinical-${scenario}-failure.png`, fullPage: true })
      throw error
    } finally { await context.close() }
  }
} finally {
  await browser?.close()
  await server.close()
}
