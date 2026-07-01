# Database Schema

The executable Phase 1 PostgreSQL schema now lives in [`database/migrations`](../../database/migrations), with the full ERD and implementation decisions in [`database/docs/SCHEMA.md`](../../database/docs/SCHEMA.md). This document remains the original design-level blueprint.

All primary keys are UUIDs unless noted. Every mutable table should include `created_at` and `updated_at`. Money values use integer minor units such as cents.

## Identity and Tenancy

### `profiles`

- `id` references `auth.users`
- `full_name`, `email`, `avatar_path`
- `platform_role`

### `salons`

- `id`, `name`, `slug` unique
- `owner_user_id`
- `email`, `phone`
- `timezone`, `currency_code`
- `address_json`
- `verification_status`
- `onboarding_status`, `onboarding_step`
- `booking_enabled`

### `salon_memberships`

- `salon_id`, `user_id`
- `role`: owner, admin, provider
- `status`: invited, active, disabled
- unique `(salon_id, user_id)`

### `salon_verification_documents`

- `salon_id`, `storage_path`, `document_type`
- `status`, `reviewed_at`, `reviewed_by`

### `legal_documents`

- `type`: terms, privacy
- `version`, `content`, `published_at`, `active`

### `legal_acceptances`

- `user_id`, `salon_id`, `legal_document_id`
- `accepted_at`, `ip_hash`

## Catalog and Providers

### `service_categories`

- `id`, `code`, `name`, `description`, `sort_order`

Seeded categories: nails, lashes, cosmetology, micropigmentation.

### `services`

- `salon_id`, `category_id`
- `name`, `description`
- `duration_minutes`
- `price_cents`
- `active`, `publicly_bookable`
- `form_template_id` nullable

### `providers`

- `salon_id`, `user_id` nullable
- `full_name`, `avatar_path`
- `languages` text array
- `status`, `is_owner`
- `salon_earnings_percent`, `provider_earnings_percent`

### `provider_services`

- `provider_id`, `service_id`
- optional overrides: `duration_minutes`, `price_cents`
- unique `(provider_id, service_id)`

### `salon_working_hours`

- `salon_id`, `day_of_week`
- `is_open`, `start_time`, `end_time`
- unique `(salon_id, day_of_week)`

### `provider_working_hours`

- `provider_id`, `day_of_week`
- `is_working`, `start_time`, `end_time`
- unique `(provider_id, day_of_week)`

### `provider_time_off`

- `provider_id`, `starts_at`, `ends_at`, `reason`

## Clients and Clinical Data

### `clients`

- `salon_id`
- `full_name`, `phone`, `email`, `date_of_birth`
- `notes`
- optional matching fields normalized for search

### `client_health_profiles`

- `client_id`
- `allergies`, `medications`, `conditions`, `notes`
- `responses_json`
- `reviewed_at`, `reviewed_by`

### `form_templates`

- `category_id` nullable
- `code`, `name`, `version`
- `purpose`: intake, treatment, consent
- `schema_json`
- `active`

### `client_form_submissions`

- `salon_id`, `client_id`, `appointment_id` nullable
- `form_template_id`
- `answers_json`
- `status`: draft, submitted
- `submitted_by`, `submitted_at`

### `consent_records`

- `salon_id`, `client_id`, `appointment_id`
- `form_submission_id`
- `signature_path`
- `signed_at`, `professional_signature_path`

## Scheduling and Treatments

### `appointments`

- `salon_id`, `client_id`, `provider_id`
- `status`: scheduled, coming_up, in_progress, completed, canceled
- `starts_at`, `ends_at`
- `source`: internal, public_booking, rebook
- `notes`, `cancellation_reason`
- `rescheduled_from_id` nullable

Use a PostgreSQL exclusion constraint or transaction-safe availability RPC to prevent overlapping active appointments for a provider.

### `appointment_services`

- `appointment_id`, `service_id`
- snapshot fields: `service_name`, `category_code`, `duration_minutes`, `price_cents`
- `status`

### `appointment_events`

- `appointment_id`
- `event_type`
- `actor_user_id`
- `from_status`, `to_status`
- `metadata_json`, `created_at`

### `treatment_records`

- `salon_id`, `appointment_service_id`, `client_id`, `provider_id`
- `category_code`
- `template_version`
- `details_json`
- `notes`, `recommendations`
- `completed_at`

`details_json` stores specialized data such as nail/finger selections, lash properties, facial annotations, equipment, products, or pigment details.

### `treatment_media`

- `treatment_record_id`
- `type`: reference, before, after, diagram, other
- `storage_path`, `metadata_json`

## Revenue and Subscriptions

### `appointment_financials`

- `appointment_id` unique
- `subtotal_cents`, `tip_cents`, `total_cents`
- `salon_earnings_cents`, `provider_earnings_cents`
- `currency_code`
- `recorded_at`

These values are completion-time snapshots.

### `subscription_plans`

- `code`, `name`, `billing_interval`
- `price_cents`, `currency_code`
- `entitlements_json`, `active`

### `salon_subscriptions`

- `salon_id`, `plan_id`
- `provider`, `provider_customer_id`, `provider_subscription_id`
- `status`, `current_period_start`, `current_period_end`
- `cancel_at_period_end`

## Notifications and Sharing

### `notification_preferences`

- `salon_id`, `user_id` nullable
- `channel`, `event_type`, `enabled`

### `notifications`

- `salon_id`, `appointment_id` nullable
- `recipient`, `channel`, `template`
- `status`, `scheduled_for`, `sent_at`, `metadata_json`

The public booking URL can be derived from `salons.slug`; a separate link table is only needed if links can expire, be disabled independently, or be campaign-tracked.

## Important Views / RPCs

- `dashboard_summary(salon_id, date)`
- `sales_summary(salon_id, provider_id, date_range)`
- `available_slots(salon_id, service_id, provider_id, date_range)`
- `create_public_booking(...)`
- `reschedule_appointment(...)`
- `complete_appointment(...)`
- `reassign_provider_appointments(...)`

## RLS Summary

- Salon-owned data: accessible only through active `salon_memberships`.
- Owner/admin: full salon scope.
- Provider: own schedule, assigned clients/appointments, and records needed for service delivery.
- Client/public: no direct access to internal tables; use narrowly scoped public views/RPCs.
- Verification documents, health profiles, signatures, and treatment media: always private.
