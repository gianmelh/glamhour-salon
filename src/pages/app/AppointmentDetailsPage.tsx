import { useState } from 'react'
import { CalendarDays, ChevronLeft, Clock3, DollarSign, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, LoadingState, MutationError, PageTitle, ScreenSection } from '../../components'
import { useAppointment } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { appointmentService, appointmentStatus, formatDate, formatMoney, formatTime } from '../../lib/format'
import { glamhourApi } from '../../services/glamhour-api'
import { AppointmentClinicalDetails } from './AppointmentClinicalDetails'
import { APPOINTMENT_DRAFT_KEY } from './appointment-booking/draft'

export function AppointmentDetailsPage() {
  const navigate = useNavigate()
  const { appointmentId = '' } = useParams()
  const appointment = useAppointment(appointmentId)
  const [tipDollars, setTipDollars] = useState('0')
  const mutation = useMutation((input: { status: string; tipMinor?: number }) =>
    glamhourApi.updateAppointmentStatus(appointmentId, input.status, { tipMinor: input.tipMinor }),
  )

  if (appointment.loading) return <LoadingState label="Loading booking details..." />
  if (!appointment.data) {
    return <ErrorState description={appointment.error?.message ?? 'Appointment not found'} onRetry={appointment.retry} />
  }

  const data = appointment.data
  const status = appointmentStatus(data.status_code)
  const tone = status === 'Completed' ? 'success' : status === 'In progress' ? 'primary' : status === 'Canceled' ? 'danger' : 'warning'
  const service = data.services?.[0]
  const categoryCode = service?.category_code_snapshot ?? ''
  const treatmentDetails = data.treatment_details_by_category?.[categoryCode] ?? {}

  const updateStatus = async (next: string, tipMinor?: number) => {
    const updated = await mutation.mutate({ status: next, tipMinor })
    appointment.setData((current) => current ? { ...current, ...updated } : updated)
  }

  const openRegistration = async () => {
    if (data.status_code === 'coming_up') {
      await updateStatus('in_progress')
    }
    window.sessionStorage.setItem(APPOINTMENT_DRAFT_KEY, JSON.stringify({
      categoryId: '',
      categoryCode,
      serviceId: service?.service_id ?? '',
      clientId: data.client_id,
      providerId: data.professional_id,
      date: data.starts_at.slice(0, 10),
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      notes: data.internal_notes ?? '',
      details: treatmentDetails,
      appointmentId: data.id,
    }))
    navigate('/app/appointments/new')
  }

  const completeService = async () => {
    const tipMinor = Math.max(0, Math.round(Number.parseFloat(tipDollars || '0') * 100))
    await updateStatus('completed', Number.isFinite(tipMinor) ? tipMinor : 0)
  }

  return (
    <div className="space-y-5">
      <DataSourceNotice visible={appointment.isFallback} />
      <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => navigate(-1)} type="button">
        <ChevronLeft className="size-4" /> Back
      </button>
      <PageTitle title="Appointment Details" subtitle="Review and manage this salon appointment." />

      <Card className="overflow-hidden border-0 bg-gradient-to-b from-[#7a48db] to-[#6138b8] p-6 text-white shadow-[0px_8px_16px_rgba(115,68,205,0.2)]">
        <Badge className="bg-[#e3f6ed] text-[#12b76a]" tone="success">{status.toUpperCase()}</Badge>
        <h2 className="mt-6 text-[32px] font-bold leading-10">{appointmentService(data)}</h2>
        <p className="mt-2 text-base text-white/80">with {data.professional_name ?? 'Professional'}</p>
      </Card>

      <ScreenSection title="Information">
        <div className="grid grid-cols-2 gap-4">
          <InfoCard icon={<UserRound className="size-4" />} label="Client" value={data.client_name ?? 'Client'} />
          <InfoCard icon={<CalendarDays className="size-4" />} label="Date" value={formatDate(data.starts_at)} />
          <InfoCard icon={<Clock3 className="size-4" />} label="Time" value={formatTime(data.starts_at)} />
          <InfoCard icon={<DollarSign className="size-4" />} label="Cost" value={formatMoney(service?.unit_price_minor ?? 0)} />
        </div>
      </ScreenSection>

      <div className="flex items-center gap-3">
        <Avatar name={data.client_name ?? 'Client'} />
        <div>
          <p className="text-sm font-semibold">{data.client_name ?? 'Client'}</p>
          <p className="text-xs text-muted">{appointmentService(data)}</p>
        </div>
      </div>

      <AppointmentClinicalDetails appointment={data} />

      {!['completed', 'canceled', 'no_show'].includes(data.status_code) && (
        <Card className="space-y-2">
          <label className="text-[12px] font-semibold text-[#0c111d]" htmlFor="appointment-tip">Tips ($)</label>
          <input
            className="w-full rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] px-4 py-3 text-[16px] outline-none"
            id="appointment-tip"
            inputMode="decimal"
            min="0"
            onChange={(event) => setTipDollars(event.target.value)}
            step="0.01"
            type="number"
            value={tipDollars}
          />
        </Card>
      )}

      <MutationError error={mutation.error} />
      <div className="grid gap-3">
        {data.status_code === 'scheduled' && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('coming_up')}>Mark as coming up</Button>
        )}
        {['coming_up', 'in_progress', 'scheduled'].includes(data.status_code) && (
          <Button fullWidth loading={mutation.loading} onClick={() => void openRegistration()} variant="outline">
            {data.status_code === 'in_progress' || Object.keys(treatmentDetails).length > 0
              ? 'Continue registration'
              : 'Open service registration'}
          </Button>
        )}
        {data.status_code === 'coming_up' && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('in_progress')}>Start service</Button>
        )}
        {(data.status_code === 'coming_up' || data.status_code === 'in_progress') && (
          <Button fullWidth loading={mutation.loading} onClick={() => void completeService()}>Complete service</Button>
        )}
        {data.status_code === 'completed' && (
          <Button fullWidth onClick={() => navigate('/app')}>Go back to home</Button>
        )}
        <Button fullWidth variant="outline">Reschedule appointment</Button>
        {!['completed', 'canceled'].includes(data.status_code) && (
          <Button fullWidth loading={mutation.loading} onClick={() => updateStatus('canceled')} variant="ghost">Cancel appointment</Button>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
      <span className="grid size-8 place-items-center rounded-full bg-[#ebe7ff] text-[#7344cd]">{icon}</span>
      <p className="mt-3 text-[12px] text-[#666]">{label}</p>
      <p className="mt-1 text-[16px] font-bold text-[#0a0a0a]">{value}</p>
    </Card>
  )
}
