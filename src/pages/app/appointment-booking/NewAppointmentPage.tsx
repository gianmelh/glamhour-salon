import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorState, LoadingState } from '../../../components'
import { useAppointments, useClients, useProfessionals, useServiceCategories, useServices } from '../../../hooks/useGlamhourData'
import { useMutation } from '../../../hooks/useMutation'
import { ApiClientError } from '../../../lib/api'
import { cn } from '../../../lib/cn'
import { clampToToday, localDateString } from '../../../lib/date'
import { deferTask, scrollMainToTop } from '../../../lib/defer'
import { glamhourApi } from '../../../services/glamhour-api'
import type { AvailabilitySlot, EligibleProvider } from '../../../types/api'
import { NailsServicesScreen } from '../nails-booking/NailsServicesScreen'
import { CategoryServiceStep } from './CategoryServiceStep'
import { usesCategoryStepLayout } from './categoryStepLayout'
import { buildAppointmentCategories } from './constants'
import { APPOINTMENT_DRAFT_KEY, emptyDraft, initialBookingStep, readDraft, todayString } from './draft'
import { formatClientBirthDate } from './dateMask'
import { ClientStep } from './steps/ClientHealthSteps'
import { MicropigmentationClientStep } from './steps/MicropigmentationClientStep'
import { AppointmentDetailsStep } from './steps/AppointmentDetailsStep'
import { CalendarSetupStep } from './steps/CalendarSetupStep'
import { ReviewStep, SuccessStep } from './steps/SchedulingSteps'
import { ServiceSelectionStep } from './steps/ServiceSelectionStep'
import { HomeQuickCreateAppointmentStep, quickAppointmentTimes } from './steps/HomeQuickCreateAppointmentStep'
import { buildTreatmentPayload } from './buildTreatmentPayload'
import { mergeDetailsPatchForCategory, sanitizeDetailsForCategory } from './categoryDetails'
import {
  cosmetologyServiceDisplayName,
  cosmetologyServiceSlug,
  resolveCosmetologyServiceId,
} from './categories/cosmetology/cosmetologyDetailsSpec'
import {
  micropigmentationServiceDefaults,
  micropigmentationServiceDisplayName,
  resolveMicropigmentationServiceId,
} from './categories/micropigmentation/micropigmentationDetailsSpec'
import type { AppointmentDraft, BookingStep, DraftPatch } from './types'
import type { Service } from '../../../types/api'
import type { Client } from '../../../types/api'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AppointmentConflictErrorDetails {
  conflictingAppointment: {
    id: string
    serviceName: string
    startsAt: string
    endsAt: string
  }
  nextAvailableSlot: {
    time: string
    label: string
    startsAt: string
    endsAt: string
  } | null
}

function optionalUuid(value: string) {
  return uuidPattern.test(value) ? value : undefined
}

function isAppointmentConflictDetails(value: unknown): value is AppointmentConflictErrorDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as AppointmentConflictErrorDetails
  return Boolean(
    details.conflictingAppointment
    && typeof details.conflictingAppointment.serviceName === 'string'
    && typeof details.conflictingAppointment.startsAt === 'string'
    && typeof details.conflictingAppointment.endsAt === 'string',
  )
}

function appointmentConflictDetails(error: Error | null | undefined) {
  if (!(error instanceof ApiClientError)) return null
  if (error.status !== 409) return null
  return isAppointmentConflictDetails(error.details) ? error.details : null
}

function formatConflictDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function formatConflictTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function AppointmentConflictAlert({ error, serviceName, onSelectSlot }: {
  error: Error | null | undefined
  serviceName: string
  onSelectSlot: (slot: NonNullable<AppointmentConflictErrorDetails['nextAvailableSlot']>) => void
}) {
  const details = appointmentConflictDetails(error)
  if (!details) return null
  const conflict = details.conflictingAppointment
  const nextSlot = details.nextAvailableSlot

  return (
    <div className="rounded-[16px] border border-[#fda29b] bg-[#fff4f2] p-4 text-sm text-[#7a271a]">
      <p className="font-bold">This client already has an appointment during this time.</p>
      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold uppercase text-[#b42318]">Current appointment</p>
        <p className="font-bold text-[#111827]">{conflict.serviceName}</p>
        <p>{formatConflictDate(conflict.startsAt)}</p>
        <p>{formatConflictTime(conflict.startsAt)} - {formatConflictTime(conflict.endsAt)}</p>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold uppercase text-[#b42318]">Next available time for {serviceName}</p>
        {nextSlot ? (
          <Button className="min-h-10 rounded-[10px]" onClick={() => onSelectSlot(nextSlot)} type="button" variant="outline">
            Select {nextSlot.label}
          </Button>
        ) : (
          <p>No available slot was found for this provider in the next 14 days.</p>
        )}
      </div>
    </div>
  )
}

function resolveCategoryServiceId(
  draft: AppointmentDraft,
  categoryServices: Service[],
  services: Service[],
) {
  if (draft.categoryCode === 'cosmetology') {
    const serviceType = typeof draft.details.serviceType === 'string' ? draft.details.serviceType : undefined
    // Active services only — never fall back to another type or an inactive catalog row.
    if (serviceType) {
      return resolveCosmetologyServiceId(categoryServices, serviceType, draft.serviceId)
    }
  }

  if (draft.categoryCode === 'micropigmentation') {
    const procedure = typeof draft.details.procedure === 'string' ? draft.details.procedure : undefined
    if (procedure) {
      return resolveMicropigmentationServiceId(categoryServices, procedure, draft.serviceId)
    }
  }

  return services.find((service) => service.id === draft.serviceId)?.id
    ?? categoryServices.find((service) => service.is_active)?.id
    ?? categoryServices[0]?.id
    ?? ''
}

function appointmentDraftTime(draft: AppointmentDraft) {
  if (draft.startsAt) {
    const date = new Date(draft.startsAt)
    if (!Number.isNaN(date.getTime())) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  if (typeof draft.details.consentTime === 'string' && draft.details.consentTime) return draft.details.consentTime
  return '09:00'
}

function appointmentDraftDate(draft: AppointmentDraft) {
  return clampToToday(draft.date)
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
  const params = new URLSearchParams(window.location.search)
  const fresh = params.get('fresh') === '1'
  if (fresh) {
    const date = params.get('date') ?? ''
    const source = params.get('source')
    window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
    window.history.replaceState(null, '', window.location.pathname)
    return {
      ...emptyDraft(),
      date: clampToToday(date),
      entryPoint: source === 'home' ? 'home' : undefined,
    } satisfies AppointmentDraft
  }
  return readDraft()
}

function shouldReviewAppointmentDetailsAfterService(categoryCode: string) {
  return categoryCode === 'nails'
    || categoryCode === 'lashes'
    || categoryCode === 'cosmetology'
    || categoryCode === 'micropigmentation'
}

function detailsWithSelectedClient(categoryCode: string, details: Record<string, unknown>, client: Client | undefined) {
  if (!client || (categoryCode !== 'cosmetology' && categoryCode !== 'micropigmentation')) return details
  return {
    ...details,
    generalFullName: client.full_name,
    generalPhone: client.phone ?? '',
    generalEmail: client.email ?? details.generalEmail ?? '',
    generalDateOfBirth: formatClientBirthDate(client.date_of_birth) || details.generalDateOfBirth || '',
  }
}

function detailsForSelectedService(categoryCode: string, service: Service, details: Record<string, unknown>) {
  if (categoryCode === 'nails') {
    return sanitizeDetailsForCategory(categoryCode, { ...details, nailServiceType: service.name })
  }
  if (categoryCode === 'lashes') {
    return sanitizeDetailsForCategory(categoryCode, { ...details, style: service.name })
  }
  if (categoryCode === 'cosmetology') {
    return sanitizeDetailsForCategory(categoryCode, { ...details, serviceType: service.name })
  }
  if (categoryCode === 'micropigmentation') {
    return sanitizeDetailsForCategory(categoryCode, { ...details, procedure: service.name })
  }
  return sanitizeDetailsForCategory(categoryCode, details)
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
  const [localServices, setLocalServices] = useState<Service[]>([])
  const [confirmError, setConfirmError] = useState<Error | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [nowTimestamp] = useState(() => Date.now())
  const devLashesBootstrapped = useRef(false)
  const allServices = useMemo(() => {
    const byId = new Map<string, Service>()
    for (const service of services.data ?? []) byId.set(service.id, service)
    for (const service of localServices) byId.set(service.id, service)
    return [...byId.values()]
  }, [localServices, services.data])

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
    const clientData = clients.data
    const serviceData = services.data
    deferTask(() => {
      setDraft({
        ...emptyDraft(),
        categoryCode: 'lashes',
        categoryId: '50000000-0000-0000-0000-000000000002',
        clientId: clientData[0]?.id ?? '40000000-0000-0000-0000-000000000002',
        serviceId: serviceData.find((service) => service.category_code === 'lashes')?.id ?? '60000000-0000-0000-0000-000000000004',
        date: todayString(),
        details: { style: 'Cat eye' },
      })
      setStep('service')
    })
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
    if (!categories.data || !clients.data || !allServices.length) return

    const appointmentCategories = buildAppointmentCategories(categories.data, allServices)
    const category = appointmentCategories.find((item) => item.code === draft.categoryCode || item.id === draft.categoryId)
    const categoryServices = allServices.filter((service) => (
      (service.category_id === draft.categoryId || service.category_code === draft.categoryCode) && service.is_active
    ))
    const service = allServices.find((item) => item.id === draft.serviceId) ?? categoryServices[0]
    const client = clients.data.find((item) => item.id === draft.clientId)

    if (!category) {
      deferTask(() => setStep('categories'))
      return
    }
    if (!draft.clientId || !client) {
      deferTask(() => setStep('client'))
      return
    }
    if (!service) {
      deferTask(() => setStep('service'))
      return
    }

    const resolvedServiceId = resolveCategoryServiceId(draft, categoryServices, allServices)
    // Cosmetology/Micropigmentation: also clear a stale serviceId when type has no active match.
    const clearsStaleService = draft.categoryCode === 'cosmetology' || draft.categoryCode === 'micropigmentation'
    if (resolvedServiceId !== draft.serviceId && (resolvedServiceId || clearsStaleService)) {
      deferTask(() => setDraft((current) => ({ ...current, serviceId: resolvedServiceId })))
    }
  }, [allServices, categories.data, clients.data, draft.categoryCode, draft.categoryId, draft.clientId, draft.serviceId, draft.details.serviceType, draft.details.procedure, step])

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
    serviceId: allServices.some((service) => service.id === draft.serviceId) ? draft.serviceId : '',
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

  const appointmentCategories = buildAppointmentCategories(categories.data, allServices)
  const selectedCategory = appointmentCategories.find((category) => category.code === draft.categoryCode || category.id === draft.categoryId)
  const categoryServices = allServices.filter((service) => (
    (service.category_id === draft.categoryId || service.category_code === draft.categoryCode) && service.is_active
  ))
  const selectedService = allServices.find((service) => service.id === draft.serviceId) ?? categoryServices[0]
  const selectedClient = clients.data.find((client) => client.id === draft.clientId)
  const isHomeQuickFlow = draft.entryPoint === 'home' && !draft.appointmentId
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
      ?? resolveCategoryServiceId(patchedDraft, categoryServices, allServices)

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

    setStep(shouldReviewAppointmentDetailsAfterService(draft.categoryCode) ? 'appointment-details' : 'provider')
  }

  const goBack = () => {
    const order: BookingStep[] = isHomeQuickFlow
      ? ['categories', 'service', 'quick-create', 'success']
      : ['categories', 'client', 'service', 'provider', 'appointment-details', 'review', 'success']
    const index = order.indexOf(step)
    if (index <= 0) navigate('/app/home')
    else setStep(order[index - 1])
  }

  const selectSuggestedSlot = (slot: NonNullable<AppointmentConflictErrorDetails['nextAvailableSlot']>) => {
    setConfirmError(null)
    setDraft((current) => ({
      ...current,
      date: localDateString(new Date(slot.startsAt)),
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      details: sanitizeDetailsForCategory(current.categoryCode, {
        ...current.details,
        consentTime: slot.time,
      }),
    }))
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
    // Cosmetology/Micropigmentation must book the active service matched to the selected type.
    const serviceType = typeof draft.details.serviceType === 'string' ? draft.details.serviceType : ''
    const procedure = typeof draft.details.procedure === 'string' ? draft.details.procedure : ''
    let createdTypedService: Service | undefined
    let typedServiceId = (
      draft.categoryCode === 'cosmetology' || draft.categoryCode === 'micropigmentation'
    )
      ? resolveCategoryServiceId(draft, categoryServices, allServices)
      : ''

    if (draft.categoryCode === 'cosmetology' && !typedServiceId && serviceType && selectedCategory) {
      createdTypedService = await glamhourApi.ensureService({
        categoryId: optionalUuid(selectedCategory.id),
        categoryCode: 'cosmetology',
        slug: cosmetologyServiceSlug(serviceType),
        name: cosmetologyServiceDisplayName(serviceType),
        description: `${serviceType} cosmetology service created from booking flow.`,
        durationMinutes: selectedService?.duration_minutes ?? 60,
        priceMinor: 0,
        assignToActiveProviders: true,
      })
      typedServiceId = createdTypedService.id
      setLocalServices((current) => [createdTypedService!, ...current.filter((item) => item.id !== createdTypedService!.id)])
      services.setData((current) => [createdTypedService!, ...(current ?? []).filter((item) => item.id !== createdTypedService!.id)])
      setDraft((current) => ({ ...current, serviceId: createdTypedService!.id }))
    }

    if (draft.categoryCode === 'micropigmentation' && !typedServiceId && procedure && selectedCategory) {
      const defaults = micropigmentationServiceDefaults(procedure)
      createdTypedService = await glamhourApi.ensureService({
        categoryId: optionalUuid(selectedCategory.id),
        categoryCode: 'micropigmentation',
        slug: defaults.slug,
        name: defaults.name,
        description: `${defaults.name} created from micropigmentation booking flow.`,
        durationMinutes: defaults.durationMinutes,
        priceMinor: defaults.priceMinor,
        assignToActiveProviders: true,
      })
      typedServiceId = createdTypedService.id
      setLocalServices((current) => [createdTypedService!, ...current.filter((item) => item.id !== createdTypedService!.id)])
      services.setData((current) => [createdTypedService!, ...(current ?? []).filter((item) => item.id !== createdTypedService!.id)])
      setDraft((current) => ({ ...current, serviceId: createdTypedService!.id }))
    }

    const uniqueCandidates = (
      draft.categoryCode === 'cosmetology' || draft.categoryCode === 'micropigmentation'
        ? [
          createdTypedService,
          ...categoryServices.filter((service) => service.id === typedServiceId && service.is_active),
        ]
        : [
          selectedService,
          ...categoryServices.filter((service) => service.is_active),
        ]
    ).filter((service, index, list): service is Service => (
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

    if (draft.categoryCode === 'cosmetology') {
      const label = serviceType || 'selected'
      throw new Error(
        typedServiceId
          ? `Assign “${label}” to a provider in Staff settings before scheduling.`
          : `No active Cosmetology service matches “${label}”. Activate or create it in Services before booking.`,
      )
    }

    if (draft.categoryCode === 'micropigmentation') {
      const fallbackService = uniqueCandidates[0] ?? selectedService ?? categoryServices.find((service) => service.is_active)
      const fallbackProvider = scheduleProviders.find((provider) => provider.id === draft.providerId)
        ?? scheduleProviders[0]
      if (fallbackService && fallbackProvider) {
        return { service: fallbackService, provider: fallbackProvider }
      }

      const label = procedure ? micropigmentationServiceDisplayName(procedure) : 'selected'
      throw new Error(
        typedServiceId
          ? `Assign “${label}” to a provider in Staff settings before scheduling.`
          : `No active Micropigmentation service matches “${label}”. Activate or create it in Services before booking.`,
      )
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

  const quickCreateAppointment = async () => {
    setConfirmError(null)
    const time = typeof draft.details.consentTime === 'string' ? draft.details.consentTime : ''
    if (!selectedClient) {
      setConfirmError(new Error('Client is required.'))
      return
    }
    if (!selectedService) {
      setConfirmError(new Error('Service is required.'))
      return
    }
    if (!draft.date) {
      setConfirmError(new Error('Day is required.'))
      return
    }
    if (!time) {
      setConfirmError(new Error('Time is required.'))
      return
    }

    setConfirmLoading(true)
    try {
      const durationMinutes = selectedProvider?.durationMinutes ?? selectedService.duration_minutes
      const slot = draft.providerId ? availability.find((item) => item.time === time && item.available) : undefined
      const appointmentTimes = slot
        ? { startsAt: slot.startsAt, endsAt: slot.endsAt }
        : quickAppointmentTimes(draft.date, time, durationMinutes)
      const appointment = await mutation.mutate({
        clientId: selectedClient.id,
        professionalId: draft.providerId || null,
        serviceIds: [selectedService.id],
        startsAt: appointmentTimes.startsAt,
        endsAt: appointmentTimes.endsAt,
      })
      setDraft(emptyDraft())
      window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
      appointments.setData((current) => [appointment, ...(current ?? [])])
      setCreatedAppointmentId(appointment.id)
      navigate(`/app/calendar?date=${localDateString(new Date(appointment.starts_at))}`)
    } catch (reason) {
      setConfirmError(reason instanceof Error ? reason : new Error('Appointment could not be scheduled.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  const confirm = async () => {
    setConfirmError(null)
    setConfirmLoading(true)
    const treatmentDetails = buildTreatmentPayload(draft.categoryCode, draft.details, selectedClient!)
    const appointmentNotes = String(draft.details.appointmentNotes ?? draft.notes ?? '')

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
          treatmentNotes: appointmentNotes,
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
      const micropigmentationServiceIds = Array.isArray(draft.details.micropigmentationServiceIds)
        ? draft.details.micropigmentationServiceIds.filter((item): item is string => typeof item === 'string' && Boolean(item))
        : []
      const serviceIds = draft.categoryCode === 'micropigmentation' && micropigmentationServiceIds.length
        ? [assignment.service.id, ...micropigmentationServiceIds].filter((item, index, list) => list.indexOf(item) === index)
        : [assignment.service.id]
      const appointment = await mutation.mutate({
        clientId: draft.clientId,
        professionalId: assignment.provider.id,
        serviceIds,
        startsAt: appointmentTimes.startsAt,
        endsAt: appointmentTimes.endsAt,
        customerNotes: appointmentNotes,
        treatmentDetails,
        treatmentNotes: appointmentNotes,
        priceOverrideMinor: typeof draft.details.appointmentPriceMinor === 'number'
          ? draft.details.appointmentPriceMinor
          : undefined,
      })
      const comingUpAppointment = await glamhourApi.updateAppointmentStatus(appointment.id, 'coming_up')
      setDraft(emptyDraft())
      window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
      appointments.setData((current) => [comingUpAppointment, ...(current ?? [])])
      setCreatedAppointmentId(comingUpAppointment.id)
      navigate(`/app/appointments/${comingUpAppointment.id}`)
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
  const conflictAlertForService = (serviceName: string) => (
    appointmentConflictDetails(confirmError)
      ? <AppointmentConflictAlert error={confirmError} serviceName={serviceName} onSelectSlot={selectSuggestedSlot} />
      : null
  )

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
          services={allServices}
          onSelect={(category) => {
            setDraft({
              ...emptyDraft(),
              categoryId: category.id,
              categoryCode: category.code,
              date: appointmentDraftDate(draft),
              entryPoint: draft.entryPoint,
            })
            setCreatedAppointmentId('')
            setStep(isHomeQuickFlow ? 'service' : 'client')
          }}
        />
      )}

      {step === 'client' && draft.categoryCode === 'micropigmentation' && (
        <MicropigmentationClientStep
          clients={clients.data}
          clientVisitByClientId={clientVisitByClientId}
          selectedClientId={draft.clientId}
          onCreate={(client) => clients.setData((current) => [client, ...(current ?? []).filter((item) => item.id !== client.id)])}
          onSelect={(clientId) => setDraft((current) => {
            const client = (clients.data ?? []).find((item) => item.id === clientId)
            const resetDetails = clientId === current.clientId ? current.details : {
              ...current.details,
              usedExistingHealthProfile: false,
              existingQuestionnaireId: null,
            }
            return {
              ...current,
              clientId,
              details: detailsWithSelectedClient(current.categoryCode, resetDetails, client),
            }
          })}
          onContinueWithProfile={(details) => setDraft((current) => ({
            ...current,
            details: sanitizeDetailsForCategory('micropigmentation', {
              ...current.details,
              ...details,
            }),
          }))}
          onNext={() => setStep('service')}
        />
      )}

      {step === 'client' && draft.categoryCode !== 'micropigmentation' && (
        <ClientStep
          clients={clients.data}
          clientVisitByClientId={clientVisitByClientId}
          selectedClientId={draft.clientId}
          onCreate={(client) => clients.setData((current) => [client, ...(current ?? []).filter((item) => item.id !== client.id)])}
          onSelect={(clientId) => setDraft((current) => ({
            ...current,
            clientId,
            details: detailsWithSelectedClient(
              current.categoryCode,
              current.details,
              (clients.data ?? []).find((item) => item.id === clientId),
            ),
          }))}
          onNext={() => setStep('service')}
        />
      )}

      {step === 'service' && selectedCategory && (
        isHomeQuickFlow ? (
          <ServiceSelectionStep
            category={selectedCategory}
            onBack={goBack}
            onSelect={(service) => {
              setDraft((current) => ({
                ...current,
                serviceId: service.id,
                providerId: '',
                startsAt: '',
                endsAt: '',
                details: detailsForSelectedService(current.categoryCode, service, current.details),
              }))
              setStep('quick-create')
            }}
            selectedServiceId={draft.serviceId}
            services={categoryServices}
          />
        ) : (
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
            onServiceCreated={(service) => {
              setLocalServices((current) => [service, ...current.filter((item) => item.id !== service.id)])
              services.setData((current) => [service, ...(current ?? []).filter((item) => item.id !== service.id)])
            }}
            onNext={continueFromServiceDetails}
            selectedServiceId={draft.serviceId}
            services={categoryServices}
          />
        )
      )}

      {step === 'quick-create' && selectedService && (
        <HomeQuickCreateAppointmentStep
          clientVisitByClientId={clientVisitByClientId}
          clients={clients.data}
          conflictAlert={conflictAlertForService(selectedService.name)}
          date={draft.date}
          error={confirmError}
          loading={confirmLoading || mutation.loading}
          onClientCreated={(client) => clients.setData((current) => [client, ...(current ?? []).filter((item) => item.id !== client.id)])}
          onClientSelect={(clientId) => setDraft((current) => ({
            ...current,
            clientId,
            details: detailsWithSelectedClient(
              current.categoryCode,
              current.details,
              (clients.data ?? []).find((item) => item.id === clientId),
            ),
          }))}
          onCreate={() => void quickCreateAppointment()}
          onDateChange={(date) => setDraft((current) => ({
            ...current,
            date: clampToToday(date),
            startsAt: '',
            endsAt: '',
          }))}
          onProviderChange={(providerId) => setDraft((current) => ({
            ...current,
            providerId,
            startsAt: '',
            endsAt: '',
          }))}
          onTimeChange={(time) => {
            const slot = draft.providerId ? availability.find((item) => item.time === time && item.available) : undefined
            setDraft((current) => ({
              ...current,
              startsAt: slot?.startsAt ?? '',
              endsAt: slot?.endsAt ?? '',
              details: sanitizeDetailsForCategory(current.categoryCode, {
                ...current.details,
                consentTime: time,
              }),
            }))
          }}
          providerId={draft.providerId}
          providers={scheduleProviders}
          selectedClientId={draft.clientId}
          service={selectedService}
          slots={availability}
          time={typeof draft.details.consentTime === 'string' ? draft.details.consentTime : ''}
        />
      )}

      {step === 'appointment-details' && selectedCategory && selectedService && selectedClient && (
        <AppointmentDetailsStep
          category={selectedCategory}
          client={selectedClient}
          date={appointmentDraftDate(draft)}
          details={draft.details}
          conflictAlert={conflictAlertForService(selectedService.name)}
          error={confirmError}
          loading={confirmLoading || mutation.loading}
          notes={draft.notes}
          onDateChange={(date) => setDraft((current) => ({
            ...current,
            date: clampToToday(date),
            startsAt: '',
            endsAt: '',
          }))}
          onDetailsChange={(details) => setDraft((current) => ({
            ...current,
            details: sanitizeDetailsForCategory(current.categoryCode, details),
          }))}
          onTimeChange={(time) => setDraft((current) => ({
            ...current,
            startsAt: '',
            endsAt: '',
            details: sanitizeDetailsForCategory(current.categoryCode, {
              ...current.details,
              consentTime: time,
            }),
          }))}
          onEdit={() => {
            setDraft((current) => ({
              ...current,
              details: sanitizeDetailsForCategory(current.categoryCode, current.details),
            }))
            setStep(shouldReviewAppointmentDetailsAfterService(draft.categoryCode) ? 'service' : 'provider')
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
          onBack={() => setStep('service')}
          onDateChange={(date) => setDraft({ ...draft, date: clampToToday(date), startsAt: '', endsAt: '' })}
          onExit={exitBooking}
          onNext={() => setStep('appointment-details')}
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
          conflictAlert={conflictAlertForService(selectedService.name)}
          details={draft.details}
          error={confirmError}
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
