import type { OnboardingDayInput, ProfessionalWithNailSettings, UpsertProfessionalInput } from '../../types/api'
import { normalizeLanguages, normalizeProviderSchedule } from '../../lib/provider-settings'

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

export function normalizeProfessionalDraft(draft: ProfessionalDraft, salonSchedule: Record<string, OnboardingDayInput>): ProfessionalDraft {
  return {
    ...draft,
    languages: normalizeLanguages(draft.languages),
    schedule: draft.useSalonSchedule ? salonSchedule : normalizeProviderSchedule(draft.schedule ?? salonSchedule),
  }
}

export function professionalDraftFromProvider(provider: ProfessionalWithNailSettings, salonSchedule: Record<string, OnboardingDayInput>): ProfessionalDraft {
  return normalizeProfessionalDraft({
    id: provider.id,
    fullName: provider.full_name,
    email: provider.email ?? '',
    phone: provider.phone ?? '',
    avatarUrl: provider.avatar_url,
    languages: provider.languages,
    status: provider.status === 'inactive' ? 'inactive' : 'active',
    salonEarningsPercent: Number(provider.salon_earnings_percent),
    professionalEarningsPercent: Number(provider.professional_earnings_percent),
    useSalonSchedule: provider.use_salon_schedule,
    schedule: provider.schedule,
    serviceAssignments: provider.service_assignments.map((assignment) => ({
      serviceId: assignment.service_id,
      isActive: assignment.is_active,
      durationOverrideMinutes: assignment.duration_override_minutes,
      priceOverrideMinor: assignment.price_override_minor,
    })),
  }, salonSchedule)
}
