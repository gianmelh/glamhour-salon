export interface PublicBookingShareSettings {
  whatsappPhone: string
  smsPhone: string
  facebookUrl: string
  instagramUrl: string
}

export const emptyPublicBookingShareSettings: PublicBookingShareSettings = {
  whatsappPhone: '',
  smsPhone: '',
  facebookUrl: '',
  instagramUrl: '',
}

export function publicBookingShareSettings(settingsJson: Record<string, unknown> | undefined): PublicBookingShareSettings {
  const raw = settingsJson?.publicBookingShare
  if (!raw || typeof raw !== 'object') return emptyPublicBookingShareSettings
  const value = raw as Record<string, unknown>
  return {
    whatsappPhone: typeof value.whatsappPhone === 'string' ? value.whatsappPhone : '',
    smsPhone: typeof value.smsPhone === 'string' ? value.smsPhone : '',
    facebookUrl: typeof value.facebookUrl === 'string' ? value.facebookUrl : '',
    instagramUrl: typeof value.instagramUrl === 'string' ? value.instagramUrl : '',
  }
}

export function mergePublicBookingShareSettings(
  current: Record<string, unknown>,
  next: PublicBookingShareSettings,
) {
  return {
    ...current,
    publicBookingShare: {
      whatsappPhone: next.whatsappPhone.trim(),
      smsPhone: next.smsPhone.trim(),
      facebookUrl: next.facebookUrl.trim(),
      instagramUrl: next.instagramUrl.trim(),
    },
  }
}

export function phoneForUrl(phone: string) {
  return phone.replace(/[^\d]/g, '')
}
