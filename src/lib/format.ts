import type { Appointment } from '../types/api'

export function formatMoney(amountMinor: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function appointmentStatus(status: string): 'Upcoming' | 'In progress' | 'Completed' | 'Canceled' {
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress' || status === 'coming_up') return 'In progress'
  if (status === 'canceled' || status === 'no_show') return 'Canceled'
  return 'Upcoming'
}

export function appointmentService(appointment: Appointment) {
  return appointment.services?.[0]?.service_name_snapshot ?? 'Salon service'
}
