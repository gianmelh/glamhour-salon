# User Flows

## 1. New Salon Registration and Onboarding

`Welcome -> Sign up -> Validate account fields -> Accept legal documents -> Upload salon verification -> Select salon location -> Account created -> Select categories -> Configure services/prices/durations -> Configure weekly schedule -> Add providers -> Finish -> Calendar`

Key rules:

- Continue/submit stays disabled until required fields are valid.
- Legal acceptance must be stored with document version and timestamp.
- Onboarding progress must be resumable.
- A salon can initially operate without providers only if appointments may be assigned to the owner; otherwise require at least one provider.

## 2. Returning User Login and Password Recovery

`Welcome -> Log in -> Home`

Recovery:

`Log in -> Forgot password -> Enter email -> Enter verification code -> Set new password -> Password changed -> Log in`

## 3. Create or Register a Service for a Client

`Home or Services -> Select category/service -> Search client -> Load profile or create client -> Review health profile -> Enter discipline-specific service selections -> Complete/update clinical form and consent -> Set appointment details -> Confirm -> Appointment appears in calendar`

For a returning client, prior health data should prefill but remain explicitly reviewable. Treatment-specific details should create a new immutable treatment record rather than overwrite previous history.

## 4. Complete an Appointment

`Calendar/Home -> Appointment details -> Mark as coming up -> Open service registration -> Confirm/update service details -> Mark service complete -> Record cost/tip/earnings -> Completed appointment appears in Sales History`

Recommended state machine:

`scheduled -> confirmed/coming_up -> in_progress -> completed`

Alternative exits:

`scheduled/confirmed/in_progress -> canceled`

`scheduled/confirmed -> rescheduled` should update the appointment and preserve an audit event.

## 5. Reschedule an Appointment

`Appointment details -> Reschedule -> Select provider/date/time -> Validate availability -> Confirm -> Success modal -> Updated calendar`

The system must prevent provider overlap and validate salon/provider working hours before committing.

## 6. Review Sales and Rebook

`Sales History -> Filter provider/date range -> Expand record or open details -> Review treatment/earnings/notes -> Schedule this service again -> Appointment creation with prior client/service preselected`

## 7. Manage Salon Configuration

`Settings -> Salon Configuration -> Edit weekly schedule/categories/services/providers -> Save`

Provider removal:

`Provider details -> Delete provider -> If future appointments exist, block deletion and require reassignment -> Reassign or cancel appointments -> Delete provider`

## 8. Manage Subscription

Upgrade:

`Settings -> Subscription -> Choose premium -> Select monthly/annual -> Continue to store/payment provider -> Activated confirmation`

Cancel:

`Subscription -> Cancel plan -> Confirmation -> Keep plan or cancel -> Canceled confirmation`

## 9. Share Booking Link

`Home or Salon Link -> Copy/share link -> WhatsApp/SMS/Facebook -> Client opens public booking page`

The continuation after the client opens the link is a product gap in the provided designs.

## 10. Public Client Booking (Proposed)

Because the design references a public booking link, the minimum required flow is:

`Salon link -> Select service/category -> Select provider or any available -> Select date/time -> Enter client contact details -> Review policies -> Confirm -> Booking confirmation`

This flow should create or match a client record conservatively and should not expose internal health or treatment records.

