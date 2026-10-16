import { apiRequest } from '../lib/api'
import type {
  Appointment, AppointmentAvailability, AppointmentCategory, Client, CreateAppointmentInput, CreateClientInput, CreateServiceInput, DashboardSummary, EligibleProvider, HealthProfileVersion, Notification, Professional,
  NailSettingsResponse, OnboardingSession, ReassignProfessionalInput, UpdateNailSettingsInput, UpsertProfessionalInput,
  ConfirmPasswordResetInput, ConfirmPasswordResetResult, LoginInput, LoginResult, RegisterAppleSalonInput,
  RegisterFacebookSalonInput, RegisterGoogleSalonInput, RegisterSalonInput, RegisterSalonResult,
  RequestPasswordResetInput, RequestPasswordResetResult, RescheduleAppointmentInput, Salon, SalonSettings,
  SalesHistoryItem, SalesHistoryResponse, SaveOnboardingInput, Service, ServiceCategory, SubscriptionPlanCode, SubscriptionSummary, UpdateSettingsInput, VerifyPasswordResetCodeInput,
  VerifyPasswordResetCodeResult, UpdateServiceInput,
  PublicBookingPayload, PublicBookingEmailStatus, PublicBookingEmailCodeResponse,
} from '../types/api'

export const SALON_ID = import.meta.env.VITE_SALON_ID ?? '10000000-0000-0000-0000-000000000001'
export const PUBLIC_BOOKING_BASE_URL = (import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL ?? 'https://glamhourapp.com').replace(/\/+$/, '')

const activeSalonSessionKey = 'glamhour:active-salon-id'

export function resolveSalonId(explicitSalonId?: string) {
  if (explicitSalonId) {
    return explicitSalonId
  }

  if (typeof window !== 'undefined') {
    const storedSalonId = window.sessionStorage.getItem(activeSalonSessionKey)
    if (storedSalonId) {
      return storedSalonId
    }
  }

  return SALON_ID
}

export interface SalesHistoryFilters {
  professionalId?: string
  startDate?: string
  endDate?: string
  categoryId?: string
  limit?: number
  offset?: number
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

export const glamhourApi = {
  login: (input: LoginInput) => apiRequest<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  requestPasswordReset: (input: RequestPasswordResetInput) => apiRequest<RequestPasswordResetResult>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify(input) }),
  verifyPasswordResetCode: (input: VerifyPasswordResetCodeInput) => apiRequest<VerifyPasswordResetCodeResult>('/auth/password-reset/verify', { method: 'POST', body: JSON.stringify(input) }),
  confirmPasswordReset: (input: ConfirmPasswordResetInput) => apiRequest<ConfirmPasswordResetResult>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(input) }),
  registerSalon: (input: RegisterSalonInput) => apiRequest<RegisterSalonResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  registerGoogleSalon: (input: RegisterGoogleSalonInput) => apiRequest<RegisterSalonResult>('/auth/google/register', { method: 'POST', body: JSON.stringify(input) }),
  registerFacebookSalon: (input: RegisterFacebookSalonInput) => apiRequest<RegisterSalonResult>('/auth/facebook/register', { method: 'POST', body: JSON.stringify(input) }),
  registerAppleSalon: (input: RegisterAppleSalonInput) => apiRequest<RegisterSalonResult>('/auth/apple/register', { method: 'POST', body: JSON.stringify(input) }),
  publicBooking: (slug: string) => apiRequest<PublicBookingPayload>(`/public-booking/${encodeURIComponent(slug)}`, { cache: 'no-store' }),
  publicFindOrCreateClient: (slug: string, input: CreateClientInput & { email: string; mergeNotes?: string }) => apiRequest<Pick<Client, 'id'>>(`/public-booking/${encodeURIComponent(slug)}/clients/find-or-create`, { method: 'POST', body: JSON.stringify(input) }),
  publicBookingEmailStatus: (slug: string, email: string) => apiRequest<PublicBookingEmailStatus>(`/public-booking/${encodeURIComponent(slug)}/email-verification/status`, { method: 'POST', body: JSON.stringify({ email }) }),
  requestPublicBookingEmailCode: (slug: string, email: string) => apiRequest<PublicBookingEmailCodeResponse>(`/public-booking/${encodeURIComponent(slug)}/email-verification/request`, { method: 'POST', body: JSON.stringify({ email }) }),
  verifyPublicBookingEmailCode: (slug: string, email: string, code: string) => apiRequest<{ verified: true }>(`/public-booking/${encodeURIComponent(slug)}/email-verification/verify`, { method: 'POST', body: JSON.stringify({ email, code }) }),
  salon: (salonId?: string) => apiRequest<Salon>(`/salons/${resolveSalonId(salonId)}`),
  dashboard: (salonId?: string, date?: string) => apiRequest<DashboardSummary>(`/salons/${resolveSalonId(salonId)}/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  appointments: (salonId?: string) => apiRequest<Appointment[]>(`/salons/${resolveSalonId(salonId)}/appointments?limit=100`),
  appointment: (id: string, salonId?: string) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments/${id}`),
  clients: (salonId?: string) => apiRequest<Client[]>(`/salons/${resolveSalonId(salonId)}/clients?limit=100`),
  services: async (salonId?: string, options?: { publicOnly?: boolean; includeInactive?: boolean }): Promise<Service[]> => {
    const resolvedSalonId = resolveSalonId(salonId)
    const pageSize = 100
    const services: Service[] = []
    const seenIds = new Set<string>()
    for (let offset = 0; ; offset += pageSize) {
      const page = await apiRequest<Service[]>(`/salons/${resolvedSalonId}/services${queryString({ limit: pageSize, offset, publicOnly: options?.publicOnly ? 'true' : undefined, includeInactive: options?.includeInactive ? 'true' : undefined })}`)
      for (const service of page) {
        if (seenIds.has(service.id)) throw new Error('The service catalog changed while loading. Please try again.')
        seenIds.add(service.id)
        services.push(service)
      }
      if (page.length < pageSize) return services
    }
  },
  categories: (salonId?: string, options?: { includeAll?: boolean }) => apiRequest<ServiceCategory[]>(`/service-categories${queryString({ salonId: resolveSalonId(salonId), includeAll: options?.includeAll ? 'true' : undefined })}`),
  updateServiceCategories: (input: { categoryIds: string[] }, salonId?: string) => apiRequest<ServiceCategory[]>(`/salons/${resolveSalonId(salonId)}/service-categories`, { method: 'PUT', body: JSON.stringify(input) }),
  appointmentCategories: (salonId?: string) => apiRequest<AppointmentCategory[]>(`/salons/${resolveSalonId(salonId)}/appointment-categories`),
  healthProfile: (clientId: string, category: string, salonId?: string) => apiRequest<HealthProfileVersion | null>(`/salons/${resolveSalonId(salonId)}/clients/${clientId}/health-profiles/${category}`),
  professionals: (salonId?: string) => apiRequest<Professional[]>(`/salons/${resolveSalonId(salonId)}/professionals?limit=100`),
  eligibleProviders: (params: { serviceId: string; categoryId?: string; date?: string; durationMinutes?: number; optionalStartTime?: string }, salonId?: string) => apiRequest<EligibleProvider[]>(`/salons/${resolveSalonId(salonId)}/providers/eligible${queryString(params)}`, { cache: 'no-store' }),
  appointmentAvailability: (params: { providerId: string; serviceId: string; date: string; timezone?: string }, salonId?: string) => apiRequest<AppointmentAvailability>(`/salons/${resolveSalonId(salonId)}/availability${queryString(params)}`, { cache: 'no-store' }),
  nailSettings: (salonId?: string) => apiRequest<NailSettingsResponse>(`/salons/${resolveSalonId(salonId)}/settings/nails`),
  serviceMaterials: (params: { categoryId?: string; categoryCode?: string; serviceId?: string }, salonId?: string) =>
    apiRequest<import('../types/api').ServiceMaterial[]>(`/salons/${resolveSalonId(salonId)}/service-materials${queryString(params)}`),
  updateNailSettings: (input: UpdateNailSettingsInput, salonId?: string) => apiRequest<NailSettingsResponse>(`/salons/${resolveSalonId(salonId)}/settings/nails`, { method: 'PUT', body: JSON.stringify(input) }),
  createProfessional: (input: UpsertProfessionalInput, salonId?: string) => apiRequest<Professional>(`/salons/${resolveSalonId(salonId)}/professionals`, { method: 'POST', body: JSON.stringify(input) }),
  updateProfessional: (id: string, input: UpsertProfessionalInput, salonId?: string) => apiRequest<Professional>(`/salons/${resolveSalonId(salonId)}/professionals/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteProfessional: (id: string, salonId?: string) => apiRequest<{ deleted: boolean; futureAppointmentCount: number }>(`/salons/${resolveSalonId(salonId)}/professionals/${id}`, { method: 'DELETE' }),
  reassignProfessional: (id: string, input: ReassignProfessionalInput, salonId?: string) => apiRequest<{ reassigned: number; deactivated: boolean }>(`/salons/${resolveSalonId(salonId)}/professionals/${id}/reassign-and-deactivate`, { method: 'POST', body: JSON.stringify(input) }),
  salesHistory: (salonId?: string, filters: SalesHistoryFilters = {}) => apiRequest<SalesHistoryResponse>(`/salons/${resolveSalonId(salonId)}/sales-history${queryString({ limit: 100, ...filters })}`),
  salesHistoryDetail: (recordId: string, salonId?: string) => apiRequest<SalesHistoryItem>(`/salons/${resolveSalonId(salonId)}/sales-history/${recordId}`),
  settings: (salonId?: string) => apiRequest<SalonSettings>(`/salons/${resolveSalonId(salonId)}/settings`),
  subscription: (salonId?: string) => apiRequest<SubscriptionSummary>(`/salons/${resolveSalonId(salonId)}/subscription`),
  createSubscriptionCheckout: (planCode: Exclude<SubscriptionPlanCode, 'free'>, salonId?: string) =>
    apiRequest<{ clientSecret?: string; sessionId?: string; changed?: boolean }>(`/salons/${resolveSalonId(salonId)}/subscription/checkout`, { method: 'POST', body: JSON.stringify({ planCode }) }),
  syncSubscriptionCheckout: (sessionId: string, salonId?: string) =>
    apiRequest<SubscriptionSummary>(`/salons/${resolveSalonId(salonId)}/subscription/sync-checkout`, { method: 'POST', body: JSON.stringify({ sessionId }) }),
  changeSubscriptionPlan: (planCode: Exclude<SubscriptionPlanCode, 'free'>, salonId?: string) =>
    apiRequest<{ changed: boolean }>(`/salons/${resolveSalonId(salonId)}/subscription/change-plan`, { method: 'POST', body: JSON.stringify({ planCode }) }),
  createBillingPortal: (salonId?: string) => apiRequest<{ url: string }>(`/salons/${resolveSalonId(salonId)}/subscription/portal`, { method: 'POST' }),
  cancelSubscription: (salonId?: string) => apiRequest<SubscriptionSummary>(`/salons/${resolveSalonId(salonId)}/subscription/cancel`, { method: 'POST' }),
  reactivateSubscription: (salonId?: string) => apiRequest<SubscriptionSummary>(`/salons/${resolveSalonId(salonId)}/subscription/reactivate`, { method: 'POST' }),
  notifications: (salonId?: string) => apiRequest<Notification[]>(`/salons/${resolveSalonId(salonId)}/notifications?limit=100`),
  onboarding: (salonId?: string) => apiRequest<OnboardingSession | null>(`/salons/${resolveSalonId(salonId)}/onboarding`, { cache: 'no-store' }),
  saveOnboarding: (input: SaveOnboardingInput, salonId?: string) => apiRequest<Salon>(`/salons/${resolveSalonId(salonId)}/onboarding`, { method: 'PUT', body: JSON.stringify(input) }),
  createAppointment: (input: CreateAppointmentInput, salonId?: string) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments`, { method: 'POST', body: JSON.stringify({ source: 'internal', ...input }) }),
  rescheduleAppointment: (id: string, input: RescheduleAppointmentInput, salonId?: string) =>
    apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments/${id}/schedule`, { method: 'PATCH', body: JSON.stringify(input) }),
  uploadTreatmentMedia: (input: {
    dataBase64: string
    mimeType: string
    originalFilename?: string
    mediaType?: 'reference' | 'before' | 'after' | 'diagram' | 'signature' | 'other'
    category?: string
  }, salonId?: string) => apiRequest<{
    storageKey: string
    url: string
    mimeType: string
    size: number
    mediaType: string
  }>(`/salons/${resolveSalonId(salonId)}/treatment-media/upload`, { method: 'POST', body: JSON.stringify(input) }),
  updateAppointmentStatus: (
    id: string,
    status: string,
    options?: { tipMinor?: number; discountMinor?: number; taxMinor?: number; note?: string; salonId?: string },
  ) => apiRequest<Appointment>(`/salons/${resolveSalonId(options?.salonId)}/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      actorRole: status === 'completed' || status === 'in_progress' ? 'professional' : 'owner',
      tipMinor: options?.tipMinor,
      discountMinor: options?.discountMinor,
      taxMinor: options?.taxMinor,
      note: options?.note,
    }),
  }),
  updateAppointmentTreatmentDetails: (
    id: string,
    input: {
      categoryCode: string
      treatmentDetails: Record<string, unknown>
      treatmentNotes?: string
      treatmentRecommendations?: string
    },
    salonId?: string,
  ) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments/${id}/treatment-details`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  createClient: (input: CreateClientInput, salonId?: string) => apiRequest<Client>(`/salons/${resolveSalonId(salonId)}/clients`, { method: 'POST', body: JSON.stringify(input) }),
  updateClient: (id: string, input: CreateClientInput, salonId?: string) => apiRequest<Client>(`/salons/${resolveSalonId(salonId)}/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  findOrCreateClient: (input: CreateClientInput & { mergeNotes?: string }, salonId?: string) =>
    apiRequest<Client>(`/salons/${resolveSalonId(salonId)}/clients/find-or-create`, { method: 'POST', body: JSON.stringify(input) }),
  createService: (input: CreateServiceInput, salonId?: string) => apiRequest<Service>(`/salons/${resolveSalonId(salonId)}/services`, { method: 'POST', body: JSON.stringify({ currencyCode: 'USD', isPubliclyBookable: true, ...input }) }),
  createServiceInSettings: (input: CreateServiceInput, salonId?: string) => apiRequest<Service>(`/salons/${resolveSalonId(salonId)}/settings/services`, { method: 'POST', body: JSON.stringify(input) }),
  updateService: (id: string, input: UpdateServiceInput, salonId?: string) => apiRequest<Service>(`/salons/${resolveSalonId(salonId)}/services/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteService: (id: string, salonId?: string) => apiRequest<{ deleted: boolean }>(`/salons/${resolveSalonId(salonId)}/services/${id}`, { method: 'DELETE' }),
  ensureService: (input: import('../types/api').EnsureServiceInput, salonId?: string) =>
    apiRequest<Service>(`/salons/${resolveSalonId(salonId)}/services/ensure`, {
      method: 'POST',
      body: JSON.stringify({ currencyCode: 'USD', isPubliclyBookable: true, assignToActiveProviders: true, ...input }),
    }),
  updateSettings: (input: UpdateSettingsInput, salonId?: string) => apiRequest<SalonSettings>(`/salons/${resolveSalonId(salonId)}/settings`, { method: 'PATCH', body: JSON.stringify(input) }),
}
