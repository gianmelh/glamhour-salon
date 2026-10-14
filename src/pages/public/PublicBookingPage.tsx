import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Languages, MapPin, Scissors } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState } from '../../components'
import { ApiClientError } from '../../lib/api'
import { deferTask } from '../../lib/defer'
import { normalizeLanguages } from '../../lib/provider-settings'
import { usePublicBookingEmailVerification } from '../../hooks/usePublicBookingEmailVerification'
import { addMinutesIso, formatZonedDate, formatZonedTime, normalizeTimeZone, zonedDateString } from '../../lib/salon-time'
import { glamhourApi } from '../../services/glamhour-api'
import type { Appointment, AvailabilitySlot, EligibleProvider, PublicBookingPayload, Service } from '../../types/api'

type Step = 'service' | 'schedule' | 'provider' | 'details' | 'success'

function availablePublicServices(payload: PublicBookingPayload) {
  const enabledCategoryIds = new Set(payload.categories.filter((category) => category.is_active).map((category) => category.id))
  return payload.services.filter((service) => (
    enabledCategoryIds.has(service.category_id) && service.is_active && service.is_publicly_bookable
  ))
}

function nextBookableDates(timeZone: string) {
  const today = zonedDateString(new Date(), timeZone)
  const [year, month, day] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0))
  return Array.from({ length: 90 }, (_, index) => {
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
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', notes: '' })
  const [emailTouched, setEmailTouched] = useState(false)
  const emailVerification = usePublicBookingEmailVerification(salonSlug, form.email, step === 'details')
  const submissionVersion = useRef(0)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState<Appointment['confirmation_email']>()
  const [calendarMonth, setCalendarMonth] = useState('')

  const timeZone = normalizeTimeZone(payload?.salon.timezone)
  const dates = useMemo(() => nextBookableDates(timeZone), [timeZone])
  const bookableDateSet = useMemo(() => new Set(dates), [dates])
  const salonLocation = useMemo(() => {
    if (!payload) return ''
    return [
      payload.salon.address_line_1,
      payload.salon.city,
      payload.salon.region,
    ].filter(Boolean).join(', ')
  }, [payload])
  const serviceGroups = useMemo(() => {
    const groups = new Map<string, Service[]>()
    if (!payload) return []
    availablePublicServices(payload).forEach((item) => {
      const key = item.category_name ?? item.name
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    return [...groups.entries()]
  }, [payload])

  useEffect(() => {
    const submissions = submissionVersion
    let active = true
    let requestVersion = 0
    deferTask(() => { setLoading(true); setBusy(false) })
    const refreshCatalog = () => {
      if (document.visibilityState === 'hidden') return
      const version = ++requestVersion
      glamhourApi.publicBooking(salonSlug)
        .then((data) => {
          if (!active || version !== requestVersion) return
          setPayload(data)
          const firstDate = nextBookableDates(normalizeTimeZone(data.salon.timezone))[0] ?? ''
          setDate((current) => current || firstDate)
          setCalendarMonth((current) => current || firstDate.slice(0, 7))
          setError(null)
        })
        .catch((reason) => {
          if (active && version === requestVersion) setError(reason instanceof Error ? reason : new Error('Booking link could not be loaded.'))
        })
        .finally(() => {
          if (active && version === requestVersion) setLoading(false)
        })
    }
    refreshCatalog()
    window.addEventListener('focus', refreshCatalog)
    document.addEventListener('visibilitychange', refreshCatalog)
    return () => {
      ++submissions.current
      active = false
      window.removeEventListener('focus', refreshCatalog)
      document.removeEventListener('visibilitychange', refreshCatalog)
    }
  }, [salonSlug])

  useEffect(() => {
    if (!payload || !service || !availablePublicServices(payload).some((item) => item.id === service.id)) {
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
    if (!payload || step === 'success') return
    if (service && !availablePublicServices(payload).some((item) => item.id === service.id)) {
      deferTask(() => {
        setService(null)
        setServiceCategory(null)
        setProvider(null)
        setSlot(null)
        setStep('service')
        setSubmitError(new Error('This service is no longer available. Please choose another service.'))
      })
    } else if (serviceCategory && !serviceGroups.some(([category]) => category === serviceCategory)) {
      deferTask(() => setServiceCategory(null))
    }
  }, [payload, service, serviceCategory, serviceGroups, step])

  useEffect(() => {
    if (!payload || !service || !availablePublicServices(payload).some((item) => item.id === service.id) || !date || providers.length === 0) {
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
        const nextProviderSlots: Record<string, AvailabilitySlot[]> = Object.fromEntries(availableResults.map(([providerId, slots]) => [
          providerId,
          slots.filter((item) => item.available),
        ]))
        const slotsByStart = new Map<string, AvailabilitySlot>()
        Object.values(nextProviderSlots).forEach((slots) => {
          slots.forEach((item) => {
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
  }, [availabilityVersion, date, payload, providers, service, timeZone])

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
    if (!service || !provider || !slot || !form.fullName.trim() || !form.phone.trim() || !emailVerification.valid || !emailVerification.verified || busy) return
    const version = ++submissionVersion.current
    const bookingEmail = emailVerification.normalizedEmail
    setBusy(true)
    setSubmitError(null)
    try {
      // Verification belongs to the current salon/email and is always checked on the server.
      const verified = await emailVerification.checkStatus()
      if (version !== submissionVersion.current) return
      if (!verified) {
        setSubmitError(new Error('Verify your email before confirming your appointment.'))
        return
      }
      // The salon may have disabled this category since the link was opened.
      // Recheck before creating a client; the API also validates the final booking.
      const currentCatalog = await glamhourApi.publicBooking(salonSlug)
      if (version !== submissionVersion.current) return
      if (!availablePublicServices(currentCatalog).some((item) => item.id === service.id)) {
        setPayload(currentCatalog)
        return
      }
      const client = await glamhourApi.publicFindOrCreateClient(salonSlug, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: bookingEmail,
        notes: 'Created from public booking link.',
        mergeNotes: 'Used public booking link.',
      })
      if (version !== submissionVersion.current) return
      const appointment = await glamhourApi.createAppointment({
        clientId: client.id,
        professionalId: provider.id,
        serviceIds: [service.id],
        startsAt: slot.startsAt,
        endsAt: slot.endsAt || addMinutesIso(slot.startsAt, provider.durationMinutes ?? service.duration_minutes),
        source: 'public_booking',
        publicBookingEmail: bookingEmail,
        customerNotes: form.notes.trim() || undefined,
      }, payload.salon.id)
      if (version !== submissionVersion.current) return
      setConfirmationCode(`A${appointment.id.replace(/-/g, '').slice(0, 5).toUpperCase()}`)
      setConfirmationEmail(appointment.confirmation_email)
      setStep('success')
    } catch (reason) {
      if (version !== submissionVersion.current) return
      const isProfessionalConflict = reason instanceof ApiClientError
        && reason.status === 409
        && (reason.code === 'APPOINTMENT_CONFLICT' || reason.message === 'The professional is unavailable for that time.')
      if (isProfessionalConflict) {
        setProvider(null)
        setSlot(null)
        setAvailability([])
        setProviderSlots({})
        setAvailabilityVersion((current) => current + 1)
        setStep('schedule')
        setSubmitError(new Error('That time was just booked. The available times have been refreshed.'))
      } else {
        setSubmitError(reason instanceof Error ? reason : new Error('Appointment could not be requested.'))
        if (reason instanceof ApiClientError && [400, 403, 404].includes(reason.status)) {
          // Also recover if the category changed between the catalog check and POST.
          try {
            setPayload(await glamhourApi.publicBooking(salonSlug))
          } catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError : new Error('Booking link could not be loaded.'))
          }
        }
      }
    } finally {
      if (version === submissionVersion.current) setBusy(false)
    }
  }

  const bookAnotherService = () => {
    ++submissionVersion.current
    emailVerification.invalidate()
    setEmailTouched(false)
    setService(null)
    setServiceCategory(null)
    setProvider(null)
    setSlot(null)
    setProviders([])
    setProviderSlots({})
    setAvailability([])
    setAvailabilityError(null)
    setAvailabilityVersion((current) => current + 1)
    setForm({ fullName: '', phone: '', email: '', notes: '' })
    setConfirmationCode('')
    setConfirmationEmail(undefined)
    setSubmitError(null)
    setStep('service')
  }

  const providersForSlot = providers.filter((item) => providerSlots[item.id]?.some((providerSlot) => (
    providerSlot.available && providerSlot.startsAt === slot?.startsAt
  )))
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
        location: salonLocation || payload.salon.name,
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
              {!serviceGroups.length && <p className="rounded-md bg-[#f1efff] px-3 py-4 text-sm text-[#596275]">No services are available for online booking right now.</p>}
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
                  <button className={`mx-auto grid size-7 place-items-center rounded-full text-[9px] font-bold ${date === item ? 'bg-[#8b5cf6] text-white' : bookableDateSet.has(item) ? 'text-[#596275] hover:bg-[#f1efff]' : 'text-[#c8ccd5]'}`} disabled={!bookableDateSet.has(item)} key={item} onClick={() => { setDate(item); setSlot(null); setProvider(null) }} type="button">{Number(item.slice(-2))}</button>
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
                const languages = providerLanguages(item)
                const offeredServices = providerServices(item, service)
                return (
                  <button className={`flex min-h-[118px] w-full items-start gap-3 rounded-lg px-4 py-4 text-left ${selected ? 'bg-[#eef2ff] ring-1 ring-[#8b5cf6]' : 'bg-[#f4f6ff]'}`} key={item.id} onClick={() => {
                    const nextSlot = providerSlots[item.id]?.find((providerSlot) => providerSlot.startsAt === slot.startsAt) ?? slot
                    setProvider(item)
                    setSlot(nextSlot)
                  }} type="button">
                    <ProviderAvatar provider={item} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-extrabold text-[#101827]">{item.full_name}</span>
                      <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#596275]"><Languages className="size-3 text-[#8b5cf6]" /> Languages</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {languages.map((language) => <span className="rounded border border-[#d9dce7] bg-white px-1.5 py-0.5 text-[8px] font-semibold text-[#596275]" key={language}>{language}</span>)}
                      </span>
                      <span className="mt-2 flex items-center gap-1 text-[9px] font-bold text-[#596275]"><Scissors className="size-3 text-[#8b5cf6]" /> Services offered</span>
                      <span className="mt-1 flex max-h-[42px] flex-wrap gap-1 overflow-hidden">
                        {offeredServices.map((serviceName) => <span className="rounded border border-[#d9dce7] bg-white px-1.5 py-0.5 text-[8px] font-semibold text-[#596275]" key={serviceName}>{serviceName}</span>)}
                      </span>
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
            <ScreenHeader onBack={busy || emailVerification.phase === 'sending' || emailVerification.phase === 'verifying' ? undefined : () => setStep('provider')} title="Details" subtitle="To continue your appointment confirmation" />
            <div className="space-y-3">
              <label className="block text-[9px] font-bold text-[#596275]">Preferred language
                <select className="mt-1 min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-2 text-[10px] font-semibold text-[#101827]">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>Portuguese</option>
                </select>
              </label>
              <Field label="Email"><input aria-describedby={emailTouched && !emailVerification.valid ? 'public-booking-email-error' : undefined} aria-invalid={emailTouched && !emailVerification.valid} autoComplete="email" className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" disabled={busy} maxLength={320} onBlur={() => setEmailTouched(true)} onChange={(event) => {
                const email = event.target.value
                if (email.trim().toLowerCase() !== emailVerification.normalizedEmail) {
                  ++submissionVersion.current
                  emailVerification.invalidate()
                  setSubmitError(null)
                }
                setForm((current) => ({ ...current, email }))
              }} required type="email" value={form.email} /></Field>
              {emailTouched && !emailVerification.valid && <p className="text-[10px] font-semibold text-[#c24141]" id="public-booking-email-error" role="alert">{form.email.trim() ? 'Enter a valid email address.' : 'Email is required to confirm your appointment.'}</p>}
              {emailVerification.valid && (
                <div className="space-y-3 rounded-md border border-[#ddd6fe] bg-[#faf8ff] p-3">
                  {emailVerification.verified ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#21855b]" role="status"><CheckCircle2 className="size-4" /> Email verified.</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[#596275]" role="status">{emailVerification.phase === 'checking' ? 'Checking email verification...' : emailVerification.codeSent ? `A verification code was sent to ${emailVerification.normalizedEmail}. Check your inbox or spam folder.` : 'Verify your email to confirm your appointment.'}</p>
                      {emailVerification.codeSent && (
                        <>
                          <Field label="Verification code"><input autoComplete="one-time-code" className="min-h-10 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-sm tracking-[0.25em] outline-none focus:border-[#8b5cf6]" disabled={busy || emailVerification.phase === 'verifying' || emailVerification.phase === 'sending'} inputMode="numeric" maxLength={6} onChange={(event) => emailVerification.setCode(event.target.value)} pattern="[0-9]{6}" placeholder="000000" type="text" value={emailVerification.code} /></Field>
                          {emailVerification.expiresInSeconds === 0 ? <p className="text-[10px] font-semibold text-[#c24141]">This code has expired. Request a new code.</p> : emailVerification.expiresInSeconds !== null && <p className="text-[10px] text-[#596275]">Code expires in {Math.floor(emailVerification.expiresInSeconds / 60)}:{String(emailVerification.expiresInSeconds % 60).padStart(2, '0')}.</p>}
                          <Button disabled={busy || emailVerification.code.length !== 6 || emailVerification.expiresInSeconds === 0 || emailVerification.phase === 'sending'} fullWidth loading={emailVerification.phase === 'verifying'} onClick={() => void emailVerification.verifyCode()} size="sm">Verify email</Button>
                        </>
                      )}
                      <Button disabled={busy || emailVerification.phase === 'checking' || emailVerification.phase === 'verifying' || emailVerification.resendInSeconds > 0} fullWidth loading={emailVerification.phase === 'sending'} onClick={() => void emailVerification.requestCode()} size="sm" variant="outline">{emailVerification.codeSent ? 'Resend code' : 'Send code'}</Button>
                      {emailVerification.resendInSeconds > 0 && <p className="text-[10px] text-[#596275]">You can request another code in {emailVerification.resendInSeconds} seconds.</p>}
                      {emailVerification.phase === 'error' && !emailVerification.codeSent && <Button disabled={busy} fullWidth onClick={() => void emailVerification.checkStatus()} size="sm" variant="ghost">Check email again</Button>}
                    </>
                  )}
                  {emailVerification.error && <p className="text-[10px] font-semibold text-[#c24141]" role="alert">{emailVerification.error}</p>}
                </div>
              )}
              <Field label="Full name"><input className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" disabled={busy} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} value={form.fullName} /></Field>
              <Field label="Phone"><input className="min-h-8 w-full rounded-md border border-[#e1e4ec] bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#8b5cf6]" disabled={busy} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} type="tel" value={form.phone} /></Field>
            </div>
            <FlowButton disabled={!form.fullName.trim() || !form.phone.trim() || !emailVerification.valid || !emailVerification.verified} loading={busy} onClick={submit}>Confirm appointment</FlowButton>
          </section>
        )}

        {step === 'success' && service && provider && slot && (
          <section className="space-y-4 text-center">
            <div className="mx-auto mt-3 grid size-9 place-items-center rounded-md bg-[#eee9ff] text-[#7c3aed]">
              <CheckCircle2 className="size-5" />
            </div>
            <ScreenHeader title="Booking Confirmed!" subtitle={confirmationEmail?.status === 'sent' ? `Confirmation email sent to ${form.email.trim().toLowerCase()}` : 'Your appointment has been scheduled.'} centered />
            {(confirmationEmail?.status === 'failed' || confirmationEmail?.status === 'not_sent') && (
              <p className="rounded-md border border-[#f6d6a8] bg-[#fff9ed] px-3 py-3 text-left text-[11px] leading-5 text-[#854d0e]" role="status">
                We couldn&apos;t send the confirmation email. Download your PDF ticket below. You don&apos;t need to book again.
              </p>
            )}
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
            <SummaryItem icon={<MapPin className="size-3" />} label={payload.salon.name} value={salonLocation || 'Salon location'} />
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
    <header className={`relative ${onBack ? 'pl-7' : ''} ${centered ? 'text-center' : ''}`}>
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

function ProviderAvatar({ provider, size = 'md' }: { provider: EligibleProvider; size?: 'md' | 'lg' }) {
  const className = size === 'lg' ? 'size-14' : 'size-10'
  if (provider.avatar_url) return <img alt="" className={`${className} shrink-0 rounded-full object-cover`} src={provider.avatar_url} />
  return <span className={`grid ${className} shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold text-[#7c3aed]`}>{provider.full_name.slice(0, 1)}</span>
}

function providerLanguages(provider: EligibleProvider) {
  const languages = normalizeLanguages(provider.languages ?? [])
  return languages.length ? languages : ['Not specified']
}

function providerServices(provider: EligibleProvider, selectedService: Service) {
  const services = provider.services_offered?.filter(Boolean)
  return services?.length ? services : [selectedService.name]
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
