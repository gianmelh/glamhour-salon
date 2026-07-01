# Glamhour Database

This directory contains the PostgreSQL database architecture and mockup-derived development seed data. It does not build UI or API endpoints.

## Migration Order

1. `migrations/001_foundation.sql` - users, salons, owners, memberships, legal, verification, onboarding, settings
2. `migrations/002_catalog_staff_clients.sql` - categories, services, professionals, clients, health profiles, form templates
3. `migrations/003_scheduling.sql` - appointment statuses, working hours, availability, appointments, event/history tables
4. `migrations/004_treatments_finance_engagement.sql` - treatment records, consent, payments, invoices, sales snapshots, notifications, reviews, subscriptions
5. `migrations/005_reporting_views.sql` - sales-history and public-booking catalog views
6. `migrations/006_password_reset_codes.sql` - password reset verification codes

## Local Application

Install PostgreSQL locally, then create a clean development database:

```bash
createdb glamhour_dev
export DATABASE_URL="postgresql://localhost/glamhour_dev"
```

Apply migrations in filename order, followed by the seed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_catalog_staff_clients.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_scheduling.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_treatments_finance_engagement.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/005_reporting_views.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/006_password_reset_codes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_mockup_seed_data.sql
```

The seed expects a clean database after all six migrations. It creates the Glow Salon scenario shown in the design, including three professionals, eight clients, nine services, upcoming calendar appointments, four completed sales records, treatment records, payments, invoices, receipts, notifications, and two future client-app review samples.

Verify the main mockup data:

```bash
psql "$DATABASE_URL" -c "SELECT name, slug, booking_enabled FROM salons;"
psql "$DATABASE_URL" -c "SELECT client_name, professional_name, total_minor FROM sales_history ORDER BY starts_at;"
psql "$DATABASE_URL" -c "SELECT salon_slug, category_name, service_name FROM public_booking_catalog ORDER BY category_name, service_name;"
```

To rebuild the local-only database from scratch:

```bash
dropdb glamhour_dev
createdb glamhour_dev
```

## Architecture Principles

- PostgreSQL is the shared source of truth for the salon-facing and future client-facing applications.
- Every salon-owned operational record carries `salon_id`.
- Composite foreign keys prevent records from accidentally linking across salons.
- UUID primary keys allow safe generation across API workers and future clients.
- Monetary values are integer minor units such as cents; never floating point.
- Times are stored as `timestamptz`; each salon stores its IANA timezone.
- Appointment price, duration, and service/category names are snapshotted so history remains correct after catalog changes.
- Completed appointment finances are snapshotted in `appointment_financials`; `sales_history` is a view, not a duplicated mutable table.
- Medical intake, consent, and specialized treatment details use versioned form templates and JSONB answers. Core searchable/business data stays relational.
- Professionals and clients may optionally link to `users`, allowing future independent logins without requiring them now.
- Appointments cannot overlap for the same professional while active.
- Destructive deletes are restricted for historical/financial records; user-facing deletion should normally be soft deletion.

## Design-to-Entity Coverage

| Design area | Primary tables |
|---|---|
| Sign up, login, password recovery | `users` plus external auth/session layer |
| Salon ownership verification | `salons`, `salon_owners`, `salon_verification_documents` |
| Terms and privacy acceptance | `legal_documents`, `legal_acceptances` |
| Onboarding | `onboarding_sessions`, `salon_service_categories`, `services`, schedules, professionals |
| Team/providers | `professionals`, `professional_services`, `professional_working_hours` |
| Clients and health profiles | `clients`, `client_health_profiles`, `client_form_submissions` |
| Calendar and availability | `salon_working_hours`, `professional_working_hours`, `availability_exceptions`, `appointments` |
| Appointment lifecycle | `appointment_statuses`, `appointment_status_transitions`, `appointments`, `appointment_status_history`, `appointment_events` |
| Nails/lashes/cosmetology/micropigmentation | `form_templates`, `treatment_records`, `treatment_media`, `consent_records` |
| Sales history | `appointment_financials`, `payments`, `sales_history` view |
| Receipts | `invoices`, `invoice_items`, `payment_allocations`, `receipts` |
| Shareable salon link | `salons.slug`, `salon_settings`, `public_booking_catalog` view |
| Settings and subscriptions | `salon_settings`, `user_settings`, `subscription_plans`, `salon_subscriptions` |
| Notifications | `notification_preferences`, `notifications` |
| Reviews/ratings | `reviews` |

Reviews are not visible in the current salon-facing mockups, but the table is included because it is a stated requirement and a likely need for the future client-facing application.

## Seed Data

`seeds/001_mockup_seed_data.sql` is intentionally separate from schema migrations. It uses fixed UUIDs and is designed for a clean local/development database, not production. The file ends with verification checks against `sales_history` and `public_booking_catalog`; any incomplete seed transaction rolls back.

## Backend Requirement

A backend API layer is required even if a hosted PostgreSQL service is used. Public booking, availability calculation, appointment completion, provider reassignment, payments, and subscription webhooks must execute as trusted transactions rather than direct browser writes.

See [SCHEMA.md](docs/SCHEMA.md) for the ERD, entity explanations, and future API/frontend plan.
