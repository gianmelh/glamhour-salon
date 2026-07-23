import type { Service, ServiceCategory } from '../../../types/api'

export type BookingStep = 'categories' | 'service' | 'client' | 'health' | 'appointment-details' | 'provider' | 'time' | 'review' | 'success'

export type BookingCategoryCode = 'nails' | 'lashes' | 'cosmetology' | 'micropigmentation'

export type HandName = 'rightHand' | 'leftHand'
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'

export type TreatmentMediaItem = {
  storageKey: string
  url: string
  mimeType: string
  mediaType: 'reference' | 'before' | 'after' | 'diagram' | 'signature' | 'other'
  originalFilename?: string
}

export type AppointmentDraft = {
  categoryId: string
  categoryCode: string
  serviceId: string
  clientId: string
  providerId: string
  date: string
  startsAt: string
  endsAt: string
  notes: string
  details: Record<string, unknown>
}

export type DraftPatch = Omit<Partial<AppointmentDraft>, 'details'> & {
  details?: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)
}

export type CategoryStepProps = {
  services: Service[]
  selectedServiceId: string
  details: Record<string, unknown>
  onChange: (patch: DraftPatch) => void
  onBack: () => void
  onNext: () => void
}

export type ServiceStepProps = CategoryStepProps & {
  category: ServiceCategory
}
