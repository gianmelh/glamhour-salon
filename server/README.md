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
| POST | `/api/public-booking/:slug/email-verification/status` | Check whether an email was verified for this salon |
| POST | `/api/public-booking/:slug/email-verification/request` | Send a six-digit code if verification is needed |
| POST | `/api/public-booking/:slug/email-verification/verify` | Validate an email using its code |
| POST | `/api/public-booking/:slug/clients/find-or-create` | Resolve a public booking client only after email verification |
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

## Public booking email verification

Apply `database/migrations/014_public_booking_email_verification.sql` before deploying
the updated API. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and
`SMTP_FROM` (and `SMTP_SECURE` for the mail provider). Public verification fails
closed if SMTP is missing or rejects delivery; codes are never returned by the API
or logged, including in development.

Status and request accept `{ "email": "client@domain.com" }`; verify also requires
a six-digit `code`. Emails are trimmed and normalized to lowercase. Codes expire
after ten minutes, permit five attempts, and can be resent after sixty seconds,
with up to five sends per address and one hundred per salon per hour. Failed
deliveries also count toward these limits. A new code replaces the old one.
Successful verification persists per salon and email: future bookings with that
address do not request another code. Existing client emails are not automatically
marked verified. This records email validation, not a client login session.

Appointment requests with `source: "public_booking"` require `publicBookingEmail`.
The booking transaction checks both the saved verification and the client's
current email. Changing email requires verification of the new address. Public
client resolution rejects conflicting email/phone records instead of overwriting
another client's contact information. Internal salon bookings retain their
existing behavior.

## Appointment confirmation email

After saving an appointment, the API waits for its confirmation email attempt and
returns `data.confirmation_email` with `status: "sent" | "failed" | "not_sent"` and
an optional machine-readable `reason`. The appointment remains saved (HTTP 201)
if email fails; do not repeat the booking request to retry email. `sent` means the
SMTP server accepted the message, not that delivery to the inbox was verified.

The same SMTP settings above send the appointment details and confirmation code.
Each attempt is recorded in `notifications` with
`event_type = 'appointment_confirmation'`: `sent` with `provider_message_id`,
`failed` on an SMTP/preparation error, or `canceled` when email is missing,
undeliverable or SMTP is not configured. Failures before appointment lookup, or
failures writing the audit record, are logged by appointment ID without customer
content. An audit write failure does not change an accepted email to `failed` or
trigger a duplicate send. The auxiliary lookup and audit queries each limit their
response wait to five seconds.

The public booking success screen uses the returned status. If mail failed, it
keeps the confirmed appointment and offers its existing PDF ticket. A response
from an older API without email status shows neutral confirmation text.

Run `npm run test:appointment-confirmation-email` for isolated route and SMTP
regressions; this does not send real email. After deployment, verify delivery with
a designated test inbox and check the notification/provider message ID. SMTP
acceptance alone cannot confirm receipt or placement outside spam.

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
