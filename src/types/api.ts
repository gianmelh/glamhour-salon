export interface Timestamped {
  created_at: string
  updated_at: string
}

export interface Salon extends Timestamped {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  timezone: string
  currency_code: string
  locale: string
  city: string | null
  region: string | null
  verification_status: string
  onboarding_status: string
  booking_enabled: boolean
  is_active: boolean
}

export interface Professional extends Timestamped {
  id: string
  salon_id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  languages: string[]
  status: string
  is_owner: boolean
  salon_earnings_percent: string
  professional_earnings_percent: string
}

export interface ProfessionalServiceAssignment {
  service_id: string
  duration_override_minutes: number | null
  price_override_minor: number | null
  is_active: boolean
}

export interface ProfessionalWithNailSettings extends Professional {
  use_salon_schedule: boolean
  service_assignments: ProfessionalServiceAssignment[]
  schedule: Record<string, OnboardingDayInput>
}

export interface Client extends Timestamped {
  id: string
  salon_id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  preferred_language: string | null
  notes: string | null
}

export interface ServiceCategory extends Timestamped {
  id: string
  code: string
  name: string
  description: string | null
  icon_key: string | null
  sort_order: number
  is_active: boolean
}

export interface Service extends Timestamped {
  id: string
  salon_id: string
  category_id: string
  form_template_id: string | null
  name: string
  description: string | null
  duration_minutes: number
  price_minor: number
  currency_code: string
  is_active: boolean
  is_publicly_bookable: boolean
  sort_order: number
  category_code?: string
  category_name?: string
}

export interface ServiceMaterial extends Timestamped {
  id: string
  salon_id: string
  category_id: string
  service_id: string | null
  name: string
  brand: string | null
  material_type: string | null
  unit: string | null
  cost_minor: number | null
  currency_code: string
  is_active: boolean
  sort_order: number
}

export interface AppointmentService {
  id: string
  service_name_snapshot: string
  category_code_snapshot: string
  duration_minutes_snapshot: number
  unit_price_minor: number
  status_code: string
}

export interface ClinicalSignature {
  id: string
  signature_type: string
  signer_name: string
  signature_data: string
  signed_at: string
}

export interface ClinicalConsent {
  consent_type: string
  accepted: boolean
  accepted_at: string
  consent_text_snapshot: string
}

export interface ClinicalAnnotation {
  id: string
  category: string
  body_area: string | null
  annotation_type: string
  x_position: number | null
  y_position: number | null
  points_json: unknown
  notes: string | null
}

export interface ClinicalMedia {
  media_type: string
  storage_key: string
  mime_type: string | null
  url: string | null
}

export interface Appointment extends Timestamped {
  id: string
  salon_id: string
  client_id: string
  professional_id: string
  status_code: string
  source: string
  starts_at: string
  ends_at: string
  customer_notes: string | null
  internal_notes: string | null
  client_name?: string
  professional_name?: string
  services?: AppointmentService[]
  treatment_details_by_category?: Record<string, Record<string, unknown>>
  clinical_signatures?: ClinicalSignature[]
  clinical_consents?: ClinicalConsent[]
  clinical_annotations?: ClinicalAnnotation[]
  clinical_media?: ClinicalMedia[]
  health_questionnaire_answers?: Record<string, unknown>
}

export interface SalesHistoryItem {
  id: string
  appointment_id: string
  appointment_service_id: string
  salon_id: string
  client_id: string
  client_name: string
  professional_id: string
  professional_name: string
  provider_avatar_url: string | null
  starts_at: string
  ends_at: string
  status_code: string
  service_id: string | null
  service_name: string
  category_id: string | null
  category_code: string
  category_name: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  tip_minor: number
  total_minor: number
  salon_earnings_minor: number
  professional_earnings_minor: number
  currency_code: string
  recorded_at: string
  notes: string | null
  recommendations: string | null
  treatment_details: Record<string, unknown> | null
  completed_at: string | null
}

export interface SalesHistoryResponse {
  filters: {
    providerId: string | null
    startDate: string | null
    endDate: string | null
    categoryId: string | null
  }
  summary: {
    salonIncome: number
    providerIncome: number
    tips: number
    recordCount: number
    totalAvailableCount: number
    currencyCode: string
    selectedProviderHasServices: boolean | null
    selectedProviderName: string | null
    selectedProviderAvatarUrl: string | null
  }
  records: SalesHistoryItem[]
}

export interface Notification extends Timestamped {
  id: string
  salon_id: string
  user_id: string | null
  client_id: string | null
  appointment_id: string | null
  channel: string
  event_type: string
  title: string | null
  body: string
  status: string
  scheduled_for: string | null
  sent_at: string | null
  read_at: string | null
}

export interface SalonSettings extends Timestamped {
  id: string
  salon_id: string
  appointment_interval_minutes: number
  minimum_booking_notice_minutes: number
  maximum_booking_days_ahead: number
  cancellation_notice_minutes: number
  allow_public_booking: boolean
  require_booking_confirmation: boolean
  settings_json: Record<string, unknown>
}

export interface DashboardAppointment {
  id: string
  starts_at: string
  ends_at: string
  status_code: string
  client_name: string
  professional_name: string
  services: Array<{
    service_name_snapshot: string
    category_code_snapshot: string
    duration_minutes_snapshot: number
    unit_price_minor: number
    status_code: string
  }>
}

export interface DashboardSummary {
  salon: Pick<Salon, 'id' | 'name' | 'slug' | 'currency_code' | 'timezone' | 'onboarding_status'>
  selectedDate: string
  revenue: {
    amountMinor: number
    currencyCode: string
    periodLabel: string
  }
  appointmentCount: number
  slotsRemaining: number
  activeStaffCount: number
  staffLimit: number
  upcomingAppointments: DashboardAppointment[]
  nextHourAppointmentCount: number
  bookingLink: string
  emptyStateFlags: {
    noAppointmentsToday: boolean
    noActiveStaff: boolean
    zeroRevenue: boolean
    staffLimitReached: boolean
  }
}

export interface NailSettingsResponse {
  salon: {
    id: string
    name: string
    currencyCode: string
    timezone: string
  }
  category: {
    id: string
    code: string
    name: string
    description: string | null
    isEnabled: boolean
  }
  services: Service[]
  materials: ServiceMaterial[]
  salonSchedule: Record<string, OnboardingDayInput>
  providers: ProfessionalWithNailSettings[]
  staffLimit: number
  activeStaffCount: number
}

export interface NailSettingsServiceInput {
  id?: string
  name: string
  description?: string | null
  priceMinor: number
  durationMinutes: number
  isActive: boolean
  sortOrder: number
}

export interface NailMaterialInput {
  id?: string
  serviceId?: string | null
  name: string
  brand?: string | null
  materialType?: string | null
  unit?: string | null
  costMinor?: number | null
  isActive: boolean
  sortOrder: number
}

export interface UpdateNailSettingsInput {
  categoryEnabled: boolean
  forceDisable?: boolean
  services: NailSettingsServiceInput[]
  materials: NailMaterialInput[]
}

export interface ProviderServiceAssignmentInput {
  serviceId: string
  isActive: boolean
  durationOverrideMinutes?: number | null
  priceOverrideMinor?: number | null
}

export interface UpsertProfessionalInput {
  fullName: string
  email?: string
  phone?: string
  avatarUrl?: string | null
  languages: string[]
  status: 'active' | 'inactive'
  salonEarningsPercent: number
  professionalEarningsPercent: number
  useSalonSchedule: boolean
  schedule?: Record<string, OnboardingDayInput>
  serviceAssignments: ProviderServiceAssignmentInput[]
}

export interface ReassignProfessionalInput {
  replacementProviderId: string
  appointmentIds: string[]
}

export interface CreateAppointmentInput {
  clientId: string
  professionalId: string
  serviceIds: string[]
  startsAt: string
  endsAt: string
  source?: 'internal' | 'public_booking' | 'rebook'
  customerNotes?: string
  internalNotes?: string
  treatmentDetails?: Record<string, unknown>
  treatmentNotes?: string
  treatmentRecommendations?: string
}

export interface AppointmentCategory {
  id: string
  code: string
  name: string
  description?: string | null
  sort_order?: number
  enabled: boolean
  service_count: number
}

export interface EligibleProvider extends Professional {
  durationMinutes: number
  category_code?: string
  category_name?: string
}

export interface AvailabilitySlot {
  time: string
  startsAt: string
  endsAt: string
  label: string
  available: boolean
}

export interface AppointmentAvailability {
  providerId: string
  serviceId: string
  date: string
  durationMinutes: number
  timezone: string
  workingWindow?: {
    open: string
    close: string
  }
  slots: AvailabilitySlot[]
}

export interface HealthProfileVersion {
  id: string
  category: string
  status: string
  valid_from: string
  valid_until: string
  completed_at?: string | null
  questionnaire_type?: string | null
  questionnaire_id?: string | null
  is_valid?: boolean
  answers?: Record<string, unknown>
}

export interface CreateClientInput {
  fullName: string
  email?: string
  phone?: string
  notes?: string
}

export interface CreateServiceInput {
  categoryId: string
  name: string
  description?: string
  durationMinutes: number
  priceMinor: number
  currencyCode?: string
  isPubliclyBookable?: boolean
}

export interface UpdateSettingsInput {
  appointmentIntervalMinutes?: number
  minimumBookingNoticeMinutes?: number
  maximumBookingDaysAhead?: number
  cancellationNoticeMinutes?: number
  allowPublicBooking?: boolean
  requireBookingConfirmation?: boolean
  settingsJson?: Record<string, unknown>
}

export interface OnboardingDayInput {
  enabled: boolean
  open: string
  close: string
}

export interface OnboardingServiceInput {
  id: string
  categoryId: string
  name: string
  selected: boolean
  price: string
  duration: string
  section?: 'service' | 'material'
}

export interface OnboardingProviderInput {
  id: string
  name: string
  email: string
  phone: string
  photoPreview?: string
  languages: string[]
  salonPercent: string
  professionalPercent: string
  serviceIds: string[]
  schedule: Record<string, OnboardingDayInput>
  useSalonSchedule?: boolean
}

export interface SaveOnboardingInput {
  step: 'categories' | 'services' | 'schedule' | 'team' | 'complete'
  completed?: boolean
  draft: {
    selectedCategoryIds: string[]
    services: OnboardingServiceInput[]
    schedule: Record<string, OnboardingDayInput>
    providers: OnboardingProviderInput[]
    activeProviderId?: string
  }
}

export interface RegisterSalonInput {
  salonName: string
  email: string
  password: string
  acceptedTerms: true
  ownerFullName?: string
  location: {
    formattedAddress: string
    placeId?: string
  }
  document: {
    originalFilename: string
    mimeType: string
    size: number
  }
}

export interface RegisterGoogleSalonInput extends Omit<RegisterSalonInput, 'email' | 'password'> {
  credential: string
}

export interface RegisterFacebookSalonInput extends Omit<RegisterSalonInput, 'email' | 'password'> {
  accessToken: string
}

export interface RegisterAppleSalonInput extends Omit<RegisterSalonInput, 'email' | 'password'> {
  identityToken: string
  ownerFullName?: string
}

export interface RegisterSalonResult {
  user: {
    id: string
    email: string
    full_name: string
  }
  salon: Salon
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  user: {
    id: string
    email: string
    full_name: string
    auth_provider: string
  }
  salons: Array<{
    id: string
    name: string
    slug: string
    role: string
  }>
}

export interface RequestPasswordResetInput {
  email: string
}

export interface RequestPasswordResetResult {
  email: string
  expiresAt: string
  devCode?: string
}

export interface VerifyPasswordResetCodeInput {
  email: string
  code: string
}

export interface VerifyPasswordResetCodeResult {
  valid: true
}

export interface ConfirmPasswordResetInput extends VerifyPasswordResetCodeInput {
  password: string
}

export interface ConfirmPasswordResetResult {
  reset: true
}
