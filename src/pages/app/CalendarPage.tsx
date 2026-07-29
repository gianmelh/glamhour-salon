import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  DataSourceNotice,
  ErrorState,
  LoadingState,
} from '../../components'
import { useAppointments, useProfessionals } from '../../hooks/useGlamhourData'
import { cn } from '../../lib/cn'
import {
  appointmentService,
  formatTime,
  timedAppointmentStatus,
} from '../../lib/format'
import { nailsBookingAssets } from './appointment-booking/assets'
import type { Appointment, Professional } from '../../types/api'

const scheduleHours = [
  { hour: 9, label: '9:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 11, label: '11:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 13, label: '1:00 PM' },
  { hour: 14, label: '2:00 PM' },
  { hour: 15, label: '3:00 PM' },
  { hour: 16, label: '4:00 PM' },
  { hour: 17, label: '5:00 PM' },
]

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(2026, index, 1)
  ),
}))

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function weekAround(selected: Date) {
  const start = addDays(startOfDay(selected), -selected.getDay())
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function weekdayLetter(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(date)
}

function displayProviderName(name: string) {
  return name.split(' ')[0] || name
}

function appointmentHour(value: string) {
  return new Date(value).getHours()
}

function appointmentCategory(appointment: Appointment) {
  const category = appointment.services?.[0]?.category_code_snapshot ?? ''
  if (category === 'lashes') return 'Lashes'
  if (category === 'nails') return 'Nails'
  if (category === 'cosmetology') return 'Cosmetology'
  if (category === 'micropigmentation') return 'Micropigmentation'
  return 'Service'
}

function appointmentCategoryAsset(appointment: Appointment) {
  const category = appointment.services?.[0]?.category_code_snapshot ?? ''
  if (category === 'nails') return nailsBookingAssets.categories.nails
  if (category === 'lashes') return nailsBookingAssets.categories.lashes
  if (category === 'cosmetology') return nailsBookingAssets.categories.cosmetology
  if (category === 'micropigmentation') return nailsBookingAssets.categories.micropigmentation
  return null
}

function appointmentTone(appointment: Appointment, index: number) {
  const status = timedAppointmentStatus(appointment)
  if (status === 'Canceled') return 'border-[#f04438] bg-[#fff1f3]'
  if (status === 'Completed') return 'border-[#12b76a] bg-[#ecfdf3]'
  if (status === 'In progress') return 'border-[#f7b267] bg-[#fff6e8]'
  return index % 2 === 0
    ? 'border-[#7a3fe0] bg-white'
    : 'border-[#97d0c6] bg-[#ecfffa]'
}

function statusTone(status: ReturnType<typeof timedAppointmentStatus>) {
  if (status === 'Canceled') return 'text-[#101828]'
  if (status === 'Completed') return 'text-[#101828]'
  if (status === 'In progress') return 'text-[#b54708]'
  return 'text-[#7a3fe0]'
}

function statusLabel(status: ReturnType<typeof timedAppointmentStatus>) {
  if (status === 'Canceled') return 'Cancelled'
  return status
}

function moveToMonth(date: Date, month: number) {
  const next = new Date(date)
  const maxDay = new Date(next.getFullYear(), month + 1, 0).getDate()
  next.setDate(Math.min(next.getDate(), maxDay))
  next.setMonth(month)
  return startOfDay(next)
}

function moveToYear(date: Date, year: number) {
  const next = new Date(date)
  next.setFullYear(year)
  return startOfDay(next)
}

export function CalendarPage() {
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date')
    ? new Date(`${searchParams.get('date')}T12:00:00`)
    : new Date()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(initialDate))
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const appointments = useAppointments()
  const professionals = useProfessionals()

  const week = useMemo(() => weekAround(selectedDate), [selectedDate])
  const yearOptions = useMemo(() => {
    const selectedYear = selectedDate.getFullYear()
    return Array.from({ length: 7 }, (_, index) => selectedYear - 3 + index)
  }, [selectedDate])

  const providers = useMemo(() => {
    const known = new Map<string, Pick<Professional, 'id' | 'full_name'>>()
    ;(professionals.data ?? []).forEach((professional) => {
      known.set(professional.id, {
        id: professional.id,
        full_name: professional.full_name,
      })
    })
    ;(appointments.data ?? []).forEach((appointment) => {
      if (!appointment.professional_id || known.has(appointment.professional_id)) return
      known.set(appointment.professional_id, {
        id: appointment.professional_id,
        full_name: appointment.professional_name ?? 'Provider',
      })
    })
    return Array.from(known.values())
  }, [appointments.data, professionals.data])

  const dayAppointments = useMemo(() => {
    const rows = appointments.data ?? []
    return rows
      .filter((appointment) =>
        isSameDay(new Date(appointment.starts_at), selectedDate)
      )
      .filter(
        (appointment) =>
          !selectedProviderId || appointment.professional_id === selectedProviderId
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )
  }, [appointments.data, selectedDate, selectedProviderId])

  if (appointments.loading) return <LoadingState label="Loading calendar..." />
  if (!appointments.data && appointments.error) {
    return (
      <ErrorState
        description={appointments.error.message}
        onRetry={appointments.retry}
      />
    )
  }

  return (
    <div className="min-h-full bg-white">
      <DataSourceNotice
        visible={appointments.isFallback || professionals.isFallback}
      />

      <div className="mx-auto flex min-h-full w-full max-w-[393px] flex-col px-4 pb-8 pt-7">
        <header>
          <h1 className="text-[30px] font-extrabold leading-tight text-[#0c111d]">
            My Services
          </h1>
          <p className="mt-4 text-[16px] leading-6 text-[#667085]">
            Track your ongoing and upcoming appointments
          </p>
        </header>

        <section className="mt-11">
          <div className="mb-7 flex items-center justify-center text-[#101828]">
            <div className="inline-flex items-center gap-3">
              <CalendarSelect
                ariaLabel="Select month"
                onChange={(value) => setSelectedDate((current) => moveToMonth(current, Number(value)))}
                options={monthOptions.map((month) => ({
                  label: month.label,
                  value: String(month.value),
                }))}
                value={String(selectedDate.getMonth())}
              />
              <CalendarSelect
                ariaLabel="Select year"
                onChange={(value) => setSelectedDate((current) => moveToYear(current, Number(value)))}
                options={yearOptions.map((year) => ({
                  label: String(year),
                  value: String(year),
                }))}
                value={String(selectedDate.getFullYear())}
              />
            </div>
          </div>

          <div className="relative">
            <button
              aria-label="Previous week"
              className="absolute left-0 top-[35px] z-10 grid size-10 place-items-center rounded-full border border-[#d0d5dd] bg-white text-[#101828]"
              onClick={() => setSelectedDate((current) => addDays(current, -7))}
              type="button"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              aria-label="Next week"
              className="absolute right-0 top-[35px] z-10 grid size-10 place-items-center rounded-full border border-[#d0d5dd] bg-white text-[#98a2b3]"
              onClick={() => setSelectedDate((current) => addDays(current, 7))}
              type="button"
            >
              <ChevronRight className="size-6" />
            </button>

            <div className="grid grid-cols-7 px-12">
              {week.map((day) => {
                const active = isSameDay(day, selectedDate)
                return (
                  <button
                    className="grid place-items-center gap-3 py-1 text-center"
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(startOfDay(day))}
                    type="button"
                  >
                    <span
                      className={cn(
                        'text-[15px] leading-none',
                        active ? 'text-[#7a3fe0]' : 'text-[#667085]'
                      )}
                    >
                      {weekdayLetter(day)}
                    </span>
                    <span
                      className={cn(
                        'grid size-10 place-items-center rounded-full text-[17px] font-semibold leading-none',
                        active ? 'bg-[#7a3fe0] text-white' : 'text-[#101828]'
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <p className="text-[14px] font-semibold text-[#101828]">
            List by Provider Name
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {providers.map((provider) => {
              const active = selectedProviderId === provider.id
              return (
                <button
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition',
                    active
                      ? 'bg-[#7a3fe0] text-white'
                      : 'bg-[#f4f0ff] text-[#344054]'
                  )}
                  key={provider.id}
                  onClick={() => setSelectedProviderId(active ? '' : provider.id)}
                  type="button"
                >
                  {displayProviderName(provider.full_name)}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-8 min-w-0 flex-1 overflow-x-hidden pb-4">
          <div className="grid grid-cols-[88px_1fr]">
            {scheduleHours.map((slot) => {
              const slotAppointments = dayAppointments.filter(
                (appointment) => appointmentHour(appointment.starts_at) === slot.hour
              )
              return (
                <div className="contents" key={slot.hour}>
                  <div className="border-r border-[#eef1f7] pr-5 pt-4 text-right text-[15px] leading-none text-[#667085]">
                    {slot.label}
                  </div>
                  <div
                    className="relative min-h-[118px] border-t border-[#eef1f7] px-3 py-2"
                  >
                    {slotAppointments.map((appointment, index) => (
                      <AppointmentBlock
                        appointment={appointment}
                        index={index}
                        key={appointment.id}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {!dayAppointments.length && (
            <div className="ml-[88px] mt-4 rounded-[16px] border border-[#e4e7ec] bg-[#fcfcfd] p-4 text-[13px] leading-5 text-[#667085]">
              No appointments for this date
              {selectedProviderId ? ' and provider' : ''}.
            </div>
          )}
        </section>

        <section className="mt-2 grid gap-3">
          <Link
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-[16px] bg-glam-gradient px-5 text-[16px] font-medium text-white shadow-[0_12px_22px_rgba(92,52,186,0.24)] transition hover:brightness-105"
            to="/app/appointments/new?fresh=1"
          >
            Book new service
          </Link>
        </section>
      </div>
    </div>
  )
}

function CalendarSelect({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        className="appearance-none bg-transparent py-1 pl-1 pr-7 text-[24px] font-bold leading-none text-[#101828] outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 size-5 text-[#101828]" />
    </label>
  )
}

function AppointmentBlock({
  appointment,
  index,
}: {
  appointment: Appointment
  index: number
}) {
  const status = timedAppointmentStatus(appointment)
  const categoryAsset = appointmentCategoryAsset(appointment)
  const isFinalStatus = status === 'Completed' || status === 'Canceled'
  const StatusIcon = status === 'Canceled' ? XCircle : CheckCircle2

  return (
    <Link
      className={cn(
        'mb-2 block min-h-[118px] rounded-[12px] border px-3 py-3 shadow-[0_10px_20px_rgba(16,24,40,0.04)]',
        appointmentTone(appointment, index)
      )}
      to={`/app/appointments/${appointment.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex max-w-[120px] items-center gap-1.5 rounded-[7px] bg-[#efe6ff] px-2 py-1 text-[11px] font-medium text-[#7047c7]">
          {categoryAsset && (
            <img
              alt=""
              className="size-4 rounded-full object-cover"
              src={categoryAsset}
            />
          )}
          <span className="truncate">{appointmentCategory(appointment)}</span>
        </span>
        <span className={cn(
          'inline-flex shrink-0 items-center gap-1 text-[12px] font-medium',
          statusTone(status)
        )}>
          {statusLabel(status)}
          {isFinalStatus && <StatusIcon className="size-3.5 fill-[#7a3fe0] text-[#7a3fe0]" />}
        </span>
      </div>
      <p className="truncate text-[14px] font-bold leading-5 text-[#101828]">
        {appointmentService(appointment)}
      </p>
      <p className="mt-2 truncate text-[11px] leading-4 text-[#667085]">
        with {appointment.client_name ?? 'Client'}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#7a3fe0]">
          {formatTime(appointment.starts_at)}
        </span>
      </div>
    </Link>
  )
}
