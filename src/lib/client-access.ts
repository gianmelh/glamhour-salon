import type { Client, SubscriptionSummary } from '../types/api'

export function applyClientAccess(clients: Client[], subscription?: SubscriptionSummary) {
  const limit = subscription?.clientUsage.limit
  const hasLimit = typeof limit === 'number'
  const shouldLockExtraClients = Boolean(subscription && !subscription.hasPremiumAccess && hasLimit && clients.length > limit)
  if (!shouldLockExtraClients || !limit) {
    return clients.map((client) => ({ ...client, subscription_locked: false }))
  }

  const enabledIds = new Set(
    [...clients]
      .sort((a, b) => {
        const byDate = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        return byDate || a.id.localeCompare(b.id)
      })
      .slice(0, limit)
      .map((client) => client.id),
  )

  return clients.map((client) => ({
    ...client,
    subscription_locked: !enabledIds.has(client.id),
  }))
}

export function clientUsageLabel(totalClients: number, subscription?: SubscriptionSummary) {
  const limit = subscription?.clientUsage.limit
  if (typeof limit === 'number') return `${subscription?.clientUsage.count ?? totalClients} / ${limit}`
  return String(totalClients)
}
