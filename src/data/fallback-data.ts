import type { Appointment, Client, Notification, Professional, Salon, SalonSettings, SalesHistoryItem, Service, ServiceCategory } from '../types/api'

const created = '2026-03-01T12:00:00.000Z'
export const FALLBACK_SALON_ID = '10000000-0000-0000-0000-000000000001'

export const fallbackSalon: Salon = {
  id: FALLBACK_SALON_ID, name: 'Glow Salon', slug: 'glow-salon', email: 'sarah@glowsalon.com', phone: '+1 305 555 0100',
  timezone: 'America/New_York', currency_code: 'USD', locale: 'en-US', city: 'Miami', region: 'FL',
  verification_status: 'verified', onboarding_status: 'completed', booking_enabled: true, is_active: true, created_at: created, updated_at: created,
}

export const fallbackCategories: ServiceCategory[] = [
  ['50000000-0000-0000-0000-000000000001', 'nails', 'Nails'],
  ['50000000-0000-0000-0000-000000000002', 'lashes', 'Lashes'],
  ['50000000-0000-0000-0000-000000000003', 'cosmetology', 'Cosmetology'],
  ['50000000-0000-0000-0000-000000000004', 'micropigmentation', 'Micropigmentation'],
].map(([id, code, name], index) => ({ id, code, name, description: null, icon_key: code, sort_order: index * 10, is_active: true, created_at: created, updated_at: created }))

export const fallbackServices: Service[] = [
  ['60000000-0000-0000-0000-000000000001', fallbackCategories[0].id, 'Full Set - Acrylic', 90, 8500, 'Nails'],
  ['60000000-0000-0000-0000-000000000004', fallbackCategories[1].id, 'Cat Eye - Classic', 90, 12000, 'Lashes'],
  ['60000000-0000-0000-0000-000000000006', fallbackCategories[2].id, 'Cosmetology - Dermapen', 60, 9500, 'Cosmetology'],
].map(([id, category_id, name, duration_minutes, price_minor, category_name]) => ({
  id: String(id), salon_id: FALLBACK_SALON_ID, category_id: String(category_id), form_template_id: null, name: String(name), description: null,
  duration_minutes: Number(duration_minutes), price_minor: Number(price_minor), currency_code: 'USD', is_active: true, is_publicly_bookable: true,
  sort_order: 0, category_name: String(category_name), created_at: created, updated_at: created,
}))

export const fallbackProfessionals: Professional[] = [
  ['30000000-0000-0000-0000-000000000001', 'Sarah Johnson', true],
  ['30000000-0000-0000-0000-000000000002', 'Maria Garcia', false],
  ['30000000-0000-0000-0000-000000000003', 'Daniel Kim', false],
].map(([id, full_name, is_owner]) => ({
  id: String(id), salon_id: FALLBACK_SALON_ID, user_id: null, full_name: String(full_name), email: null, phone: null, avatar_url: null,
  languages: ['en'], status: 'active', is_owner: Boolean(is_owner), salon_earnings_percent: '60.00', professional_earnings_percent: '40.00', created_at: created, updated_at: created,
}))

export const fallbackClients: Client[] = [
  ['40000000-0000-0000-0000-000000000001', 'Sarah Jenkins', 'sarah.jenkins@example.com', 'Prefers shorter nail length.'],
  ['40000000-0000-0000-0000-000000000002', 'Maria Rodriguez', 'maria.rodriguez@example.com', 'Sensitive eyes. Use hypoallergenic glue.'],
  ['40000000-0000-0000-0000-000000000003', 'Emily Wilson', 'emily.wilson@example.com', 'Returning facial client.'],
].map(([id, full_name, email, notes]) => ({
  id, salon_id: FALLBACK_SALON_ID, user_id: null, full_name, email, phone: null, date_of_birth: null, preferred_language: 'en', notes, created_at: created, updated_at: created,
}))

export const fallbackAppointments: Appointment[] = [
  ['70000000-0000-0000-0000-000000000005', 0, 0, 'coming_up', '2026-03-18T09:00:00-04:00'],
  ['70000000-0000-0000-0000-000000000006', 1, 1, 'scheduled', '2026-03-18T11:30:00-04:00'],
  ['70000000-0000-0000-0000-000000000007', 2, 2, 'scheduled', '2026-03-18T13:00:00-04:00'],
].map(([id, clientIndex, professionalIndex, status_code, starts_at], index) => ({
  id: String(id), salon_id: FALLBACK_SALON_ID, client_id: fallbackClients[Number(clientIndex)].id, professional_id: fallbackProfessionals[Number(professionalIndex)].id,
  status_code: String(status_code), source: 'internal', starts_at: String(starts_at), ends_at: new Date(new Date(String(starts_at)).getTime() + 60 * 60 * 1000).toISOString(),
  customer_notes: null, internal_notes: null, client_name: fallbackClients[Number(clientIndex)].full_name, professional_name: fallbackProfessionals[Number(professionalIndex)].full_name,
  services: [{ id: `fallback-service-${index}`, service_name_snapshot: fallbackServices[index].name, category_code_snapshot: fallbackCategories[index].code, duration_minutes_snapshot: fallbackServices[index].duration_minutes, unit_price_minor: fallbackServices[index].price_minor, status_code: String(status_code) }],
  created_at: created, updated_at: created,
}))

export const fallbackSales: SalesHistoryItem[] = fallbackAppointments.map((appointment, index) => ({
  id: appointment.services?.[0]?.id ?? `fallback-sale-${index}`,
  appointment_id: appointment.id,
  appointment_service_id: appointment.services?.[0]?.id ?? `fallback-sale-${index}`,
  salon_id: FALLBACK_SALON_ID, client_id: appointment.client_id, client_name: appointment.client_name ?? 'Client',
  professional_id: appointment.professional_id, professional_name: appointment.professional_name ?? 'Professional', starts_at: appointment.starts_at, ends_at: appointment.ends_at,
  provider_avatar_url: null,
  status_code: 'completed', subtotal_minor: fallbackServices[index].price_minor, discount_minor: 0, tax_minor: 0, tip_minor: 1000,
  total_minor: fallbackServices[index].price_minor + 1000, salon_earnings_minor: Math.round(fallbackServices[index].price_minor * 0.6),
  professional_earnings_minor: Math.round(fallbackServices[index].price_minor * 0.4), currency_code: 'USD', recorded_at: created,
  service_id: fallbackServices[index].id,
  service_name: fallbackServices[index].name,
  category_id: fallbackServices[index].category_id,
  category_code: fallbackCategories[index].code,
  category_name: fallbackCategories[index].name,
  notes: null,
  recommendations: null,
  treatment_details: null,
  completed_at: created,
}))

export const fallbackSettings: SalonSettings = {
  id: 'a6000000-0000-0000-0000-000000000001', salon_id: FALLBACK_SALON_ID, appointment_interval_minutes: 15, minimum_booking_notice_minutes: 120,
  maximum_booking_days_ahead: 90, cancellation_notice_minutes: 1440, allow_public_booking: true, require_booking_confirmation: false,
  settings_json: {}, created_at: created, updated_at: created,
}

export const fallbackNotifications: Notification[] = []
