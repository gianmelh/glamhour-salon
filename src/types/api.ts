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
  category_code?: string
  category_name?: string
}

export interface AppointmentService {
  id: string
  service_name_snapshot: string
  category_code_snapshot: string
  duration_minutes_snapshot: number
  unit_price_minor: number
  status_code: string
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
}

export interface SalesHistoryItem {
  appointment_id: string
  salon_id: string
  client_id: string
  client_name: string
  professional_id: string
  professional_name: string
  starts_at: string
  ends_at: string
  status_code: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  tip_minor: number
  total_minor: number
  salon_earnings_minor: number
  professional_earnings_minor: number
  currency_code: string
  recorded_at: string
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

export interface CreateAppointmentInput {
  clientId: string
  professionalId: string
  serviceIds: string[]
  startsAt: string
  endsAt: string
  source?: 'internal' | 'public_booking' | 'rebook'
  customerNotes?: string
  internalNotes?: string
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
