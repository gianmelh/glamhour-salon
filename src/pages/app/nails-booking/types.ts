import type { Service, ServiceCategory } from '../../../types/api'

export type NailsBookingCategoryCode = 'nails' | 'lashes' | 'cosmetology' | 'micropigmentation'

export type NailsBookingAppointmentSummary = {
  starts_at: string
  status_code?: string
  services?: Array<{
    category_code_snapshot: string
    service_name_snapshot?: string
    service_name?: string
  }>
}

export type NailsServicesScreenProps = {
  categories: ServiceCategory[]
  services: Service[]
  appointments: NailsBookingAppointmentSummary[]
  onSelect: (category: ServiceCategory) => void
  onCalendar: () => void
}

export type CategoryCardViewModel = {
  category: ServiceCategory
  code: NailsBookingCategoryCode
  icon: string
  serviceCount: number
  durationLabel: string
  priceLabel: string
  mostPopularService: string
  todayAppointmentCount: number
}
