import { ApiClientError } from '../../lib/api'

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function conflictDetails(error: Error) {
  if (!(error instanceof ApiClientError)) return null
  if (!error.details || typeof error.details !== 'object') return null
  const details = error.details as {
    conflictingAppointment?: {
      serviceName?: unknown
      startsAt?: unknown
      endsAt?: unknown
    }
    nextAvailableSlot?: {
      label?: unknown
    } | null
  }
  if (
    typeof details.conflictingAppointment?.serviceName !== 'string'
    || typeof details.conflictingAppointment.startsAt !== 'string'
    || typeof details.conflictingAppointment.endsAt !== 'string'
  ) {
    return null
  }
  return {
    conflictingAppointment: {
      serviceName: details.conflictingAppointment.serviceName,
      startsAt: details.conflictingAppointment.startsAt,
      endsAt: details.conflictingAppointment.endsAt,
    },
    nextAvailableLabel: typeof details.nextAvailableSlot?.label === 'string'
      ? details.nextAvailableSlot.label
      : null,
  }
}

export function MutationError({ error }: { error: Error | null }) {
  if (!error) return null
  const conflict = conflictDetails(error)
  if (conflict) {
    return (
      <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
        <p className="font-bold">{error.message}</p>
        <p className="mt-2 font-semibold">Current appointment: {conflict.conflictingAppointment.serviceName}</p>
        <p>{formatDate(conflict.conflictingAppointment.startsAt)}</p>
        <p>{formatTime(conflict.conflictingAppointment.startsAt)} - {formatTime(conflict.conflictingAppointment.endsAt)}</p>
        {conflict.nextAvailableLabel && (
          <p className="mt-2 font-semibold">Next available time: {conflict.nextAvailableLabel}</p>
        )}
      </div>
    )
  }
  return <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error.message}</p>
}
