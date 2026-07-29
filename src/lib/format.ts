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

export type AppointmentStatusLabel = 'Upcoming' | 'Coming up' | 'In progress' | 'Completed' | 'Canceled'

export function appointmentStatus(status: string): AppointmentStatusLabel {
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In progress'
  if (status === 'coming_up') return 'Coming up'
  if (status === 'canceled' || status === 'no_show') return 'Canceled'
  return 'Upcoming'
}

export function timedAppointmentStatus(appointment: Pick<Appointment, 'status_code' | 'starts_at' | 'ends_at'>): AppointmentStatusLabel {
  if (appointment.status_code === 'completed' || appointment.status_code === 'canceled' || appointment.status_code === 'no_show') {
    return appointmentStatus(appointment.status_code)
  }

  const now = Date.now()
  const startsAt = new Date(appointment.starts_at).getTime()
  const endsAt = new Date(appointment.ends_at).getTime()
  if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && now >= startsAt && now <= endsAt) {
    return 'In progress'
  }

  if (Number.isFinite(startsAt) && now < startsAt) return 'Coming up'
  return appointmentStatus(appointment.status_code)
}

export function appointmentService(appointment: Appointment) {
  const service = appointment.services?.[0]
  const categoryCode = service?.category_code_snapshot ?? ''
  const details = categoryCode ? appointment.treatment_details_by_category?.[categoryCode] : undefined
  const nailsType = details?.nailServiceType
  const materialLabels = details?.materialLabels
  const materials = details?.materials
  const material = Array.isArray(materialLabels) && materialLabels.length
    ? materialLabels[0]
    : Array.isArray(materials) && materials.length
      ? materials[0]
      : ''

  if (typeof nailsType === 'string' && nailsType) {
    return typeof material === 'string' && material ? `${nailsType} - ${material}` : nailsType
  }

  return service?.service_name_snapshot ?? 'Salon service'
}
