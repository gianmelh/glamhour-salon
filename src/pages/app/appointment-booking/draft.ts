import type { AppointmentDraft, BookingStep } from './types'
import { sanitizeDetailsForCategory } from './categoryDetails'

export const APPOINTMENT_DRAFT_KEY = 'glamhour:new-appointment-draft'

export const todayString = () => new Date().toISOString().slice(0, 10)

export const emptyDraft = (): AppointmentDraft => ({
  categoryId: '',
  categoryCode: '',
  serviceId: '',
  clientId: '',
  providerId: '',
  date: todayString(),
  startsAt: '',
  endsAt: '',
  notes: '',
  details: {},
})

export function readDraft(): AppointmentDraft {
  if (typeof window === 'undefined') return emptyDraft()
  try {
    const draft = { ...emptyDraft(), ...JSON.parse(window.sessionStorage.getItem(APPOINTMENT_DRAFT_KEY) ?? '{}') } as AppointmentDraft
    if (draft.categoryCode) {
      draft.details = sanitizeDetailsForCategory(draft.categoryCode, draft.details ?? {})
    } else {
      draft.details = {}
    }
    return draft
  } catch {
    return emptyDraft()
  }
}

export function initialBookingStep(draft: AppointmentDraft): BookingStep {
  if (draft.categoryCode && draft.clientId && draft.serviceId && draft.providerId && draft.startsAt) return 'review'
  if (draft.categoryCode && draft.clientId && draft.serviceId) return 'appointment-details'
  if (draft.categoryCode && draft.clientId) return 'health'
  if (draft.categoryCode) return 'client'
  return 'categories'
}
