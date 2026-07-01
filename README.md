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
