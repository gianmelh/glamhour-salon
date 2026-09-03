import { CalendarDays, ChevronLeft, Clock3, DollarSign, Play, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, LoadingState, MutationError, PageTitle, ScreenSection } from '../../components'
import { useAppointment, useClients, useSalon } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { appointmentService, formatMoney, timedAppointmentStatus } from '../../lib/format'
import { DEFAULT_SALON_TIMEZONE, formatZonedDate, formatZonedTime, zonedDateString } from '../../lib/salon-time'
import { glamhourApi } from '../../services/glamhour-api'
import { AppointmentClinicalDetails } from './AppointmentClinicalDetails'
import { APPOINTMENT_DRAFT_KEY } from './appointment-booking/draft'
import { formatClientBirthDate } from './appointment-booking/dateMask'
import type { Client } from '../../types/api'

function displayAppointmentDate(startsAt: string, timeZone: string) {
  return formatZonedDate(startsAt, timeZone)
}

function displayAppointmentTime(startsAt: string, endsAt: string, timeZone: string) {
  return `${formatZonedTime(startsAt, timeZone)} - ${formatZonedTime(endsAt, timeZone)}`
}

function withClientGeneralInformation(
  categoryCode: string,
  details: Record<string, unknown>,
  client: Client | undefined,
  fallbackName: string,
) {
  if (categoryCode !== 'cosmetology' && categoryCode !== 'micropigmentation') return details

  return {
    ...details,
    generalFullName: client?.full_name ?? fallbackName ?? details.generalFullName ?? '',
    generalPhone: client?.phone ?? details.generalPhone ?? '',
    generalEmail: client?.email ?? details.generalEmail ?? '',
    generalDateOfBirth: formatClientBirthDate(client?.date_of_birth) || details.generalDateOfBirth || '',
  }
}

function detailsForServiceStart(
  categoryCode: string,
  serviceName: string,
  treatmentDetails: Record<string, unknown>,
  client: Client | undefined,
  fallbackClientName: string,
) {
  if (categoryCode === 'nails') {
    return {
      ...treatmentDetails,
      nailServiceType: typeof treatmentDetails.nailServiceType === 'string' && treatmentDetails.nailServiceType
        ? treatmentDetails.nailServiceType
        : serviceName,
    }
  }
  if (categoryCode === 'lashes') {
    return {
      ...treatmentDetails,
      style: typeof treatmentDetails.style === 'string' && treatmentDetails.style
        ? treatmentDetails.style
        : serviceName,
    }
  }
  if (categoryCode === 'cosmetology') {
    return withClientGeneralInformation(categoryCode, {
      ...treatmentDetails,
      serviceType: typeof treatmentDetails.serviceType === 'string' && treatmentDetails.serviceType
        ? treatmentDetails.serviceType
        : serviceName,
    }, client, fallbackClientName)
  }
  if (categoryCode === 'micropigmentation') {
    return withClientGeneralInformation(categoryCode, {
      ...treatmentDetails,
      procedure: typeof treatmentDetails.procedure === 'string' && treatmentDetails.procedure
        ? treatmentDetails.procedure
        : serviceName,
    }, client, fallbackClientName)
  }
  return treatmentDetails
}

export function AppointmentDetailsPage() {
  const navigate = useNavigate()
  const { appointmentId = '' } = useParams()
  const salon = useSalon()
  const appointment = useAppointment(appointmentId)
  const clients = useClients()
  const mutation = useMutation((status: string) =>
    glamhourApi.updateAppointmentStatus(appointmentId, status),
  )

  if (salon.loading || appointment.loading || clients.loading) return <LoadingState label="Loading booking details..." />
  const salonTimeZone = salon.data?.timezone ?? DEFAULT_SALON_TIMEZONE
  if (!appointment.data) {
    return <ErrorState description={appointment.error?.message ?? 'Appointment not found'} onRetry={appointment.retry} />
  }
  if (!clients.data) {
    return <ErrorState description={clients.error?.message ?? 'Clients could not be loaded.'} onRetry={clients.retry} />
  }

  const data = appointment.data
  const status = timedAppointmentStatus(data)
  const service = data.services?.[0]
  const client = clients.data.find((item) => item.id === data.client_id)
  const categoryCode = service?.category_code_snapshot ?? ''
  const treatmentDetails = data.treatment_details_by_category?.[categoryCode] ?? {}
  const terminalStatus = ['completed', 'canceled', 'no_show'].includes(data.status_code)
  const appointmentDate = zonedDateString(data.starts_at, salonTimeZone)

  const updateStatus = async (next: string) => {
    const updated = await mutation.mutate(next)
    appointment.setData((current) => current ? { ...current, ...updated } : updated)
  }

  const editAppointment = () => {
    const serviceName = service?.service_name_snapshot ?? ''
    window.sessionStorage.setItem(APPOINTMENT_DRAFT_KEY, JSON.stringify({
      categoryId: '',
      categoryCode,
      serviceId: String(service?.service_id ?? service?.id ?? ''),
      clientId: data.client_id,
      providerId: data.professional_id ?? '',
      date: appointmentDate,
      startsAt: '',
      endsAt: '',
      notes: data.internal_notes ?? data.customer_notes ?? '',
      details: detailsForServiceStart(categoryCode, serviceName, treatmentDetails, client, data.client_name ?? ''),
      appointmentId: data.id,
    }))
    navigate('/app/appointments/new')
  }

  const rescheduleAppointment = () => {
    window.sessionStorage.setItem(APPOINTMENT_DRAFT_KEY, JSON.stringify({
      categoryId: '',
      categoryCode,
      serviceId: String(service?.service_id ?? service?.id ?? ''),
      clientId: data.client_id,
      providerId: data.professional_id ?? '',
      date: appointmentDate,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      notes: data.internal_notes ?? data.customer_notes ?? '',
      details: treatmentDetails,
      appointmentId: data.id,
      mode: 'reschedule',
    }))
    navigate('/app/appointments/new')
  }

  const canMarkComingUp = ['Completed', 'Canceled'].includes(status)
  const canMarkInProgress = ['Upcoming', 'Coming up'].includes(status)
  const canMarkComplete = ['Upcoming', 'Coming up', 'In progress'].includes(status)
  const canCancel = ['Upcoming', 'Coming up', 'In progress'].includes(status)

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <DataSourceNotice visible={appointment.isFallback} />
      <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => navigate(-1)} type="button">
        <ChevronLeft className="size-4" /> Back
      </button>
      <PageTitle title="Appointment Details" subtitle="Review and manage this salon appointment." />

      <Card className="min-w-0 overflow-hidden border-0 bg-gradient-to-b from-[#7a48db] to-[#6138b8] p-6 text-white shadow-[0px_8px_16px_rgba(115,68,205,0.2)]">
        <Badge tone="primary">{status.toUpperCase()}</Badge>
        <h2 className="mt-6 max-w-full break-words text-[30px] font-bold leading-9">{appointmentService(data)}</h2>
        <p className="mt-2 text-base text-white/80">with {data.professional_name ?? 'Professional'}</p>
      </Card>

      <ScreenSection title="Information">
        <div className="grid min-w-0 grid-cols-2 gap-4">
          <InfoCard icon={<UserRound className="size-4" />} label="Client" value={data.client_name ?? 'Client'} />
          <InfoCard icon={<CalendarDays className="size-4" />} label="Date" value={displayAppointmentDate(data.starts_at, salonTimeZone)} />
          <InfoCard icon={<Clock3 className="size-4" />} label="Time" value={displayAppointmentTime(data.starts_at, data.ends_at, salonTimeZone)} />
          <InfoCard icon={<DollarSign className="size-4" />} label="Cost" value={formatMoney(service?.unit_price_minor ?? 0)} />
        </div>
      </ScreenSection>

      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={data.client_name ?? 'Client'} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{data.client_name ?? 'Client'}</p>
          <p className="text-xs text-muted">{appointmentService(data)}</p>
        </div>
      </div>

      <AppointmentClinicalDetails appointment={data} />

      <MutationError error={mutation.error} />
      <div className="grid gap-3">
        <Button fullWidth onClick={editAppointment}>
          <Play className="mr-2 size-4" /> Start service
        </Button>
        {canMarkComplete && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('completed')}>Mark as complete</Button>
        )}
        {canMarkInProgress && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('in_progress')} variant="outline">Mark as in progress</Button>
        )}
        <Button fullWidth onClick={rescheduleAppointment} variant={canMarkComplete ? 'outline' : 'primary'}>Reschedule appointment</Button>
        {canMarkComingUp && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('coming_up')} variant="outline">Mark as coming up</Button>
        )}
        {!terminalStatus && !canMarkComplete && (
          <Button fullWidth onClick={editAppointment} variant="outline">Edit appointment</Button>
        )}
        {canCancel && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('canceled')} variant="ghost">Cancel appointment</Button>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="min-w-0 overflow-hidden rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
      <span className="grid size-8 place-items-center rounded-full bg-[#ebe7ff] text-[#7344cd]">{icon}</span>
      <p className="mt-3 text-[12px] text-[#666]">{label}</p>
      <p className="mt-1 break-words text-[16px] font-bold leading-tight text-[#0a0a0a]">{value}</p>
    </Card>
  )
}
