import { apiRequest } from '../lib/api'
import type {
  Appointment, Client, CreateAppointmentInput, CreateClientInput, CreateServiceInput, Notification, Professional,
  ConfirmPasswordResetInput, ConfirmPasswordResetResult, LoginInput, LoginResult, RegisterAppleSalonInput,
  RegisterFacebookSalonInput, RegisterGoogleSalonInput, RegisterSalonInput, RegisterSalonResult,
  RequestPasswordResetInput, RequestPasswordResetResult, Salon, SalonSettings,
  SalesHistoryItem, SaveOnboardingInput, Service, ServiceCategory, UpdateSettingsInput, VerifyPasswordResetCodeInput,
  VerifyPasswordResetCodeResult,
} from '../types/api'

export const SALON_ID = import.meta.env.VITE_SALON_ID ?? '10000000-0000-0000-0000-000000000001'

export const glamhourApi = {
  login: (input: LoginInput) => apiRequest<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  requestPasswordReset: (input: RequestPasswordResetInput) => apiRequest<RequestPasswordResetResult>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify(input) }),
  verifyPasswordResetCode: (input: VerifyPasswordResetCodeInput) => apiRequest<VerifyPasswordResetCodeResult>('/auth/password-reset/verify', { method: 'POST', body: JSON.stringify(input) }),
  confirmPasswordReset: (input: ConfirmPasswordResetInput) => apiRequest<ConfirmPasswordResetResult>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(input) }),
  registerSalon: (input: RegisterSalonInput) => apiRequest<RegisterSalonResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  registerGoogleSalon: (input: RegisterGoogleSalonInput) => apiRequest<RegisterSalonResult>('/auth/google/register', { method: 'POST', body: JSON.stringify(input) }),
  registerFacebookSalon: (input: RegisterFacebookSalonInput) => apiRequest<RegisterSalonResult>('/auth/facebook/register', { method: 'POST', body: JSON.stringify(input) }),
  registerAppleSalon: (input: RegisterAppleSalonInput) => apiRequest<RegisterSalonResult>('/auth/apple/register', { method: 'POST', body: JSON.stringify(input) }),
  salon: (salonId = SALON_ID) => apiRequest<Salon>(`/salons/${salonId}`),
  appointments: (salonId = SALON_ID) => apiRequest<Appointment[]>(`/salons/${salonId}/appointments?limit=100`),
  appointment: (id: string, salonId = SALON_ID) => apiRequest<Appointment>(`/salons/${salonId}/appointments/${id}`),
  clients: (salonId = SALON_ID) => apiRequest<Client[]>(`/salons/${salonId}/clients?limit=100`),
  services: (salonId = SALON_ID) => apiRequest<Service[]>(`/salons/${salonId}/services?limit=100`),
  categories: (salonId = SALON_ID) => apiRequest<ServiceCategory[]>(`/service-categories?salonId=${salonId}`),
  professionals: (salonId = SALON_ID) => apiRequest<Professional[]>(`/salons/${salonId}/professionals?limit=100`),
  salesHistory: (salonId = SALON_ID) => apiRequest<SalesHistoryItem[]>(`/salons/${salonId}/sales-history?limit=100`),
  settings: (salonId = SALON_ID) => apiRequest<SalonSettings>(`/salons/${salonId}/settings`),
  notifications: (salonId = SALON_ID) => apiRequest<Notification[]>(`/salons/${salonId}/notifications?limit=100`),
  saveOnboarding: (input: SaveOnboardingInput, salonId = SALON_ID) => apiRequest<Salon>(`/salons/${salonId}/onboarding`, { method: 'PUT', body: JSON.stringify(input) }),
  createAppointment: (input: CreateAppointmentInput, salonId = SALON_ID) => apiRequest<Appointment>(`/salons/${salonId}/appointments`, { method: 'POST', body: JSON.stringify({ source: 'internal', ...input }) }),
  updateAppointmentStatus: (id: string, status: string, salonId = SALON_ID) => apiRequest<Appointment>(`/salons/${salonId}/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, actorRole: status === 'completed' ? 'professional' : 'owner' }) }),
  createClient: (input: CreateClientInput, salonId = SALON_ID) => apiRequest<Client>(`/salons/${salonId}/clients`, { method: 'POST', body: JSON.stringify(input) }),
  createService: (input: CreateServiceInput, salonId = SALON_ID) => apiRequest<Service>(`/salons/${salonId}/services`, { method: 'POST', body: JSON.stringify({ currencyCode: 'USD', isPubliclyBookable: true, ...input }) }),
  updateSettings: (input: UpdateSettingsInput, salonId = SALON_ID) => apiRequest<SalonSettings>(`/salons/${salonId}/settings`, { method: 'PATCH', body: JSON.stringify(input) }),
}
