import { apiRequest } from '../lib/api'
import type {
  Appointment, AppointmentAvailability, AppointmentCategory, Client, CreateAppointmentInput, CreateClientInput, CreateServiceInput, DashboardSummary, EligibleProvider, HealthProfileVersion, Notification, Professional,
  NailSettingsResponse, ReassignProfessionalInput, UpdateNailSettingsInput, UpsertProfessionalInput,
  ConfirmPasswordResetInput, ConfirmPasswordResetResult, LoginInput, LoginResult, RegisterAppleSalonInput,
  RegisterFacebookSalonInput, RegisterGoogleSalonInput, RegisterSalonInput, RegisterSalonResult,
  RequestPasswordResetInput, RequestPasswordResetResult, Salon, SalonSettings,
  SalesHistoryItem, SalesHistoryResponse, SaveOnboardingInput, Service, ServiceCategory, UpdateSettingsInput, VerifyPasswordResetCodeInput,
  VerifyPasswordResetCodeResult,
} from '../types/api'

export const SALON_ID = import.meta.env.VITE_SALON_ID ?? '10000000-0000-0000-0000-000000000001'

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
  salon: (salonId?: string) => apiRequest<Salon>(`/salons/${resolveSalonId(salonId)}`),
  dashboard: (salonId?: string, date?: string) => apiRequest<DashboardSummary>(`/salons/${resolveSalonId(salonId)}/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  appointments: (salonId?: string) => apiRequest<Appointment[]>(`/salons/${resolveSalonId(salonId)}/appointments?limit=100`),
  appointment: (id: string, salonId?: string) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments/${id}`),
  clients: (salonId?: string) => apiRequest<Client[]>(`/salons/${resolveSalonId(salonId)}/clients?limit=100`),
  services: (salonId?: string) => apiRequest<Service[]>(`/salons/${resolveSalonId(salonId)}/services?limit=100`),
  categories: (salonId?: string) => apiRequest<ServiceCategory[]>(`/service-categories?salonId=${resolveSalonId(salonId)}`),
  appointmentCategories: (salonId?: string) => apiRequest<AppointmentCategory[]>(`/salons/${resolveSalonId(salonId)}/appointment-categories`),
  healthProfile: (clientId: string, category: string, salonId?: string) => apiRequest<HealthProfileVersion | null>(`/salons/${resolveSalonId(salonId)}/clients/${clientId}/health-profiles/${category}`),
  professionals: (salonId?: string) => apiRequest<Professional[]>(`/salons/${resolveSalonId(salonId)}/professionals?limit=100`),
  eligibleProviders: (params: { serviceId: string; categoryId?: string; date?: string; durationMinutes?: number; optionalStartTime?: string }, salonId?: string) => apiRequest<EligibleProvider[]>(`/salons/${resolveSalonId(salonId)}/providers/eligible${queryString(params)}`),
  appointmentAvailability: (params: { providerId: string; serviceId: string; date: string; timezone?: string }, salonId?: string) => apiRequest<AppointmentAvailability>(`/salons/${resolveSalonId(salonId)}/availability${queryString(params)}`),
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
  notifications: (salonId?: string) => apiRequest<Notification[]>(`/salons/${resolveSalonId(salonId)}/notifications?limit=100`),
  saveOnboarding: (input: SaveOnboardingInput, salonId?: string) => apiRequest<Salon>(`/salons/${resolveSalonId(salonId)}/onboarding`, { method: 'PUT', body: JSON.stringify(input) }),
  createAppointment: (input: CreateAppointmentInput, salonId?: string) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments`, { method: 'POST', body: JSON.stringify({ source: 'internal', ...input }) }),
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
  updateAppointmentStatus: (id: string, status: string, salonId?: string) => apiRequest<Appointment>(`/salons/${resolveSalonId(salonId)}/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, actorRole: status === 'completed' ? 'professional' : 'owner' }) }),
  createClient: (input: CreateClientInput, salonId?: string) => apiRequest<Client>(`/salons/${resolveSalonId(salonId)}/clients`, { method: 'POST', body: JSON.stringify(input) }),
  createService: (input: CreateServiceInput, salonId?: string) => apiRequest<Service>(`/salons/${resolveSalonId(salonId)}/services`, { method: 'POST', body: JSON.stringify({ currencyCode: 'USD', isPubliclyBookable: true, ...input }) }),
  updateSettings: (input: UpdateSettingsInput, salonId?: string) => apiRequest<SalonSettings>(`/salons/${resolveSalonId(salonId)}/settings`, { method: 'PATCH', body: JSON.stringify(input) }),
}
