import type { SubscriptionSummary } from '../types/api'

const previewDateKey = 'glamhour:subscription-preview-date'

export function subscriptionPreviewDate() {
  if (typeof window === 'undefined') return ''
  const param = new URLSearchParams(window.location.search).get('previewDate')
  if (param === 'clear') {
    window.sessionStorage.removeItem(previewDateKey)
    return ''
  }
  if (param) {
    window.sessionStorage.setItem(previewDateKey, param)
    return param
  }
  return window.sessionStorage.getItem(previewDateKey) ?? ''
}

export function applySubscriptionPreview(summary: SubscriptionSummary) {
  const previewDateValue = subscriptionPreviewDate()
  if (!previewDateValue) return summary
  const currentPeriodEnd = summary.subscription?.currentPeriodEnd
  const previewDate = new Date(`${previewDateValue}T00:00:00`)
  const previewAfterCurrentPeriod = currentPeriodEnd
    ? previewDate.getTime() > new Date(currentPeriodEnd).getTime()
    : false

  if (!summary.subscription?.cancelAtPeriodEnd || !previewAfterCurrentPeriod) return summary

  const limit = 15
  return {
    ...summary,
    hasPremiumAccess: false,
    clientUsage: {
      count: summary.clientUsage.count,
      limit,
      nearLimit: summary.clientUsage.count >= Math.ceil(limit * 0.8),
      canCreateClient: summary.clientUsage.count < limit,
    },
  }
}
