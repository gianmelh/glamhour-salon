# Glamhour

Glamhour is a beauty salon booking and business-management application.

- PostgreSQL schema and local mockup data: [database/README.md](database/README.md)
- Express/TypeScript API: [server/README.md](server/README.md)
- Design analysis and roadmap: [design/design/ANALYSIS.md](design/design/ANALYSIS.md)
- Design tokens: [design/design/07-DESIGN-TOKENS.md](design/design/07-DESIGN-TOKENS.md)
- Reusable React components: [`src/components`](src/components)

## Development

Use Node.js 20.19+.

```bash
cp .env.example .env
npm install
npm run dev:all
```

The frontend runs on `http://localhost:5173`; the API defaults to `http://127.0.0.1:3001`.

The frontend contains the routed Glamhour application screens and consumes the
Express/PostgreSQL API through reusable typed hooks. When the API is unavailable,
screens may show clearly labeled development fallback data from
`src/data/fallback-data.ts`. Mutations never silently fall back.

Key routes:

- `/`, `/intro`, `/entry` - welcome and product introduction
- `/login`, `/signup`, `/forgot-password`, `/register` - authentication and registration
- `/onboarding/categories` - start of the salon setup flow
- `/app/home`, `/app/calendar`, `/app/appointments` - daily salon operations
- `/app/clients`, `/app/services`, `/app/staff` - salon management
- `/app/sales`, `/app/share`, `/app/settings` - reporting and account tools

## Full Local Setup

Use Node.js 20.19+ and PostgreSQL:

```bash
nvm use 20
createdb glamhour_dev
export DATABASE_URL="postgresql://localhost/glamhour_dev"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_catalog_staff_clients.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_scheduling.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_treatments_finance_engagement.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/005_reporting_views.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_mockup_seed_data.sql

cp .env.example .env
npm install
npm run dev:all
```

The seeded salon ID is configured by `VITE_SALON_ID`. The frontend runs at
`http://localhost:5173`, the API at `http://127.0.0.1:3001`, and API health is
available at `http://127.0.0.1:3001/health`.

Phase 6 API-backed screens:

- Home dashboard, appointments, appointment details, and calendar
- Clients, services, professionals, sales history, sharing, and settings
- Notifications on the dashboard

Implemented mutations:

- Create appointment
- Update appointment status
- Create client
- Create service
- Enable or disable public booking in salon settings

## Commands

- `npm run dev` - frontend only
- `npm run dev:api` - backend only
- `npm run dev:all` - frontend and backend
- `npm run typecheck:api` - backend TypeScript check
- `npm run build` - frontend and project TypeScript build
- `npm run lint` - lint frontend and backend

## Local browser regression checks

```bash
npx playwright install chromium
npm run test:regression
```

To use an installed Chrome instead, run
`PLAYWRIGHT_CHANNEL=chrome npm run test:regression`.

The tests start local Vite servers, mock API responses and block external requests.
They require no API server or database and send no emails. Coverage includes
browser-translated buttons, internal and public appointment submission, error
recovery, retained clinical data, and date/time picker activation. Registration
tests exercise the Google Maps branch with a simulated widget, including address
selection, mobile styles and manual entry after search failures. Native iPhone
keyboard behavior and the live Google widget still require a physical-device check.

Provider settings and booking catalog checks can also be run independently with
`npm run test:provider-settings` (or `PLAYWRIGHT_CHANNEL=chrome npm run test:provider-settings`).
These cover custom provider hours independent of salon hours, optional salon
schedule inheritance, language edits on legacy records (English, Spanish, and
Portuguese only), provider save actions at mobile sizes, and disabled categories
in provider assignments, new bookings, saved drafts, public booking, and
rescheduling. Category settings cover disabling every category, re-enabling,
failed saves, and stale onboarding drafts. Public booking rechecks the catalog on
returning to the tab and before confirmation. Full service catalog loading is
checked beyond 100 services and fails closed if any page cannot load, protecting
provider assignments from partial catalogs. Existing treatment records remain
editable after their category is disabled. Browser requests and database queries
are mocked; these checks do not modify a live salon.

Lash photo fitting checks run with `npm run test:lash-preview` (or
`PLAYWRIGHT_CHANNEL=chrome npm run test:lash-preview`). They cover the three-point
curve, older seven-point drafts, mouse and touch adjustment, rotation, and saved
preview restoration using local lash images and a synthetic photo.

Public booking now requires email verification before confirmation. A six-digit
code expires after ten minutes; successfully verified addresses are remembered
per salon, so later bookings do not send another code. Deploy migration
`database/migrations/014_public_booking_email_verification.sql` before the API and
configure SMTP as described in [server/README.md](server/README.md).

Run `PLAYWRIGHT_CHANNEL=chrome npm run test:public-booking-email` for the email
verification regressions. These use mocked PostgreSQL and SMTP, local HTTP routes,
and a browser with external traffic blocked. They cover code expiry and attempt
limits, resends, prior verification, stale responses after changing email, client
contact conflicts, and server enforcement before public appointment creation.

Appointment confirmation email checks also run in that suite, or separately with
`npm run test:appointment-confirmation-email`. They cover SMTP acceptance/rejection,
missing configuration, email content, database logging failures, and preserving a
saved booking when email fails. Public booking now reports the email outcome and
keeps the PDF ticket available when confirmation mail could not be sent.
