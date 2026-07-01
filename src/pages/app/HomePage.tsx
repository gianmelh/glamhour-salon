import { ArrowRight, Bell, CalendarPlus, Link2, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentCard, Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, LoadingState, PageTitle, ScreenSection, StaffCard } from '../../components'
import { useAppointments, useNotifications, useProfessionals, useSalesHistory, useSalon } from '../../hooks/useGlamhourData'
import { formatMoney } from '../../lib/format'
import { appointmentCardProps, staffCardProps } from '../../lib/view-models'

export function HomePage() {
  const salon = useSalon()
  const appointments = useAppointments()
  const professionals = useProfessionals()
  const sales = useSalesHistory()
  const notifications = useNotifications()
  const loading = salon.loading || appointments.loading || professionals.loading || sales.loading
  if (loading) return <LoadingState label="Loading salon dashboard..." />
  if (!salon.data || !appointments.data || !professionals.data || !sales.data) return <ErrorState description="The dashboard could not be loaded." onRetry={() => { salon.retry(); appointments.retry(); professionals.retry(); sales.retry() }} />
  const salonData = salon.data
  const appointmentData = appointments.data
  const professionalData = professionals.data
  const salesData = sales.data
  const totalSales = salesData.reduce((sum, item) => sum + item.total_minor, 0)
  return (
    <div className="space-y-6">
      <DataSourceNotice visible={salon.isFallback || appointments.isFallback || professionals.isFallback || sales.isFallback} />
      <PageTitle title={`Good Morning, ${salonData.name}!`} subtitle="Ready to manage your day? Schedule an appointment or check your salon's performance." />
      <Card className="overflow-hidden" padding="none" tone="lavender"><div className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-md bg-primary text-white"><CalendarPlus className="size-5" /></span><div className="flex-1"><p className="text-xs font-semibold">Schedule a new appointment</p><p className="text-[11px] text-muted">Client, service, specialist, date and time</p></div></div><Link to="/app/appointments"><Button className="rounded-none" fullWidth trailingIcon={<ArrowRight className="size-4" />}>Create new appointment</Button></Link></Card>
      <Card><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted">Recorded sales</p><span className="text-primary">$</span></div><p className="mt-2 text-2xl font-bold">{formatMoney(totalSales, salonData.currency_code)}</p><p className="mt-1 text-[11px] text-success">{salesData.length} completed services</p></Card>
      <ScreenSection action={<Link className="text-xs font-semibold text-primary" to="/app/appointments">See all</Link>} title="Appointments">
        {appointmentData.length ? <div className="space-y-3">{appointmentData.slice(0, 2).map((appointment) => <Link key={appointment.id} to={`/app/appointments/${appointment.id}`}><AppointmentCard {...appointmentCardProps(appointment)} /></Link>)}</div> : <EmptyState compact description="Create an appointment or share your booking link." title="No appointments" />}
      </ScreenSection>
      <ScreenSection action={<Badge tone="success">{professionalData.length} active</Badge>} title="Active staff"><div className="space-y-3">{professionalData.slice(0, 2).map((person) => <StaffCard key={person.id} {...staffCardProps(person)} />)}</div></ScreenSection>
      {notifications.data?.[0] && <Card className="flex items-start gap-3"><Bell className="mt-0.5 size-5 text-primary" /><div><p className="text-xs font-semibold">{notifications.data[0].title ?? 'Notification'}</p><p className="mt-1 text-[11px] text-muted">{notifications.data[0].body}</p></div></Card>}
      <Card tone="lavender"><div className="flex items-start gap-3"><Link2 className="mt-0.5 size-5 text-primary" /><div><p className="text-sm font-semibold">Your booking link</p><p className="mt-1 text-xs leading-5 text-muted">Share this link so clients can book appointments directly online.</p><Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary" to="/app/share">Go to share page <ArrowRight className="size-3" /></Link></div></div></Card>
      <div className="grid grid-cols-3 gap-2"><QuickLink icon={<UsersRound className="size-5" />} label="Clients" to="/app/clients" /><QuickLink icon={<CalendarPlus className="size-5" />} label="Services" to="/app/services" /><QuickLink icon={<UsersRound className="size-5" />} label="Team" to="/app/staff" /></div>
    </div>
  )
}

function QuickLink({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return <Link className="grid place-items-center gap-2 rounded-lg border border-border bg-surface p-3 text-xs font-semibold shadow-card" to={to}><span className="grid size-9 place-items-center rounded-md bg-lavender text-primary">{icon}</span>{label}</Link>
}
