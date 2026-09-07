import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, MapPin, UserRound } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState } from '../../components'
import { deferTask } from '../../lib/defer'
import { formatMoney } from '../../lib/format'
import { addMinutesIso, formatZonedDate, formatZonedTime, normalizeTimeZone, zonedDateString } from '../../lib/salon-time'
import { glamhourApi } from '../../services/glamhour-api'
import type { AvailabilitySlot, EligibleProvider, PublicBookingPayload, Service } from '../../types/api'

type Step = 'service' | 'provider' | 'time' | 'details' | 'success'

function nextBookableDates(timeZone: string) {
  const today = zonedDateString(new Date(), timeZone)
  const [year, month, day] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0))
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

export function PublicBookingPage() {
  const { salonSlug = '' } = useParams()
  const [payload, setPayload] = useState<PublicBookingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const [step, setStep] = useState<Step>('service')
  const [service, setService] = useState<Service | null>(null)
  const [provider, setProvider] = useState<EligibleProvider | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [providers, setProviders] = useState<EligibleProvider[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', notes: '' })

  const timeZone = normalizeTimeZone(payload?.salon.timezone)
  const dates = useMemo(() => nextBookableDates(timeZone), [timeZone])

  useEffect(() => {
    let active = true
    deferTask(() => setLoading(true))
    glamhourApi.publicBooking(salonSlug)
      .then((data) => {
        if (!active) return
        setPayload(data)
        setDate(nextBookableDates(normalizeTimeZone(data.salon.timezone))[0] ?? '')
        setError(null)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason : new Error('Booking link could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [salonSlug])

  useEffect(() => {
    if (!payload || !service || !date) {
      deferTask(() => setProviders([]))
      return
    }
    let active = true
    deferTask(() => setBusy(true))
    glamhourApi.eligibleProviders({ serviceId: service.id, categoryId: service.category_id, date }, payload.salon.id)
      .then((items) => {
        if (active) setProviders(items)
      })
      .catch(() => {
        if (active) setProviders([])
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => { active = false }
  }, [date, payload, service])

  useEffect(() => {
    if (!payload || !service || !provider || !date) {
      deferTask(() => setAvailability([]))
      return
    }
    let active = true
    deferTask(() => setBusy(true))
    glamhourApi.appointmentAvailability({ providerId: provider.id, serviceId: service.id, date, timezone: timeZone }, payload.salon.id)
      .then((result) => {
        if (active) setAvailability(result.slots)
      })
      .catch(() => {
        if (active) setAvailability([])
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => { active = false }
  }, [date, payload, provider, service, timeZone])

  if (loading) return <PublicShell><LoadingState label="Loading booking link..." /></PublicShell>
  if (error || !payload) {
    return <PublicShell><ErrorState description={error?.message ?? 'This booking link is not available.'} /></PublicShell>
  }

  const submit = async () => {
    if (!service || !provider || !slot || !form.fullName.trim() || !form.phone.trim()) return
    setBusy(true)
    setSubmitError(null)
    try {
      const client = await glamhourApi.createClient({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        notes: 'Created from public booking link.',
      }, payload.salon.id)
      await glamhourApi.createAppointment({
        clientId: client.id,
        professionalId: provider.id,
        serviceIds: [service.id],
        startsAt: slot.startsAt,
        endsAt: slot.endsAt || addMinutesIso(slot.startsAt, provider.durationMinutes ?? service.duration_minutes),
        source: 'public_booking',
        customerNotes: form.notes.trim() || undefined,
      }, payload.salon.id)
      setStep('success')
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason : new Error('Appointment could not be requested.'))
    } finally {
      setBusy(false)
    }
  }

  const bookAnotherService = () => {
    setService(null)
    setProvider(null)
    setSlot(null)
    setProviders([])
    setAvailability([])
    setForm({ fullName: '', phone: '', email: '', notes: '' })
    setSubmitError(null)
    setStep('service')
  }

  const groupedServices = payload.services.reduce<Record<string, Service[]>>((result, item) => {
    const key = item.category_name ?? 'Services'
    result[key] = [...(result[key] ?? []), item]
    return result
  }, {})

  return (
    <PublicShell>
      <div className="space-y-5 px-5 py-6">
        <header className="space-y-3">
          <div className="grid size-12 place-items-center rounded-lg bg-[#eee9ff] text-[#7c3aed]">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#101827]">{payload.salon.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#748096]">
              <MapPin className="size-3.5" />
              {[payload.salon.city, payload.salon.region].filter(Boolean).join(', ') || 'Online booking'}
            </p>
          </div>
        </header>

        <StepIndicator step={step} />
        {submitError && <p className="rounded-md bg-[#fff0f0] px-3 py-2 text-xs font-semibold text-[#e05252]">{submitError.message}</p>}

        {step === 'service' && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Choose a service</h2>
            {Object.entries(groupedServices).map(([category, items]) => (
              <div className="space-y-2" key={category}>
                <p className="text-[11px] font-bold uppercase text-[#748096]">{category}</p>
                {items.map((item) => (
                  <button className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e1e4ec] bg-white p-4 text-left shadow-card" key={item.id} onClick={() => { setService(item); setProvider(null); setSlot(null); setStep('provider') }} type="button">
                    <span>
                      <span className="block text-sm font-bold">{item.name}</span>
                      <span className="mt-1 block text-xs text-[#748096]">{item.duration_minutes} min</span>
                    </span>
                    <span className="text-sm font-bold text-[#7c3aed]">{formatMoney(item.price_minor, item.currency_code)}</span>
                  </button>
                ))}
              </div>
            ))}
          </section>
        )}

        {step === 'provider' && service && (
          <section className="space-y-4">
            <PublicBack onClick={() => setStep('service')} />
            <h2 className="text-lg font-bold">Choose a professional</h2>
            {busy && <LoadingState label="Finding availability..." />}
            {!busy && providers.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-[#748096]">No available professionals were found for this service.</p>}
            {providers.map((item) => (
              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e1e4ec] bg-white p-4 text-left shadow-card" key={item.id} onClick={() => { setProvider(item); setSlot(null); setStep('time') }} type="button">
                <span className="grid size-10 place-items-center rounded-full bg-[#eee9ff] text-[#7c3aed]"><UserRound className="size-5" /></span>
                <span>
                  <span className="block text-sm font-bold">{item.full_name}</span>
                  <span className="text-xs text-[#748096]">{item.durationMinutes} min appointment</span>
                </span>
              </button>
            ))}
          </section>
        )}

        {step === 'time' && provider && (
          <section className="space-y-4">
            <PublicBack onClick={() => setStep('provider')} />
            <h2 className="text-lg font-bold">Choose a time</h2>
            <div className="grid grid-cols-2 gap-2">
              {dates.slice(0, 6).map((item) => (
                <button className={`rounded-md border px-3 py-2 text-xs font-bold ${date === item ? 'border-[#7c3aed] bg-[#eee9ff] text-[#4c1d95]' : 'border-[#e1e4ec] bg-white'}`} key={item} onClick={() => { setDate(item); setSlot(null) }} type="button">
                  {shortDateLabel(item, timeZone)}
                </button>
              ))}
            </div>
            {busy && <LoadingState label="Loading time slots..." />}
            {!busy && <div className="grid grid-cols-3 gap-2">
              {availability.filter((item) => item.available).slice(0, 18).map((item) => (
                <button className={`min-h-11 rounded-md border text-xs font-bold ${slot?.startsAt === item.startsAt ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#e1e4ec] bg-white'}`} key={item.startsAt} onClick={() => setSlot(item)} type="button">
                  {item.label}
                </button>
              ))}
            </div>}
            {!busy && availability.filter((item) => item.available).length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-[#748096]">No times are available on this day.</p>}
            <Button disabled={!slot} fullWidth onClick={() => setStep('details')}>Continue</Button>
          </section>
        )}

        {step === 'details' && service && provider && slot && (
          <section className="space-y-4">
            <PublicBack onClick={() => setStep('time')} />
            <div className="rounded-lg bg-white p-4 shadow-card">
              <p className="text-sm font-bold">{service.name}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-[#748096]"><CalendarDays className="size-3.5" />{formatZonedDate(slot.startsAt, timeZone)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-[#748096]"><Clock className="size-3.5" />{formatZonedTime(slot.startsAt, timeZone)} with {provider.full_name}</p>
            </div>
            <input className="min-h-12 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Full name" value={form.fullName} />
            <input className="min-h-12 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" value={form.phone} />
            <input className="min-h-12 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email (optional)" type="email" value={form.email} />
            <textarea className="min-h-24 w-full resize-none rounded-md border border-[#e1e4ec] bg-white px-3 py-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes for the salon (optional)" value={form.notes} />
            <Button disabled={!form.fullName.trim() || !form.phone.trim()} fullWidth loading={busy} onClick={submit}>Request appointment</Button>
          </section>
        )}

        {step === 'success' && (
          <section className="space-y-4 rounded-lg bg-white p-5 text-center shadow-card">
            <CheckCircle2 className="mx-auto size-12 text-[#21855b]" />
            <h2 className="text-lg font-bold">Appointment requested</h2>
            <p className="text-sm text-[#748096]">Thanks, {form.fullName}. {payload.salon.name} has received your booking.</p>
            <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#eee9ff] px-4 text-sm font-bold text-[#4c1d95]" onClick={bookAnotherService} type="button">Book another service</button>
          </section>
        )}
      </div>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#eceaf5] sm:py-6"><main className="mx-auto min-h-dvh w-full max-w-[393px] overflow-x-hidden bg-[#f2f5ff]">{children}</main></div>
}

function shortDateLabel(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

function PublicBack({ onClick }: { onClick: () => void }) {
  return <button className="text-xs font-bold text-[#7c3aed]" onClick={onClick} type="button">Back</button>
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ['service', 'provider', 'time', 'details']
  const current = Math.max(0, steps.indexOf(step))
  return <div className="flex gap-1">{steps.map((item, index) => <span className={`h-1.5 flex-1 rounded-full ${index <= current || step === 'success' ? 'bg-[#7c3aed]' : 'bg-[#ded3ff]'}`} key={item} />)}</div>
}
