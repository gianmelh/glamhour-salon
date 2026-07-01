# Glamhour Salon Design Analysis

This document is the implementation blueprint derived from the exported Figma PDFs in this directory. It describes the product without adding application code.

## Product Summary

Glamhour is a mobile-first salon operations application for salon owners and providers. It combines:

- Salon account creation and verification
- Salon setup, service catalog, provider management, and schedules
- Appointment calendar and appointment lifecycle management
- Client profiles and discipline-specific treatment records
- Sales history and provider/salon earnings splits
- A public salon booking link
- Subscription and account settings

The design primarily shows the authenticated salon-facing application. The public client booking page is referenced by the shareable link but is not designed in the provided PDFs.

## Primary Roles

| Role | Responsibilities | Authentication |
|---|---|---|
| Salon owner/admin | Creates salon, configures services/providers, manages all appointments, sales, subscription, and settings | Required |
| Provider/staff | Performs services, views assigned schedule, records treatment details, completes appointments | Required; permissions need confirmation |
| Client | Is selected or created by salon staff and receives appointments/services | Public booking authentication is not shown |
| Platform/system | Verifies salon, manages subscriptions, calculates availability and earnings | Service role |

## Navigation Model

The authenticated app uses a persistent five-item bottom navigation:

1. Calendar / My Services
2. Sales History
3. Home
4. Salon Link
5. Settings

The visual design is mobile-first, with light lavender page backgrounds, white cards, purple gradients, rounded inputs/buttons, bottom-fixed primary actions, and modal success/confirmation states.

## Domain Boundaries

- **Identity and access:** users, roles, sessions, salon membership
- **Salon setup:** salon profile, verification, category selection, catalog, weekly schedule
- **Provider management:** provider profiles, languages, offered services, earnings, availability
- **Client records:** client identity, health profile, consent, treatment history
- **Scheduling:** appointments, provider availability, rescheduling, cancellation, completion
- **Treatment records:** discipline-specific selections, questionnaires, photos, diagrams, equipment/product details
- **Revenue:** completed service totals, tips, salon/provider earnings
- **Sharing:** public booking slug and social sharing
- **Billing:** subscription plans and subscription state

## Product Decisions Recommended Before Coding

1. Confirm whether providers log in independently or are records managed only by the salon owner.
2. Define the public booking experience; only its entry point is shown.
3. Confirm whether clients can have accounts, or remain salon-owned contact records.
4. Confirm payment processing scope. The designs show earnings and tips, but not checkout or payment collection.
5. Confirm whether salon verification is automated, manually reviewed, or informational only.
6. Confirm subscription provider and exact plan entitlements.
7. Review privacy/compliance requirements for medical history, consent, treatment photos, and signatures.
8. Confirm whether the specialized treatment forms are fixed templates or editable by salons.

