// Disposable legal-review demo. Never loads the repository's .env or an existing DB.
import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(import.meta.url)
const repo = path.resolve(path.dirname(script), '..')
const salonId = '10000000-0000-0000-0000-000000000001'
const demoEmail = 'abogado@example.test'
const demoPassword = 'DemoLegal2026!'
const exists = (file: string) => access(file).then(() => true, () => false)

async function postgresBin() {
  const candidates = [process.env.GLAMHOUR_DEMO_POSTGRES_BIN,
    '/opt/homebrew/opt/postgresql@17/bin', '/opt/homebrew/opt/postgresql@16/bin',
    '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin',
    ...(process.env.PATH ?? '').split(path.delimiter)].filter((x): x is string => Boolean(x))
  for (const candidate of candidates) {
    if (await exists(path.join(candidate, 'initdb')) && await exists(path.join(candidate, 'pg_ctl'))) return candidate
  }
  throw new Error('Install PostgreSQL 16/17, or set GLAMHOUR_DEMO_POSTGRES_BIN to its bin directory.')
}

async function isolatedChild() {
  const root = process.env.GLAMHOUR_DEMO_ROOT!
  assert.ok(root && path.basename(root).startsWith('glamhour-legal-demo-'))
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null')
  const socket = path.join(root, 'socket')
  const origin = `http://127.0.0.1:${process.env.API_PORT}`
  const connection = new URL(process.env.DATABASE_URL!)
  assert.equal(connection.hostname, 'localhost')
  assert.equal(connection.searchParams.get('host'), socket)
  assert.equal(process.env.DATABASE_SSL, 'false')
  for (const key of Object.keys(process.env)) {
    assert.ok(!/^(SMTP_|STRIPE_|GOOGLE_|FACEBOOK_|APPLE_|VITE_)/.test(key), `Unexpected integration setting: ${key}`)
  }

  // First build a fresh frontend with a separate, empty env directory. Existing
  // dist, uploads, Vite env files and inherited browser API keys are never used.
  const [{ build }, { default: react }, { default: tailwindcss }] = await Promise.all([
    import('vite'), import('@vitejs/plugin-react'), import('@tailwindcss/vite'),
  ])
  await mkdir(path.join(root, 'empty-env'))
  await build({
    root: repo, configFile: false, envDir: path.join(root, 'empty-env'),
    plugins: [react(), tailwindcss(), {
      name: 'local-demo-notice',
      enforce: 'pre',
      transformIndexHtml(html) {
        return html.replace('<body>', '<body><aside style="position:relative;z-index:9999;padding:9px 16px;background:#442073;color:white;text-align:center;font:13px system-ui">DEMO LOCAL · Datos ficticios · Correos y cobros desactivados · <a href="/demo" style="color:white">Guía</a></aside>')
      },
      transform(code, id) {
        if (!id.endsWith('/src/pages/app/SharePage.tsx')) return
        // Only this disposable build disables outbound share actions. CSP alone
        // does not prevent top-level navigation to WhatsApp or an SMS handler.
        const start = code.indexOf('const shareOptions:')
        if (start < 0) throw new Error('Review demo share guard after changing SharePage')
        const sharing = code.slice(start)
        assert.equal(sharing.split('if (!canShare) return').length - 1, 4, 'Review demo external-share actions')
        return code.slice(0, start) + sharing.replaceAll('if (!canShare) return', 'window.location.assign("/demo"); return')
      },
    }],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
      'import.meta.env.VITE_SALON_ID': JSON.stringify(salonId),
      'import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL': JSON.stringify(origin),
    },
    build: { outDir: path.join(root, 'dist'), emptyOutDir: true }, logLevel: 'warn',
  })

  // Backend traffic may only reach this demo's private PostgreSQL Unix socket.
  // This also blocks SMTP, social providers, Stripe and HTTP client libraries.
  const net = await import('node:net')
  const { syncBuiltinESMExports } = await import('node:module')
  const originalConnect = net.Socket.prototype.connect
  net.Socket.prototype.connect = function (this: import('node:net').Socket, ...args: unknown[]) {
    const options = args[0]
    const socketPath = typeof options === 'string' ? options
      : options && typeof options === 'object' && 'path' in options ? (options as { path: unknown }).path : null
    if (typeof socketPath !== 'string' || !socketPath.startsWith(`${socket}/.s.PGSQL.`) || path.dirname(socketPath) !== socket) {
      throw new Error('DEMO_NETWORK_BLOCKED: only the private demo database socket is allowed')
    }
    return Reflect.apply(originalConnect, this, args)
  } as typeof originalConnect
  syncBuiltinESMExports()
  globalThis.fetch = async () => { throw new Error('DEMO_NETWORK_BLOCKED: outbound HTTP is disabled') }
  assert.throws(() => net.connect(443, 'example.test'), /DEMO_NETWORK_BLOCKED/)
  await assert.rejects(() => fetch('https://example.test'), /DEMO_NETWORK_BLOCKED/)

  process.chdir(root)
  const { pool } = await import('../server/db.ts')
  assert.equal((await pool.query('SHOW data_directory')).rows[0].data_directory, path.join(root, 'cluster'))
  assert.equal((await pool.query('SHOW listen_addresses')).rows[0].listen_addresses, '')
  const migrations = (await readdir(path.join(repo, 'database/migrations'))).filter(x => /^\d{3}_.*\.sql$/.test(x)).sort()
  assert.equal(migrations.length, 17, 'Review demo fixtures when adding a migration')
  for (const migration of migrations) {
    await pool.query(await readFile(path.join(repo, 'database/migrations', migration), 'utf8'))
    // The original seed requires the service slug from 009. Later migrations upgrade this local
    // fixture, including current plan prices; never run the legacy seed last.
    if (migration.startsWith('009_')) {
      await pool.query(await readFile(path.join(repo, 'database/seeds/001_mockup_seed_data.sql'), 'utf8'))
    }
  }
  await pool.query(await readFile(path.join(repo, 'scripts/demo-fixture.sql'), 'utf8'))
  await pool.query("UPDATE users SET email = $1, password_hash = crypt($2, gen_salt('bf')), full_name = 'Responsable Demo Legal' WHERE id = '20000000-0000-0000-0000-000000000001'", [demoEmail, demoPassword])

  // Current editable forms supplement the original historical appointment data.
  const { dataService } = await import('../server/services/data-service.ts')
  const general = {
    generalFullName: 'Cliente Demo 1', generalPhone: '+1-202-555-0101', generalDateOfBirth: '02/21/1990',
    generalEmail: 'cliente1@example.test', isFirstTime: 'No', phototype: 'Type III', healthHistory: ['Cosmetics'],
    professionalSignature: '10,20 25,10 40,25 60,12 80,20', consentDate: new Date().toISOString().slice(0, 10),
  }
  const zones = [8, 9, 10, 11, 12, 13, 14].map(position => ({ position, length: 11 }))
  const forms = {
    nails: { nailServiceType: 'Manicure', nailType: 'Almond', materials: ['Polygel'], materialLabels: ['Polygel'], extraNotes: 'Ejemplo ficticio' },
    lashes: { style: 'Cat eye', variant: 'Base', eyeShape: 'Almond eyes', volume: 'Classic', curl: 'C', thickness: '0.07', defaultLength: '11', lashMap: { rightEye: zones, leftEye: zones } },
    cosmetology: { ...general, serviceType: 'Facial Cleansing', negativeExperience: 'No', currentMedications: 'None', smoking: 'No', alcohol: 'No', skin_type: 'Sensitive', faceAnnotations: [{ id: 'demo', type: 'Sensitivity/redness', x: 10, y: 20 }] },
    micropigmentation: { ...general, procedure: 'Microblading', procedures: ['Microblading'], herpesSimplex: 'No', anesthesiaBrand: 'Anestésico ficticio', anesthesiaExposureTime: '30', needleSize: '0.18mm, 7-pin', color_mix: 'Marrón ficticio', pigment_brand: 'Pigmento ficticio', needleType: '18U', clientDesignSignature: '10,10 20,20 30,15', negativeExperience: 'No' },
  }
  for (const [category, details] of Object.entries(forms)) {
    const prior = (await dataService.listClientClinicalForms(salonId, '40000000-0000-0000-0000-000000000001')).find(item => item.category === category)
    await dataService.saveClientClinicalForm(salonId, '40000000-0000-0000-0000-000000000001', category as keyof typeof forms, {
      details, notes: 'DATOS FICTICIOS. Solo para revisión de funcionalidades.', expectedProfileId: prior?.id ?? null, expectedRevision: prior?.revision ?? null,
    })
  }

  const { default: express } = await import('express')
  const { app: application } = await import('../server/app.ts')
  const outer = express()
  outer.disable('x-powered-by')
  outer.use((request, response, next) => {
    if (request.header('host') !== `127.0.0.1:${process.env.API_PORT}` ||
      (request.header('origin') && request.header('origin') !== origin)) {
      response.status(403).send('Local demo: untrusted host or origin')
      return
    }
    response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; frame-src 'none'; object-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  outer.get('/demo', (_request, response) => {
    response.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GlamHour · Demo legal local</title><style>body{font:17px/1.6 system-ui;color:#202437;max-width:760px;margin:50px auto;padding:0 24px}h1{color:#6e38a8}a{color:#6e38a8}code{background:#f0eafa;padding:3px 7px}li{margin:10px 0}.notice{padding:20px;background:#f4effb;border-radius:12px}</style><h1>GlamHour · Demo legal local</h1><p class="notice">Todos los datos son ficticios. Esta demo funciona solo en este equipo, sin credenciales ni acceso a producción. No introduzcas información real.</p><p><b>Cuenta:</b> <code>${demoEmail}</code><br><b>Contraseña de demostración:</b> <code>${demoPassword}</code></p><p><a href="/login">Abrir la aplicación</a> · <a href="/terms">Términos actuales</a> · <a href="/privacy">Privacidad actual</a></p><ol><li>Inicia sesión y revisa Inicio, Agenda, Clientes, Equipo y Servicios.</li><li>Abre Cliente Demo 1 y sus fichas de las cuatro especialidades. Puedes editar y guardar cambios locales.</li><li>Consulta citas e historial de ventas. Los nombres, importes, firmas y antecedentes son ejemplos.</li><li>Revisa Settings y suscripción. Premium está simulado; Stripe, cobros, correo, Maps y acceso social están desactivados.</li><li>En el enlace público de reservas puedes usar <code>cliente8@example.test</code>, correo ficticio prevalidado solo en esta base. No se enviarán correos ni códigos. La confirmación mostrará la falta de envío.</li></ol><p>La demo contiene 8 clientes, 3 profesionales, 4 categorías, citas, ventas y fichas. Las referencias fotográficas antiguas no incluyen fotos reales. La demo no representa una auditoría de seguridad ni una publicación móvil.</p><p>Para reiniciar todos los datos: detén el proceso con Ctrl+C y ejecuta de nuevo <code>npm run demo:legal</code>. Los cambios se eliminan al cerrar la demo. No publiques esta instancia ni abras un túnel hacia ella.</p></html>`)
  })
  outer.use(application)
  const server = outer.listen(Number(process.env.API_PORT), '127.0.0.1', () => {
    console.log(`\nDEMO_READY ${origin}/demo\nCuenta: ${demoEmail}\nContraseña demo: ${demoPassword}\nSolo datos ficticios; red externa, correo y cobros desactivados. Ctrl+C detiene y elimina la demo.\n`)
    process.send?.({ ready: true })
  })
  server.on('error', async error => { console.error(error); await pool.end(); process.exit(1) })
  async function shutdown() {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await pool.end()
    process.exit(0)
  }
  process.once('SIGTERM', () => void shutdown())
  process.once('SIGINT', () => void shutdown())
}

async function launch() {
  const bin = await postgresBin()
  const root = await mkdtemp(path.join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'glamhour-legal-demo-'))
  const data = path.join(root, 'cluster'), socket = path.join(root, 'socket')
  const databasePort = 52000 + Math.floor(Math.random() * 6000)
  const port = Number(process.env.GLAMHOUR_DEMO_PORT ?? 4178)
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'GLAMHOUR_DEMO_PORT must be 1024..65535')
  const user = userInfo().username
  // Explicit allowlist: never forward DATABASE_URL, cloud keys, NODE_OPTIONS or .env.
  const clean = { PATH: process.env.PATH ?? '', LANG: 'C', LC_ALL: 'C', TMPDIR: root }
  const command = (name: string, args: string[]) => execFileSync(path.join(bin, name), args, { env: clean, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })
  let started = false
  let child: ChildProcess | undefined
  let stopRequested = false
  const stop = () => { stopRequested = true; child?.kill('SIGTERM') }
  const checkStopped = () => { if (stopRequested) throw new Error('Demo startup canceled; cleaning temporary files') }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    await mkdir(socket)
    checkStopped()
    command('initdb', ['-D', data, '-A', 'trust', '-U', user, '--no-locale', '--encoding=UTF8'])
    await writeFile(path.join(data, 'postgresql.conf'), `listen_addresses = ''\nunix_socket_directories = '${socket.replaceAll("'", "''")}'\nport = ${databasePort}\n`)
    checkStopped()
    started = true
    command('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-w', 'start'])
    await new Promise<void>(resolve => setImmediate(resolve))
    checkStopped()
    child = spawn(process.execPath, ['--import', 'tsx', script, '--isolated-child'], {
      cwd: repo, stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: { ...clean, NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_SSL: 'false',
        DATABASE_URL: `postgresql://${encodeURIComponent(user)}@localhost:${databasePort}/postgres?host=${encodeURIComponent(socket)}`,
        GLAMHOUR_DEMO_ROOT: root, API_HOST: '127.0.0.1', API_PORT: String(port),
        CORS_ORIGIN: `http://127.0.0.1:${port}`, APP_URL: `http://127.0.0.1:${port}`,
        UPLOAD_DIR: path.join(root, 'uploads'), MEDIA_PUBLIC_BASE: '/api',
      },
    })
    const exited = new Promise<number>((resolve, reject) => {
      child!.once('error', reject)
      child!.once('exit', code => resolve(code ?? 1))
    })
    if (process.argv.includes('--check')) {
      const ready = new Promise<void>(resolve => child!.once('message', () => resolve()))
      await Promise.race([ready, exited.then(code => { throw new Error(`Demo exited before ready: ${code}`) })])
      await checkDemo(port)
      stop()
    }
    const code = await exited
    if (code !== 0) throw new Error(`Demo process exited with ${code}`)
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await new Promise<void>(resolve => child!.once('exit', () => resolve()))
    }
    if (started && await exists(path.join(data, 'postmaster.pid'))) {
      try { command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']) }
      catch { throw new Error(`Shutdown failed. Temporary cluster retained at ${data}`) }
    }
    await rm(root, { recursive: true, force: true })
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    console.log('DEMO_CLEANUP: isolated PostgreSQL stopped; temporary demo files removed.')
  }
}

async function checkDemo(port: number) {
  const base = `http://127.0.0.1:${port}`
  const health = await fetch(`${base}/health`)
  assert.equal(health.status, 200)
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: demoEmail, password: demoPassword }) })
  assert.equal(login.status, 200)
  assert.equal((await login.json()).data.salons[0].id, salonId)
  const clients = await (await fetch(`${base}/api/salons/${salonId}/clients`)).json()
  assert.equal(clients.data.length, 8)
  assert.ok(clients.data.every((x: { email: string }) => x.email.endsWith('@example.test')))
  const created = await fetch(`${base}/api/salons/${salonId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'Cliente de prueba local', email: 'check@example.test', phone: '+1-202-555-0199' }) })
  assert.equal(created.status, 201, await created.text())
  const forms = await (await fetch(`${base}/api/salons/${salonId}/clients/40000000-0000-0000-0000-000000000001/clinical-forms`)).json()
  assert.equal(forms.data.length, 4)
  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const sales = await (await fetch(`${base}/api/salons/${salonId}/sales-history?startDate=${from}&endDate=${to}`)).json()
  assert.ok(sales.data.records.length >= 4, 'Recent fictional sales are visible')
  const denied = await fetch(`${base}/api/salons/${salonId}/clients`, { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(denied.status, 403)
  const page = await fetch(`${base}/login`)
  assert.ok(page.headers.get('Content-Security-Policy')?.includes("connect-src 'self'"))
  assert.ok((await page.text()).includes('DEMO LOCAL'))
  console.log('DEMO_CHECK_PASS: login, 8 fictional clients, local write, 4 forms, recent sales, origin guard, CSP and backend network denial.')
}

if (process.argv.includes('--isolated-child')) await isolatedChild()
else await launch()
