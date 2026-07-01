# Application Architecture

## Recommended Shape

Use one React/Vite application with two route groups:

- **Authenticated salon app:** salon operations, provider workflows, sales, and settings
- **Public booking app:** salon booking link experience, isolated from internal records

Supabase provides authentication, PostgreSQL, Storage, Row Level Security, Realtime where useful, and Edge Functions for trusted workflows.

## Frontend Layers

```text
src/
  app/
    router/
    providers/
    layouts/
  components/
    ui/
    forms/
    scheduling/
    domain/
  features/
    auth/
    onboarding/
    home/
    salon/
    providers/
    clients/
    services/
    appointments/
    treatments/
    sales/
    sharing/
    subscriptions/
  lib/
    supabase/
    validation/
    dates/
    money/
  types/
```

## Route Model

```text
/                         welcome
/login                    login
/forgot-password/*        password recovery
/signup/*                  account creation and verification
/legal/terms               terms
/legal/privacy             privacy
/onboarding/*              resumable salon setup
/app/home                  dashboard
/app/calendar              appointment calendar
/app/appointments/:id      appointment details
/app/services/register/*   client service/treatment flow
/app/sales                 sales history
/app/sales/:id             completed service details
/app/share                 salon link
/app/settings/*            profile, salon, providers, subscription
/book/:salonSlug/*         public booking
```

## State Strategy

- Supabase is the server state source of truth.
- Use feature-scoped query hooks and cache invalidation around appointments, services, providers, and sales.
- Keep transient multi-step form state in a route-level provider/store and save drafts for long clinical forms.
- Derive dashboard and sales summaries through database views/RPCs, not by aggregating all records in the browser.
- Store all times in UTC and retain each salon's IANA timezone for display and availability calculation.

## Supabase Responsibilities

### Auth

- Email/password and supported OAuth providers
- User metadata only for bootstrapping; authoritative profile and membership data lives in database tables

### Database and RLS

- Every salon-owned row includes `salon_id`
- Access is granted through active salon membership
- Owners/admins can manage salon configuration and all operational data
- Providers can access assigned appointments and permitted client/treatment data
- Public users can only read explicitly published booking catalog/availability and create bookings through a controlled RPC/Edge Function

### Storage Buckets

- `salon-verification`: private, owner/platform access
- `provider-avatars`: public or signed-read
- `client-treatment-media`: private, salon-member signed-read
- `consent-signatures`: private, restricted

### Edge Functions / Trusted RPCs

- Calculate public availability
- Create a public booking atomically and prevent time collisions
- Reschedule/cancel appointments with audit events
- Mark appointment complete and create financial split snapshot
- Send confirmation/reminder notifications
- Subscription webhook processing

## Data and Form Architecture

Use a hybrid relational/JSONB model:

- Relational tables for salons, people, services, appointments, earnings, and permissions
- Versioned form templates plus JSONB answers for specialized clinical/treatment forms
- Typed relational columns for commonly queried appointment fields and money values
- Immutable snapshots on completed appointments so later service/provider configuration changes do not rewrite history

This avoids hard-coding a separate database table for every visual selection while retaining configurable, versioned treatment records.

## Security and Compliance

- Enable RLS on every exposed table.
- Keep medical/health/treatment media private.
- Record consent document version, signer, and timestamp.
- Preserve appointment and treatment audit trails.
- Avoid putting sensitive data in auth metadata, URLs, logs, or public storage.
- Define retention/deletion policy before launch.
- Get legal review for the supplied Terms and Privacy content and for handling health-related data.

## Architecture Risks

- Public booking is underspecified and is essential to the booking-link promise.
- Specialized forms are much larger than the rest of the app and can dominate scope.
- Appointment collision prevention must happen in the database, not only in UI validation.
- Sales figures require immutable completion snapshots to remain historically accurate.
- Provider deletion/reassignment needs transaction-safe business logic.

