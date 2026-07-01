# Reusable Components

## Application Shell

- `AuthLayout`: gradient background, centered card, optional hero illustration
- `AppShell`: mobile page container with bottom navigation
- `PageHeader`: title, subtitle, back action, optional trailing action
- `BottomNavigation`: Calendar, Sales, Home, Link, Settings
- `StickyActionBar`: primary and secondary bottom actions
- `StepHeader`: onboarding title, progress indicator, helper text

## Inputs and Forms

- Text, email, password, numeric, currency, time, date, search, textarea
- Password visibility control
- Inline validation/error text
- Checkbox, radio, toggle, segmented choice, selectable chip
- File upload/dropzone with preview and remove action
- Address/location search field
- Signature field
- Dynamic option group
- Form section/card
- Long-form questionnaire section
- Consent checklist

Use a schema-driven form renderer for discipline-specific clinical and treatment forms. Each field definition should support:

- Key, label, type, options, validation, conditional visibility, unit, help text
- Required/optional state
- Repeatable groups
- Diagram/media input
- Versioning

## Scheduling

- Month calendar picker
- Horizontal week/date strip
- Timeline/day schedule
- Appointment block with status and provider color
- Provider filter
- Date/time availability picker
- Appointment summary/details card
- Status badge

## Domain Cards

- Service category card
- Service option row with price and duration
- Provider card
- Client search result/card
- Health profile summary
- Revenue metric card
- Appointment list item
- Completed sale/service card
- Booking link card
- Subscription plan card
- Empty-state guidance card
- Tip/action card

## Treatment UI

- Discipline tab/category selector
- Visual selection tile
- Hand/finger selector
- Face diagram annotation canvas
- Camera/photo capture and preview
- Treatment equipment section
- Product/material chips
- Recommendations section

## Feedback and Overlays

- Success modal
- Confirmation modal
- Destructive confirmation modal
- Toast/status message
- Loading skeleton
- Empty state
- Inline error summary

## Design Tokens to Establish

- Purple primary and dark-purple gradient
- Lavender backgrounds and selected states
- Neutral text, border, disabled, error, warning, and success colors
- Card/input/button radii
- Shadow levels for cards and fixed actions
- Mobile spacing scale
- Typography hierarchy
- Status colors for scheduled, coming up, completed, and canceled

## Component Ownership Recommendation

- `components/ui`: generic visual primitives
- `components/forms`: generic inputs and schema renderer
- `components/scheduling`: calendar and appointment UI
- `components/domain`: salon/provider/client/service cards
- `features/<feature>/components`: feature-only composed components

