import type { OnboardingDayInput } from '../types/api.js'

export const providerWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const providerLanguageOptions = ['English', 'Spanish', 'Portuguese']

const languageAliases = new Map([
  ['en', 'English'], ['english', 'English'],
  ['es', 'Spanish'], ['spanish', 'Spanish'],
  ['pt', 'Portuguese'], ['portuguese', 'Portuguese'],
])

// Older onboarding records contain codes; provider settings used display names.
// Expose only supported languages, using the same labels across the application.
export function normalizeLanguages(languages: string[]): string[] {
  const seen = new Set<string>()
  return languages.flatMap((language) => {
    const trimmed = language.trim()
    const canonical = languageAliases.get(trimmed.toLowerCase())
    if (!canonical) return []
    const key = canonical.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [canonical]
  })
}

export function providerLanguageCode(language: string): string {
  switch (normalizeLanguages([language])[0]) {
    case 'English': return 'EN'
    case 'Spanish': return 'ES'
    case 'Portuguese': return 'PT'
    default: return ''
  }
}

export type ProviderSchedule = Record<string, OnboardingDayInput>
const isScheduleTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export function normalizeProviderSchedule(schedule: ProviderSchedule | undefined): ProviderSchedule {
  return Object.fromEntries(providerWeekdays.map((day) => {
    const providerDay = schedule?.[day] ?? { enabled: false, open: '09:00', close: '18:00' }
    const enabled = providerDay.enabled
    return [day, {
      ...providerDay,
      enabled,
      // A cleared field on a day that is then disabled should not prevent saving.
      open: enabled || isScheduleTime(providerDay.open) ? providerDay.open : '09:00',
      close: enabled || isScheduleTime(providerDay.close) ? providerDay.close : '18:00',
    }]
  }))
}

export function providerScheduleErrors(schedule: ProviderSchedule): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const day of providerWeekdays) {
    const value = schedule[day]
    if (!value?.enabled) continue
    if (!isScheduleTime(value.open) || !isScheduleTime(value.close) || value.open >= value.close) {
      errors[day] = 'Enter an opening time before the closing time.'
    }
  }
  return errors
}
