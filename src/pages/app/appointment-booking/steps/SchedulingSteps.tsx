import { Check, UserRound } from 'lucide-react'
import { Button, Card, Input, LoadingState } from '../../../../components'
import { MutationError } from '../../../../components/screen/MutationError'
import { cn } from '../../../../lib/cn'
import type { AvailabilitySlot, Client, EligibleProvider, Service, ServiceCategory } from '../../../../types/api'
import { buildReviewSections } from '../reviewSummary'
import { ReviewRow, StepShell } from '../components/shared'

export function ProviderStep({ providers, selectedProviderId, loading, onSelect, onNext }: {
  providers: EligibleProvider[]
  selectedProviderId: string
  loading: boolean
  onSelect: (id: string) => void
  onNext: () => void
}) {
  return (
    <StepShell subtitle="Only providers assigned to this service are shown." title="Provider">
      {loading && <LoadingState label="Checking eligible providers..." />}
      {!loading && !providers.length && (
        <Card className="rounded-[18px] border-[#dde3f1] bg-white text-center">
          <p className="font-bold">No eligible provider</p>
          <p className="mt-2 text-xs text-[#68738b]">Assign an active provider to this service in Settings.</p>
        </Card>
      )}
      <div className="space-y-3">
        {providers.map((provider) => (
          <button className="w-full text-left" key={provider.id} onClick={() => onSelect(provider.id)} type="button">
            <Card className={cn('rounded-[18px] border-[#dde3f1] bg-white', selectedProviderId === provider.id && 'border-[#7a3fe0] bg-[#eee9ff]')}>
              <div className="flex items-center gap-3">
                <UserRound className="size-5 text-[#7a3fe0]" />
                <div>
                  <p className="font-bold">{provider.full_name}</p>
                  <p className="text-xs text-[#68738b]">{provider.durationMinutes} min · {provider.languages.join(', ') || 'Provider'}</p>
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>
      <Button disabled={!selectedProviderId} fullWidth onClick={onNext}>Continue</Button>
    </StepShell>
  )
}

export function TimeStep({ service, date, selectedStartsAt, slots, loading, onDateChange, onSelect, onNext }: {
  service: Service
  date: string
  selectedStartsAt: string
  slots: AvailabilitySlot[]
  loading: boolean
  onDateChange: (date: string) => void
  onSelect: (slot: AvailabilitySlot) => void
  onNext: () => void
}) {
  return (
    <StepShell subtitle={`Real slots for ${service.duration_minutes} minutes.`} title="Date & time">
      <Input label="Date" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      {loading && <LoadingState label="Checking availability..." />}
      {!loading && !slots.length && (
        <Card className="rounded-[18px] border-[#dde3f1] bg-white text-center">
          <p className="font-bold">No available slots</p>
          <p className="mt-2 text-xs text-[#68738b]">Choose another date or provider.</p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <button
            className={cn(
              'rounded-[14px] border bg-white p-3 text-left text-sm',
              !slot.available && 'cursor-not-allowed opacity-40',
              selectedStartsAt === slot.startsAt && 'border-[#7a3fe0] bg-[#eee9ff]',
            )}
            disabled={!slot.available}
            key={slot.startsAt}
            onClick={() => onSelect(slot)}
            type="button"
          >
            <span className="block font-bold">{slot.label}</span>
            <span className="text-[#68738b]">{slot.available ? 'Available' : 'Busy'}</span>
          </button>
        ))}
      </div>
      <Button disabled={!selectedStartsAt} fullWidth onClick={onNext}>Review appointment</Button>
    </StepShell>
  )
}

export function ReviewStep({ category, service, client, provider, startsAt, details, notes, loading, error, onConfirm }: {
  category: ServiceCategory
  service: Service
  client: Client
  provider: EligibleProvider
  startsAt: string
  details: Record<string, unknown>
  notes: string
  loading: boolean
  error: Error | null
  onConfirm: () => void
}) {
  const sections = buildReviewSections(category, service, client, provider, startsAt, details, notes)

  return (
    <StepShell subtitle="Confirm the details before saving." title="Review appointment">
      {sections.map((section) => (
        <Card className="space-y-3 rounded-[22px] border-[#dde3f1] bg-white" key={section.title}>
          <p className="text-lg font-bold text-[#111827]">{section.title}</p>
          {section.rows.map((row) => (
            <ReviewRow key={`${section.title}-${row.label}`} label={row.label} value={row.value} />
          ))}
        </Card>
      ))}
      <MutationError error={error} />
      <Button fullWidth loading={loading} onClick={onConfirm}>Confirm appointment</Button>
    </StepShell>
  )
}

export function SuccessStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="grid min-h-[75dvh] place-items-center px-5">
      <Card className="w-full max-w-[393px] rounded-[28px] border-0 bg-white py-10 text-center shadow-xl">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#7a3fe0] text-white shadow-lg"><Check className="size-10" /></span>
        <h1 className="mt-6 text-[28px] font-extrabold text-[#111827]">Successfully scheduled</h1>
        <p className="mx-auto mt-3 max-w-[250px] text-sm leading-6 text-[#68738b]">The appointment was added to your salon schedule.</p>
        <Button className="mt-8" fullWidth onClick={onDone}>Go to calendar</Button>
      </Card>
    </div>
  )
}
