import { nailsBookingAssets } from './assets'
import type { CategoryCardViewModel, NailsBookingAppointmentSummary, NailsBookingCategoryCode, NailsServicesScreenProps } from './types'
import type { Service, ServiceCategory } from '../../../types/api'

const categoryOrder: NailsBookingCategoryCode[] = ['nails', 'lashes', 'cosmetology', 'micropigmentation']
const categoryIcon: Record<NailsBookingCategoryCode, string> = nailsBookingAssets.categories

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function appointmentDateKey(value: string) {
  return value.slice(0, 10)
}

function compactMoney(amountMinor: number, currencyCode: string) {
  const amount = amountMinor / 100
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
  return formatted.replace(/\s/g, '')
}

function durationRangeLabel(services: Service[]) {
  if (!services.length) return '0 min'
  const durations = services.map((service) => service.duration_minutes).filter((value) => Number.isFinite(value) && value > 0)
  if (!durations.length) return '0 min'
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  return min === max ? `${min} min` : `${min} - ${max} min`
}

function priceRangeLabel(services: Service[]) {
  if (!services.length) return '$0'
  const prices = services.map((service) => service.price_minor).filter((value) => Number.isFinite(value) && value >= 0)
  if (!prices.length) return '$0'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const currency = services[0]?.currency_code ?? 'USD'
  return min === max ? compactMoney(min, currency) : `${compactMoney(min, currency)}-${compactMoney(max, currency)}`
}

function serviceSnapshotName(service: NonNullable<NailsBookingAppointmentSummary['services']>[number]) {
  return service.service_name_snapshot ?? service.service_name ?? ''
}

function isActiveAppointment(appointment: NailsBookingAppointmentSummary) {
  const inactiveStatuses = new Set(['completed', 'canceled', 'cancelled', 'no_show'])
  return !inactiveStatuses.has((appointment.status_code ?? '').toLowerCase())
}

function mostPopularService(category: ServiceCategory, services: Service[], appointments: NailsBookingAppointmentSummary[]) {
  const counts = new Map<string, number>()
  for (const appointment of appointments) {
    for (const service of appointment.services ?? []) {
      if (service.category_code_snapshot !== category.code) continue
      const name = serviceSnapshotName(service)
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  const popular = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  return popular ?? services[0]?.name ?? 'No services available'
}

function todayAppointmentCount(category: ServiceCategory, appointments: NailsBookingAppointmentSummary[]) {
  const today = localDateKey()
  return appointments.filter((appointment) => (
    appointmentDateKey(appointment.starts_at) === today
    && isActiveAppointment(appointment)
    && appointment.services?.some((service) => service.category_code_snapshot === category.code)
  )).length
}

function activeTodayCount(appointments: NailsBookingAppointmentSummary[]) {
  const today = localDateKey()
  return appointments.filter((appointment) => appointmentDateKey(appointment.starts_at) === today && isActiveAppointment(appointment)).length
}

function screenDateLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function buildViewModels(categories: ServiceCategory[], services: Service[], appointments: NailsBookingAppointmentSummary[]): CategoryCardViewModel[] {
  return categoryOrder.flatMap((code) => {
    const category = categories.find((item) => item.code === code && item.is_active)
    if (!category) return []
    const categoryServices = services
      .filter((service) => (
        service.is_active
        && (service.category_id === category.id || service.category_code === category.code)
      ))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    return {
      category,
      code,
      icon: categoryIcon[code],
      serviceCount: categoryServices.length,
      durationLabel: durationRangeLabel(categoryServices),
      priceLabel: priceRangeLabel(categoryServices),
      mostPopularService: mostPopularService(category, categoryServices, appointments),
      todayAppointmentCount: todayAppointmentCount(category, appointments),
    }
  })
}

export function NailsServicesScreen({ categories, services, appointments, onSelect, onCalendar }: NailsServicesScreenProps) {
  const cards = buildViewModels(categories, services, appointments)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[393px] bg-[#f2f5ff] px-4 pb-8 pt-16 text-[#2d1954]">
      <header className="space-y-2">
        <h1 className="text-[28px] font-extrabold leading-[40px] tracking-[-0.56px] text-[#2d1954]">Services</h1>
        <p className="text-[15px] leading-[22.5px] tracking-[-0.3px] text-[#666]">Select a category to schedule an appointment</p>
      </header>

      <section className="mt-[27px] rounded-[16px] bg-gradient-to-b from-[#7a48db] to-[#6138b8] px-4 py-4 shadow-[0_8px_10px_rgba(115,68,205,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] leading-[19.5px] tracking-[-0.26px] text-white/80">Today&apos;s Schedule</p>
            <p className="mt-1 text-[32px] font-extrabold leading-[48px] tracking-[-0.64px] text-white">{activeTodayCount(appointments)}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] leading-[19.5px] tracking-[-0.26px] text-white/80">{screenDateLabel()}</p>
            <p className="mt-1 text-[15px] font-medium leading-[22.5px] tracking-[-0.3px] text-white">Active Appointments</p>
          </div>
        </div>
      </section>

      <div className="mt-4 space-y-4">
        {cards.map((card) => (
          <ServiceCategoryCard card={card} key={card.code} onSelect={() => onSelect(card.category)} />
        ))}
      </div>

      <button className="mx-auto mt-8 flex h-10 items-center justify-center gap-2 text-[16px] font-medium text-[#7a48db]" onClick={onCalendar} type="button">
        <img alt="" className="size-[19px] object-contain" src={nailsBookingAssets.icons.calendar} />
        View Calendar
      </button>
    </main>
  )
}

function ServiceCategoryCard({ card, onSelect }: { card: CategoryCardViewModel; onSelect: () => void }) {
  return (
    <button className="block w-full text-left" onClick={onSelect} type="button">
      <article className="min-h-[239px] rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-[17px] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <img alt="" className="size-[51px] shrink-0 object-contain" src={card.icon} />
            <div className="min-w-0">
              <h2 className="text-[21px] font-normal leading-[30px] tracking-[-0.42px] text-[#2d1954]">{card.category.name}</h2>
              <p className="text-[13px] leading-[19.5px] tracking-[-0.26px] text-[#666]">{card.serviceCount} services available</p>
            </div>
          </div>
          <img alt="" className="size-6 shrink-0 object-contain" src={nailsBookingAssets.icons.chevronRight} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex h-[34px] items-center gap-2 rounded-[8px] bg-[#fdfdff] px-3 text-[12px] text-[#2d1954]">
            <img alt="" className="size-[15px] object-contain" src={nailsBookingAssets.icons.clock} />
            <span className="truncate">{card.durationLabel}</span>
          </div>
          <div className="flex h-[34px] items-center gap-2 rounded-[8px] bg-[#fdfdff] px-3 text-[12px] text-[#2d1954]">
            <img alt="" className="size-[15px] object-contain" src={nailsBookingAssets.icons.dollar} />
            <span className="truncate">{card.priceLabel}</span>
          </div>
        </div>

        <div className="mt-3 rounded-[8px] bg-[#fdfdff] px-4 py-3">
          <p className="flex items-center gap-2 text-[12px] text-[#77727c]">
            <img alt="" className="size-[14px] object-contain" src={nailsBookingAssets.icons.trending} />
            Most Popular
          </p>
          <p className="mt-1 pl-[22px] text-[14px] font-medium text-[#2d1954]">{card.mostPopularService}</p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#edf0f7] pt-3">
          <span className="text-[13px] text-[#77727c]">Today&apos;s appointments</span>
          <span className="grid size-8 place-items-center rounded-[9px] bg-[#7a48db] text-[14px] font-bold text-white">{card.todayAppointmentCount}</span>
        </div>
      </article>
    </button>
  )
}
