# Glamhour API

The Phase 3 API is an Express 5 + TypeScript server backed by PostgreSQL through `pg`. Routes validate inputs with Zod and return consistent JSON responses.

## Runtime And Configuration

Use Node.js 20.19 or newer. Create a local environment file:

```bash
cp .env.example .env
```

Required:

```dotenv
DATABASE_URL=postgresql://localhost/glamhour_dev
```

Defaults:

```dotenv
API_PORT=3001
API_HOST=127.0.0.1
CORS_ORIGIN=http://localhost:5173
VITE_API_URL=http://127.0.0.1:3001/api
DATABASE_SSL=false
```

Set `DATABASE_SSL=true` for hosted PostgreSQL providers that require TLS.

## Run

Apply the migrations and seed data using [database/README.md](../database/README.md), then:

```bash
npm run dev:api
```

Run frontend and backend together:

```bash
npm run dev:all
```

Health check:

```bash
curl http://127.0.0.1:3001/health
```

## Response Format

Success: `{ "data": ... }`

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

## Endpoints

All salon routes expect the UUID from `salons.id`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API and database health |
| GET | `/api/salons` | List salons |
| GET | `/api/salons/:salonId` | Salon details |
| GET | `/api/salons/by-slug/:slug` | Salon by public slug |
| GET | `/api/salons/:salonId/professionals` | List staff/professionals |
| GET | `/api/salons/:salonId/professionals/:id` | Professional details |
| GET | `/api/salons/:salonId/clients?search=` | Search/list clients |
| GET | `/api/salons/:salonId/clients/:id` | Client and health profile |
| POST | `/api/salons/:salonId/clients` | Create a client |
| GET | `/api/service-categories?salonId=` | Global or salon-enabled categories |
| GET | `/api/salons/:salonId/services?category=` | List services |
| GET | `/api/salons/:salonId/services/:id` | Service details |
| POST | `/api/salons/:salonId/services` | Create a service |
| GET | `/api/salons/:salonId/appointments` | Filter appointments |
| POST | `/api/salons/:salonId/appointments` | Create appointment transactionally |
| GET | `/api/salons/:salonId/appointments/:id` | Appointment with service lines |
| PATCH | `/api/salons/:salonId/appointments/:id/status` | Apply allowed status transition |
| GET | `/api/salons/:salonId/availability?from=&to=&professionalId=` | Working hours, exceptions, and busy periods |
| GET | `/api/salons/:salonId/payments` | List payments |
| GET | `/api/salons/:salonId/invoices` | List invoices |
| GET | `/api/salons/:salonId/receipts` | List receipts |
| GET | `/api/salons/:salonId/sales-history` | Filter completed sales |
| GET | `/api/salons/:salonId/notifications` | List notifications |
| GET | `/api/salons/:salonId/settings` | Salon booking settings |
| PATCH | `/api/salons/:salonId/settings` | Update salon booking settings |
| GET | `/api/salons/:salonId/reviews?publicOnly=true` | List reviews |

List endpoints accept `limit` and `offset`. Appointment and sales endpoints support date, provider, client, and status filters as applicable.

## Examples

The seeded Glow Salon ID is `10000000-0000-0000-0000-000000000001`.

```bash
curl "http://127.0.0.1:3001/api/salons/10000000-0000-0000-0000-000000000001/services"

curl "http://127.0.0.1:3001/api/salons/10000000-0000-0000-0000-000000000001/appointments?from=2026-03-18T00:00:00-04:00&to=2026-03-19T00:00:00-04:00"
```

Create appointment:

```bash
curl -X POST "http://127.0.0.1:3001/api/salons/10000000-0000-0000-0000-000000000001/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "40000000-0000-0000-0000-000000000007",
    "professionalId": "30000000-0000-0000-0000-000000000001",
    "serviceIds": ["60000000-0000-0000-0000-000000000003"],
    "startsAt": "2026-03-20T10:00:00-04:00",
    "endsAt": "2026-03-20T11:00:00-04:00",
    "source": "internal"
  }'
```

## Frontend Usage

The shared fetch helper is [src/lib/api.ts](../src/lib/api.ts):

```ts
import { apiRequest } from './lib/api'

const services = await apiRequest<Service[]>(`/salons/${salonId}/services`)
```

The frontend uses `VITE_API_URL`, never `DATABASE_URL`. Browser code must not connect directly to PostgreSQL.

## Structure

- `server/routes.ts`: HTTP routes and request validation
- `server/services/data-service.ts`: typed SQL data access and transactions
- `server/db.ts`: PostgreSQL pool and transaction helper
- `server/types/entities.ts`: database entity response types
- `server/errors.ts`: consistent API/database error mapping
- `server/validation.ts`: reusable Zod schemas

Authentication and authorization middleware are intentionally deferred until an identity provider is selected. Before production, every salon route must derive authorized salon access from the authenticated user rather than trusting the URL alone.
