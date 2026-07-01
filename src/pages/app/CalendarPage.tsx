import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, LoadingState, PageTitle } from '../../components'
import { useAppointments, useProfessionals } from '../../hooks/useGlamhourData'
import { appointmentService, formatTime } from '../../lib/format'

const days = [{ day: 'S', date: 15 }, { day: 'M', date: 16 }, { day: 'T', date: 17 }, { day: 'W', date: 18 }, { day: 'T', date: 19 }, { day: 'F', date: 20 }, { day: 'S', date: 21 }]

export function CalendarPage() {
  const appointments = useAppointments()
  const professionals = useProfessionals()
  if (appointments.loading) return <LoadingState label="Loading calendar..." />
  if (!appointments.data && appointments.error) return <ErrorState description={appointments.error.message} onRetry={appointments.retry} />
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={appointments.isFallback || professionals.isFallback} />
      <PageTitle action={<Button size="icon" variant="outline"><SlidersHorizontal className="size-4" /></Button>} title="My services" subtitle="View your salon schedule by date and provider." />
      <Card><div className="mb-4 flex items-center justify-between"><button type="button"><ChevronLeft className="size-4" /></button><p className="text-sm font-semibold">March 2026</p><button type="button"><ChevronRight className="size-4" /></button></div><div className="grid grid-cols-7 gap-1">{days.map(({ day, date }) => <button className={date === 18 ? 'grid place-items-center gap-1 rounded-md bg-primary py-2 text-white' : 'grid place-items-center gap-1 rounded-md py-2 text-muted hover:bg-surface-soft'} key={date} type="button"><span className="text-[10px]">{day}</span><span className="text-xs font-semibold">{date}</span></button>)}</div></Card>
      <div className="flex gap-2 overflow-x-auto pb-1"><Badge tone="primary">All providers</Badge>{professionals.data?.map((item) => <Badge key={item.id}>{item.full_name.split(' ')[0]}</Badge>)}</div>
      {appointments.data?.length ? <Card padding="sm"><div className="space-y-1">{appointments.data.map((appointment, index) => <Link className="grid grid-cols-[52px_1fr] gap-3" key={appointment.id} to={`/app/appointments/${appointment.id}`}><span className="pt-3 text-[11px] font-semibold text-muted">{formatTime(appointment.starts_at)}</span><div className={`rounded-md border-l-4 p-3 ${index % 3 === 0 ? 'border-primary bg-lavender' : index % 3 === 1 ? 'border-info bg-info-soft' : 'border-success bg-success-soft'}`}><div className="flex justify-between gap-2"><div><p className="text-xs font-semibold">{appointment.client_name ?? 'Client'}</p><p className="mt-0.5 text-[11px] text-muted">{appointmentService(appointment)}</p></div><Avatar name={appointment.professional_name ?? 'Professional'} size="sm" /></div></div></Link>)}</div></Card> : <EmptyState description="No services are scheduled for this date." title="Calendar is clear" />}
    </div>
  )
}
