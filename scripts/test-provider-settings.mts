#!/usr/bin/env -S npx tsx
// Local regression for legacy provider languages and independent working hours.
// API methods are replaced with fixtures; no remote data is read or changed.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import type { Locator, Page } from 'playwright'
import { createServer } from 'vite'
import { normalizeLanguages, providerLanguageOptions, providerScheduleErrors, normalizeProviderSchedule } from '../src/lib/provider-settings.ts'
import { emptyProfessionalDraft, normalizeProfessionalDraft } from '../src/components/screen/professionalDraft.ts'
import { upsertProfessionalSchema } from '../server/validation.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
assert.deepEqual(providerLanguageOptions, ['English', 'Spanish', 'Portuguese'])
assert.deepEqual(normalizeLanguages(['en', ' EN ', 'es', ' English ', 'SPANISH', 'pt', ' Portuguese ', 'Arabic', 'ar', '', 'French', 'french']), ['English', 'Spanish', 'Portuguese'])
assert.deepEqual(normalizeLanguages(['Arabic', 'ar', 'French', 'fr', '']), [], 'unsupported stored languages do not become selectable or silently select another language')
const salonHours = { Tuesday: { enabled: true, open: '10:00', close: '18:00' } }
const independent = normalizeProviderSchedule({ Monday: { enabled: true, open: '08:00', close: '20:00' }, Tuesday: { enabled: true, open: '09:00', close: '19:00' } })
assert.equal(independent.Monday.enabled, true)
assert.deepEqual(providerScheduleErrors(independent), {})
assert.deepEqual(normalizeProfessionalDraft({ ...emptyProfessionalDraft(salonHours), useSalonSchedule: false, schedule: independent }, salonHours).schedule, independent)
assert.deepEqual(normalizeProfessionalDraft({ ...emptyProfessionalDraft(salonHours), useSalonSchedule: true, schedule: independent }, salonHours).schedule, salonHours)
assert.ok(providerScheduleErrors({ Tuesday: { enabled: true, open: '18:00', close: '10:00' } }).Tuesday)

const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Button, ProfessionalEditorModal, emptyProfessionalDraft } from '/src/components/index.ts';
import { NailSettingsPage } from '/src/pages/app/NailSettingsPage.tsx';
import { StaffPage } from '/src/pages/app/StaffPage.tsx';
import { HomePage } from '/src/pages/app/HomePage.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import '/src/index.css';
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario');
let enabledCodes = scenario === 'none' ? [] : ['nails'];
const schedule = Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { enabled: !['Monday', 'Sunday'].includes(day), open: '10:00', close: '18:00' }]));
const service = { id: 'nail-service', name: 'Manicure', category_id: 'nails', category_code: 'nails', category_name: 'Nails', description: '', price_minor: 1000, duration_minutes: 60, is_active: true, sort_order: 1 };
const disabledService = { ...service, id: 'lash-service', category_id: 'lashes', category_code: 'lashes', category_name: 'Lashes', name: 'Lash extensions' };
const inactiveService = { ...service, id: 'retired-service', name: 'Retired manicure', is_active: false };
const legacySchedule = { ...schedule, Monday: { enabled: true, open: '09:00', close: '18:00' } };
let provider = { id: 'provider-local', full_name: 'Local Specialist', email: '', phone: '', avatar_url: null, languages: ['en', 'es', 'pt', ' EN ', 'English', 'Spanish', 'Portuguese', 'Arabic', 'ar', 'French'], status: 'active', salon_earnings_percent: 40, professional_earnings_percent: 60, use_salon_schedule: false, schedule: legacySchedule, service_assignments: [{ service_id: service.id, is_active: true, duration_override_minutes: 60 }, { service_id: disabledService.id, is_active: true, duration_override_minutes: 60 }] };
if (scenario === 'stale') provider.service_assignments = provider.service_assignments.filter(a => a.service_id === disabledService.id);
const staffEdit = scenario === 'staff-edit-limit';
if (staffEdit) provider = { ...provider, email: 'local@example.test', phone: '+1 555 010 2020', salon_earnings_percent: '35.00', professional_earnings_percent: '65.00', service_assignments: provider.service_assignments.map(a => ({ ...a, duration_override_minutes: 75, price_override_minor: 1300 })) };
const staffProviders = () => staffEdit ? [provider, ...Array.from({ length: 9 }, (_, index) => ({ ...provider, id: 'other-provider-' + index, full_name: 'Other Specialist ' + (index + 1) }))] : [provider];
window.saves = [];
window.updatedProviders = [];
window.createdProviders = [];
window.settingsSaves = [];
window.catalogReads = { categories: 0, services: 0 };
const settingsResponse = () => ({ salon: { id: 'local-salon-provider-test' }, category: { id: 'nails', code: 'nails', isEnabled: enabledCodes.includes('nails') }, services: [service], materials: [], providers: staffProviders(), salonSchedule: schedule, activeStaffCount: staffProviders().length, staffLimit: 10 });
glamhourApi.nailSettings = async () => settingsResponse();
glamhourApi.services = async () => { window.catalogReads.services += 1; return scenario === 'empty-services' ? [] : [service, disabledService, inactiveService]; };
glamhourApi.categories = async () => { window.catalogReads.categories += 1; if (scenario === 'catalog-error') throw new Error('Local category catalog error'); return enabledCodes.map(code => ({ id: code, code, name: code === 'nails' ? 'Nails' : 'Lashes' })); };
glamhourApi.professionals = async () => staffProviders().map(person => staffEdit ? Object.fromEntries(Object.entries(person).filter(([key]) => !['schedule', 'use_salon_schedule'].includes(key))) : person);
glamhourApi.appointments = async () => [];
glamhourApi.subscription = async () => ({ subscription: null, hasPremiumAccess: false, clientUsage: { count: 0, canCreateClient: true } });
glamhourApi.dashboard = async () => ({ salon: { id: 'local-salon-provider-test', name: 'Local salon', slug: 'local-salon', currency_code: 'USD', timezone: 'UTC' }, revenue: { amountMinor: 0, currencyCode: 'USD' }, appointmentCount: 0, slotsRemaining: 0, activeStaffCount: 1, staffLimit: 10, upcomingAppointments: [], nextHourAppointmentCount: 0, emptyStateFlags: { noAppointmentsToday: true, noActiveStaff: false, staffLimitReached: false } });
glamhourApi.updateNailSettings = async input => { window.settingsSaves.push(input); enabledCodes = input.categoryEnabled ? ['nails'] : []; return settingsResponse(); };
glamhourApi.updateProfessional = async (id, input) => { window.updatedProviders.push({ id, input }); if (staffEdit && window.updatedProviders.length === 1) throw new Error('Temporary provider update failure'); window.saves.push(input); provider = { ...provider, full_name: input.fullName, email: input.email, phone: input.phone, avatar_url: input.avatarUrl, salon_earnings_percent: String(input.salonEarningsPercent), professional_earnings_percent: String(input.professionalEarningsPercent), languages: input.languages, schedule: input.schedule, use_salon_schedule: input.useSalonSchedule, service_assignments: input.serviceAssignments.map(a => ({ service_id: a.serviceId, is_active: a.isActive, duration_override_minutes: a.durationOverrideMinutes, price_override_minor: a.priceOverrideMinor })) }; return provider; };
glamhourApi.createProfessional = async input => { window.saves.push(input); window.createdProviders.push(input); return { ...provider, full_name: input.fullName }; };
function Harness() {
  const [open, setOpen] = useState(false);
  const [availableCodes, setAvailableCodes] = useState(enabledCodes);
  window.setEnabledCategories = setAvailableCodes;
  const [draft, setDraft] = useState({ ...emptyProfessionalDraft(schedule), id: provider.id, fullName: provider.full_name, languages: provider.languages, schedule: legacySchedule, useSalonSchedule: false, serviceAssignments: provider.service_assignments.map(a => ({ serviceId: a.service_id, isActive: a.is_active, durationOverrideMinutes: a.duration_override_minutes })) });
  if (params.has('nails')) return React.createElement(NailSettingsPage);
  if (params.get('surface') === 'staff-page') return React.createElement(StaffPage);
  if (params.get('surface') === 'home-page') return React.createElement(HomePage);
  return React.createElement(React.Fragment, null,
    React.createElement(Button, { onClick: () => setOpen(true) }, 'Edit provider'),
    open && React.createElement(ProfessionalEditorModal, { draft, services: scenario === 'empty-services' ? [] : [service, disabledService, inactiveService].filter(s => availableCodes.includes(s.category_code)), salonSchedule: schedule, loading: false, error: null, onChange: setDraft, onCancel: () => setOpen(false), onSubmit: input => { window.saves.push(input); setDraft(input); setOpen(false); } })
  );
}
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, null, React.createElement(Harness)));
</script></body></html>`

const server = await createServer({
  logLevel: 'error', cacheDir: 'node_modules/.vite-provider-settings',
  // Source edits or optimizer notifications must not reload a running fixture
  // midway through an interaction and discard its open-dialog state.
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{
    name: 'provider-settings-regression',
    configureServer(vite) {
      vite.middlewares.use('/__provider_settings__', async (req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await vite.transformIndexHtml(req.originalUrl || req.url!, html))
        } catch (error) { next(error) }
      })
    },
  }],
})

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
async function openProviderEditor(page: Page, opener: Locator) {
  await opener.waitFor({ state: 'visible' })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('footer').getByRole('button', { name: /^(Save provider|Add provider)$/ }).waitFor({ state: 'visible' })
}

try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  for (const mode of ['nails', 'staff']) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/__provider_settings__${mode === 'nails' ? '?nails' : ''}`)
      const opener = page.getByRole('button', { name: mode === 'nails' ? 'Edit' : 'Edit provider', exact: true })
      await opener.waitFor()
      if (mode === 'nails') {
        for (const [code, language] of [['EN', 'English'], ['ES', 'Spanish'], ['PT', 'Portuguese']]) {
          const badge = page.getByText(code, { exact: true })
          assert.equal(await badge.count(), 1, `provider summary displays ${code} once`)
          assert.equal(await badge.getAttribute('title'), language, `${code} has the full language name in its tooltip`)
          assert.equal(await badge.getAttribute('aria-label'), language, `${code} has the full language name for accessibility`)
        }
        for (const language of ['English', 'Spanish', 'Portuguese', 'Arabic', 'French', 'en', 'es', 'pt', 'ar']) {
          assert.equal(await page.getByText(language, { exact: true }).count(), 0, `provider summary never displays ${language}`)
        }
      }
      await openProviderEditor(page, opener)
      const dialog = page.getByRole('dialog')
      const save = dialog.getByRole('button', { name: 'Save provider', exact: true })
      assert.equal(await dialog.getByRole('button', { name: /Lashes|Cosmetology|Micropigmentation|Lash extensions|Retired manicure/ }).count(), 0, 'disabled categories and inactive services are absent from provider choices')
      const serviceChoice = dialog.getByRole('button', { name: mode === 'nails' ? /Nails.*services/ : /Manicure/ })
      await serviceChoice.click()
      assert.equal(await save.isDisabled(), true, 'a hidden old assignment cannot keep Save enabled')
      await serviceChoice.click()
      for (const language of ['Arabic', 'French', 'en', 'es', 'pt', 'ar']) {
        assert.equal(await dialog.getByRole('button', { name: language, exact: true }).count(), 0, `${language} is not a language option`)
      }
      for (const language of ['English', 'Spanish', 'Portuguese']) {
        const option = dialog.getByRole('button', { name: language, exact: true })
        assert.equal(await option.count(), 1, `${language} has no duplicated code/label option`)
        assert.equal(await option.getAttribute('aria-pressed'), 'true')
        await option.click()
      }
      assert.equal(await save.isDisabled(), true, 'empty language selection cannot save')
      await dialog.getByRole('button', { name: 'Portuguese', exact: true }).click()
      assert.equal(await save.isEnabled(), true)
      for (const day of ['Monday', 'Sunday']) {
        const toggle = dialog.getByRole('button', { name: `${day} working day` })
        assert.equal(await toggle.isEnabled(), true, `${day}: custom work days remain editable when the salon is closed`)
        if (day === 'Monday') assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'existing custom closed-salon day is preserved')
        else await toggle.click()
        await dialog.getByLabel(`${day} opening time`).fill('08:00')
        await dialog.getByLabel(`${day} closing time`).fill('20:00')
      }
      const opening = dialog.getByLabel('Tuesday opening time')
      const closing = dialog.getByLabel('Tuesday closing time')
      assert.equal(await opening.getAttribute('min'), null)
      assert.equal(await closing.getAttribute('max'), null)
      await opening.fill('09:00')
      assert.equal(await save.isEnabled(), true, 'provider can start before salon opening')
      await closing.fill('19:00')
      assert.equal(await save.isEnabled(), true, 'provider can end after salon closing')
      await closing.fill('08:00')
      assert.equal(await save.isDisabled(), true, 'cannot close before opening')
      await closing.fill('19:00')
      assert.equal(await save.isEnabled(), true)
      await dialog.getByLabel('Wednesday opening time').fill('')
      assert.equal(await save.isDisabled(), true, 'missing hours are invalid while the day is enabled')
      await dialog.getByRole('button', { name: 'Wednesday working day' }).click()
      assert.equal(await save.isEnabled(), true, 'disabled days do not keep an invalid hidden field')
      await save.click()
      await dialog.waitFor({ state: 'detached' })
      const saved = await page.evaluate(() => (window as unknown as { saves: Record<string, unknown>[] }).saves[0])
      assert.deepEqual(saved.languages, ['Portuguese'], 'deselected legacy codes do not survive save')
      assert.ok(upsertProfessionalSchema.shape.schedule.safeParse(saved.schedule).success, 'the saved schedule passes the API schema, including disabled days')
      assert.deepEqual((saved.schedule as Record<string, unknown>).Monday, { enabled: true, open: '08:00', close: '20:00' })
      assert.deepEqual((saved.schedule as Record<string, unknown>).Sunday, { enabled: true, open: '08:00', close: '20:00' })
      assert.deepEqual((saved.schedule as Record<string, unknown>).Tuesday, { enabled: true, open: '09:00', close: '19:00' })
      assert.deepEqual((saved.serviceAssignments as { serviceId: string }[]).map((assignment) => assignment.serviceId), ['nail-service'], 'disabled-category assignments are not resubmitted')
      await opener.waitFor()
      if (mode === 'nails') {
        assert.equal(await page.getByText('PT', { exact: true }).count(), 1, 'saved provider summary displays Portuguese as PT')
        for (const language of ['EN', 'ES', 'English', 'Spanish', 'Portuguese', 'en', 'es', 'pt']) {
          assert.equal(await page.getByText(language, { exact: true }).count(), 0, `saved provider summary does not retain ${language}`)
        }
      }
      await openProviderEditor(page, opener)
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'English', exact: true }).getAttribute('aria-pressed'), 'false')
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Spanish', exact: true }).getAttribute('aria-pressed'), 'false')
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Portuguese', exact: true }).getAttribute('aria-pressed'), 'true')
      for (const language of ['Arabic', 'French', 'en', 'es', 'pt', 'ar']) {
        assert.equal(await page.getByRole('dialog').getByRole('button', { name: language, exact: true }).count(), 0, `${language} does not return after reopening`)
      }
      assert.equal(await page.getByLabel('Monday opening time').inputValue(), '08:00')
      assert.equal(await page.getByLabel('Sunday closing time').inputValue(), '20:00')
      assert.equal(await page.getByLabel('Tuesday closing time').inputValue(), '19:00')
      await page.getByRole('button', { name: 'Use the salon schedule', exact: true }).click()
      assert.equal(await page.getByLabel('Tuesday opening time').getAttribute('readonly'), '')
      assert.equal(await page.getByLabel('Tuesday opening time').inputValue(), '10:00')
      assert.equal(await page.getByRole('button', { name: 'Monday working day' }).isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Monday working day' }).getAttribute('aria-pressed'), 'false')
      await page.getByRole('button', { name: 'Use the salon schedule', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Monday working day' }).isEnabled(), true)
      await page.getByRole('button', { name: 'Monday working day' }).click()
      assert.equal(await page.getByRole('button', { name: 'Monday working day' }).getAttribute('aria-pressed'), 'true')
      assert.deepEqual(errors, [])
      console.log(`PASS ${mode}: legacy languages replaced, independent days/hours save and reopen, invalid time ranges blocked, salon inheritance remains optional`)
    } finally { await context.close() }
  }
  {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/__provider_settings__?surface=staff-page&scenario=staff-edit-limit`)
      await page.getByText('10 / 10 active professionals', { exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Upgrade to add more providers', exact: true }).isDisabled(), true)
      const editors = page.getByRole('button', { name: /^Edit / })
      assert.equal(await editors.count(), 10, 'every staff member has an edit action at the active staff limit')
      for (const editor of await editors.all()) assert.equal(await editor.isEnabled(), true, 'the creation limit does not disable editing')
      await openProviderEditor(page, page.getByRole('button', { name: 'Edit Local Specialist', exact: true }))
      const dialog = page.getByRole('dialog', { name: 'Edit provider', exact: true })
      assert.equal(await dialog.getByLabel('Full name', { exact: true }).inputValue(), 'Local Specialist')
      assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), 'local@example.test')
      assert.equal(await dialog.getByLabel('Phone', { exact: true }).inputValue(), '+1 555 010 2020')
      assert.equal(await dialog.getByLabel('Salon earnings %', { exact: true }).inputValue(), '35')
      assert.equal(await dialog.getByLabel('Provider earnings %', { exact: true }).inputValue(), '65')
      assert.equal(await dialog.getByRole('button', { name: 'Use the salon schedule', exact: true }).getAttribute('aria-pressed'), 'false')
      assert.equal(await dialog.getByRole('button', { name: 'Monday working day', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.equal(await dialog.getByLabel('Monday opening time').inputValue(), '09:00', 'editing loads custom hours even when Monday is closed at the salon')
      assert.equal(await dialog.getByLabel('Monday closing time').inputValue(), '18:00')
      for (const language of ['English', 'Spanish', 'Portuguese']) {
        const option = dialog.getByRole('button', { name: language, exact: true })
        assert.equal(await option.count(), 1)
        assert.equal(await option.getAttribute('aria-pressed'), 'true', 'legacy codes prefill the canonical language selection')
      }
      for (const language of ['en', 'es', 'pt', 'Arabic', 'French']) assert.equal(await dialog.getByRole('button', { name: language, exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('button', { name: /Manicure/ }).getAttribute('aria-pressed'), 'true')
      assert.equal(await dialog.getByLabel('Manicure duration', { exact: true }).inputValue(), '75')
      assert.equal(await dialog.getByRole('button', { name: /Lashes|Lash extensions|Retired manicure/ }).count(), 0, 'edit offers only active services from enabled categories')
      await dialog.getByLabel('Full name', { exact: true }).fill('Updated Specialist')
      await dialog.getByLabel('Monday opening time').fill('08:30')
      await dialog.getByRole('button', { name: 'Spanish', exact: true }).click()
      await dialog.getByRole('button', { name: 'Save provider', exact: true }).click()
      await dialog.getByText('Temporary provider update failure', { exact: true }).waitFor()
      assert.equal(await dialog.getByLabel('Full name', { exact: true }).inputValue(), 'Updated Specialist', 'a failed update keeps the unsaved draft open for retry')
      assert.equal(await dialog.getByLabel('Monday opening time').inputValue(), '08:30')
      await dialog.getByRole('button', { name: 'Save provider', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      await page.getByText('Provider updated successfully.', { exact: true }).waitFor()
      const mutations = await page.evaluate(() => {
        const fixture = window as unknown as { updatedProviders: { id: string; input: Record<string, unknown> }[]; createdProviders: unknown[] }
        return { updates: fixture.updatedProviders, creates: fixture.createdProviders }
      })
      assert.equal(mutations.updates.length, 2, 'one failed update can be retried')
      assert.deepEqual(mutations.updates.map(update => update.id), ['provider-local', 'provider-local'], 'editing and retry update the existing professional ID')
      assert.deepEqual(mutations.creates, [], 'editing must never call createProfessional')
      assert.equal(mutations.updates[0].input.fullName, 'Updated Specialist')
      assert.deepEqual(mutations.updates[0].input.languages, ['English', 'Portuguese'])
      assert.deepEqual(mutations.updates[0].input.serviceAssignments, [{ serviceId: 'nail-service', isActive: true, durationOverrideMinutes: 75, priceOverrideMinor: 1300 }])
      assert.deepEqual((mutations.updates[0].input.schedule as Record<string, unknown>).Monday, { enabled: true, open: '08:30', close: '18:00' })
      await page.getByText('Updated Specialist', { exact: true }).waitFor()
      assert.equal(await page.getByText('Local Specialist', { exact: true }).count(), 0, 'the staff list replaces the saved professional instead of adding another card')
      assert.equal(await page.getByRole('button', { name: /^Edit / }).count(), 10)
      await mkdir('/private/tmp/glamhour-pdf-review', { recursive: true })
      await page.screenshot({ path: '/private/tmp/glamhour-pdf-review/staff-edit-cards.png', fullPage: false })
      await openProviderEditor(page, page.getByRole('button', { name: 'Edit Updated Specialist', exact: true }))
      assert.equal(await dialog.getByLabel('Full name', { exact: true }).inputValue(), 'Updated Specialist')
      assert.equal(await dialog.getByLabel('Monday opening time').inputValue(), '08:30', 'reopening uses the saved schedule')
      assert.equal(await dialog.getByRole('button', { name: 'Spanish', exact: true }).getAttribute('aria-pressed'), 'false')
      assert.deepEqual(errors, [])
      console.log('PASS staff-page: every existing provider remains editable at the staff limit, fields prefill, update preserves ID, and the saved card reopens correctly')
    } finally { await context.close() }
  }
  for (const { surface, scenario } of [
    { surface: 'nails', scenario: 'stale' }, { surface: 'shared', scenario: 'stale' },
    { surface: 'nails', scenario: 'none' }, { surface: 'shared', scenario: 'none' },
    { surface: 'nails', scenario: 'empty-services' },
    { surface: 'nails', scenario: 'transition' }, { surface: 'nails', scenario: 'catalog-error' },
    { surface: 'staff-page', scenario: 'enabled' }, { surface: 'staff-page', scenario: 'none' }, { surface: 'staff-page', scenario: 'catalog-error' },
    { surface: 'home-page', scenario: 'enabled' }, { surface: 'home-page', scenario: 'none' }, { surface: 'home-page', scenario: 'catalog-error' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/__provider_settings__?scenario=${scenario}&${surface === 'nails' ? 'nails' : `surface=${surface}`}`)
      if (scenario === 'catalog-error') {
        if (surface === 'home-page') {
          const add = page.getByRole('button', { name: 'Add provider', exact: true })
          await add.waitFor()
          assert.equal(await add.isDisabled(), true)
        } else {
          await page.getByText('Local category catalog error', { exact: true }).waitFor()
          assert.equal(await page.getByRole('button', { name: /^(Edit|Add professional|Add New Provider)$/ }).count(), 0)
        }
        assert.deepEqual(errors, [])
        console.log(`PASS ${surface}: category catalog failure cannot offer providers from fallback catalogs`)
        continue
      }
      const createMode = surface.endsWith('-page')
      const opener = page.getByRole('button', { name: surface === 'nails' ? 'Edit' : surface === 'staff-page' ? 'Add professional' : surface === 'home-page' ? 'Add provider' : 'Edit provider', exact: true })
      await openProviderEditor(page, opener)
      const dialog = page.getByRole('dialog')
      const save = dialog.getByRole('button', { name: createMode ? 'Add provider' : 'Save provider', exact: true })
      const choice = dialog.getByRole('button', { name: surface === 'nails' ? /Nails.*services/ : /Manicure/ })
      if (createMode) await dialog.getByLabel('Full name', { exact: true }).fill('New provider')
      assert.equal(await dialog.getByRole('button', { name: /Lashes|Cosmetology|Micropigmentation|Lash extensions|Retired manicure/ }).count(), 0)
      if (scenario === 'none' || scenario === 'empty-services') {
        assert.equal(await choice.count(), 0, 'no hidden fallback resurrects unassignable categories')
        assert.equal(await save.isDisabled(), true)
        await dialog.getByText('No assignable services found.', { exact: false }).waitFor()
        if (surface === 'shared') {
          await page.evaluate(() => (window as unknown as { setEnabledCategories: (codes: string[]) => void }).setEnabledCategories(['nails']))
          await choice.waitFor()
          assert.equal(await save.isEnabled(), true, 'a reenabled category restores valid services and existing selections')
          await page.evaluate(() => (window as unknown as { setEnabledCategories: (codes: string[]) => void }).setEnabledCategories([]))
          await choice.waitFor({ state: 'detached' })
          assert.equal(await save.isDisabled(), true, 'catalog changes remove stale selections while editor is open')
        }
      } else if (scenario === 'transition') {
        const saveCategoryAndReopen = async (revision: number) => {
          await dialog.getByRole('button', { name: 'Close', exact: true }).click()
          await dialog.waitFor({ state: 'detached' })
          const readsBefore = await page.evaluate(() => (window as unknown as { catalogReads: { categories: number; services: number } }).catalogReads)
          await page.getByRole('button', { name: 'Enable Nails category', exact: true }).click()
          await page.getByRole('button', { name: 'Save changes', exact: true }).click()
          // A reused success message can already be visible from the previous save.
          // Wait for this mutation and both requested catalog reloads instead.
          await page.waitForFunction(({ revision, readsBefore }) => {
            const fixture = window as unknown as { settingsSaves: unknown[]; catalogReads: { categories: number; services: number } }
            return fixture.settingsSaves.length === revision
              && fixture.catalogReads.categories > readsBefore.categories
              && fixture.catalogReads.services > readsBefore.services
          }, { revision, readsBefore })
          await page.getByText('Your Nail service settings were saved.', { exact: true }).waitFor()
          await openProviderEditor(page, opener)
        }
        assert.equal(await choice.count(), 1)
        await saveCategoryAndReopen(1)
        assert.equal(await choice.count(), 0, 'saved category disable removes provider choice')
        assert.equal(await save.isDisabled(), true)
        await saveCategoryAndReopen(2)
        assert.equal(await choice.count(), 1, 'reenabling refreshes the active category and service catalogs')
        assert.equal(await save.isEnabled(), true)
        await save.click()
        await dialog.waitFor({ state: 'detached' })
      } else {
        assert.equal(await save.isDisabled(), true, 'new provider or stale-only assignments require an available selection')
        await choice.click()
        assert.equal(await save.isEnabled(), true)
        await save.click()
        await dialog.waitFor({ state: 'detached' })
      }
      if (scenario === 'stale' || scenario === 'enabled' || scenario === 'transition') {
        const assignments = await page.evaluate(() => (window as unknown as { saves: { serviceAssignments: { serviceId: string }[] }[] }).saves[0].serviceAssignments)
        assert.deepEqual(assignments.map(assignment => assignment.serviceId), ['nail-service'], 'payload includes only available selected services')
      }
      assert.deepEqual(errors, [])
      console.log(`PASS ${surface}: ${scenario} category choices, selection validation, and submission`)
    } finally { await context.close() }
  }
} finally {
  await browser?.close()
  await server.close()
}
