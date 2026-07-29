import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../../components'
import { useAppointments, useClients, useProfessionals, useServiceCategories, useServices } from '../../../hooks/useGlamhourData'
import { useMutation } from '../../../hooks/useMutation'
import { cn } from '../../../lib/cn'
import { clampToToday } from '../../../lib/date'
import { deferTask, scrollMainToTop } from '../../../lib/defer'
import { glamhourApi } from '../../../services/glamhour-api'
import type { AvailabilitySlot, EligibleProvider } from '../../../types/api'
import { NailsServicesScreen } from '../nails-booking/NailsServicesScreen'
import { CategoryServiceStep, usesCategoryStepLayout } from './CategoryServiceStep'
import { buildAppointmentCategories } from './constants'
import { APPOINTMENT_DRAFT_KEY, emptyDraft, initialBookingStep, readDraft, todayString } from './draft'
import { ClientStep, HealthStep } from './steps/ClientHealthSteps'
import { AppointmentDetailsStep } from './steps/AppointmentDetailsStep'
import { CalendarSetupStep } from './steps/CalendarSetupStep'
import { ReviewStep, SuccessStep } from './steps/SchedulingSteps'
import { buildTreatmentPayload } from './buildTreatmentPayload'
import { mergeDetailsPatchForCategory, sanitizeDetailsForCategory } from './categoryDetails'
import type { AppointmentDraft, BookingStep, DraftPatch } from './types'
import type { Service } from '../../../types/api'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function optionalUuid(value: string) {
  return uuidPattern.test(value) ? value : undefined
}

function resolveCategoryServiceId(
  draft: AppointmentDraft,
  categoryServices: Service[],
  services: Service[],
) {
  return services.find((service) => service.id === draft.serviceId)?.id
    ?? categoryServices.find((service) => service.is_active)?.id
    ?? categoryServices[0]?.id
    ?? ''
}

function appointmentDraftTime(draft: AppointmentDraft) {
  if (typeof draft.details.consentTime === 'string' && draft.details.consentTime) return draft.details.consentTime
  if (!draft.startsAt) return '09:00'
  const date = new Date(draft.startsAt)
  if (Number.isNaN(date.getTime())) return '09:00'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function appointmentDraftDate(draft: AppointmentDraft) {
  return clampToToday(typeof draft.details.consentDate === 'string' && draft.details.consentDate
    ? draft.details.consentDate
    : draft.date)
}

function parseDraftTime(details: Record<string, unknown>) {
  const value = typeof details.consentTime === 'string' ? details.consentTime : ''
  const [hour, minute] = value.split(':').map(Number)
  return {
    hour: Number.isFinite(hour) ? hour : 9,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function readInitialDraft() {
  if (typeof window === 'undefined') return readDraft()
  const fresh = new URLSearchParams(window.location.search).get('fresh') === '1'
  if (fresh) {
    window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
    window.history.replaceState(null, '', window.location.pathname)
    return emptyDraft()
  }
  return readDraft()
}

export function NewAppointmentPage() {
  const navigate = useNavigate()
  const categories = useServiceCategories()
  const services = useServices()
  const clients = useClients()
  const appointments = useAppointments()
  const professionals = useProfessionals()
  const mutation = useMutation(glamhourApi.createAppointment)
  const updateMutation = useMutation((input: {
    appointmentId: string
    categoryCode: string
    treatmentDetails: Record<string, unknown>
    treatmentNotes?: string
  }) => glamhourApi.updateAppointmentTreatmentDetails(input.appointmentId, {
    categoryCode: input.categoryCode,
    treatmentDetails: input.treatmentDetails,
    treatmentNotes: input.treatmentNotes,
  }))
  const initialDraft = useMemo(() => readInitialDraft(), [])
  const [draft, setDraft] = useState<AppointmentDraft>(initialDraft)
  const [step, setStep] = useState<BookingStep>(() => initialBookingStep(initialDraft))
  const [eligibleProviders, setEligibleProviders] = useState<EligibleProvider[]>([])
  const [providerLoading, setProviderLoading] = useState(false)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [createdAppointmentId, setCreatedAppointmentId] = useState('')
  const [confirmError, setConfirmError] = useState<Error | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [nowTimestamp] = useState(() => Date.now())
  const devLashesBootstrapped = useRef(false)

  useEffect(() => {
    scrollMainToTop()
  }, [step])

  useEffect(() => {
    window.sessionStorage.setItem(APPOINTMENT_DRAFT_KEY, JSON.stringify({
      ...draft,
      details: sanitizeDetailsForCategory(draft.categoryCode, draft.details),
    }))
  }, [draft])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (devLashesBootstrapped.current) return
    if (new URLSearchParams(window.location.search).get('dev') !== 'lashes-details') return
    if (!categories.data || !clients.data || !services.data) return
    devLashesBootstrapped.current = true
    setDraft({
      ...emptyDraft(),
      categoryCode: 'lashes',
      categoryId: '50000000-0000-0000-0000-000000000002',
      clientId: clients.data[0]?.id ?? '40000000-0000-0000-0000-000000000002',
      serviceId: services.data.find((service) => service.category_code === 'lashes')?.id ?? '60000000-0000-0000-0000-000000000004',
      date: todayString(),
      details: { style: 'Cat eye' },
    })
    setStep('service')
  }, [categories.data, clients.data, services.data])

  useEffect(() => {
    if (!draft.serviceId) {
      deferTask(() => setEligibleProviders([]))
      return
    }
    let active = true
    deferTask(() => setProviderLoading(true))
    glamhourApi.eligibleProviders({
      serviceId: draft.serviceId,
      categoryId: optionalUuid(draft.categoryId),
      date: appointmentDraftDate(draft) || undefined,
    }).then((providers) => {
      if (active) setEligibleProviders(providers)
    }).catch(() => {
      if (active) setEligibleProviders([])
    }).finally(() => {
      if (active) setProviderLoading(false)
    })
    return () => { active = false }
  }, [draft.categoryId, draft.date, draft.serviceId])

  useEffect(() => {
    if (!draft.providerId || !draft.serviceId || !appointmentDraftDate(draft)) {
      deferTask(() => setAvailability([]))
      return
    }
    let active = true
    deferTask(() => setAvailabilityLoading(true))
    glamhourApi.appointmentAvailability({
      providerId: draft.providerId,
      serviceId: draft.serviceId,
      date: appointmentDraftDate(draft),
    }).then((result) => {
      if (active) setAvailability(result.slots)
    }).catch(() => {
      if (active) setAvailability([])
    }).finally(() => {
      if (active) setAvailabilityLoading(false)
    })
    return () => { active = false }
  }, [draft.date, draft.providerId, draft.serviceId])

  useEffect(() => {
    if (step !== 'appointment-details') return
    if (!categories.data || !services.data || !clients.data) return

    const appointmentCategories = buildAppointmentCategories(categories.data, services.data)
    const category = appointmentCategories.find((item) => item.code === draft.categoryCode || item.id === draft.categoryId)
    const categoryServices = services.data.filter((service) => (
      (service.category_id === draft.categoryId || service.category_code === draft.categoryCode) && service.is_active
    ))
    const service = services.data.find((item) => item.id === draft.serviceId) ?? categoryServices[0]
    const client = clients.data.find((item) => item.id === draft.clientId)

    if (!category) {
      setStep('categories')
      return
    }
    if (!draft.clientId || !client) {
      setStep('client')
      return
    }
    if (!service) {
      setStep('service')
      return
    }

    const resolvedServiceId = resolveCategoryServiceId(draft, categoryServices, services.data)
    if (resolvedServiceId && resolvedServiceId !== draft.serviceId) {
      setDraft((current) => ({ ...current, serviceId: resolvedServiceId }))
    }
  }, [categories.data, clients.data, draft.categoryCode, draft.categoryId, draft.clientId, draft.serviceId, services.data, step])

  const clientVisitByClientId = useMemo(() => {
    const canceledStatuses = new Set(['canceled', 'cancelled', 'no_show'])
    const completedStatuses = new Set(['completed'])
    const visits = (appointments.data ?? []).reduce<Record<string, { upcoming?: string; last?: string }>>((result, appointment) => {
      const appointmentTime = new Date(appointment.starts_at).getTime()
      if (!Number.isFinite(appointmentTime)) return result
      const status = appointment.status_code.toLowerCase()
      if (canceledStatuses.has(status)) return result

      const current = result[appointment.client_id] ?? {}
      if (appointmentTime >= nowTimestamp && !completedStatuses.has(status)) {
        const previousUpcomingTime = current.upcoming ? new Date(current.upcoming).getTime() : Number.POSITIVE_INFINITY
        if (appointmentTime < previousUpcomingTime) current.upcoming = appointment.starts_at
      } else {
        const previousLastTime = current.last ? new Date(current.last).getTime() : 0
        if (appointmentTime > previousLastTime) current.last = appointment.starts_at
      }
      result[appointment.client_id] = current
      return result
    }, {})

    return Object.entries(visits).reduce<Record<string, { kind: 'upcoming' | 'last'; date: string }>>((result, [clientId, visit]) => {
      if (visit.upcoming) result[clientId] = { kind: 'upcoming', date: visit.upcoming }
      else if (visit.last) result[clientId] = { kind: 'last', date: visit.last }
      return result
    }, {})
  }, [appointments.data, nowTimestamp])

  const loading = categories.loading || services.loading || clients.loading || appointments.loading || professionals.loading
  if (loading) return <LoadingState label="Loading appointment flow..." />
  if (!categories.data || !services.data || !clients.data || !appointments.data || !professionals.data) {
    return <ErrorState description="Appointment data could not be loaded." onRetry={() => { categories.retry(); services.retry(); clients.retry(); appointments.retry(); professionals.retry() }} />
  }

  const currentSalonDraft = {
    ...draft,
    clientId: clients.data.some((client) => client.id === draft.clientId) ? draft.clientId : '',
    serviceId: services.data.some((service) => service.id === draft.serviceId) ? draft.serviceId : '',
    providerId: professionals.data.some((provider) => provider.id === draft.providerId) ? draft.providerId : '',
  }
  if (
    currentSalonDraft.clientId !== draft.clientId
    || currentSalonDraft.serviceId !== draft.serviceId
    || currentSalonDraft.providerId !== draft.providerId
  ) {
    deferTask(() => setDraft(currentSalonDraft))
    return <LoadingState label="Refreshing appointment flow..." />
  }

  const appointmentCategories = buildAppointmentCategories(categories.data, services.data)
  const selectedCategory = appointmentCategories.find((category) => category.code === draft.categoryCode || category.id === draft.categoryId)
  const categoryServices = services.data.filter((service) => (
    (service.category_id === draft.categoryId || service.category_code === draft.categoryCode) && service.is_active
  ))
  const selectedService = services.data.find((service) => service.id === draft.serviceId) ?? categoryServices[0]
  const selectedClient = clients.data.find((client) => client.id === draft.clientId)
  const scheduleProviders = eligibleProviders.length
    ? eligibleProviders
    : professionals.data
      .filter((provider) => provider.status !== 'inactive')
      .map((provider) => ({
        ...provider,
        durationMinutes: selectedService?.duration_minutes ?? 60,
        category_code: selectedCategory?.code,
        category_name: selectedCategory?.name,
      }))
  const selectedProvider = scheduleProviders.find((provider) => provider.id === draft.providerId)

  const continueFromServiceDetails = (patch: DraftPatch = {}) => {
    const patchedDetails = typeof patch.details === 'function'
      ? patch.details(draft.details)
      : mergeDetailsPatchForCategory(draft.categoryCode, draft.details, patch.details ?? {})
    const restDetails = { ...patchedDetails }
    delete restDetails.registrationStep
    const nextDetails = sanitizeDetailsForCategory(draft.categoryCode, restDetails)
    const patchedDraft = { ...draft, ...patch, details: nextDetails }
    const nextServiceId = patch.serviceId
      ?? resolveCategoryServiceId(patchedDraft, categoryServices, services.data ?? [])

    setDraft((current) => ({
      ...current,
      ...patch,
      serviceId: nextServiceId,
      details: nextDetails,
    }))

    if (draft.appointmentId && selectedClient) {
      void (async () => {
        const appointment = await updateMutation.mutate({
          appointmentId: draft.appointmentId!,
          categoryCode: draft.categoryCode,
          treatmentDetails: buildTreatmentPayload(draft.categoryCode, nextDetails, selectedClient),
          treatmentNotes: draft.notes,
        })
        const appointmentId = draft.appointmentId!
        setDraft(emptyDraft())
        window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
        appointments.setData((current) => (current ?? []).map((item) => (
          item.id === appointment.id ? { ...item, ...appointment } : item
        )))
        navigate(`/app/appointments/${appointmentId}`)
      })()
      return
    }

    setStep('appointment-details')
  }

  const goBack = () => {
    const order: BookingStep[] = ['categories', 'client', 'health', 'service', 'appointment-details', 'provider', 'review', 'success']
    const index = order.indexOf(step)
    if (index <= 0) navigate('/app/home')
    else setStep(order[index - 1])
  }

  const defaultAppointmentTimes = () => {
    const [year, month, day] = appointmentDraftDate(draft).split('-').map(Number)
    const { hour, minute } = parseDraftTime(draft.details)
    const starts = new Date(year, (month || 1) - 1, day || 1, hour, minute, 0, 0)
    const ends = new Date(starts)
    ends.setMinutes(starts.getMinutes() + (selectedService?.duration_minutes ?? 60))
    return { startsAt: starts.toISOString(), endsAt: ends.toISOString() }
  }

  const resolveBookableAssignment = async () => {
    const uniqueCandidates = [
      selectedService,
      ...categoryServices.filter((service) => service.is_active),
    ].filter((service, index, list): service is Service => (
      Boolean(service) && list.findIndex((item) => item?.id === service?.id) === index
    ))

    for (const service of uniqueCandidates) {
      const providers = service.id === draft.serviceId && eligibleProviders.length
        ? eligibleProviders
        : await glamhourApi.eligibleProviders({
          serviceId: service.id,
          categoryId: optionalUuid(draft.categoryId),
          date: appointmentDraftDate(draft) || undefined,
        }).catch(() => [])
      const provider = providers.find((item) => item.id === draft.providerId) ?? providers[0]
      if (provider) return { service, provider }
    }

    const fallbackService = selectedService ?? categoryServices.find((service) => service.is_active)
    const fallbackProvider = scheduleProviders.find((provider) => provider.id === draft.providerId)
      ?? scheduleProviders[0]
    if (fallbackService && fallbackProvider) {
      return { service: fallbackService, provider: fallbackProvider }
    }

    throw new Error(`Assign at least one ${selectedCategory?.name ?? 'selected'} service to a provider in Staff settings before scheduling.`)
  }

  const resolveAppointmentTimes = async (serviceId: string, providerId: string) => {
    if (draft.startsAt && draft.endsAt) return { startsAt: draft.startsAt, endsAt: draft.endsAt }
    if (typeof draft.details.consentTime === 'string' && draft.details.consentTime) return defaultAppointmentTimes()

    const availableSlots = await glamhourApi.appointmentAvailability({
      providerId,
      serviceId,
      date: appointmentDraftDate(draft),
    }).then((result) => result.slots.filter((slot) => slot.available)).catch(() => [])

    const slot = availableSlots[0]
    if (slot) return { startsAt: slot.startsAt, endsAt: slot.endsAt }

    return defaultAppointmentTimes()
  }

  const confirm = async () => {
    setConfirmError(null)
    setConfirmLoading(true)
    const treatmentDetails = buildTreatmentPayload(draft.categoryCode, draft.details, selectedClient!)

    try {
      if (draft.appointmentId && draft.mode === 'reschedule') {
        const assignment = await resolveBookableAssignment()
        const appointmentTimes = await resolveAppointmentTimes(assignment.service.id, assignment.provider.id)
        const updated = await glamhourApi.rescheduleAppointment(draft.appointmentId, {
          professionalId: assignment.provider.id,
          startsAt: appointmentTimes.startsAt,
          endsAt: appointmentTimes.endsAt,
        })
        const appointmentId = draft.appointmentId
        setDraft(emptyDraft())
        window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
        appointments.setData((current) => (current ?? []).map((item) => (
          item.id === updated.id ? { ...item, ...updated } : item
        )))
        navigate(`/app/appointments/${appointmentId}`)
        return
      }

      if (draft.appointmentId) {
        const appointment = await updateMutation.mutate({
          appointmentId: draft.appointmentId,
          categoryCode: draft.categoryCode,
          treatmentDetails,
          treatmentNotes: draft.notes,
        })
        const appointmentId = draft.appointmentId
        setDraft(emptyDraft())
        window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
        appointments.setData((current) => (current ?? []).map((item) => (
          item.id === appointment.id ? { ...item, ...appointment } : item
        )))
        navigate(`/app/appointments/${appointmentId}`)
        return
      }

      const assignment = await resolveBookableAssignment()
      const appointmentTimes = await resolveAppointmentTimes(assignment.service.id, assignment.provider.id)
      const appointment = await mutation.mutate({
        clientId: draft.clientId,
        professionalId: assignment.provider.id,
        serviceIds: [assignment.service.id],
        startsAt: appointmentTimes.startsAt,
        endsAt: appointmentTimes.endsAt,
        customerNotes: draft.notes,
        treatmentDetails,
        treatmentNotes: draft.notes,
        priceOverrideMinor: typeof draft.details.appointmentPriceMinor === 'number'
          ? draft.details.appointmentPriceMinor
          : undefined,
      })
      const comingUpAppointment = await glamhourApi.updateAppointmentStatus(appointment.id, 'coming_up')
      setDraft(emptyDraft())
      window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
      appointments.setData((current) => [comingUpAppointment, ...(current ?? [])])
      setCreatedAppointmentId(comingUpAppointment.id)
      setStep('success')
    } catch (reason) {
      setConfirmError(reason instanceof Error ? reason : new Error('Appointment could not be scheduled.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  const hideBack = step === 'success'
    || step === 'categories'
    || (step === 'service' && usesCategoryStepLayout(draft.categoryCode))
    || step === 'appointment-details'
    || step === 'provider'

  const usesCategoryDetailsLayout = step === 'service' && usesCategoryStepLayout(draft.categoryCode)

  const exitBooking = () => navigate('/app/home')

  return (
    <div className={cn(
      'min-h-full w-full min-w-0',
      step === 'provider' ? 'bg-white' : 'bg-[#f2f5ff]',
      step === 'categories' || usesCategoryDetailsLayout
        ? 'pt-0'
        : step === 'appointment-details'
          ? 'px-4 pt-10'
          : step === 'provider'
            ? 'px-3 pt-8'
          : 'px-5 pt-5',
    )}>
      {!hideBack && (
        <button className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#111827]" onClick={goBack} type="button">
          <ArrowLeft className="size-5" /> Back
        </button>
      )}

      {step === 'categories' && (
        <NailsServicesScreen
          appointments={appointments.data}
          categories={appointmentCategories}
          onCalendar={() => navigate('/app/calendar')}
          services={services.data}
          onSelect={(category) => {
            setDraft({ ...emptyDraft(), categoryId: category.id, categoryCode: category.code, date: appointmentDraftDate(draft) })
            setCreatedAppointmentId('')
            setStep('client')
          }}
        />
      )}

      {step === 'client' && (
        <ClientStep
          clients={clients.data}
          clientVisitByClientId={clientVisitByClientId}
          selectedClientId={draft.clientId}
          onCreate={(client) => clients.setData((current) => [client, ...(current ?? [])])}
          onSelect={(clientId) => setDraft({ ...draft, clientId })}
          onNext={() => setStep('health')}
        />
      )}

      {step === 'health' && selectedCategory && selectedClient && (
        <HealthStep
          category={selectedCategory}
          client={selectedClient}
          details={draft.details}
          notes={draft.notes}
          serviceDate={appointmentDraftDate(draft)}
          serviceTime={appointmentDraftTime(draft)}
          onChange={(details, notes) => setDraft((current) => {
            const nextDate = clampToToday(typeof details.consentDate === 'string' && details.consentDate
              ? details.consentDate
              : current.date)
            return {
              ...current,
              date: nextDate,
              startsAt: '',
              endsAt: '',
              details: sanitizeDetailsForCategory(current.categoryCode, details),
              notes,
            }
          })}
          onNext={() => setStep('service')}
        />
      )}

      {step === 'service' && selectedCategory && (
        <CategoryServiceStep
          category={selectedCategory}
          details={draft.details}
          onBack={goBack}
          onChange={(patch: DraftPatch) => setDraft((current) => {
            const nextDetails = typeof patch.details === 'function'
              ? patch.details(current.details)
              : mergeDetailsPatchForCategory(current.categoryCode, current.details, patch.details ?? {})
            return {
              ...current,
              ...patch,
              details: sanitizeDetailsForCategory(current.categoryCode, nextDetails),
            }
          })}
          categorySource={categories.data}
          onServiceCreated={(service) => services.setData((current) => [service, ...(current ?? [])])}
          onNext={continueFromServiceDetails}
          selectedServiceId={draft.serviceId}
          services={categoryServices}
        />
      )}

      {step === 'appointment-details' && selectedCategory && selectedService && selectedClient && (
        <AppointmentDetailsStep
          category={selectedCategory}
          client={selectedClient}
          date={appointmentDraftDate(draft)}
          details={draft.details}
          error={confirmError ?? mutation.error}
          loading={confirmLoading || mutation.loading}
          notes={draft.notes}
          onDetailsChange={(details) => setDraft((current) => ({
            ...current,
            details: sanitizeDetailsForCategory(current.categoryCode, details),
          }))}
          onEdit={() => {
            setDraft((current) => ({
              ...current,
              details: sanitizeDetailsForCategory(current.categoryCode, current.details),
            }))
            setStep('service')
          }}
          onNext={() => void confirm()}
          service={selectedService}
          time={appointmentDraftTime(draft)}
        />
      )}

      {step === 'provider' && (
        <CalendarSetupStep
          availabilityLoading={availabilityLoading}
          date={appointmentDraftDate(draft)}
          onBack={goBack}
          onDateChange={(date) => setDraft({ ...draft, date: clampToToday(date), startsAt: '', endsAt: '' })}
          onExit={exitBooking}
          onNext={() => setStep('review')}
          onSelectProvider={(providerId) => setDraft({ ...draft, providerId, startsAt: '', endsAt: '' })}
          onSelectSlot={(slot) => setDraft({ ...draft, startsAt: slot.startsAt, endsAt: slot.endsAt })}
          providerLoading={providerLoading}
          providers={scheduleProviders}
          selectedProviderId={draft.providerId}
          selectedStartsAt={draft.startsAt}
          serviceName={selectedService?.name}
          slots={availability}
        />
      )}

      {step === 'review' && selectedCategory && selectedService && selectedClient && selectedProvider && (
        <ReviewStep
          category={selectedCategory}
          client={selectedClient}
          details={draft.details}
          error={mutation.error}
          loading={mutation.loading}
          notes={draft.notes}
          onConfirm={confirm}
          provider={selectedProvider}
          service={selectedService}
          startsAt={draft.startsAt}
        />
      )}

      {step === 'success' && (
        <SuccessStep
          onDone={() => navigate(createdAppointmentId ? `/app/appointments/${createdAppointmentId}` : '/app/calendar')}
        />
      )}
    </div>
  )
}
