import { CalendarPlus, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppointmentCard, Badge, Button, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, PageTitle } from '../../components'
import { useAppointments } from '../../hooks/useGlamhourData'
import { appointmentCardProps } from '../../lib/view-models'

export function AppointmentsPage() {
  const navigate = useNavigate()
  const appointments = useAppointments()

  if (appointments.loading) return <LoadingState label="Loading appointments..." />
  if (!appointments.data && appointments.error) return <ErrorState description={appointments.error.message} onRetry={appointments.retry} />

  return (
    <div className="space-y-5">
      <DataSourceNotice visible={appointments.isFallback} />
      <PageTitle action={<Button onClick={() => navigate('/app/appointments/new')} size="icon"><CalendarPlus className="size-5" /></Button>} title="Appointments" subtitle="Review today's schedule and manage appointment status." />
      <Input aria-label="Search appointments" leadingIcon={<Search className="size-4" />} placeholder="Search client or service" />
      <div className="flex gap-2 overflow-x-auto pb-1"><Badge tone="primary">All {appointments.data?.length ?? 0}</Badge><Badge>Scheduled</Badge><Badge>In progress</Badge><Badge>Completed</Badge></div>
      {appointments.data?.length ? <div className="space-y-3">{appointments.data.map((appointment) => <Link key={appointment.id} to={`/app/appointments/${appointment.id}`}><AppointmentCard {...appointmentCardProps(appointment)} /></Link>)}</div> : <EmptyState action={<Button onClick={() => navigate('/app/appointments/new')}>Create appointment</Button>} description="Create an appointment manually or share your booking link." title="No appointments today" />}
    </div>
  )
}
