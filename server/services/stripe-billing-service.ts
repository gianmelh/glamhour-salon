import crypto from 'node:crypto'
import type { QueryResultRow } from 'pg'
import { config } from '../config.js'
import { query, withTransaction } from '../db.js'
import { ApiError } from '../errors.js'

export type SubscriptionPlanCode = 'free' | 'premium_monthly' | 'premium_annual'

const FREE_CLIENT_LIMIT = 15
const premiumStatuses = new Set(['active', 'trialing', 'past_due'])
const UNDEFINED_TABLE = '42P01'

interface SubscriptionRow extends QueryResultRow {
  id: string
  salon_id: string
  plan_id: string
  plan_code: SubscriptionPlanCode
  plan_name: string
  billing_interval: 'none' | 'month' | 'year'
  price_minor: number
  currency_code: string
  entitlements_json: Record<string, unknown>
  provider: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_price_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
}

interface SalonBillingRow extends QueryResultRow {
  id: string
  name: string
  email: string | null
}

interface StripeSubscription {
  id: string
  status: string
  customer: string
  cancel_at_period_end: boolean
  current_period_start?: number
  current_period_end?: number
  canceled_at?: number | null
  items?: {
    data?: Array<{
      id: string
      current_period_start?: number
      current_period_end?: number
      price?: { id: string }
    }>
  }
}

interface StripeCheckoutSession {
  id: string
  client_secret?: string
  customer?: string
  subscription?: string
  status?: string
  metadata?: Record<string, string>
}

function requireStripeConfig() {
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_MONTHLY_PRICE_ID || !config.STRIPE_ANNUAL_PRICE_ID) {
    throw new ApiError(500, 'Stripe billing is not configured.')
  }
}

function appUrl() {
  return (config.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
}

function stripePriceId(planCode: SubscriptionPlanCode) {
  if (planCode === 'premium_monthly') return config.STRIPE_MONTHLY_PRICE_ID
  if (planCode === 'premium_annual') return config.STRIPE_ANNUAL_PRICE_ID
  return undefined
}

function stripePriceEnvName(planCode: SubscriptionPlanCode) {
  if (planCode === 'premium_monthly') return 'STRIPE_MONTHLY_PRICE_ID'
  if (planCode === 'premium_annual') return 'STRIPE_ANNUAL_PRICE_ID'
  return 'STRIPE_PRICE_ID'
}

function planCodeForPrice(priceId?: string | null): SubscriptionPlanCode {
  if (priceId && priceId === config.STRIPE_ANNUAL_PRICE_ID) return 'premium_annual'
  if (priceId && priceId === config.STRIPE_MONTHLY_PRICE_ID) return 'premium_monthly'
  return 'free'
}

function unixToIso(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null
}

function isDatabaseError(error: unknown, code: string) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === code
}

async function stripeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireStripeConfig()
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...init.headers,
    },
  })
  const body = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.message ?? 'Stripe request failed.')
  }
  return body
}

async function activeSubscription(salonId: string) {
  const rows = await query<SubscriptionRow>(
    `SELECT ss.*, ss.provider_subscription_id, ss.provider_customer_id, ss.provider_price_id,
            sp.code AS plan_code, sp.name AS plan_name, sp.billing_interval,
            sp.price_minor, sp.currency_code, sp.entitlements_json
     FROM salon_subscriptions ss
     JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.salon_id = $1
     ORDER BY
       CASE WHEN ss.status IN ('active', 'trialing', 'past_due') THEN 0
            WHEN ss.status = 'free' THEN 1
            ELSE 2 END,
       ss.updated_at DESC
     LIMIT 1`,
    [salonId],
  )
  return rows[0] ?? null
}

async function planId(planCode: SubscriptionPlanCode) {
  const rows = await query<{ id: string }>('SELECT id FROM subscription_plans WHERE code = $1 AND is_active LIMIT 1', [planCode])
  if (!rows[0]) throw new ApiError(500, `Subscription plan ${planCode} is not configured.`)
  return rows[0].id
}

async function ensureStripeCustomer(salonId: string) {
  const existing = await activeSubscription(salonId)
  if (existing?.provider_customer_id) return existing.provider_customer_id

  const salons = await query<SalonBillingRow>('SELECT id, name, email FROM salons WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [salonId])
  const salon = salons[0]
  if (!salon) throw new ApiError(404, 'Salon not found')

  const body = new URLSearchParams()
  body.set('name', salon.name)
  if (salon.email) body.set('email', salon.email)
  body.set('metadata[salonId]', salon.id)
  const customer = await stripeRequest<{ id: string }>('/customers', { method: 'POST', body })

  const freePlanId = await planId(existing?.plan_code ?? 'free')
  await query(
    `INSERT INTO salon_subscriptions (salon_id, plan_id, provider, provider_customer_id, status)
     VALUES ($1, $2, 'stripe', $3, 'free')
     ON CONFLICT (salon_id) WHERE status IN ('trialing', 'active', 'past_due', 'free')
     DO UPDATE SET provider_customer_id = COALESCE(salon_subscriptions.provider_customer_id, EXCLUDED.provider_customer_id),
                   provider = 'stripe',
                   updated_at = now()`,
    [salonId, freePlanId, customer.id],
  )

  return customer.id
}

async function upsertSubscriptionFromStripe(stripeSubscription: StripeSubscription, explicitSalonId?: string | null) {
  const item = stripeSubscription.items?.data?.[0]
  const priceId = item?.price?.id ?? null
  const currentPeriodStart = stripeSubscription.current_period_start ?? item?.current_period_start
  const currentPeriodEnd = stripeSubscription.current_period_end ?? item?.current_period_end
  const code = planCodeForPrice(priceId)
  const resolvedPlanId = await planId(code)
  const salonId = explicitSalonId ?? await resolveSalonIdForStripeCustomer(stripeSubscription.customer)
  if (!salonId) return

  if (code !== 'free') {
    await query(
      `UPDATE salon_subscriptions
       SET status = 'canceled', updated_at = now()
       WHERE salon_id = $1
         AND status = 'free'
         AND provider_subscription_id IS NULL`,
      [salonId],
    )
  }

  await query(
    `INSERT INTO salon_subscriptions (
       salon_id, plan_id, provider, provider_customer_id, provider_subscription_id,
       provider_price_id, status, current_period_start, current_period_end,
       cancel_at_period_end, canceled_at
     ) VALUES ($1, $2, 'stripe', $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL
     DO UPDATE SET plan_id = EXCLUDED.plan_id,
                   provider_customer_id = EXCLUDED.provider_customer_id,
                   provider_price_id = EXCLUDED.provider_price_id,
                   status = EXCLUDED.status,
                   current_period_start = EXCLUDED.current_period_start,
                   current_period_end = EXCLUDED.current_period_end,
                   cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                   canceled_at = EXCLUDED.canceled_at,
                   updated_at = now()`,
    [
      salonId,
      resolvedPlanId,
      stripeSubscription.customer,
      stripeSubscription.id,
      priceId,
      stripeSubscription.status,
      unixToIso(currentPeriodStart),
      unixToIso(currentPeriodEnd),
      stripeSubscription.cancel_at_period_end,
      unixToIso(stripeSubscription.canceled_at),
    ],
  )
}

async function resolveSalonIdForStripeCustomer(customerId: string) {
  const rows = await query<{ salon_id: string }>(
    `SELECT salon_id
     FROM salon_subscriptions
     WHERE provider_customer_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [customerId],
  )
  return rows[0]?.salon_id ?? null
}

export async function getSubscriptionSummary(salonId: string) {
  let subscription: SubscriptionRow | null = null
  try {
    subscription = await activeSubscription(salonId)
  } catch (error) {
    if (!isDatabaseError(error, UNDEFINED_TABLE)) {
      throw error
    }
  }
  const countRows = await query<{ count: string }>('SELECT count(*) FROM clients WHERE salon_id = $1 AND deleted_at IS NULL', [salonId])
  const clientCount = Number(countRows[0]?.count ?? 0)
  const periodEnded = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime() <= Date.now()
    : false
  const hasPremiumAccess = Boolean(
    subscription
    && subscription.plan_code !== 'free'
    && premiumStatuses.has(subscription.status)
    && !(subscription.cancel_at_period_end && periodEnded),
  )
  return {
    subscription: subscription ? {
      id: subscription.id,
      planCode: subscription.plan_code,
      planName: subscription.plan_name,
      billingInterval: subscription.billing_interval,
      priceMinor: Number(subscription.price_minor),
      currencyCode: subscription.currency_code,
      entitlements: subscription.entitlements_json,
      provider: subscription.provider,
      providerCustomerId: subscription.provider_customer_id,
      providerSubscriptionId: subscription.provider_subscription_id,
      providerPriceId: subscription.provider_price_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
    } : null,
    clientUsage: {
      count: clientCount,
      limit: hasPremiumAccess ? null : FREE_CLIENT_LIMIT,
      nearLimit: !hasPremiumAccess && clientCount >= Math.ceil(FREE_CLIENT_LIMIT * 0.8),
      canCreateClient: hasPremiumAccess || clientCount < FREE_CLIENT_LIMIT,
    },
    hasPremiumAccess,
  }
}

export async function getSyncedSubscriptionSummary(salonId: string) {
  const summary = await getSubscriptionSummary(salonId)
  if (
    summary.hasPremiumAccess
    && summary.subscription?.provider === 'stripe'
    && summary.subscription.providerSubscriptionId
    && !summary.subscription.currentPeriodEnd
  ) {
    return syncActiveStripeSubscription(salonId)
  }
  return summary
}

export async function getClientAccessPolicy(salonId: string) {
  const summary = await getSyncedSubscriptionSummary(salonId)
  return {
    hasPremiumAccess: summary.hasPremiumAccess,
    limit: summary.clientUsage.limit,
  }
}

export async function enforceCanCreateClient(salonId: string) {
  const summary = await getSyncedSubscriptionSummary(salonId)
  if (!summary.clientUsage.canCreateClient) {
    throw new ApiError(403, 'Free plan client limit reached. Upgrade to Premium to add unlimited clients.', summary.clientUsage)
  }
}

export async function createCheckoutSession(salonId: string, planCode: Exclude<SubscriptionPlanCode, 'free'>) {
  const priceId = stripePriceId(planCode)
  if (!priceId) throw new ApiError(500, `Stripe price is not configured. Missing ${stripePriceEnvName(planCode)}.`)
  const current = await activeSubscription(salonId)

  if (current?.provider_subscription_id && current.plan_code !== 'free' && premiumStatuses.has(current.status)) {
    return changeSubscriptionPlan(salonId, planCode)
  }

  const customerId = await ensureStripeCustomer(salonId)
  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  body.set('customer', customerId)
  body.set('line_items[0][price]', priceId)
  body.set('line_items[0][quantity]', '1')
  body.set('ui_mode', 'embedded')
  body.set('return_url', `${appUrl()}/app/settings/subscription/success?session_id={CHECKOUT_SESSION_ID}&plan=${planCode}`)
  body.set('redirect_on_completion', 'if_required')
  body.set('metadata[salonId]', salonId)
  body.set('metadata[planCode]', planCode)
  body.set('subscription_data[metadata][salonId]', salonId)
  body.set('subscription_data[metadata][planCode]', planCode)

  const session = await stripeRequest<StripeCheckoutSession>('/checkout/sessions', { method: 'POST', body })
  if (!session.client_secret) throw new ApiError(500, 'Stripe embedded checkout client secret was not returned.')
  return { clientSecret: session.client_secret, sessionId: session.id }
}

export async function syncCheckoutSession(salonId: string, sessionId: string) {
  const session = await stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`)
  const sessionSalonId = session.metadata?.salonId
  if (sessionSalonId && sessionSalonId !== salonId) {
    throw new ApiError(403, 'Stripe checkout session does not belong to this salon.')
  }
  if (session.subscription) {
    const subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${session.subscription}`)
    await upsertSubscriptionFromStripe(subscription, salonId)
  }
  return getSubscriptionSummary(salonId)
}

export async function syncActiveStripeSubscription(salonId: string) {
  const subscription = await activeSubscription(salonId)
  if (!subscription?.provider_subscription_id) return getSubscriptionSummary(salonId)
  const stripeSubscription = await stripeRequest<StripeSubscription>(`/subscriptions/${subscription.provider_subscription_id}`)
  await upsertSubscriptionFromStripe(stripeSubscription, salonId)
  return getSubscriptionSummary(salonId)
}

export async function createBillingPortalSession(salonId: string) {
  const customerId = await ensureStripeCustomer(salonId)
  const body = new URLSearchParams()
  body.set('customer', customerId)
  body.set('return_url', `${appUrl()}/app/settings/subscription`)
  return stripeRequest<{ url: string }>('/billing_portal/sessions', { method: 'POST', body })
}

export async function changeSubscriptionPlan(salonId: string, planCode: Exclude<SubscriptionPlanCode, 'free'>) {
  const subscription = await activeSubscription(salonId)
  if (!subscription?.provider_subscription_id) throw new ApiError(400, 'No active Stripe subscription was found.')
  if (subscription.plan_code === planCode && premiumStatuses.has(subscription.status)) {
    return { changed: false }
  }
  const stripeSubscription = await stripeRequest<StripeSubscription>(`/subscriptions/${subscription.provider_subscription_id}`)
  const itemId = stripeSubscription.items?.data?.[0]?.id
  const priceId = stripePriceId(planCode)
  if (!itemId || !priceId) throw new ApiError(500, 'Stripe subscription item could not be resolved.')

  const body = new URLSearchParams()
  body.set('items[0][id]', itemId)
  body.set('items[0][price]', priceId)
  body.set('proration_behavior', 'create_prorations')
  body.set('metadata[planCode]', planCode)
  const updated = await stripeRequest<StripeSubscription>(`/subscriptions/${subscription.provider_subscription_id}`, { method: 'POST', body })
  await upsertSubscriptionFromStripe(updated, salonId)
  return { changed: true }
}

export async function cancelSubscription(salonId: string) {
  const subscription = await activeSubscription(salonId)
  if (!subscription?.provider_subscription_id) throw new ApiError(400, 'No active Stripe subscription was found.')
  const body = new URLSearchParams()
  body.set('cancel_at_period_end', 'true')
  const updated = await stripeRequest<StripeSubscription>(`/subscriptions/${subscription.provider_subscription_id}`, { method: 'POST', body })
  await upsertSubscriptionFromStripe(updated, salonId)
  return getSubscriptionSummary(salonId)
}

export async function reactivateSubscription(salonId: string) {
  const subscription = await activeSubscription(salonId)
  if (!subscription?.provider_subscription_id) throw new ApiError(400, 'No active Stripe subscription was found.')
  const body = new URLSearchParams()
  body.set('cancel_at_period_end', 'false')
  const updated = await stripeRequest<StripeSubscription>(`/subscriptions/${subscription.provider_subscription_id}`, { method: 'POST', body })
  await upsertSubscriptionFromStripe(updated, salonId)
  return getSubscriptionSummary(salonId)
}

export function verifyStripeWebhookSignature(rawBody: Buffer, signatureHeader?: string) {
  if (!config.STRIPE_WEBHOOK_SECRET) throw new ApiError(500, 'Stripe webhook secret is not configured.')
  if (!signatureHeader) throw new ApiError(400, 'Missing Stripe signature.')
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, value] = part.split('=')
    return [key, value]
  }))
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) throw new ApiError(400, 'Invalid Stripe signature.')
  const expected = crypto
    .createHmac('sha256', config.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw new ApiError(400, 'Invalid Stripe signature.')
  }
}

export async function handleStripeWebhook(rawBody: Buffer, signatureHeader?: string) {
  verifyStripeWebhookSignature(rawBody, signatureHeader)
  const event = JSON.parse(rawBody.toString('utf8')) as {
    id: string
    type: string
    data: { object: Record<string, unknown> }
  }

  return withTransaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO stripe_webhook_events (id, event_type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
      [event.id, event.type],
    )
    if (!inserted.rows[0]) return { received: true, duplicate: true }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as unknown as StripeCheckoutSession
      if (session.subscription) {
        const subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${session.subscription}`)
        await upsertSubscriptionFromStripe(subscription, session.metadata?.salonId)
      }
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      await upsertSubscriptionFromStripe(event.data.object as unknown as StripeSubscription)
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as { subscription?: string }
      if (invoice.subscription) {
        const subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${invoice.subscription}`)
        await upsertSubscriptionFromStripe(subscription)
      }
    }

    return { received: true }
  })
}
