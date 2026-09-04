import { useEffect } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BottomNavigation, Button, Card, LoadingState } from '../../../../components'
import { cn } from '../../../../lib/cn'
import { clampToToday, localDateString } from '../../../../lib/date'
import type { AvailabilitySlot, EligibleProvider } from '../../../../types/api'

const scheduleHours = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

function parseDisplayDate(date: string) {
  if (!date) return new Date()
  return new Date(`${date}T12:00:00`)
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return clampToToday(isoDate(next))
}

function weekAround(date: string) {
  const selected = parseDisplayDate(date)
  const start = new Date(selected)
  start.setDate(selected.getDate() - selected.getDay())
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function monthYear(date: string) {
  const value = parseDisplayDate(date)
  return {
    month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(value),
    year: new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(value),
  }
}

function weekdayLetter(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(date)
}

function slotHourLabel(slot: AvailabilitySlot) {
  return slot.label.split(' ')[0] + ' ' + (slot.label.includes('PM') ? 'PM' : 'AM')
}

function displayProviderName(name: string) {
  return name.split(' ')[0] || name
}

export function CalendarSetupStep({ providers, selectedProviderId, date, selectedStartsAt, slots, providerLoading, availabilityLoading, serviceName, serviceCategoryName, onSelectProvider, onDateChange, onSelectSlot, onBack, onExit, onNext }: {
  providers: EligibleProvider[]
  selectedProviderId: string
  date: string
  selectedStartsAt: string
  slots: AvailabilitySlot[]
  providerLoading: boolean
  availabilityLoading: boolean
  serviceName?: string
  serviceCategoryName?: string
  onSelectProvider: (id: string) => void
  onDateChange: (date: string) => void
  onSelectSlot: (slot: AvailabilitySlot) => void
  onBack: () => void
  onExit: () => void
  onNext: () => void
}) {
  const navigate = useNavigate()
  const blocked = !providerLoading && providers.length === 0
  const today = localDateString()
  const selectedDate = clampToToday(date)
  const week = weekAround(selectedDate)
  const dateTitle = monthYear(selectedDate)
  const visibleProviders = providers.slice(0, 3)
  const canGoToPreviousWeek = shiftDate(selectedDate, -7) !== today

  useEffect(() => {
    if (!providers.length) return
    if (providers.some((provider) => provider.id === selectedProviderId)) return
    onSelectProvider(providers[0].id)
  }, [onSelectProvider, providers, selectedProviderId])

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-[393px] flex-col overflow-hidden pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-[30px] font-extrabold leading-tight text-[#0c111d]">My Services</h1>
        <p className="mt-4 whitespace-nowrap text-[16px] leading-6 text-[#667085]">Track your ongoing and upcoming appointments</p>
      </header>

      <section className="mt-11">
        <div className="mb-6 flex items-center justify-center text-[#101828]">
          <p className="inline-flex items-center gap-2 text-[22px] font-bold leading-none">
            <span>{dateTitle.month}</span>
            <ChevronDown className="size-5" />
            <span>{dateTitle.year}</span>
            <ChevronDown className="size-5" />
          </p>
        </div>

        <div className="relative">
          <button className="absolute left-1 top-[27px] z-10 grid size-9 place-items-center rounded-full border border-[#d0d5dd] bg-white text-[#101828] disabled:text-[#98a2b3]" disabled={!canGoToPreviousWeek} onClick={() => onDateChange(shiftDate(selectedDate, -7))} type="button" aria-label="Previous week">
            <ChevronLeft className="size-5" />
          </button>
          <button className="absolute right-1 top-[27px] z-10 grid size-9 place-items-center rounded-full border border-[#d0d5dd] bg-white text-[#98a2b3]" onClick={() => onDateChange(shiftDate(selectedDate, 7))} type="button" aria-label="Next week">
            <ChevronRight className="size-5" />
          </button>
          <div className="grid grid-cols-7 px-12">
            {week.map((day) => {
              const dayKey = isoDate(day)
              const active = dayKey === selectedDate
              const isPast = dayKey < today
              return (
                <button
                  className="grid place-items-center gap-3 py-1 text-center disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={isPast}
                  key={day.toISOString()}
                  onClick={() => onDateChange(dayKey)}
                  type="button"
                >
                  <span className={cn('text-[13px] leading-none', active ? 'text-[#7a3fe0]' : 'text-[#667085]')}>{weekdayLetter(day)}</span>
                  <span className={cn(
                    'grid size-9 place-items-center rounded-full text-[15px] font-semibold leading-none',
                    active ? 'bg-[#7a3fe0] text-white' : 'text-[#101828]',
                  )}>
                    {day.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {providerLoading && <div className="mt-6"><LoadingState label="Checking eligible providers..." /></div>}

      <section className="mt-11 min-w-0 overflow-x-auto pb-3">
        <div className="grid min-w-[764px] grid-cols-[104px_repeat(3,220px)]">
          <div />
          {(visibleProviders.length ? visibleProviders : [{ id: 'none', full_name: 'Provider' } as EligibleProvider]).map((provider) => (
            <button
              className={cn(
                'min-w-0 px-3 pb-4 text-left text-[18px] font-medium leading-tight text-[#101828]',
                provider.id === selectedProviderId && 'text-[#0c111d]',
              )}
              disabled={provider.id === 'none'}
              key={provider.id}
              onClick={() => onSelectProvider(provider.id)}
              type="button"
            >
              <span className="block truncate">{displayProviderName(provider.full_name)}</span>
            </button>
          ))}

          {scheduleHours.map((hour) => (
            <div className="contents" key={hour}>
              <div className="border-r border-[#eef1f7] pr-8 pt-2 text-right text-[13px] text-[#667085]" key={`${hour}-label`}>
                {hour}
              </div>
              {(visibleProviders.length ? visibleProviders : [{ id: 'none', full_name: 'Provider' } as EligibleProvider]).map((provider) => {
                const providerSlots = provider.id === selectedProviderId
                  ? slots.filter((slot) => slot.available && slotHourLabel(slot) === hour)
                  : []
                const slot = providerSlots[0]

                return (
                  <div className="relative min-h-[118px] border-r border-t border-[#eef1f7] px-3 py-2" key={`${hour}-${provider.id}`}>
                    {blocked && hour === '9:00 AM' && provider.id === 'none' && (
                      <Card className="absolute left-2 right-2 top-2 z-10 space-y-3 rounded-[12px] border-[#d0d5dd] bg-white p-3 text-center shadow-sm">
                        <p className="text-xs leading-4 text-[#667085]">
                          No eligible provider for this service. Assign the service in Staff settings.
                        </p>
                        <div className="grid gap-2">
                          <Button className="min-h-9 rounded-[10px] text-xs" fullWidth onClick={onBack} variant="outline">Change service</Button>
                          <Button className="min-h-9 rounded-[10px] text-xs" fullWidth onClick={onExit} variant="ghost">Return home</Button>
                        </div>
                      </Card>
                    )}
                    {availabilityLoading && provider.id === selectedProviderId && hour === '9:00 AM' && (
                      <div className="rounded-[12px] border border-[#e4e7ec] bg-white p-3 text-xs text-[#667085]">Checking availability...</div>
                    )}
                    {slot && (
                      <button
                        className={cn(
                          'w-full rounded-[12px] border px-3 py-3 text-left transition',
                          selectedStartsAt === slot.startsAt
                            ? 'border-[#7a3fe0] bg-[#f4f0ff]'
                            : 'border-[#d8c7ff] bg-white',
                        )}
                        onClick={() => onSelectSlot(slot)}
                        type="button"
                      >
                        <span className="mb-3 inline-flex rounded-[6px] bg-[#efe6ff] px-2 py-1 text-[11px] text-[#7047c7]">{serviceCategoryName || 'Service'}</span>
                        <span className="block text-[14px] font-bold text-[#101828]">{serviceName || 'Salon service'}</span>
                        <span className="mt-2 block text-[11px] text-[#667085]">with {provider.full_name}</span>
                        <span className="mt-2 block text-[11px] font-semibold text-[#7a3fe0]">{slot.label}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {!blocked && (
        <Button
          className="mt-3 min-h-[56px] rounded-[16px] text-[17px]"
          disabled={!selectedProviderId || !selectedStartsAt}
          fullWidth
          onClick={onNext}
        >
          Review appointment
        </Button>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[393px]">
        <BottomNavigation
          activeItem="calendar"
          onChange={(item) => navigate(`/app/${item}`)}
        />
      </div>
    </div>
  )
}
