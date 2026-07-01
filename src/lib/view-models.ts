import type { Appointment, Professional, Service } from '../types/api'
import { appointmentService, appointmentStatus, formatMoney, formatTime } from './format'

export function appointmentCardProps(appointment: Appointment) {
  return {
    time: formatTime(appointment.starts_at),
    client: appointment.client_name ?? 'Client',
    service: appointmentService(appointment),
    professional: appointment.professional_name ?? 'Professional',
    status: appointmentStatus(appointment.status_code),
  }
}

export function serviceCardProps(service: Service) {
  return {
    name: service.name,
    category: service.category_name ?? service.category_code ?? 'Service',
    duration: `${service.duration_minutes} min`,
    price: formatMoney(service.price_minor, service.currency_code),
  }
}

export function staffCardProps(professional: Professional) {
  return {
    name: professional.full_name,
    role: professional.is_owner ? 'Owner · Professional' : 'Salon professional',
    status: professional.status === 'active' ? 'Available' as const : 'Off' as const,
    image: professional.avatar_url ?? undefined,
  }
}
