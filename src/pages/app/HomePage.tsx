import {
  ArrowRight, CalendarDays, CalendarPlus, CalendarX, Copy, DollarSign, Link2, Settings2, UserRound, UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Badge, Button, Card, ErrorState, LoadingState,
} from '../../components'
import { useDashboard } from '../../hooks/useGlamhourData'
import { cn } from '../../lib/cn'
import { formatMoney, formatTime } from '../../lib/format'
import type { DashboardAppointment } from '../../types/api'

const HOME_BG = '#f2f5ff'
const SURFACE_CARD = '#ffffff'
const LAVENDER_CARD = '#eee9ff'
const LAVENDER_ICON = '#efe7ff'
const CARD_BORDER = '#dde3f1'
const LAVENDER_BORDER = '#ddd3f6'

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateFromIso(date: string) {
  return new Date(`${date}T12:00:00.000Z`)
}

function weekDays(selectedDate: string) {
  const selected = dateFromIso(selectedDate)
  const start = new Date(selected)
  start.setUTCDate(selected.getUTCDate() - 3)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return day
  })
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(dateFromIso(date))
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function appointmentStatusLabel(status: string) {
  if (status === 'coming_up') return 'On the way'
  if (status === 'in_progress') return 'In progress'
  if (status === 'completed') return 'Completed'
  if (status === 'canceled' || status === 'no_show') return 'Cancelled'
  if (status === 'pending') return 'Pending'
  return 'Upcoming'
}

function appointmentStatusTone(status: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'canceled' || status === 'no_show') return 'danger'
  if (status === 'in_progress') return 'primary'
  if (status === 'coming_up' || status === 'pending') return 'warning'
  return 'neutral'
}

function serviceLabel(appointment: DashboardAppointment) {
  const service = appointment.services[0]
  if (!service) return 'Salon service'
  const category = service.category_code_snapshot
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return `${service.service_name_snapshot}${category ? ` · ${category}` : ''}`
}

export function HomePage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  const dashboard = useDashboard(selectedDate)
  const days = useMemo(() => weekDays(selectedDate), [selectedDate])

  if (dashboard.loading) return <LoadingState label="Loading salon dashboard..." />
  if (!dashboard.data) {
    return <ErrorState description={dashboard.error?.message ?? 'The dashboard could not be loaded.'} onRetry={dashboard.retry} />
  }

  const data = dashboard.data
  const noAppointments = data.emptyStateFlags.noAppointmentsToday
  const noActiveStaff = data.emptyStateFlags.noActiveStaff
  const staffLimitReached = data.emptyStateFlags.staffLimitReached

  async function copyBookingLink() {
    await navigator.clipboard?.writeText(data.bookingLink)
  }

  return (
    <div className="-mx-4 -mt-5 min-h-dvh px-5 pb-8 pt-11" style={{ backgroundColor: HOME_BG }}>
      <header>
        <h1 className="max-w-[335px] text-[34px] font-extrabold leading-[1.05] text-[#111827]">
          {greeting()}, {data.salon.name}!
        </h1>
        <p className="mt-7 max-w-[335px] text-[17px] leading-[1.45] text-[#68738b]">
          Ready to manage your day? Schedule a new appointment or check your salon&apos;s performance.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden rounded-[14px] px-5 py-5 shadow-none" padding="none" style={{ backgroundColor: LAVENDER_CARD, borderColor: LAVENDER_BORDER }}>
        <div className="flex items-center gap-4">
          <span className="grid size-[46px] shrink-0 place-items-center rounded-lg bg-[#7a3fe0] text-white">
            <CalendarPlus className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-5 text-[#111827]">Schedule a new appointment</p>
            <p className="mt-1 text-[13px] leading-[1.35] text-[#68738b]">Client, service, specialist, date & time in one flow</p>
          </div>
        </div>
        <div className="mt-5">
          <Button className="min-h-[64px] rounded-[14px] text-[18px] font-medium shadow-[0_14px_20px_rgb(78_35_153_/_0.32)]" fullWidth onClick={() => navigate('/app/appointments/new')}>
            Create new appointment
          </Button>
        </div>
      </Card>

      <Card className="mt-5 rounded-[14px] px-5 py-7 shadow-none" padding="none" style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}>
        <p className="text-center text-[21px] font-bold text-[#111827]">{monthLabel(selectedDate)}</p>
        <div className="mt-7 grid grid-cols-[34px_1fr_34px] items-center gap-3">
          <button
            aria-label="Previous day"
            className="grid size-9 place-items-center rounded-full border text-[22px] text-[#111827]"
            style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}
            onClick={() => {
              const next = dateFromIso(selectedDate)
              next.setUTCDate(next.getUTCDate() - 1)
              setSelectedDate(isoDate(next))
            }}
            type="button"
          >
            ‹
          </button>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dayIso = isoDate(day)
              const selected = dayIso === selectedDate
              return (
                <button
                  className="grid justify-items-center gap-2 rounded-md py-1 text-[14px] font-medium text-[#68738b]"
                  key={dayIso}
                  onClick={() => setSelectedDate(dayIso)}
                  type="button"
                >
                  <span>{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(day)}</span>
                  <span className={cn(
                    'grid size-9 place-items-center rounded-full text-[15px] font-semibold',
                    selected ? 'bg-[#7a3fe0] text-white' : 'text-[#111827]',
                  )}>
                    {day.getUTCDate()}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            aria-label="Next day"
            className="grid size-9 place-items-center rounded-full border text-[22px] text-[#111827]"
            style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}
            onClick={() => {
              const next = dateFromIso(selectedDate)
              next.setUTCDate(next.getUTCDate() + 1)
              setSelectedDate(isoDate(next))
            }}
            type="button"
          >
            ›
          </button>
        </div>
      </Card>

      <MetricCard icon={<DollarSign className="size-5" />} label="Total Revenue" value={formatMoney(data.revenue.amountMinor, data.revenue.currencyCode)} />
      <MetricCard label="Appointments" sublabel={`${data.slotsRemaining} slots remaining`} value={String(data.appointmentCount)} />
      <MetricCard icon={<UserRound className="size-4" />} label="Active Staff" value={`${data.activeStaffCount} / ${data.staffLimit}`} />

      {staffLimitReached && (
        <Card className="mt-3 rounded-lg border-[#f6d6a8] bg-[#fff9ed]">
          <p className="text-[12px] font-bold text-[#111827]">Staff limit reached</p>
          <p className="mt-1 text-[11px] leading-4 text-[#8a6a32]">You&apos;ve reached the limit of 10 active staff members. Upgrade your plan to add more providers.</p>
        </Card>
      )}

      {!noAppointments ? (
        <Card className="mt-5 rounded-[14px] shadow-none" style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold text-[#111827]">Appointments</h2>
              <p className="mt-1 text-[10px] leading-4 text-[#68738b]">
                You have {data.nextHourAppointmentCount} appointments coming up in the next hour.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {data.upcomingAppointments.map((appointment) => (
              <Link className="block rounded-lg bg-[#f7f8ff] px-3 py-2" key={appointment.id} to={`/app/appointments/${appointment.id}`}>
                <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                  <span className="text-[11px] font-bold text-[#111827]">{formatTime(appointment.starts_at)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-[#111827]">{appointment.client_name}</span>
                    <span className="block truncate text-[10px] leading-4 text-[#68738b]">{serviceLabel(appointment)} with {appointment.professional_name}</span>
                  </span>
                  <Badge className="px-2 py-0.5 text-[9px]" tone={appointmentStatusTone(appointment.status_code)}>{appointmentStatusLabel(appointment.status_code)}</Badge>
                </div>
              </Link>
            ))}
          </div>
          <Button className="mt-4 min-h-11 rounded-lg text-[13px]" fullWidth onClick={() => navigate('/app/calendar')}>
            See full schedule
          </Button>
        </Card>
      ) : (
        <NoAppointmentsCard compact />
      )}

      {noActiveStaff && <NoActiveStaffCard />}

      <Card className="mt-5 rounded-[14px] shadow-none" style={{ backgroundColor: LAVENDER_CARD, borderColor: LAVENDER_BORDER }}>
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-[#7a3fe0]" />
          <h2 className="text-[15px] font-bold text-[#111827]">Your Booking Link</h2>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#68738b]">Share this link with clients so they can book appointments directly online.</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <div className="truncate rounded-md bg-white px-3 py-2 text-[10px] font-medium text-[#111827]">{data.bookingLink}</div>
          <Button className="min-h-8 rounded-md px-3 text-[10px]" onClick={() => void copyBookingLink()} size="sm">
            <Copy className="mr-1 size-3" /> Copy
          </Button>
        </div>
        <Link className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#7a3fe0]" to="/app/share">Go to share page <ArrowRight className="size-3" /></Link>
      </Card>
    </div>
  )
}

function MetricCard({ icon, label, sublabel, value }: { icon?: React.ReactNode; label: string; sublabel?: string; value: string }) {
  return (
    <Card className="mt-5 rounded-[14px] px-6 py-5 shadow-none" padding="none" style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-[#111827]">{label}</p>
        {icon && <span className="text-[#7a3fe0]">{icon}</span>}
      </div>
      <p className="mt-5 text-[28px] font-extrabold leading-none text-[#111827]">{value}</p>
      {sublabel && <p className="mt-2 text-[13px] leading-4 text-[#68738b]">{sublabel}</p>}
    </Card>
  )
}

function NoAppointmentsCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card className={cn('mt-5 rounded-[14px] text-center shadow-none', compact ? 'py-5' : 'py-8')} style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}>
      <span className={cn('mx-auto grid place-items-center rounded-lg text-[#7a3fe0]', compact ? 'size-11' : 'size-14')} style={{ backgroundColor: LAVENDER_ICON }}>
        <CalendarX className={compact ? 'size-5' : 'size-7'} />
      </span>
      <h2 className={cn('font-bold text-[#111827]', compact ? 'mt-3 text-[14px]' : 'mt-4 text-[15px]')}>No Appointments Today</h2>
      <p className="mx-auto mt-1 max-w-[230px] text-[11px] leading-4 text-[#68738b]">You don&apos;t have any appointments scheduled for today. Share your booking link or create one manually.</p>
    </Card>
  )
}

function NoActiveStaffCard() {
  const actions = [
    { icon: <Settings2 className="size-4" />, title: 'Manage provider schedules', description: 'Review and adjust staff times for your team to match availability.', to: '/app/staff', label: 'Go to Settings' },
    { icon: <CalendarDays className="size-4" />, title: 'Reassign pending appointments', description: 'Move today’s bookings to providers who will be available later.', to: '/app/appointments', label: 'View appointments' },
    { icon: <UserRound className="size-4" />, title: 'Check provider availability', description: 'See when each provider is scheduled to start their shift below.', to: '/app/calendar', label: 'See status below' },
  ]

  return (
    <Card className="mt-5 rounded-[14px] py-7 text-center shadow-none" style={{ backgroundColor: SURFACE_CARD, borderColor: CARD_BORDER }}>
      <span className="mx-auto grid size-14 place-items-center rounded-lg text-[#7a3fe0]" style={{ backgroundColor: LAVENDER_ICON }}>
        <UserX className="size-7" />
      </span>
      <h2 className="mt-4 text-[15px] font-bold text-[#111827]">No Active Staff</h2>
      <p className="mx-auto mt-1 max-w-[250px] text-[11px] leading-4 text-[#68738b]">None of your providers have started their shift yet today. Appointments may need to be reassigned or rescheduled until someone checks in.</p>
      <p className="mt-5 text-left text-[8px] font-bold uppercase tracking-[0.12em] text-[#8b92a1]">What you can do</p>
      <div className="mt-2 space-y-2 text-left">
        {actions.map((action) => (
          <Link className="grid grid-cols-[32px_1fr] gap-3 rounded-md bg-[#f8f9ff] p-3" key={action.title} to={action.to}>
            <span className="grid size-8 place-items-center rounded-md text-[#7a3fe0]" style={{ backgroundColor: LAVENDER_ICON }}>{action.icon}</span>
            <span>
              <span className="block text-[11px] font-bold text-[#111827]">{action.title}</span>
              <span className="mt-0.5 block text-[9px] leading-4 text-[#68738b]">{action.description}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#7a3fe0]">{action.label} <ArrowRight className="size-3" /></span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  )
}
