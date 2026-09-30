import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, UserRound } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState } from '../../components'
import { deferTask } from '../../lib/defer'
import { addMinutesIso, formatZonedDate, formatZonedTime, normalizeTimeZone, zonedDateString } from '../../lib/salon-time'
import { glamhourApi } from '../../services/glamhour-api'
import type { AvailabilitySlot, EligibleProvider, PublicBookingPayload, Service } from '../../types/api'

type Step = 'service' | 'schedule' | 'provider' | 'details' | 'success'

function nextBookableDates(timeZone: string) {
  const today = zonedDateString(new Date(), timeZone)
  const [year, month, day] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0))
  return Array.from({ length: 21 }, (_, index) => {
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
  const [serviceCategory, setServiceCategory] = useState<string | null>(null)
  const [provider, setProvider] = useState<EligibleProvider | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [providers, setProviders] = useState<EligibleProvider[]>([])
  const [providerSlots, setProviderSlots] = useState<Record<string, AvailabilitySlot[]>>({})
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', notes: '' })
  const [confirmationCode, setConfirmationCode] = useState('')
  const [calendarMonth, setCalendarMonth] = useState('')

  const timeZone = normalizeTimeZone(payload?.salon.timezone)
  const dates = useMemo(() => nextBookableDates(timeZone), [timeZone])
  const serviceGroups = useMemo(() => {
    const groups = new Map<string, Service[]>()
    payload?.services.forEach((item) => {
      const key = item.category_name ?? item.name
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    return [...groups.entries()]
  }, [payload])

  useEffect(() => {
    let active = true
    deferTask(() => setLoading(true))
    glamhourApi.publicBooking(salonSlug)
      .then((data) => {
        if (!active) return
        setPayload(data)
        const firstDate = nextBookableDates(normalizeTimeZone(data.salon.timezone))[0] ?? ''
        setDate(firstDate)
        setCalendarMonth(firstDate.slice(0, 7))
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
    if (!payload || !service) {
      deferTask(() => setProviders([]))
      deferTask(() => setAvailability([]))
      deferTask(() => setProviderSlots({}))
      return
    }
    let active = true
    deferTask(() => setProvidersLoading(true))
    glamhourApi.eligibleProviders({ serviceId: service.id, categoryId: service.category_id }, payload.salon.id)
      .then((items) => {
        if (active) setProviders(items)
      })
      .catch(() => {
        if (active) setProviders([])
      })
      .finally(() => {
        if (active) setProvidersLoading(false)
    })
    return () => { active = false }
  }, [payload, service])

  useEffect(() => {
    if (!payload || !service || !date || providers.length === 0) {
      deferTask(() => setAvailability([]))
      deferTask(() => setProviderSlots({}))
      deferTask(() => setAvailabilityError(null))
      return
    }
    let active = true
    deferTask(() => {
      setSlotsLoading(true)
      setAvailabilityError(null)
    })
    Promise.allSettled(providers.map(async (item) => {
      const result = await glamhourApi.appointmentAvailability({ providerId: item.id, serviceId: service.id, date, timezone: timeZone }, payload.salon.id)
      return [item.id, result.slots] as const
    }))
      .then((results) => {
        if (!active) return
        const availableResults = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
        const nextProviderSlots = Object.fromEntries(availableResults)
        const slotsByStart = new Map<string, AvailabilitySlot>()
        availableResults.forEach(([, slots]) => {
          slots.filter((item) => item.available).forEach((item) => {
            if (!slotsByStart.has(item.startsAt)) slotsByStart.set(item.startsAt, item)
          })
        })
        setProviderSlots(nextProviderSlots)
        setAvailability([...slotsByStart.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
        if (availableResults.length === 0) {
          setAvailabilityError('Available times could not be loaded. Please try another date.')
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })
    return () => { active = false }
  }, [date, payload, providers, service, timeZone])

  if (loading) return <PublicShell><LoadingState label="Loading booking link..." /></PublicShell>
  if (error || !payload) {
    return (
      <PublicShell>
        <div className="flex min-h-dvh items-center px-5 py-10">
          <ErrorState className="w-full" compact description={error?.message ?? 'This booking link is not available.'} />
        </div>
      </PublicShell>
    )
  }

  const submit = async () => {
    if (!service || !provider || !slot || !form.fullName.trim() || !form.phone.trim()) return
    setBusy(true)
    setSubmitError(null)
    try {
      const client = await glamhourApi.findOrCreateClient({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        notes: 'Created from public booking link.',
        mergeNotes: 'Used public booking link.',
      }, payload.salon.id)
      const appointment = await glamhourApi.createAppointment({
        clientId: client.id,
        professionalId: provider.id,
        serviceIds: [service.id],
        startsAt: slot.startsAt,
        endsAt: slot.endsAt || addMinutesIso(slot.startsAt, provider.durationMinutes ?? service.duration_minutes),
        source: 'public_booking',
        customerNotes: form.notes.trim() || undefined,
      }, payload.salon.id)
      setConfirmationCode(`A${appointment.id.replace(/-/g, '').slice(0, 5).toUpperCase()}`)
      setStep('success')
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason : new Error('Appointment could not be requested.'))
    } finally {
      setBusy(false)
    }
  }

  const bookAnotherService = () => {
    setService(null)
    setServiceCategory(null)
    setProvider(null)
    setSlot(null)
    setProviders([])
    setAvailability([])
    setForm({ fullName: '', phone: '', email: '', notes: '' })
    setConfirmationCode('')
    setSubmitError(null)
    setStep('service')
  }

  const providersForSlot = providers.filter((item) => providerSlots[item.id]?.some((providerSlot) => providerSlot.startsAt === slot?.startsAt))
  const selectedDateLabel = date ? fullDateLabel(date, timeZone) : ''
  const selectService = (item: Service) => {
    setService(item)
    setServiceCategory(null)
    setProvider(null)
    setSlot(null)
    setAvailability([])
    setStep('schedule')
  }
  const downloadTicket = async () => {
    if (!service || !provider || !slot) return
    setBusy(true)
    setSubmitError(null)
    try {
      const { downloadBookingTicketPdf } = await import('../../lib/booking-ticket-pdf')
      await downloadBookingTicketPdf({
        confirmationCode,
        salonName: payload.salon.name,
        salonLogoUrl: payload.salon.logo_url,
        clientName: form.fullName,
        serviceName: service.name,
        date: formatZonedDate(slot.startsAt, timeZone),
        time: formatZonedTime(slot.startsAt, timeZone),
        specialistName: provider.full_name,
        location: [payload.salon.city, payload.salon.region].filter(Boolean).join(', '),
      })
    } catch {
      setSubmitError(new Error('The PDF ticket could not be generated. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="min-h-dvh px-5 pb-6 pt-8">
        {submitError && <p className="mb-3 rounded-md bg-[#fff0f0] px-3 py-2 text-[11px] font-semibold text-[#e05252]">{submitError.message}</p>}

        {step === 'service' && (
          <section className="space-y-4">
            <ScreenHeader title="Services" subtitle="Select a category to schedule an appointment" />
            <div className="space-y-3 pt-1">
              {serviceGroups.map(([category, items]) => (
                <button className="flex min-h-[52px] w-full items-center gap-3 rounded-md bg-[#f1efff] px-3 text-left" key={category} onClick={() => items.length === 1 ? selectService(items[0]) : setServiceCategory(category)} type="button">
                  <ServiceIcon service={items[0]} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-[#101827]">{category}</span>
                  <span className="text-[15px] font-semibold text-[#8b5cf6]">›</span>
                </button>
              ))}
            </div>
            {serviceCategory && (
              <div aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/25" role="dialog">
                <div className="w-full max-w-[393px] rounded-t-lg bg-white px-5 pb-7 pt-4 shadow-2xl">
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d8dbe5]" />
                  <h2 className="text-[13px] font-extrabold text-[#101827]">Choose your service</h2>
                  <p className="mt-0.5 text-[8px] font-semibold text-[#8a93a5]">{serviceCategory}</p>
                  <div className="mt-4 space-y-2">
                    {serviceGroups.find(([category]) => category === serviceCategory)?.[1].map((item) => (
                      <button className="flex min-h-[44px] w-full items-center justify-between rounded-md bg-[#f1efff] px-3 text-left text-[11px] font-bold text-[#101827]" key={item.id} onClick={() => selectService(item)} type="button">
                        <span>{item.name}</span><ChevronRight className="size-4 text-[#8b5cf6]" />
                      </button>
                    ))}
                  </div>
                  <button className="mt-4 w-full text-center text-[10px] font-bold text-[#7c3aed]" onClick={() => setServiceCategory(null)} type="button">Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 'schedule' && service && (
          <section className="space-y-4">
            <ScreenHeader onBack={() => setStep('service')} title="Choose your schedule" subtitle="Select a date and available time" />
            <div className="rounded-md border border-[#f0eef8] bg-white px-2 pb-3 pt-2">
              <div className="mb-2 flex items-center justify-between">
                <button aria-label="Previous month" className="grid size-6 place-items-center text-[#596275]" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} type="button"><ChevronLeft className="size-3" /></button>
                <p className="text-center text-[10px] font-bold text-[#101827]">{monthLabel(`${calendarMonth}-01`, timeZone)}</p>
                <button aria-label="Next month" className="grid size-6 place-items-center text-[#596275]" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} type="button"><ChevronRight className="size-3" /></button>
              </div>
              <div className="mb-2 grid grid-cols-7 text-center text-[8px] font-bold text-[#a8afbd]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {calendarCells(calendarMonth).map((item, index) => item ? (
                  <button className={`mx-auto grid size-7 place-items-center rounded-full text-[9px] font-bold ${date === item ? 'bg-[#8b5cf6] text-white' : item < dates[0] ? 'text-[#c8ccd5]' : 'text-[#596275]'}`} disabled={item < dates[0]} key={item} onClick={() => { setDate(item); setSlot(null); setProvider(null) }} type="button">{Number(item.slice(-2))}</button>
                ) : <span key={`blank-${index}`} />)}
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1 text-[10px] font-bold text-[#7c3aed]"><Clock className="size-3" /> Time</p>
              {(providersLoading || slotsLoading) && <LoadingState label="Loading available times..." />}
              {!providersLoading && !slotsLoading && availabilityError && <p className="rounded-md bg-[#fff0f0] p-3 text-[10px] font-semibold text-[#c24141]">{availabilityError}</p>}
              {!providersLoading && !slotsLoading && !availabilityError && availability.length === 0 && <p className="rounded-md bg-[#f1efff] p-3 text-[10px] font-semibold text-[#596275]">No times are available on this day.</p>}
              {!providersLoading && !slotsLoading && availability.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {availability.slice(0, 12).map((item) => (
                    <button className={`min-h-8 rounded-md border text-[10px] font-bold transition-colors ${slot?.startsAt === item.startsAt ? 'border-[#8b5cf6] bg-[#8b5cf6] text-white' : 'border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6] hover:border-[#8b5cf6] hover:bg-[#eee9ff]'}`} key={item.startsAt} onClick={() => { setSlot(item); setProvider(null) }} type="button">
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {slot && <div className="rounded-md bg-[#f1efff] px-3 py-3 text-center text-[10px] font-extrabold text-[#4c1d95]">{selectedDateLabel}<br /><span className="text-[#7c3aed]">{slot.label}</span></div>}
            <FlowButton disabled={!slot || providersLoading || slotsLoading} onClick={() => setStep('provider')}>{slot ? 'Continue' : 'Select date and time'}</FlowButton>
          </section>
        )}

        {step === 'provider' && service && slot && (
          <section className="space-y-4">
            <ScreenHeader onBack={() => setStep('schedule')} title="Choose your specialist" subtitle="Select based on availability and specialties" />
            <button className="w-full text-center text-[10px] font-bold text-[#8b5cf6]" disabled={providersForSlot.length === 0} onClick={() => {
              const nextProvider = providersForSlot[0]
              if (!nextProvider) return
              setProvider(nextProvider)
              setSlot(providerSlots[nextProvider.id]?.find((providerSlot) => providerSlot.startsAt === slot.startsAt) ?? slot)
            }} type="button">Choose anyone available</button>
            <div className="space-y-3">
              {providersForSlot.length === 0 && <p className="rounded-md bg-[#f1efff] p-3 text-[10px] font-semibold text-[#596275]">No specialists are available for this time.</p>}
              {providersForSlot.map((item) => {
                const selected = provider?.id === item.id
                return (
                  <button className={`flex min-h-[70px] w-full items-center gap-3 rounded-md px-3 text-left ${selected ? 'bg-[#eee9ff] ring-1 ring-[#8b5cf6]' : 'bg-[#f1efff]'}`} key={item.id} onClick={() => {
                    const nextSlot = providerSlots[item.id]?.find((providerSlot) => providerSlot.startsAt === slot.startsAt) ?? slot
                    setProvider(item)
                    setSlot(nextSlot)
                  }} type="button">
                    <ProviderAvatar provider={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-extrabold text-[#101827]">{item.full_name}</span>
                      <span className="mt-0.5 block text-[9px] font-semibold text-[#8a93a5]">{service.name}</span>
                      <span className="mt-1 block truncate text-[8px] font-bold text-[#8b5cf6]">Services offered</span>
                    </span>
                    {selected && <CheckCircle2 className="size-4 text-[#7c3aed]" />}
                  </button>
                )
              })}
            </div>
            <FlowButton disabled={!provider} onClick={() => setStep('details')}>Continue</FlowButton>
          </section>
        )}

        {step === 'details' && service && provider && slot && (
          <section className="space-y-4">
            <ScreenHeader onBack={() => setStep('provider')} title="Details" subtitle="To continue your appointment confirmation" />
            <div className="space-y-3">
              <label className="block text-[9px] font-bold text-[#596275]">Preferred language
                <select className="mt-1 min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-2 text-[10px] font-semibold text-[#101827]">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>Portuguese</option>
                </select>
              </label>
              <Field label="Email"><input className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} /></Field>
              <Field label="Full name"><input className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} value={form.fullName} /></Field>
              <Field label="Phone"><input className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} type="tel" value={form.phone} /></Field>
            </div>
            <FlowButton disabled={!form.fullName.trim() || !form.phone.trim()} loading={busy} onClick={submit}>Confirm appointment</FlowButton>
          </section>
        )}

        {step === 'success' && service && provider && slot && (
          <section className="space-y-4 text-center">
            <div className="mx-auto mt-3 grid size-9 place-items-center rounded-md bg-[#eee9ff] text-[#7c3aed]">
              <CheckCircle2 className="size-5" />
            </div>
            <ScreenHeader title="Booking Confirmed!" subtitle={form.email ? `We've sent the details to ${form.email}` : 'Your appointment has been scheduled'} centered />
            <div className="rounded-md border border-[#e1e4ec] bg-white px-4 py-3">
              <p className="text-[9px] font-bold text-[#8a93a5]">Confirmation code</p>
              <p className="mt-1 text-[18px] font-extrabold tracking-[0.12em] text-[#101827]">{confirmationCode || 'A1JPQ'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left">
              <SummaryItem label="Client" value={form.fullName} />
              <SummaryItem label="Service" value={service.name} />
              <SummaryItem label="Date" value={formatZonedDate(slot.startsAt, timeZone)} />
              <SummaryItem label="Time" value={formatZonedTime(slot.startsAt, timeZone)} />
            </div>
            <SummaryItem icon={<UserRound className="size-3" />} label={payload.salon.name} value={[payload.salon.city, payload.salon.region].filter(Boolean).join(', ') || provider.full_name} />
            <FlowButton loading={busy} onClick={downloadTicket}>Download PDF ticket</FlowButton>
            <button className="w-full text-center text-[10px] font-bold text-[#7c3aed]" onClick={bookAnotherService} type="button">Go back to start</button>
          </section>
        )}
      </div>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#444] sm:py-6"><main className="mx-auto min-h-dvh w-full max-w-[393px] overflow-x-hidden bg-white">{children}</main></div>
}

function fullDateLabel(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

function monthLabel(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

function calendarCells(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ]
}

function ScreenHeader({ title, subtitle, onBack, centered = false }: { title: string; subtitle: string; onBack?: () => void; centered?: boolean }) {
  return (
    <header className={`relative ${centered ? 'text-center' : ''}`}>
      {onBack && (
        <button aria-label="Back" className="absolute -left-1 top-0 grid size-6 place-items-center rounded-full text-[#101827]" onClick={onBack} type="button">
          <ChevronLeft className="size-4" />
        </button>
      )}
      <h1 className="text-[13px] font-extrabold leading-5 text-[#101827]">{title}</h1>
      <p className="mt-0.5 text-[8px] font-semibold leading-3 text-[#8a93a5]">{subtitle}</p>
    </header>
  )
}

function FlowButton({ children, disabled, loading, onClick }: { children: React.ReactNode; disabled?: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <Button className="min-h-9 rounded-md text-[10px] font-extrabold shadow-action" disabled={disabled} fullWidth loading={loading} onClick={onClick}>
      {children}
    </Button>
  )
}

function ServiceIcon({ service }: { service: Service }) {
  const code = service.category_code ?? service.category_name?.toLowerCase() ?? ''
  const icon = code.includes('nail')
    ? '/Glamhour - Assets/Registration flow/Home/Lashes/icons/category-nails.png'
    : code.includes('lash')
      ? '/Glamhour - Assets/Registration flow/Home/Lashes/icons/category-lash.png'
      : code.includes('cosmet')
        ? '/Glamhour - Assets/Registration flow/Home/Lashes/icons/category-cosmetology.png'
        : '/Glamhour - Assets/Registration flow/Home/Lashes/icons/category-micropigmentation.png'
  return <img alt="" className="size-6 rounded-full object-cover" src={icon} />
}

function ProviderAvatar({ provider }: { provider: EligibleProvider }) {
  if (provider.avatar_url) return <img alt="" className="size-10 rounded-full object-cover" src={provider.avatar_url} />
  return <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold text-[#7c3aed]">{provider.full_name.slice(0, 1)}</span>
}

function SummaryItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#f1efff] px-3 py-2 text-left">
      <p className="flex items-center gap-1 text-[8px] font-bold text-[#8a93a5]">{icon}{label}</p>
      <p className="mt-1 truncate text-[10px] font-extrabold text-[#101827]">{value}</p>
    </div>
  )
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block space-y-1 text-[9px] font-bold text-[#596275]">{label}{children}</label>
}
