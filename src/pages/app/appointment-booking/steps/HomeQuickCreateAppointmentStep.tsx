import { useMemo, useState, type ReactNode } from 'react'
import { Calendar, Clock, Plus, UserRound } from 'lucide-react'
import { Button, Card, Input, MutationError } from '../../../../components'
import { formatMoney, formatShortDate } from '../../../../lib/format'
import { localDateString } from '../../../../lib/date'
import { addMinutesIso, zonedDateTimeToIso } from '../../../../lib/salon-time'
import { glamhourApi } from '../../../../services/glamhour-api'
import { useMutation } from '../../../../hooks/useMutation'
import type { AvailabilitySlot, Client, EligibleProvider, Service } from '../../../../types/api'
import { ClientSearchCard } from './AppointmentDetailsStep'

type ClientVisitLabel = {
  kind: 'upcoming' | 'last'
  date: string
}

function displayDate(date: string) {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function compactDisplayDate(date: string) {
  if (!date) return 'Select day'
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day)).replace('.', '')
}

function fallbackTimeOptions() {
  const options: Array<{ label: string; value: string }> = []
  for (let minutes = 9 * 60; minutes <= 17 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    options.push({
      value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hour, minute)),
    })
  }
  return options
}

function timeLabel(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hour, minute))
}

export function quickAppointmentTimes(date: string, time: string, durationMinutes: number, timeZone: string) {
  const startsAt = zonedDateTimeToIso(date, time, timeZone)
  return { startsAt, endsAt: addMinutesIso(startsAt, durationMinutes) }
}

export function HomeQuickCreateAppointmentStep({
  clients,
  clientVisitByClientId,
  selectedClientId,
  service,
  date,
  time,
  providerId,
  providers,
  slots,
  loading,
  error,
  conflictAlert,
  onClientCreated,
  onClientSelect,
  onDateChange,
  onTimeChange,
  onProviderChange,
  onCreate,
}: {
  clients: Client[]
  clientVisitByClientId: Record<string, ClientVisitLabel>
  selectedClientId: string
  service: Service
  date: string
  time: string
  providerId: string
  providers: EligibleProvider[]
  slots: AvailabilitySlot[]
  loading?: boolean
  error?: Error | null
  conflictAlert?: ReactNode
  onClientCreated: (client: Client) => void
  onClientSelect: (id: string) => void
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onProviderChange: (id: string) => void
  onCreate: () => void
}) {
  const createClient = useMutation(glamhourApi.createClient)
  const [search, setSearch] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [clientErrors, setClientErrors] = useState({ name: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)
  const minDate = localDateString()

  const selectedClient = clients.find((client) => client.id === selectedClientId)
  const selectedProvider = providers.find((provider) => provider.id === providerId)
  const durationMinutes = selectedProvider?.durationMinutes ?? service.duration_minutes
  const timeOptions = useMemo(() => {
    const options = providerId
      ? slots.filter((slot) => slot.available).map((slot) => ({ label: slot.label, value: slot.time }))
      : fallbackTimeOptions()
    if (time && !options.some((option) => option.value === time)) {
      return [{ label: timeLabel(time), value: time }, ...options]
    }
    return options
  }, [providerId, slots, time])
  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = query
      ? clients.filter((client) => client.full_name.toLowerCase().includes(query) || (client.phone ?? '').includes(query))
      : clients
    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(0, 8)
  }, [clients, search])
  const requiredErrors = {
    client: !selectedClientId ? 'Client is required' : '',
    date: !date ? 'Day is required' : '',
    time: !time ? 'Time is required' : '',
  }
  const lastVisitLabel = (clientId: string) => {
    const visit = clientVisitByClientId[clientId]
    if (!visit) return undefined
    return visit.kind === 'upcoming'
      ? `Upcoming ${formatShortDate(visit.date)}`
      : `Last visit ${formatShortDate(visit.date)}`
  }

  const saveClient = async () => {
    const name = newName.trim()
    const phone = newPhone.trim()
    const nextErrors = {
      name: name ? '' : 'Name is required',
      phone: phone ? '' : 'Phone number is required',
    }
    setClientErrors(nextErrors)
    if (nextErrors.name || nextErrors.phone) return

    const client = await createClient.mutate({ fullName: name, phone })
    onClientCreated(client)
    onClientSelect(client.id)
    setCreatingClient(false)
    setNewName('')
    setNewPhone('')
    setSearch('')
  }

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
      <header>
        <h1 className="text-[28px] font-extrabold text-[#0c111d]">Create appointment</h1>
        <p className="mt-2 text-[15px] text-[#667085]">Add the required scheduling details.</p>
      </header>

      <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Service</p>
          <p className="mt-1 text-[16px] font-bold text-[#0c111d]">
            {service.name} · {durationMinutes} min · {formatMoney(service.price_minor, service.currency_code)}
          </p>
        </div>
      </Card>

      <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Client *</p>
            <p className="mt-1 text-[16px] font-bold text-[#0c111d]">{selectedClient?.full_name ?? 'Select client'}</p>
          </div>
          <UserRound className="size-5 text-[#7344cd]" />
        </div>
        {!creatingClient ? (
          <>
            <Input label="Search client" placeholder="e.g. Sarah Johnson" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <button className="w-full text-left" key={client.id} onClick={() => onClientSelect(client.id)} type="button">
                  <ClientSearchCard client={client} selected={client.id === selectedClientId} subtitle={lastVisitLabel(client.id) ?? client.phone ?? undefined} />
                </button>
              ))}
              {!filteredClients.length && (
                <Card className="rounded-[16px] border-[#d0d5dd] bg-[#fcfcfd] p-4 text-center text-sm text-[#667085]">No clients yet</Card>
              )}
            </div>
            {submitted && requiredErrors.client && <p className="text-xs font-semibold text-[#b42318]">{requiredErrors.client}</p>}
            <Button fullWidth onClick={() => setCreatingClient(true)} variant="outline">
              <Plus className="size-4" /> Create new client
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <Input label="Name *" placeholder="e.g. Sarah Johnson" value={newName} onChange={(event) => setNewName(event.target.value)} />
            {clientErrors.name && <p className="text-xs font-semibold text-[#b42318]">{clientErrors.name}</p>}
            <Input label="Phone number *" placeholder="e.g. +52 55 1234 5678" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
            {clientErrors.phone && <p className="text-xs font-semibold text-[#b42318]">{clientErrors.phone}</p>}
            <MutationError error={createClient.error} />
            <Button fullWidth loading={createClient.loading} onClick={() => void saveClient()}>Save client</Button>
            <Button fullWidth onClick={() => setCreatingClient(false)} variant="outline">Cancel</Button>
          </div>
        )}
      </Card>

      <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
        <label className="grid min-w-0 gap-2 text-[14px] font-semibold text-[#101828]">
          Day *
          <span className="text-[16px] font-bold text-[#0c111d]">{displayDate(date)}</span>
          <span className="relative block min-w-0 overflow-hidden rounded-[14px] border border-[#d0d5dd] bg-white">
            <span className="pointer-events-none flex min-h-[50px] min-w-0 items-center gap-3 pl-10 pr-3 text-[15px] font-bold text-[#101828]">
              <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7344cd]" />
              <span className="min-w-0 truncate">{compactDisplayDate(date)}</span>
            </span>
            <input
              className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
              min={minDate}
              onChange={(event) => onDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </span>
          {submitted && requiredErrors.date && <span className="text-xs font-semibold text-[#b42318]">{requiredErrors.date}</span>}
        </label>

        <label className="grid gap-2 text-[14px] font-semibold text-[#101828]">
          Time *
          <span className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7344cd]" />
            <select
              className="min-h-[50px] w-full appearance-none rounded-[14px] border border-[#d0d5dd] bg-white pl-10 pr-3 text-[15px] outline-none"
              onChange={(event) => onTimeChange(event.target.value)}
              value={time}
            >
              <option value="">Select time</option>
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </span>
          {providerId && !timeOptions.length && <span className="text-xs font-semibold text-[#b42318]">No available time for this provider and day.</span>}
          {submitted && requiredErrors.time && <span className="text-xs font-semibold text-[#b42318]">{requiredErrors.time}</span>}
        </label>

        <label className="grid gap-2 text-[14px] font-semibold text-[#101828]">
          Professional
          <span className="text-xs font-medium text-[#667085]">Optional</span>
            <select
              className="min-h-[50px] w-full appearance-none rounded-[14px] border border-[#d0d5dd] bg-white px-3 text-[15px] outline-none"
            onChange={(event) => onProviderChange(event.target.value)}
            value={providerId}
          >
            <option value="">No provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.full_name} · {provider.durationMinutes} min</option>
            ))}
          </select>
        </label>
      </Card>

      {conflictAlert}
      <MutationError error={conflictAlert ? null : error ?? null} />
      <Button
        className="min-h-[58px] rounded-[16px] text-[17px]"
        fullWidth
        loading={loading}
        onClick={() => {
          setSubmitted(true)
          if (requiredErrors.client || requiredErrors.date || requiredErrors.time) return
          onCreate()
        }}
      >
        Create appointment
      </Button>
    </div>
  )
}
