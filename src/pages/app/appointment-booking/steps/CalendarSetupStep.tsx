import { Calendar, ChevronLeft, ChevronRight, Clock, UserRound } from 'lucide-react'
import { Button, Card, LoadingState } from '../../../../components'
import { cn } from '../../../../lib/cn'
import type { AvailabilitySlot, EligibleProvider } from '../../../../types/api'
import { CategoryStepHeader } from '../components/shared'

function formatDisplayDate(date: string) {
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

export function CalendarSetupStep({ providers, selectedProviderId, date, selectedStartsAt, slots, providerLoading, availabilityLoading, serviceName, onSelectProvider, onDateChange, onSelectSlot, onBack, onExit, onNext }: {
  providers: EligibleProvider[]
  selectedProviderId: string
  date: string
  selectedStartsAt: string
  slots: AvailabilitySlot[]
  providerLoading: boolean
  availabilityLoading: boolean
  serviceName?: string
  onSelectProvider: (id: string) => void
  onDateChange: (date: string) => void
  onSelectSlot: (slot: AvailabilitySlot) => void
  onBack: () => void
  onExit: () => void
  onNext: () => void
}) {
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId)
  const blocked = !providerLoading && providers.length === 0

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-6 px-5 pb-8">
      <CategoryStepHeader onBack={onBack} title="Calendar setup" />

      <p className="text-[15px] text-[#667085]">Select provider, date, and available time.</p>

      <section className="space-y-3">
        <h2 className="text-[21px] font-bold text-[#0c111d]">Provider</h2>
        {serviceName && (
          <p className="text-sm text-[#667085]">
            Service: <span className="font-semibold text-[#0c111d]">{serviceName}</span>
          </p>
        )}
        {providerLoading && <LoadingState label="Checking eligible providers..." />}
        {blocked && (
          <Card className="space-y-4 rounded-[16px] border-[#d0d5dd] bg-white p-4">
            <p className="text-center text-sm text-[#667085]">
              No eligible provider for this service. Assign the service to a provider in Staff settings, or choose a different service.
            </p>
            <div className="grid gap-2">
              <Button fullWidth onClick={onBack} variant="outline">Change service</Button>
              <Button fullWidth onClick={onExit} variant="ghost">Return to home</Button>
            </div>
          </Card>
        )}
        {providers.map((provider) => (
          <button className="w-full text-left" key={provider.id} onClick={() => onSelectProvider(provider.id)} type="button">
            <Card className={cn('rounded-[16px] border-[#d0d5dd] bg-white p-4', selectedProviderId === provider.id && 'border-[#7344cd] bg-[#ebe7ff]')}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[#ebe7ff]">
                  <UserRound className="size-5 text-[#7344cd]" />
                </span>
                <div>
                  <p className="font-bold text-[#0c111d]">{provider.full_name}</p>
                  <p className="text-xs text-[#667085]">{provider.durationMinutes} min · {provider.languages.join(', ') || 'Provider'}</p>
                </div>
              </div>
            </Card>
          </button>
        ))}
      </section>

      {selectedProvider && (
        <>
          <section className="space-y-3">
            <h2 className="text-[21px] font-bold text-[#0c111d]">Date</h2>
            <Card className="rounded-[16px] border-[#d0d5dd] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <button className="grid size-9 place-items-center rounded-full border border-[#d0d5dd]" onClick={() => onDateChange(shiftDate(date, -1))} type="button">
                  <ChevronLeft className="size-5" />
                </button>
                <div className="flex-1 text-center">
                  <p className="inline-flex items-center justify-center gap-2 text-[16px] font-bold text-[#0c111d]">
                    <Calendar className="size-4 text-[#7344cd]" />
                    {formatDisplayDate(date)}
                  </p>
                </div>
                <button className="grid size-9 place-items-center rounded-full border border-[#d0d5dd]" onClick={() => onDateChange(shiftDate(date, 1))} type="button">
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="text-[21px] font-bold text-[#0c111d]">Available times</h2>
            {availabilityLoading && <LoadingState label="Checking availability..." />}
            {!availabilityLoading && !slots.length && (
              <Card className="rounded-[16px] border-[#d0d5dd] bg-white p-4 text-center text-sm text-[#667085]">
                No available slots for this date.
              </Card>
            )}
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  className={cn(
                    'rounded-[12px] border px-2 py-3 text-center text-sm font-semibold',
                    !slot.available && 'cursor-not-allowed opacity-40',
                    selectedStartsAt === slot.startsAt ? 'border-[#7344cd] bg-[#7344cd] text-white' : 'border-[#d0d5dd] bg-white text-[#0c111d]',
                  )}
                  disabled={!slot.available}
                  key={slot.startsAt}
                  onClick={() => onSelectSlot(slot)}
                  type="button"
                >
                  <Clock className="mx-auto mb-1 size-4 opacity-70" />
                  {slot.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {!blocked && (
        <Button
          className="rounded-[16px]"
          disabled={!selectedProviderId || !selectedStartsAt}
          fullWidth
          onClick={onNext}
        >
          Review appointment
        </Button>
      )}
    </div>
  )
}
