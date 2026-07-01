# Screen Inventory

## Authentication and Legal

| Screen/state | Source | Purpose |
|---|---|---|
| Welcome / auth landing | Log in, Sign up | Brand introduction with Log in and Sign up actions |
| Log in: empty, valid, invalid | Log in | Email/password authentication with inline validation |
| Social sign-in options | Log in, Sign up | Facebook, Google, and Apple authentication entry points |
| Reset password: email | Log in | Request password reset verification code |
| Reset password: verification code | Log in | Enter emailed verification code |
| Reset password: new password | Log in | Set and confirm replacement password |
| Password changed modal | Log in | Confirms successful reset |
| Create account: empty, valid, invalid | Sign up | Salon name, email, password, confirmation, legal acceptance |
| Salon ownership verification | Sign up | Upload verification document and locate salon |
| Account created modal | Sign up | Starts onboarding |
| Terms and Conditions | Terms and conditions/privacy policy | Legal content and acceptance action |
| Privacy Policy | Terms and conditions/privacy policy | Privacy content and acceptance action |

## Salon Onboarding

| Screen/state | Source | Purpose |
|---|---|---|
| Service category selection | Onboarding | Select Nails, Lashes, Cosmetology, and/or Micropigmentation |
| Service selection and setup | Onboarding | Choose category services and enter price/duration |
| Weekly salon schedule | Onboarding | Enable days and define opening/closing times |
| Team and providers: empty/list | Onboarding | Add providers or proceed with existing provider cards |
| Add service provider: empty/valid/invalid | Onboarding | Enter profile, languages, earnings splits, schedule, and services |
| Provider summary/edit card | Onboarding | Review a configured provider |
| Salon ready modal | Onboarding | Completes setup and enters the calendar |

## Home Dashboard

| Screen/state | Source | Purpose |
|---|---|---|
| Home: populated | Home | Greeting, create appointment CTA, date strip, revenue, appointments, active staff, booking link |
| Home: no appointments | Home | Empty state plus booking-link promotion |
| Home: no active staff | Home | Operational guidance for schedules, reassignment, and provider availability |
| Home: no appointments and no staff | Home | Combined empty and guidance states |

## Calendar and Appointments

| Screen/state | Source | Purpose |
|---|---|---|
| My Services calendar: empty/populated | Salon/calendar | Day timeline grouped/filterable by provider |
| Month/year picker | Salon/calendar | Change visible month/year |
| Appointment details: upcoming | Salon/calendar | View appointment and mark as coming up/reschedule |
| Appointment details: coming up | Salon/calendar | Mark complete, reschedule, or cancel |
| Appointment details: completed | Salon/calendar | Review completed appointment |
| Select provider and date | Salon/calendar | Choose new provider/date/time while rescheduling |
| Successfully scheduled modal | Salon/calendar | Confirms appointment scheduling/rescheduling |

## Service Registration and Treatment Records

The four registration PDFs share a common entry flow:

1. Services/category list
2. Search client
3. Load existing profile or create a new client
4. Review health profile
5. Enter discipline-specific treatment details
6. Complete questionnaire/consent where required
7. Confirm appointment details
8. Mark service complete
9. Optionally revise selections before completion

### Shared Registration Screens

| Screen/state | Source | Purpose |
|---|---|---|
| Services category list | All registration flows | Shows scheduled/active services by discipline |
| Search client: empty/results | All registration flows | Find an existing client or create one |
| Client health profile summary | All registration flows | Review allergies, medications, and notes |
| Clinical intake form | Nails, Lashes, Cosmetology, Micropigmentation | Capture personal, health, safety, and consent information |
| Appointment details: upcoming/completed | All registration flows | View client/date/time/cost/tip and complete or reschedule |
| Update service selections modal | Nails, Lashes | Apply changes or keep existing selections |

### Nails

- Nail system/type and service selection
- Nail shape
- Materials
- Hand/finger selection and per-finger detail
- Nail questionnaire and informed consent

### Lashes

- Lash style, eye shape, volume, curl, thickness, and length
- Variant selection
- Client reference photo upload/camera capture
- Photo preview/confirmation
- Lash questionnaire and informed consent

### Cosmetology

- Aesthetic clinical form
- Service type and extensive health/skin assessment
- Facial diagram with detected/marked alterations and notes
- Treatment and equipment record
- Product/chemical and professional control data
- Completion recommendations

### Micropigmentation

- Aesthetic clinical form
- Service type by area: eyebrows, lips, eyes
- Extensive health and safety intake
- Procedure notes, skin tone, prior treatments, and details
- Pigment/tools/control information, consent, signatures, and recommendations

## Sales History

| Screen/state | Source | Purpose |
|---|---|---|
| Sales history: populated | Sales history | Filter by provider/date and view salon/provider totals |
| Date range calendar picker | Sales history | Select reporting range |
| Sales history: no appointments | Sales history | Empty state and suggested actions |
| Sales history: no services assigned | Sales history | Provider-specific empty state and setup guidance |
| Service details: nails/lashes/cosmetology/micropigmentation | Sales history | Review completed treatment, earnings split, tip, notes, and rebook |

## Salon Link

| Screen/state | Source | Purpose |
|---|---|---|
| Salon link: default/copied/error | Sherable link | Copy the public booking link and share via WhatsApp, SMS, or Facebook |

## Settings

| Screen/state | Source | Purpose |
|---|---|---|
| Settings overview | Settings | Access account and salon configuration |
| Profile information edit | Settings | Update salon name and email |
| Subscription overview | Settings | View plan, billing cycle, renewal, and cancel action |
| Choose premium plan | Settings | Select annual/monthly premium plan and proceed to store |
| Premium activated | Settings | Confirm successful plan activation |
| Premium canceled | Settings | Confirm cancellation |
| Cancel premium confirmation | Settings | Confirm or retain current plan |
| Salon configuration | Settings | Edit weekly schedule, categories, services, and providers |
| Add/edit provider | Settings | Maintain provider information, schedule, services, and earnings |
| Delete provider confirmation | Settings | Delete or reassign a provider with appointment safeguards |
| Logout confirmation | Settings | End authenticated session |

## Screens Referenced but Not Designed

- Public salon booking page
- Client-side category/service/provider/date selection
- Public booking confirmation and cancellation
- Notifications/reminders
- Provider invitation/login experience
- Payment collection, refunds, or payout setup
- Platform admin verification/review screens

