import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../../components'
import { useAppointments, useClients, useServiceCategories, useServices } from '../../../hooks/useGlamhourData'
import { useMutation } from '../../../hooks/useMutation'
import { cn } from '../../../lib/cn'
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

export function NewAppointmentPage() {
  const navigate = useNavigate()
  const categories = useServiceCategories()
  const services = useServices()
  const clients = useClients()
  const appointments = useAppointments()
  const mutation = useMutation(glamhourApi.createAppointment)
  const [step, setStep] = useState<BookingStep>(() => initialBookingStep(readDraft()))
  const [draft, setDraft] = useState<AppointmentDraft>(() => readDraft())
  const [eligibleProviders, setEligibleProviders] = useState<EligibleProvider[]>([])
  const [providerLoading, setProviderLoading] = useState(false)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const devLashesBootstrapped = useRef(false)

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
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
      queueMicrotask(() => setEligibleProviders([]))
      return
    }
    let active = true
    queueMicrotask(() => setProviderLoading(true))
    glamhourApi.eligibleProviders({
      serviceId: draft.serviceId,
      categoryId: draft.categoryId || undefined,
      date: draft.date || undefined,
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
    if (!draft.providerId || !draft.serviceId || !draft.date) {
      queueMicrotask(() => setAvailability([]))
      return
    }
    let active = true
    queueMicrotask(() => setAvailabilityLoading(true))
    glamhourApi.appointmentAvailability({
      providerId: draft.providerId,
      serviceId: draft.serviceId,
      date: draft.date,
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

  const loading = categories.loading || services.loading || clients.loading || appointments.loading
  if (loading) return <LoadingState label="Loading appointment flow..." />
  if (!categories.data || !services.data || !clients.data || !appointments.data) {
    return <ErrorState description="Appointment data could not be loaded." onRetry={() => { categories.retry(); services.retry(); clients.retry(); appointments.retry() }} />
  }

  const appointmentCategories = buildAppointmentCategories(categories.data, services.data)
  const selectedCategory = appointmentCategories.find((category) => category.code === draft.categoryCode || category.id === draft.categoryId)
  const categoryServices = services.data.filter((service) => (
    (service.category_id === draft.categoryId || service.category_code === draft.categoryCode) && service.is_active
  ))
  const selectedService = services.data.find((service) => service.id === draft.serviceId) ?? categoryServices[0]
  const selectedClient = clients.data.find((client) => client.id === draft.clientId)
  const selectedProvider = eligibleProviders.find((provider) => provider.id === draft.providerId)

  const goBack = () => {
    const order: BookingStep[] = ['categories', 'client', 'health', 'service', 'appointment-details', 'provider', 'review', 'success']
    const index = order.indexOf(step)
    if (index <= 0) navigate('/app/home')
    else setStep(order[index - 1])
  }

  const confirm = async () => {
    if (!selectedService || !draft.startsAt || !draft.endsAt) return
    const appointment = await mutation.mutate({
      clientId: draft.clientId,
      professionalId: draft.providerId,
      serviceIds: [draft.serviceId],
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      customerNotes: draft.notes,
      treatmentDetails: buildTreatmentPayload(draft.categoryCode, draft.details, selectedClient!),
      treatmentNotes: draft.notes,
    })
    setDraft(emptyDraft())
    window.sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
    appointments.setData((current) => [appointment, ...(current ?? [])])
    setStep('success')
  }

  const hideBack = step === 'success'
    || step === 'categories'
    || (step === 'service' && usesCategoryStepLayout(draft.categoryCode))
    || step === 'appointment-details'

  const usesCategoryDetailsLayout = step === 'service' && usesCategoryStepLayout(draft.categoryCode)

  const exitBooking = () => navigate('/app/home')

  return (
    <div className={cn(
      'min-h-full w-full min-w-0 bg-[#f2f5ff]',
      step === 'categories' || usesCategoryDetailsLayout ? 'pt-0' : 'px-5 pt-5',
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
            setDraft({ ...emptyDraft(), categoryId: category.id, categoryCode: category.code, date: draft.date })
            setStep('client')
          }}
        />
      )}

      {step === 'client' && (
        <ClientStep
          clients={clients.data}
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
          onChange={(details, notes) => setDraft((current) => ({
            ...current,
            details: sanitizeDetailsForCategory(current.categoryCode, details),
            notes,
          }))}
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
          onNext={() => {
            setDraft((current) => {
              const { registrationStep: _ignored, ...restDetails } = current.details
              return {
                ...current,
                serviceId: resolveCategoryServiceId(current, categoryServices, services.data ?? []),
                details: sanitizeDetailsForCategory(current.categoryCode, restDetails),
              }
            })
            setStep('appointment-details')
          }}
          selectedServiceId={draft.serviceId}
          services={categoryServices}
        />
      )}

      {step === 'appointment-details' && selectedCategory && selectedService && selectedClient && (
        <AppointmentDetailsStep
          category={selectedCategory}
          client={selectedClient}
          details={draft.details}
          notes={draft.notes}
          onEdit={() => {
            setDraft((current) => ({
              ...current,
              details: sanitizeDetailsForCategory(current.categoryCode, {
                ...current.details,
                registrationStep: 'length',
              }),
            }))
            setStep('service')
          }}
          onNext={() => setStep('provider')}
          service={selectedService}
        />
      )}

      {step === 'provider' && (
        <CalendarSetupStep
          availabilityLoading={availabilityLoading}
          date={draft.date}
          onBack={goBack}
          onDateChange={(date) => setDraft({ ...draft, date, startsAt: '', endsAt: '' })}
          onExit={exitBooking}
          onNext={() => setStep('review')}
          onSelectProvider={(providerId) => setDraft({ ...draft, providerId, startsAt: '', endsAt: '' })}
          onSelectSlot={(slot) => setDraft({ ...draft, startsAt: slot.startsAt, endsAt: slot.endsAt })}
          providerLoading={providerLoading}
          providers={eligibleProviders}
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

      {step === 'success' && <SuccessStep onDone={() => navigate('/app/calendar')} />}
    </div>
  )
}
