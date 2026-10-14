#!/usr/bin/env node
// Real provider forms rendered inside the app shell; every API method uses local fixtures.
// PLAYWRIGHT_CHANNEL=chrome node scripts/test-provider-dialog-layout.mjs
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const html = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppShell, Header, BottomNavigation, Button, ProfessionalEditorModal, emptyProfessionalDraft } from '/src/components/index.ts';
import { NailSettingsPage } from '/src/pages/app/NailSettingsPage.tsx';
import { glamhourApi } from '/src/services/glamhour-api.ts';
import '/src/index.css';
const schedule = emptyProfessionalDraft().schedule;
const services = Array.from({ length: 12 }, (_, i) => ({
  id: 'service-' + i, name: 'Service ' + (i + 1), category_id: 'nails', category_code: 'nails', category_name: 'Nails',
  description: '', price_minor: 1000, duration_minutes: 60, is_active: true, sort_order: i + 1,
}));
const provider = {
  id: 'provider-local', full_name: 'Local Specialist', email: '', phone: '', avatar_url: null,
  languages: ['English'], status: 'active', salon_earnings_percent: 40, professional_earnings_percent: 60,
  use_salon_schedule: true, schedule,
  service_assignments: services.map(s => ({ service_id: s.id, is_active: true, duration_override_minutes: 60 })),
};
window.saves = [];
glamhourApi.nailSettings = async () => ({ category: { isEnabled: true }, services, materials: [], providers: [provider], salonSchedule: schedule, activeStaffCount: 1, staffLimit: 10 });
glamhourApi.services = async () => services;
glamhourApi.categories = async () => [{ id: 'nails', code: 'nails', name: 'Nails' }];
glamhourApi.appointments = async () => [];
glamhourApi.updateProfessional = async (id, input) => { window.saves.push({ id, ...input }); return provider; };
function Harness() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...emptyProfessionalDraft(), id: provider.id, fullName: provider.full_name, serviceAssignments: services.map(s => ({ serviceId: s.id, isActive: true, durationOverrideMinutes: 60 })) });
  const nails = new URLSearchParams(location.search).has('nails');
  return React.createElement(AppShell, {
    header: React.createElement(Header, { title: 'Local salon' }),
    navigation: React.createElement(BottomNavigation, { activeItem: 'settings' }),
  }, nails ? React.createElement(NailSettingsPage) : React.createElement(React.Fragment, null,
    React.createElement(Button, { onClick: () => setOpen(true) }, 'Edit provider'),
    open && React.createElement(ProfessionalEditorModal, {
      draft, services, salonSchedule: schedule, loading: false, error: null, onChange: setDraft,
      onCancel: () => setOpen(false), onSubmit: () => { window.saves.push(draft); setOpen(false); },
    })
  ));
}
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, null, React.createElement(Harness)));
</script></body></html>`

const server = await createServer({
  cacheDir: 'node_modules/.vite-provider-dialog-layout',
  server: { host: '127.0.0.1', port: 5190 },
  plugins: [{
    name: 'provider-dialog-layout-regression',
    configureServer(vite) {
      vite.middlewares.use('/__provider_layout__', async (req, res, next) => {
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

  async function assertExposed(locator) {
    const geometry = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
        exposed: [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2]
          .every(y => element.contains(document.elementFromPoint(rect.left + rect.width / 2, y))),
        top: rect.top, bottom: rect.bottom,
      }
    })
    assert.ok(geometry.visible, `Action outside viewport: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.exposed, `Action covered by another element: ${JSON.stringify(geometry)}`)
    return geometry
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 393, height: 420 }, { width: 900, height: 800 }]) {
    for (const mode of ['nails', 'staff']) {
      const context = await browser.newContext({ viewport })
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'))
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      try {
        await page.goto(`${origin}/__provider_layout__${mode === 'nails' ? '?nails' : ''}`)
        const opener = page.getByRole('button', { name: mode === 'nails' ? 'Edit' : 'Edit provider', exact: true })
        await opener.click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        const save = dialog.getByRole('button', { name: 'Save provider', exact: true })
        const close = dialog.getByRole('button', { name: 'Close', exact: true })
        const body = dialog.locator('[data-provider-dialog-body]')
        const saveBefore = await assertExposed(save)
        const closeBefore = await assertExposed(close)
        assert.equal(await page.locator('#root').evaluate(element => element.inert), true)
        assert.equal(await body.evaluate(element => element.scrollHeight > element.clientHeight), true)
        await dialog.getByLabel('Full name', { exact: true }).fill('Updated Specialist')
        await body.evaluate(element => { element.scrollTop = element.scrollHeight })
        assert.deepEqual(await assertExposed(save), saveBefore)
        assert.deepEqual(await assertExposed(close), closeBefore)
        assert.equal(await body.evaluate(element => element.scrollTop > 0), true)
        if (process.env.PROVIDER_LAYOUT_SCREENSHOT && mode === 'nails' && viewport.width === 393 && viewport.height === 852) {
          await page.screenshot({ path: process.env.PROVIDER_LAYOUT_SCREENSHOT })
        }
        await close.focus()
        await page.keyboard.press('Shift+Tab')
        assert.equal(await save.evaluate(element => document.activeElement === element), true)
        await page.keyboard.press('Tab')
        assert.equal(await close.evaluate(element => document.activeElement === element), true)
        await save.click()
        await dialog.waitFor({ state: 'detached' })
        assert.equal(await page.evaluate(() => window.saves.length), 1)
        assert.equal(await page.evaluate(() => window.saves[0].fullName), 'Updated Specialist')
        assert.equal(await page.locator('#root').evaluate(element => element.inert), false)

        // Escape closes the next edit without persisting and returns focus to the trigger.
        await opener.click()
        await page.getByRole('dialog').waitFor()
        await page.keyboard.press('Escape')
        await page.getByRole('dialog').waitFor({ state: 'detached' })
        assert.equal(await page.evaluate(() => window.saves.length), 1)
        assert.equal(await opener.evaluate(element => document.activeElement === element), true)
        assert.deepEqual(errors, [])
        console.log(`PASS ${mode} provider actions visible and clickable, save and focus restoration (${viewport.width}x${viewport.height})`)
      } finally { await context.close() }
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
