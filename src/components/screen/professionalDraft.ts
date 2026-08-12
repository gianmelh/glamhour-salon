import type { OnboardingDayInput, UpsertProfessionalInput } from '../../types/api'

export type ProfessionalDraft = UpsertProfessionalInput & { id?: string; photoName?: string }

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const defaultSalonSchedule: Record<string, OnboardingDayInput> = Object.fromEntries(
  weekdays.map((day) => [day, { enabled: day !== 'Sunday', open: '09:00', close: '18:00' }]),
)

export function emptyProfessionalDraft(salonSchedule = defaultSalonSchedule): ProfessionalDraft {
  return {
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: null,
    languages: ['English'],
    status: 'active',
    salonEarningsPercent: 40,
    professionalEarningsPercent: 60,
    useSalonSchedule: true,
    schedule: salonSchedule,
    serviceAssignments: [],
  }
}
