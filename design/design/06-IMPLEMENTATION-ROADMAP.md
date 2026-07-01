# Implementation Roadmap

## Phase 0: Product and Compliance Decisions

- Resolve the open decisions in `ANALYSIS.md`.
- Define public booking scope and provider permissions.
- Approve appointment statuses and business rules.
- Review legal/privacy text and sensitive-data requirements.
- Decide subscription/payment providers.

Exit criteria: written acceptance criteria, permission matrix, and finalized MVP boundary.

## Phase 1: Foundation

- Add Tailwind CSS and establish design tokens.
- Establish routing, layouts, error handling, environment validation, and Supabase client.
- Create core UI primitives and responsive mobile shell.
- Set up database migrations, generated types, Storage buckets, and RLS test strategy.

Exit criteria: app shell, auth shell, component baseline, and deployable environments.

## Phase 2: Authentication and Salon Creation

- Implement welcome, login, sign-up, OAuth, password reset, and legal pages.
- Implement salon record creation, verification upload, location capture, and legal acceptance.
- Add protected-route and onboarding-route guards.

Exit criteria: a user can create and access a resumable, isolated salon account.

## Phase 3: Onboarding and Salon Configuration

- Implement category/service setup, prices, durations, salon schedule, and provider setup.
- Implement provider services, earnings splits, and working schedules.
- Reuse the same configuration features under Settings.

Exit criteria: salon configuration supports the catalog and availability engine.

## Phase 4: Clients, Calendar, and Appointment Lifecycle

- Implement client search/create/profile.
- Implement calendar/timeline and appointment details.
- Implement create, reschedule, coming-up, cancel, and complete transitions.
- Add transaction-safe provider availability checks and appointment audit events.

Exit criteria: internal appointments can be managed without collisions.

## Phase 5: Treatment Registration

Build the common form/template system first, then add disciplines incrementally:

1. Shared intake, health profile, consent, appointment summary, and completion
2. Nails selections and diagrams
3. Lashes selections and photo capture
4. Cosmetology clinical form, face annotations, treatment/equipment data
5. Micropigmentation clinical and procedure data

Exit criteria: each discipline can produce a versioned, complete treatment record attached to an appointment.

## Phase 6: Home and Sales

- Implement dashboard summaries and empty states.
- Implement sales filters, totals, completed-service cards, details, and rebooking.
- Snapshot provider/salon earnings on completion.

Exit criteria: dashboard and sales figures reconcile with completed appointments.

## Phase 7: Public Booking and Sharing

- Implement `/book/:salonSlug` catalog, availability, client details, and confirmation.
- Implement copy/share actions and link states.
- Add confirmation/reminder notification infrastructure.

Exit criteria: a client can book through the shared salon link without seeing private data.

## Phase 8: Subscriptions and Account Operations

- Implement subscription plan screens and webhook-backed status.
- Implement provider deletion/reassignment safeguards.
- Implement profile editing and logout.

Exit criteria: subscription and destructive account operations are consistent and audited.

## Phase 9: Hardening and Launch

- Add unit tests for availability, status transitions, money splits, and form validation.
- Add integration tests for RLS and critical Supabase RPCs.
- Add end-to-end tests for sign-up/onboarding, appointment completion, public booking, and provider reassignment.
- Perform accessibility, responsive, timezone/DST, security, and data-retention reviews.
- Add monitoring, backups, and operational runbooks.

Exit criteria: launch checklist signed off with no critical security or workflow defects.

## Recommended MVP Boundary

Include:

- Email authentication and salon onboarding
- Salon/provider/service configuration
- Client profiles
- Internal appointment lifecycle and calendar
- One treatment discipline end-to-end
- Home dashboard and sales history
- Shareable public booking link with basic booking

Defer:

- OAuth providers
- All four advanced treatment disciplines at launch
- Automated salon verification
- Complex billing entitlements
- Multi-location salons
- Client accounts
- Advanced notifications and analytics

## Delivery Order Rationale

The calendar and sales screens depend on correctly configured salons, providers, services, clients, and appointment states. Specialized treatment forms should follow the shared treatment-record engine. Public booking should follow the availability engine so it cannot introduce double-booking.

