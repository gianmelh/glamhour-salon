import { PUBLIC_BOOKING_BASE_URL } from '../services/glamhour-api'

function publicBookingBaseUrl() {
  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location
    if (hostname === 'glamhour.app' || hostname.endsWith('.glamhour.app')) {
      return origin.replace(/\/+$/, '')
    }
  }

  return PUBLIC_BOOKING_BASE_URL
}

export function publicBookingUrl(slug: string) {
  const safeSlug = encodeURIComponent(slug)
  return `${publicBookingBaseUrl()}/${safeSlug}`
}

export function publicBookingShareMessage(bookingUrl: string) {
  return `Book your appointment with us: ${bookingUrl}`
}
