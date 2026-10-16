#!/usr/bin/env node
// Real salon settings pages and dialogs; all reads and writes use isolated fixtures.
// PLAYWRIGHT_CHANNEL=chrome node scripts/test-service-settings.mjs
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell, Header, BottomNavigation } from '/src/components/index.ts';
import { SettingsPage } from '/src/pages/app/SettingsPage.tsx';
import { CategoryServicesPage } from '/src/pages/app/CategoryServicesPage.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import { getServiceSuggestions } from '/src/lib/service-presets.ts';
import '/src/index.css';
const salonId = 'salon-service-settings-test';
const clone = value => JSON.parse(JSON.stringify(value));
const categories = ['nails', 'lashes', 'cosmetology', 'micropigmentation'].map((code, index) => ({
  id: code, code, name: ['Nails', 'Lashes', 'Cosmetology', 'Micropigmentation'][index],
  description: null, icon_key: null, sort_order: index, is_active: true,
}));
window.enabledIds = ['nails', 'lashes'];
window.categoryWrites = [];
window.onboardingWrites = [];
window.serviceWrites = [];
window.serviceReads = [];
window.categoryReads = [];
window.bookingCreates = [];
window.suggestions = Object.fromEntries(categories.map(category => [category.code, getServiceSuggestions(category)]));
window.originalDraft = {
  selectedCategoryIds: ['nails', 'lashes'],
  services: [{ id: 'saved-draft-service', name: 'Unpublished draft', price: '99', selected: true }],
  schedule: { Sunday: { enabled: false, open: '09:00', close: '18:00' } },
  providers: [{ id: 'saved-provider', name: 'Saved Provider', serviceIds: ['saved-draft-service'], languages: ['English', 'Spanish'] }],
};
sessionStorage.setItem('glamhour:active-salon-id', salonId);
localStorage.setItem('glamhour:onboarding:' + salonId, JSON.stringify(window.originalDraft));
let services = categories.map((category, index) => ({
  id: category.code + '-service', salon_id: salonId, category_id: category.id,
  category_code: category.code, category_name: category.name, form_template_id: null,
  name: ['Manicure', 'Saved lash service', 'Saved facial', 'Saved brow service'][index],
  description: 'Existing ' + category.code + ' description', duration_minutes: 30,
  price_minor: 1250, currency_code: 'USD', is_active: category.code !== 'lashes',
  is_publicly_bookable: true, sort_order: index,
}));
let nextService = 1;
glamhourApi.categories = async (id, options) => {
  window.categoryReads.push({ salonId: id, includeAll: options?.includeAll === true });
  return clone(options?.includeAll ? categories : categories.filter(category => window.enabledIds.includes(category.id)));
};
glamhourApi.services = async (id, options) => {
  window.serviceReads.push({ salonId: id, includeInactive: options?.includeInactive === true });
  if (window.failRead) throw new Error('Service catalog unavailable. Please retry.');
  return clone(services.filter(service => options?.includeInactive || service.is_active));
};
glamhourApi.salon = async () => ({ id: salonId, name: 'Service settings salon', currency_code: 'USD', timezone: 'UTC' });
glamhourApi.professionals = async () => [];
glamhourApi.notifications = async () => [];
glamhourApi.settings = async () => ({ appointment_interval_minutes: 30, settings_json: {} });
glamhourApi.subscription = async () => ({ hasPremiumAccess: false, clientUsage: { count: 0, limit: 15, canCreateClient: true } });
glamhourApi.onboarding = async () => null;
glamhourApi.saveOnboarding = async input => { window.onboardingWrites.push(clone(input)); return {}; };
glamhourApi.updateServiceCategories = async input => { window.categoryWrites.push(clone(input)); return []; };
glamhourApi.createService = async input => { window.bookingCreates.push(clone(input)); throw new Error('Settings must use the settings catalog endpoint.'); };
function serviceFields(input) {
  return {
    name: input.name, description: input.description ?? null,
    duration_minutes: input.durationMinutes, price_minor: input.priceMinor,
    currency_code: input.currencyCode ?? 'USD', is_active: input.isActive ?? true,
    is_publicly_bookable: input.isPubliclyBookable ?? true,
  };
}
glamhourApi.createServiceInSettings = async (input, id) => {
  if (window.failCreate) throw new Error('Create failed. Please retry.');
  const category = categories.find(category => category.id === input.categoryId || category.code === input.categoryCode);
  if (!category) throw new Error('Missing service category.');
  const service = {
    id: 'created-service-' + nextService++, salon_id: salonId, category_id: category.id,
    category_code: category.code, category_name: category.name, form_template_id: null,
    sort_order: services.length, ...serviceFields(input),
  };
  window.serviceWrites.push({ kind: 'create', salonId: id, input: clone(input), id: service.id });
  services.push(service);
  return clone(service);
};
glamhourApi.updateService = async (id, input, targetSalonId) => {
  if (window.failUpdate) throw new Error('Update failed. Please retry.');
  const index = services.findIndex(service => service.id === id);
  if (index < 0) throw new Error('Service not found.');
  services[index] = { ...services[index], ...serviceFields(input) };
  window.serviceWrites.push({ kind: 'update', salonId: targetSalonId, input: clone(input), id });
  return clone(services[index]);
};
glamhourApi.deleteService = async (id, targetSalonId) => {
  if (window.failDelete) throw new Error('Delete failed. Please retry.');
  services = services.filter(service => service.id !== id);
  window.serviceWrites.push({ kind: 'delete', salonId: targetSalonId, id });
  return { deleted: true };
};
const category = new URLSearchParams(location.search).get('category');
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, {
  initialEntries: [category ? '/app/settings/categories/' + category + '/services' : '/app/settings'],
}, React.createElement(AppShell, {
  header: React.createElement(Header, { title: 'Service settings salon' }),
  navigation: React.createElement(BottomNavigation, { activeItem: 'settings' }),
}, React.createElement(Routes, null,
  React.createElement(Route, { path: '/app/settings', element: React.createElement(SettingsPage) }),
  React.createElement(Route, { path: '/app/settings/categories/:categoryCode/services', element: React.createElement(CategoryServicesPage) }),
))));
</script></body></html>`

const server = await createServer({
  cacheDir: 'node_modules/.vite-service-settings',
  server: { host: '127.0.0.1', port: 5196, hmr: false },
  plugins: [{
    name: 'service-settings-regression',
    configureServer(vite) {
      vite.middlewares.use('/__service_settings__', async (req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await vite.transformIndexHtml(req.originalUrl || req.url, html))
        } catch (error) { next(error) }
      })
    },
  }],
})

async function assertExposed(locator) {
  const geometry = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      exposed: [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2]
        .every(y => element.contains(document.elementFromPoint(rect.left + rect.width / 2, y))),
      top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
    }
  })
  assert.ok(geometry.visible, `Action outside viewport: ${JSON.stringify(geometry)}`)
  assert.ok(geometry.exposed, `Action covered by another element: ${JSON.stringify(geometry)}`)
}

async function assertUnrelatedStatePreserved(page) {
  const state = await page.evaluate(() => ({
    draft: JSON.parse(localStorage.getItem('glamhour:onboarding:salon-service-settings-test')),
    originalDraft: window.originalDraft, enabledIds: window.enabledIds,
    categoryWrites: window.categoryWrites, onboardingWrites: window.onboardingWrites, bookingCreates: window.bookingCreates,
  }))
  assert.deepEqual(state.draft, state.originalDraft)
  assert.deepEqual(state.enabledIds, ['nails', 'lashes'])
  assert.deepEqual(state.categoryWrites, [])
  assert.deepEqual(state.onboardingWrites, [])
  assert.deepEqual(state.bookingCreates, [])
}

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
  const dialog = () => page.getByRole('dialog')
  const serviceRow = name => page.getByRole('article', { name, exact: true })
  const openEditor = async () => {
    await page.getByRole('button', { name: 'Add service', exact: true }).click()
    await dialog().getByRole('heading', { name: 'Add service', exact: true }).waitFor()
  }
  const fillEditor = async ({ name, description = '', price = '29.95', duration = '45' }) => {
    await dialog().getByLabel('Service name', { exact: true }).fill(name)
    await dialog().getByRole('textbox', { name: /^Description/ }).fill(description)
    await dialog().getByLabel('Price (USD)', { exact: true }).fill(price)
    await dialog().getByLabel('Duration in minutes', { exact: true }).fill(duration)
  }

  // Every category row opens its own complete catalog, including disabled and inactive entries.
  for (const [code, name, existingService] of [
    ['nails', 'Nails', 'Manicure'], ['lashes', 'Lashes', 'Saved lash service'],
    ['cosmetology', 'Cosmetology', 'Saved facial'], ['micropigmentation', 'Micropigmentation', 'Saved brow service'],
  ]) {
    await page.goto(`${origin}/__service_settings__`)
    const categoryLink = page.getByRole('link', { name: new RegExp('^' + name + ' ') })
    await categoryLink.waitFor()
    assert.equal(await categoryLink.getAttribute('href'), `/app/settings/categories/${code}/services`)
    await categoryLink.click()
    await page.getByRole('heading', { name: `${name} services`, exact: true }).waitFor()
    await serviceRow(existingService).waitFor()
    assert.equal(await page.getByRole('article').count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Add Other', exact: true }).count(), 0)
    const reads = await page.evaluate(() => ({ services: window.serviceReads, categories: window.categoryReads }))
    assert.ok(reads.services.some(read => read.salonId === 'salon-service-settings-test' && read.includeInactive))
    assert.ok(reads.categories.some(read => read.salonId === 'salon-service-settings-test' && read.includeAll))
    await assertUnrelatedStatePreserved(page)
  }
  console.log('PASS category rows open their own catalog, including disabled categories and inactive services')

  await page.goto(`${origin}/__service_settings__?category=cosmetology`)
  await page.getByRole('heading', { name: 'Cosmetology services', exact: true }).waitFor()
  await openEditor()
  await fillEditor({ name: 'Custom renewal', description: 'A salon-specific facial', price: '29.95', duration: '45' })
  await dialog().getByLabel('Available for public booking', { exact: true }).uncheck()
  await page.evaluate(() => { window.failCreate = true })
  await dialog().getByRole('button', { name: 'Create service', exact: true }).click()
  await dialog().getByText('Create failed. Please retry.', { exact: true }).waitFor()
  assert.equal(await dialog().getByLabel('Service name', { exact: true }).inputValue(), 'Custom renewal')
  assert.equal(await dialog().getByLabel('Price (USD)', { exact: true }).inputValue(), '29.95')
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 0)
  await page.evaluate(() => { window.failCreate = false })
  await dialog().getByRole('button', { name: 'Create service', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await serviceRow('Custom renewal').waitFor()
  const created = await page.evaluate(() => window.serviceWrites[0])
  assert.equal(created.kind, 'create')
  assert.equal(created.input.categoryId ?? created.input.categoryCode, 'cosmetology')
  assert.equal(created.input.priceMinor, 2995)
  assert.equal(created.input.durationMinutes, 45)
  assert.equal(created.input.isPubliclyBookable, false)
  await assertUnrelatedStatePreserved(page)
  console.log('PASS disabled category supports custom creation; failed creation keeps edits and retries with exact cents')

  await serviceRow('Custom renewal').getByRole('button', { name: 'View Custom renewal', exact: true }).click()
  await dialog().getByText('A salon-specific facial', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 1)
  await dialog().getByRole('button', { name: 'Close', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await serviceRow('Custom renewal').getByRole('button', { name: 'Edit Custom renewal', exact: true }).click()
  await fillEditor({ name: 'Custom renewal plus', description: 'Updated facial details', price: '47.25', duration: '75' })
  await dialog().getByLabel('Service is active', { exact: true }).uncheck()
  await dialog().getByLabel('Available for public booking', { exact: true }).check()
  await page.evaluate(() => { window.failUpdate = true })
  await dialog().getByRole('button', { name: 'Save service', exact: true }).click()
  await dialog().getByText('Update failed. Please retry.', { exact: true }).waitFor()
  assert.equal(await dialog().getByLabel('Service name', { exact: true }).inputValue(), 'Custom renewal plus')
  assert.equal(await dialog().getByLabel('Service is active', { exact: true }).isChecked(), false)
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 1)
  await page.evaluate(() => { window.failUpdate = false })
  await dialog().getByRole('button', { name: 'Save service', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await serviceRow('Custom renewal plus').waitFor()
  assert.equal(await serviceRow('Custom renewal').count(), 0)
  const updated = await page.evaluate(() => window.serviceWrites[1])
  assert.equal(updated.id, created.id)
  assert.equal(updated.input.priceMinor, 4725)
  assert.equal(updated.input.durationMinutes, 75)
  assert.equal(updated.input.isActive, false)
  assert.equal(updated.input.isPubliclyBookable, true)
  await serviceRow('Custom renewal plus').getByRole('button', { name: 'Edit Custom renewal plus', exact: true }).click()
  await dialog().getByLabel('Service name', { exact: true }).fill('Canceled name')
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 2)
  assert.equal(await serviceRow('Custom renewal plus').count(), 1)
  console.log('PASS view, edit, inactive services, failure retry, and canceled edits preserve the saved catalog')

  const suggestion = await page.evaluate(() => window.suggestions.cosmetology[0])
  await page.getByRole('button', { name: `Add ${suggestion}`, exact: true }).click()
  await dialog().getByRole('heading', { name: 'Add service', exact: true }).waitFor()
  assert.equal(await dialog().getByLabel('Service name', { exact: true }).inputValue(), suggestion)
  await dialog().getByLabel('Price (USD)', { exact: true }).fill('10')
  await dialog().getByLabel('Duration in minutes', { exact: true }).fill('30')
  await dialog().getByRole('button', { name: 'Create service', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await serviceRow(suggestion).waitFor()
  assert.equal(await page.getByRole('button', { name: `Add ${suggestion}`, exact: true }).count(), 0)
  console.log('PASS onboarding suggestions prefill an editable service and disappear after creation')

  await serviceRow('Custom renewal plus').getByRole('button', { name: 'Delete Custom renewal plus', exact: true }).click()
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 3)
  assert.equal(await serviceRow('Custom renewal plus').count(), 1)
  await serviceRow('Custom renewal plus').getByRole('button', { name: 'Delete Custom renewal plus', exact: true }).click()
  await page.evaluate(() => { window.failDelete = true })
  await dialog().getByRole('button', { name: 'Delete service', exact: true }).click()
  await dialog().getByText('Delete failed. Please retry.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.serviceWrites.length), 3)
  assert.equal(await serviceRow('Custom renewal plus').count(), 1)
  await page.evaluate(() => { window.failDelete = false })
  await dialog().getByRole('button', { name: 'Delete service', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  assert.equal(await serviceRow('Custom renewal plus').count(), 0)
  assert.equal(await serviceRow('Saved facial').count(), 1)
  assert.equal(await serviceRow(suggestion).count(), 1)
  assert.deepEqual(await page.evaluate(() => window.serviceWrites.map(write => write.kind)), ['create', 'update', 'create', 'delete'])
  await assertUnrelatedStatePreserved(page)
  console.log('PASS deletion requires confirmation, supports failure retry, and preserves other services and onboarding')

  // Check the real shell so its header and bottom navigation cannot cover dialog controls.
  for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    await page.goto(`${origin}/__service_settings__?category=nails`)
    await page.getByRole('heading', { name: 'Nails services', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Add Manicure', exact: true }).count(), 0)
    if (process.env.SERVICE_SETTINGS_PAGE_SCREENSHOT && viewport.width === 393) {
      await page.screenshot({ path: process.env.SERVICE_SETTINGS_PAGE_SCREENSHOT })
    }
    await openEditor()
    const create = dialog().getByRole('button', { name: 'Create service', exact: true })
    const cancel = dialog().getByRole('button', { name: 'Cancel', exact: true })
    await assertExposed(create)
    await assertExposed(cancel)
    await fillEditor({ name: 'Mobile service', description: 'Created from a small screen' })
    await assertExposed(create)
    await assertExposed(cancel)
    if (process.env.SERVICE_SETTINGS_SCREENSHOT && viewport.width === 393) {
      await page.screenshot({ path: process.env.SERVICE_SETTINGS_SCREENSHOT })
    }
    if (process.env.SERVICE_SETTINGS_SHORT_SCREENSHOT && viewport.width === 320) {
      await page.screenshot({ path: process.env.SERVICE_SETTINGS_SHORT_SCREENSHOT })
    }
    await create.click()
    await dialog().waitFor({ state: 'detached' })
    await serviceRow('Mobile service').waitFor()
    await assertUnrelatedStatePreserved(page)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    console.log(`PASS service dialog actions remain exposed and usable (${viewport.width}x${viewport.height})`)
  }
  assert.deepEqual(errors, [])
  await context.close()
} finally {
  await browser?.close()
  await server.close()
}
