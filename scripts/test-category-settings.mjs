#!/usr/bin/env node
// Settings keeps every category manageable while salon membership controls its status.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SettingsPage } from '/src/pages/app/SettingsPage.tsx';
import { NailSettingsPage } from '/src/pages/app/NailSettingsPage.tsx';
import { SetupPage } from '/src/pages/onboarding/SetupPage.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import '/src/index.css';
const salonId = 'salon-category-test';
const categories = ['nails', 'lashes', 'cosmetology', 'micropigmentation'].map((code, i) => ({ id: code, code, name: ['Nails', 'Lashes', 'Cosmetology', 'Micropigmentation'][i], is_active: true }));
window.enabledIds = ['nails', 'lashes'];
window.categoryWrites = [];
window.onboardingWrites = [];
const services = ['nails', 'cosmetology'].map(code => ({ id: code + '-service', category_id: code, category_code: code, name: code + ' service', is_active: true, duration_minutes: 60, price_minor: 1000 }));
window.originalDraft = { selectedCategoryIds: categories.map(c => c.id), services: [], schedule: { Sunday: { enabled: false, open: '09:00', close: '18:00' } }, providers: [{ id: 'provider-local', name: 'Saved Provider', languages: ['English', 'Spanish', 'Portuguese'], serviceIds: [], schedule: { Sunday: { enabled: true, open: '10:00', close: '12:00' } }, useSalonSchedule: false }] };
sessionStorage.setItem('glamhour:active-salon-id', salonId);
localStorage.setItem('glamhour:onboarding:' + salonId, JSON.stringify(window.originalDraft));
const freshSetup = new URLSearchParams(location.search).has('setup');
const nailSettings = new URLSearchParams(location.search).has('nails');
if (freshSetup) localStorage.removeItem('glamhour:onboarding:' + salonId);
if (nailSettings) window.enabledIds = [];
glamhourApi.categories = async (_salonId, options) => {
  if (!options?.includeAll && window.holdCategoryRefresh) await new Promise(resolve => { window.releaseCategories = resolve; });
  return options?.includeAll ? categories : categories.filter(c => window.enabledIds.includes(c.id));
};
glamhourApi.services = async () => { if (window.failResources) throw new Error('Service catalog unavailable'); return services; };
glamhourApi.professionals = async () => { if (window.failResources) throw new Error('Providers unavailable'); return []; };
glamhourApi.notifications = async () => [];
glamhourApi.salon = async () => ({ id: salonId, name: 'Category salon' });
glamhourApi.onboarding = async () => null;
glamhourApi.settings = async () => ({ appointment_interval_minutes: 30, settings_json: {} });
glamhourApi.subscription = async () => ({ hasPremiumAccess: false, clientUsage: { count: 0, limit: 15, canCreateClient: true } });
glamhourApi.updateServiceCategories = async ({ categoryIds }) => {
  if (window.failCategorySave) throw new Error('Category save failed. Please retry.');
  window.categoryWrites.push([...categoryIds]);
  window.enabledIds = [...categoryIds];
  return categories.filter(c => categoryIds.includes(c.id));
};
glamhourApi.saveOnboarding = async input => { window.onboardingWrites.push(input); return {}; };
const provider = {
  id: 'provider-local', full_name: 'Saved Provider', email: '', phone: '', avatar_url: null,
  languages: ['English', 'Spanish', 'Portuguese'], status: 'active', salon_earnings_percent: 40, professional_earnings_percent: 60,
  use_salon_schedule: false, schedule: window.originalDraft.providers[0].schedule,
  service_assignments: [{ service_id: 'nails-service', is_active: true, duration_override_minutes: 60 }],
};
const nailResponse = () => ({
  salon: { id: salonId, name: 'Category salon', currencyCode: 'USD', timezone: 'UTC' },
  category: { ...categories[0], isEnabled: window.enabledIds.includes('nails') },
  services: services.filter(service => service.category_id === 'nails'), materials: [],
  salonSchedule: window.originalDraft.schedule, providers: [provider], activeStaffCount: 1, staffLimit: 10,
});
window.nailWrites = [];
window.providerWrites = [];
glamhourApi.nailSettings = async () => nailResponse();
glamhourApi.appointments = async () => [];
glamhourApi.updateNailSettings = async input => {
  window.nailWrites.push(input);
  window.enabledIds = [...window.enabledIds.filter(id => id !== 'nails'), ...(input.categoryEnabled ? ['nails'] : [])];
  return nailResponse();
};
glamhourApi.updateProfessional = async (id, input) => { window.providerWrites.push({ id, ...input }); return provider; };
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, { initialEntries: [freshSetup ? '/onboarding/categories' : nailSettings ? '/app/settings/services/nails' : '/app/settings'] },
  React.createElement(Routes, null,
    React.createElement(Route, { path: '/app/settings', element: React.createElement(SettingsPage) }),
    React.createElement(Route, { path: '/app/settings/services/nails', element: React.createElement(NailSettingsPage) }),
    React.createElement(Route, { path: '/onboarding/:step', element: React.createElement(SetupPage) }))));
</script></body></html>`

const server = await createServer({
  cacheDir: 'node_modules/.vite-category-settings',
  server: { host: '127.0.0.1', port: 5194, hmr: false },
  plugins: [{
    name: 'category-settings-regression',
    configureServer(vite) {
      vite.middlewares.use('/__category_settings__', async (req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await vite.transformIndexHtml(req.originalUrl || req.url, html))
        } catch (error) { next(error) }
      })
    },
  }],
})

let browser
try {
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const categoryButton = name => page.getByRole('button', { name: new RegExp('^' + name + ' ') })
  const storedDraft = () => page.evaluate(() => JSON.parse(localStorage.getItem('glamhour:onboarding:salon-category-test')))
  const openManager = async () => {
    await page.getByRole('link', { name: /Manage service categories/ }).click()
    await page.getByRole('heading', { name: 'Service categories', exact: true }).waitFor()
  }
  const assertSettingsStatus = async enabled => {
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
    for (const name of ['Nails', 'Lashes', 'Cosmetology', 'Micropigmentation']) {
      const row = page.getByRole('link', { name: new RegExp('^' + name + ' ') })
      assert.equal(await row.getByText(enabled.includes(name.toLowerCase()) ? 'Enabled' : 'Disabled', { exact: true }).count(), 1)
    }
  }

  await page.goto(`${origin}/__category_settings__`)
  await assertSettingsStatus(['nails', 'lashes'])
  await openManager()
  assert.equal(await categoryButton('Nails').getAttribute('aria-pressed'), 'true')
  assert.equal(await categoryButton('Lashes').getAttribute('aria-pressed'), 'true')
  assert.equal(await categoryButton('Cosmetology').getAttribute('aria-pressed'), 'false')
  assert.equal(await categoryButton('Micropigmentation').getAttribute('aria-pressed'), 'false')
  await categoryButton('Nails').click()
  await categoryButton('Lashes').click()
  const save = page.getByRole('button', { name: 'Save categories', exact: true })
  assert.equal(await save.isEnabled(), true)
  await save.click()
  await assertSettingsStatus([])
  let saved = await storedDraft()
  assert.deepEqual(saved.selectedCategoryIds, [])
  assert.deepEqual(saved.providers, await page.evaluate(() => window.originalDraft.providers))
  assert.deepEqual(saved.schedule, await page.evaluate(() => window.originalDraft.schedule))
  assert.deepEqual(await page.evaluate(() => window.onboardingWrites), [])
  console.log('PASS category status follows salon membership, all-disabled saves, unrelated provider details retained')

  // Category settings should remain usable when unrelated provider/service calls fail.
  await page.evaluate(() => { window.failResources = true })
  await openManager()
  for (const name of ['Nails', 'Lashes', 'Cosmetology', 'Micropigmentation']) assert.equal(await categoryButton(name).getAttribute('aria-pressed'), 'false')
  await categoryButton('Cosmetology').click()
  await page.getByRole('button', { name: 'Go back', exact: true }).click()
  await assertSettingsStatus([])
  assert.deepEqual((await storedDraft()).selectedCategoryIds, [])
  await openManager()
  assert.equal(await categoryButton('Cosmetology').getAttribute('aria-pressed'), 'false')
  await categoryButton('Cosmetology').click()
  await page.evaluate(() => { window.failCategorySave = true })
  await save.click()
  await page.getByText('Category save failed. Please retry.').waitFor()
  assert.equal(await categoryButton('Cosmetology').getAttribute('aria-pressed'), 'true')
  assert.deepEqual((await storedDraft()).selectedCategoryIds, [])
  await page.evaluate(() => { window.failCategorySave = false })
  await save.click()
  await assertSettingsStatus(['cosmetology'])
  saved = await storedDraft()
  assert.deepEqual(saved.selectedCategoryIds, ['cosmetology'])
  assert.deepEqual(await page.evaluate(() => window.categoryWrites), [[], ['cosmetology']])
  assert.deepEqual(await page.evaluate(() => window.onboardingWrites), [])
  console.log('PASS all categories remain accessible, canceled edits do not persist, failed save retries and re-enable work')

  await page.goto(`${origin}/__category_settings__?setup`)
  await page.getByRole('heading', { name: 'Salon Setup', exact: true }).waitFor()
  assert.equal(await categoryButton('Nails').getAttribute('aria-pressed'), 'true')
  assert.equal(await categoryButton('Lashes').getAttribute('aria-pressed'), 'true')
  assert.equal(await categoryButton('Cosmetology').getAttribute('aria-pressed'), 'false')
  await categoryButton('Nails').click()
  await categoryButton('Lashes').click()
  for (const name of ['Nails', 'Lashes', 'Cosmetology', 'Micropigmentation']) assert.equal(await categoryButton(name).getAttribute('aria-pressed'), 'false')
  assert.deepEqual((await storedDraft()).selectedCategoryIds, [])
  console.log('PASS onboarding initializes from enabled catalog and preserves deliberate empty draft selection')

  await page.goto(`${origin}/__category_settings__?nails`)
  await page.getByRole('heading', { name: 'Nail Services', exact: true }).waitFor()
  const original = await page.evaluate(() => window.originalDraft)
  assert.deepEqual(await storedDraft(), original)
  const nailToggle = page.getByRole('button', { name: 'Enable Nails category', exact: true })
  assert.equal(await nailToggle.getAttribute('aria-pressed'), 'false')
  await nailToggle.click()
  assert.deepEqual(await storedDraft(), original)
  await page.evaluate(() => { window.holdCategoryRefresh = true })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.waitForFunction(() => typeof window.releaseCategories === 'function')
  assert.deepEqual(await storedDraft(), original)
  await page.evaluate(() => { window.holdCategoryRefresh = false; window.releaseCategories() })
  await page.getByText('Your Nail service settings were saved.', { exact: true }).waitFor()
  await page.waitForFunction(() => JSON.stringify(JSON.parse(localStorage.getItem('glamhour:onboarding:salon-category-test')).selectedCategoryIds) === '["nails"]')
  assert.deepEqual(await storedDraft(), { ...original, selectedCategoryIds: ['nails'] })
  console.log('PASS Nail settings mount and unsaved toggle preserve onboarding; explicit save waits for refreshed membership')

  // Saving a provider also refreshes settings, but must not touch onboarding categories.
  await page.evaluate(() => localStorage.setItem('glamhour:onboarding:salon-category-test', JSON.stringify(window.originalDraft)))
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save provider', exact: true }).click()
  await page.getByText('Provider settings were saved.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.providerWrites.length), 1)
  assert.deepEqual(await storedDraft(), original)
  await nailToggle.click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByText('Your Nail service settings were saved.', { exact: true }).waitFor()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('glamhour:onboarding:salon-category-test')).selectedCategoryIds.length === 0)
  assert.deepEqual(await storedDraft(), { ...original, selectedCategoryIds: [] })
  assert.deepEqual(await page.evaluate(() => window.nailWrites.map(input => input.categoryEnabled)), [true, false])
  assert.deepEqual(errors, [])
  console.log('PASS provider save preserves onboarding; explicitly disabling Nails synchronizes the empty selection')
  await context.close()
} finally {
  await browser?.close()
  await server.close()
}
