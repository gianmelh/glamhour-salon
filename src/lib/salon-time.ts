export const DEFAULT_SALON_TIMEZONE = 'America/Merida'

export function normalizeTimeZone(timeZone?: string | null) {
  const candidate = timeZone || DEFAULT_SALON_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_SALON_TIMEZONE
  }
}

function datePartsFromIsoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

function partsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function offsetInTimeZone(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone)
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return zonedAsUtc - date.getTime()
}

export function zonedDateTimeToIso(date: string, time: string, timeZone: string) {
  const { year, month, day } = datePartsFromIsoDate(date)
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  const wallTimeAsUtc = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0)
  const firstPass = new Date(wallTimeAsUtc - offsetInTimeZone(new Date(wallTimeAsUtc), timeZone))
  const secondPass = new Date(wallTimeAsUtc - offsetInTimeZone(firstPass, timeZone))
  return secondPass.toISOString()
}

export function addMinutesIso(value: string, minutes: number) {
  const date = new Date(value)
  return new Date(date.getTime() + minutes * 60_000).toISOString()
}

export function zonedDateString(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = partsInTimeZone(date, timeZone)
  return [
    parts.year,
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

export function zonedTimeParts(value: string | Date, timeZone: string) {
  return partsInTimeZone(value instanceof Date ? value : new Date(value), timeZone)
}

export function formatZonedTime(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

export function formatZonedDate(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value instanceof Date ? value : new Date(value))
}
