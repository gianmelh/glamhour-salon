import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Sparkles, UsersRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, ErrorState, LoadingState } from '../../components'
import { useSubscription } from '../../hooks/useGlamhourData'
import { glamhourApi } from '../../services/glamhour-api'
import type { SubscriptionPlanCode } from '../../types/api'

type PremiumPlan = Exclude<SubscriptionPlanCode, 'free'>
type EmbeddedCheckoutInstance = { mount: (selector: string | HTMLElement) => void; destroy: () => void }

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      initEmbeddedCheckout: (options: { fetchClientSecret: () => Promise<string>; onComplete?: () => void | Promise<void> }) => Promise<EmbeddedCheckoutInstance>
    }
  }
}

const premiumFeatures = [
  'Unlimited clients',
  'Appointment management',
  'Shareable salon link',
  'Service history',
  'Team dashboard',
  'Access to all current Premium features',
  'First access to new features',
  'Priority support',
]

const freeFeatures = [
  'Up to 15 registered clients',
  'Appointment management',
  'Shareable salon link',
  'Service history',
  'Team dashboard',
]

export function SubscriptionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const subscription = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState('')
  const [actionError, setActionError] = useState<Error | null>(null)
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState('')
  const [embeddedSessionId, setEmbeddedSessionId] = useState('')
  const mode = location.pathname.endsWith('/success')
    ? 'success'
    : location.pathname.endsWith('/cancel')
      ? 'cancel'
      : 'default'
  const successSearchParams = new URLSearchParams(location.search)
  const successPlanParam = successSearchParams.get('plan')
  const successSessionId = successSearchParams.get('session_id')

  const summary = subscription.data
  const currentPlan = summary?.subscription?.planCode ?? 'free'
  const effectivePlan = summary?.hasPremiumAccess ? currentPlan : 'free'
  const isPremium = summary?.hasPremiumAccess ?? false
  const currentPeriodEnd = summary?.subscription?.currentPeriodEnd
  const selectedPlanDetails = useMemo(() => selectedPlan ? planDetails(selectedPlan) : null, [selectedPlan])
  const successPlan = successPlanParam === 'premium_annual' || successPlanParam === 'premium_monthly'
    ? successPlanParam
    : currentPlan === 'premium_annual' || currentPlan === 'premium_monthly'
      ? currentPlan
      : selectedPlan ?? 'premium_monthly'

  useEffect(() => {
    if (mode !== 'success' || !successSessionId) return
    let active = true
    glamhourApi.syncSubscriptionCheckout(successSessionId)
      .then((nextSummary) => {
        if (active) subscription.setData(nextSummary)
      })
      .catch((reason) => {
        if (active) setActionError(reason instanceof Error ? reason : new Error('Subscription could not be synced.'))
      })
    return () => { active = false }
  }, [mode, successSessionId])

  if (subscription.loading) return <LoadingState label="Loading subscription..." />
  if (!summary) return <ErrorState description={subscription.error?.message ?? 'Subscription could not be loaded.'} onRetry={subscription.retry} />

  const beginCheckout = async (planCode: PremiumPlan) => {
    setActionError(null)
    setLoadingAction(planCode)
    try {
      const result = await glamhourApi.createSubscriptionCheckout(planCode)
      if (result.clientSecret) {
        setEmbeddedClientSecret(result.clientSecret)
        setEmbeddedSessionId(result.sessionId ?? '')
        return
      }
      await subscription.retry()
      setSelectedPlan(null)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('Checkout could not be started.'))
    } finally {
      setLoadingAction('')
    }
  }

  const cancelPremium = async () => {
    setActionError(null)
    setLoadingAction('cancel')
    try {
      subscription.setData(await glamhourApi.cancelSubscription())
      setCancelOpen(false)
      navigate('/app/settings/subscription/cancel')
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('Subscription could not be canceled.'))
    } finally {
      setLoadingAction('')
    }
  }

  const reactivatePremium = async () => {
    setActionError(null)
    setLoadingAction('reactivate')
    try {
      subscription.setData(await glamhourApi.reactivateSubscription())
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('Subscription could not be reactivated.'))
    } finally {
      setLoadingAction('')
    }
  }

  if (mode === 'success') {
    return <PremiumSuccessScreen onBack={() => navigate('/app/settings')} planCode={successPlan} />
  }

  if (mode === 'cancel') {
    return (
      <PremiumCanceledScreen
        onBack={() => navigate('/app/settings')}
        onViewPlans={() => navigate('/app/settings/subscription')}
        planCode={currentPlan === 'premium_annual' ? 'premium_annual' : 'premium_monthly'}
      />
    )
  }

  if (selectedPlanDetails) {
    const planToCheckout = selectedPlan
    if (!planToCheckout) return null
    return (
      <SubscriptionShell title="Choose Your Premium Plan" onBack={() => {
        setEmbeddedClientSecret('')
        setEmbeddedSessionId('')
        setSelectedPlan(null)
      }}>
        <p className="mb-5 text-[15px] leading-5 text-[#475467]">No ads, no surprises. Choose the payment frequency you prefer.</p>

        <div className="space-y-4">
          <PremiumChoiceCard
            billing="annual"
            checked={planToCheckout === 'premium_annual'}
            onClick={() => {
              setEmbeddedClientSecret('')
              setEmbeddedSessionId('')
              setSelectedPlan('premium_annual')
            }}
          />
          <PremiumChoiceCard
            billing="monthly"
            checked={planToCheckout === 'premium_monthly'}
            onClick={() => {
              setEmbeddedClientSecret('')
              setEmbeddedSessionId('')
              setSelectedPlan('premium_monthly')
            }}
          />

          <Card className="space-y-3 rounded-[14px] border-[#d0d5dd] bg-white p-4 shadow-none">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#7c3aed]" />
              <p className="text-[15px] font-extrabold leading-5 text-[#101827]">Everything included in Premium</p>
            </div>
            <div className="space-y-2.5">
              <Feature accent>Unlimited clients with no restrictions</Feature>
              <Feature accent>Access to all current features</Feature>
              <Feature accent>First to access new features</Feature>
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-md bg-white px-4 py-3 text-[11px] leading-4 text-[#667085]">
            <img alt="" className="mt-1 size-3.5 shrink-0" src="/Glamhour - Assets/Settings/account/my subscription/Icon.svg" />
            <p>Payment will be processed securely by Stripe. Prices may vary by region.</p>
          </div>

          {actionError && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{actionError.message}</p>}
          {embeddedClientSecret ? (
            <EmbeddedStripeCheckout
              clientSecret={embeddedClientSecret}
              onComplete={async () => {
                if (embeddedSessionId) {
                  subscription.setData(await glamhourApi.syncSubscriptionCheckout(embeddedSessionId))
                } else {
                  await subscription.retry()
                }
                navigate(`/app/settings/subscription/success?plan=${planToCheckout}${embeddedSessionId ? `&session_id=${encodeURIComponent(embeddedSessionId)}` : ''}`)
              }}
            />
          ) : (
            <Button className="min-h-[50px] rounded-[12px] text-[14px] font-bold shadow-[0_12px_20px_rgb(76_29_149_/_0.24)]" fullWidth loading={loadingAction === planToCheckout} onClick={() => beginCheckout(planToCheckout)}>
              {selectedPlanDetails.cta}
            </Button>
          )}
          <Button className="min-h-[50px] rounded-[12px] bg-white text-[14px] font-bold text-[#7c3aed] shadow-[0_10px_18px_rgb(16_24_39_/_0.1)] hover:bg-white" fullWidth onClick={() => {
            setEmbeddedClientSecret('')
            setEmbeddedSessionId('')
            setSelectedPlan(null)
          }} variant="secondary">
            Back to plans
          </Button>
        </div>
      </SubscriptionShell>
    )
  }

  return (
    <SubscriptionShell title={isPremium ? 'My Subscription' : 'My Subscription'} onBack={() => navigate('/app/settings')}>
      <p className="text-xs leading-5 text-muted">Choose the plan that best fits your salon&apos;s needs.</p>
      {!isPremium && (
        <div className="mt-5 flex gap-3 rounded-md border border-[#f7a81b] bg-[#fff3d9] px-4 py-3 text-[#101827]">
          <UsersRound className="mt-0.5 size-4 shrink-0 text-[#f79009]" />
          <p className="text-[11px] font-medium leading-4">
            You have {summary.clientUsage.count} of 15 clients on the free plan. {summary.clientUsage.canCreateClient ? summary.clientUsage.nearLimit ? 'Near the limit.' : '' : 'Limit reached.'}
          </p>
        </div>
      )}
      {actionError && <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{actionError.message}</p>}
      <div className="mt-5 space-y-5">
        <PlanCard
          badge={effectivePlan === 'free' ? 'Current Plan' : undefined}
          cta={currentPlan === 'free' ? 'Continue' : 'Continue'}
          disabled={effectivePlan === 'free'}
          features={freeFeatures}
          name="Free"
          onClick={() => navigate('/app/settings')}
          priceMain="$0"
          priceSuffix="/ month"
          subtitle="Everything you need to start managing your salon."
        />
        <PlanCard
          badge={effectivePlan === 'premium_monthly' ? 'Current Plan' : undefined}
          cta={effectivePlan === 'premium_monthly' ? 'Current Plan' : effectivePlan === 'premium_annual' ? 'Change to Monthly Premium' : 'Get Started'}
          disabled={effectivePlan === 'premium_monthly'}
          features={premiumFeatures.slice(0, 5)}
          loading={loadingAction === 'premium_monthly'}
          name="Monthly Premium"
          onClick={() => setSelectedPlan('premium_monthly')}
          priceMain="$14.99"
          priceSuffix="/ month"
          subtitle="Full access without restrictions, billed monthly."
        />
        <PlanCard
          annual
          badge="Recommended"
          cta={effectivePlan === 'premium_annual' ? 'Current Plan' : effectivePlan === 'premium_monthly' ? 'Change to Annual Premium' : 'Get Started'}
          disabled={effectivePlan === 'premium_annual'}
          features={premiumFeatures.slice(0, 5)}
          loading={loadingAction === 'premium_annual'}
          name="Annual Premium"
          onClick={() => setSelectedPlan('premium_annual')}
          priceMain="$9.99"
          priceSuffix="/ month"
          description="Best price-value ratio. Premium access all year without interruptions."
          savings="Save 33%"
          subtitle="$119.99 billed annually"
        />
      </div>

      {isPremium && (
        <Card className="mt-4 space-y-4">
          <p className="text-sm font-bold">Payment Information</p>
          <DetailRow label="Billing Cycle" value={currentPlan === 'premium_annual' ? '$119.99 / year' : '$14.99 / month'} />
          <DetailRow label="Next Charge / Renewal" value={currentPeriodEnd ? formatDate(currentPeriodEnd) : 'Pending Stripe sync'} />
          {summary.subscription?.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning">
              Premium access continues until {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'the end of your billing period'}.
            </div>
          )}
          {summary.subscription?.cancelAtPeriodEnd ? (
            <Button fullWidth loading={loadingAction === 'reactivate'} onClick={reactivatePremium}>Keep Premium</Button>
          ) : (
            <div className="rounded-lg border border-danger/20 bg-danger-soft p-3">
              <p className="text-xs font-bold text-danger">Danger Zone</p>
              <p className="mt-1 text-xs leading-5 text-danger">Premium access continues until the end of your current paid billing period.</p>
              <Button className="mt-3" fullWidth onClick={() => setCancelOpen(true)} variant="danger">Cancel Subscription</Button>
            </div>
          )}
        </Card>
      )}

      <div className="mt-5 flex items-start justify-center gap-2 rounded-md bg-white px-4 py-3 text-center text-[11px] leading-4 text-[#667085] shadow-card">
        <img alt="" className="mt-0.5 size-3.5 shrink-0" src="/Glamhour - Assets/Settings/account/my subscription/Icon.svg" />
        <p>Payments and renewals are securely processed by Stripe. Glamhour does not store your card information.</p>
      </div>

      {cancelOpen && (
        <div aria-modal="true" className="fixed left-1/2 top-0 z-50 h-dvh w-full max-w-[393px] -translate-x-1/2 bg-[#101828]/40 sm:top-6 sm:h-[calc(100dvh-48px)]" role="dialog">
          <button aria-label="Close cancel premium" className="absolute inset-0" onClick={() => setCancelOpen(false)} type="button" />
          <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-[14px] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_30px_rgb(16_24_39_/_0.16)]">
            <button aria-label="Close" className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-[#f2f4f7] text-[15px] text-[#667085]" onClick={() => setCancelOpen(false)} type="button">×</button>
            <span className="grid size-11 place-items-center rounded-[12px] bg-[#fff1f1] text-[#ff3b30]">
              <AlertTriangle className="size-5" />
            </span>
            <h2 className="mt-5 text-[20px] font-extrabold leading-6 text-[#101827]">Cancel Premium?</h2>
            <p className="mt-3 text-[13px] leading-5 text-[#475467]">
              If you cancel, your Premium access will continue until {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'the end of your billing period'}. After that, your account will revert to the free plan with its limitations.
            </p>
            <div className="mt-5 rounded-[8px] border border-[#ffb4ad] bg-[#fff8f8] px-4 py-3 text-left">
              <p className="text-[12px] font-bold text-[#ff3b30]">What you&apos;ll lose by canceling:</p>
              <p className="mt-2 text-[11px] leading-4 text-[#344054]">
                <span className="mr-2 font-bold text-[#ff3b30]">×</span>
                Unlimited clients (reverts to 15 limit)
              </p>
            </div>
            <div className="mt-8 grid gap-2.5">
              <Button className="min-h-[48px] rounded-[12px] text-[14px] font-medium shadow-[0_12px_20px_rgb(76_29_149_/_0.24)]" fullWidth onClick={() => setCancelOpen(false)}>
                Keep premium
              </Button>
              <Button className="min-h-[48px] rounded-[12px] bg-[#f4f6ff] text-[14px] font-medium text-[#7c3aed] shadow-[0_10px_18px_rgb(16_24_39_/_0.1)] hover:bg-[#f4f6ff]" fullWidth loading={loadingAction === 'cancel'} onClick={cancelPremium} variant="secondary">
                Yes, cancel subscription
              </Button>
            </div>
          </section>
        </div>
      )}
    </SubscriptionShell>
  )
}

function PremiumSuccessScreen({ onBack, planCode }: { onBack: () => void; planCode: PremiumPlan }) {
  const annual = planCode === 'premium_annual'
  return (
    <div className="flex min-h-full flex-col bg-[#f2f5ff] px-5 pb-6 pt-[136px]">
      <section className="text-center">
        <span className="mx-auto grid size-[78px] place-items-center rounded-full bg-[#d9f8e7]">
          <span className="grid size-8 place-items-center rounded-full border-[3px] border-[#12b76a] text-[#12b76a]">
            <Check className="size-5 stroke-[3]" />
          </span>
        </span>
        <h1 className="mt-9 text-[23px] font-extrabold leading-7 text-[#101827]">Premium Activated!</h1>
        <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-5 text-[#667085]">
          Your subscription is active. You can now enjoy all the benefits of the Premium plan.
        </p>
      </section>

      <section className="mt-9 space-y-4">
        <div className="rounded-[13px] border border-[#d0d5dd] bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-extrabold leading-5 text-[#101827]">{annual ? 'Annual Premium' : 'Monthly Premium'}</p>
            <span className="rounded-md bg-[#dcfae6] px-2.5 py-1 text-[11px] font-bold text-[#12b76a]">Active</span>
          </div>
          <p className="mt-4 text-[20px] font-extrabold leading-6 text-[#7c3aed]">
            {annual ? '$119.99 / year' : '$14.99 / month'}
          </p>
        </div>

        <div className="flex min-h-[52px] items-center gap-3 rounded-[10px] border border-[#d0d5dd] bg-white px-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[#7c3aed] text-white">
            <UsersRound className="size-4" />
          </span>
          <p className="text-[14px] font-bold text-[#101827]">Unlimited clients</p>
        </div>
      </section>

      <div className="mt-auto pt-8">
        <Button className="min-h-[54px] rounded-[12px] text-[14px] font-bold shadow-[0_12px_20px_rgb(76_29_149_/_0.28)]" fullWidth onClick={onBack}>
          Go back to settings
        </Button>
      </div>
    </div>
  )
}

function PremiumCanceledScreen({ onBack, onViewPlans, planCode }: { onBack: () => void; onViewPlans: () => void; planCode: PremiumPlan }) {
  const annual = planCode === 'premium_annual'
  return (
    <div className="flex min-h-full flex-col bg-[#f2f5ff] px-5 pb-6 pt-[116px]">
      <section className="text-center">
        <span className="mx-auto grid size-[78px] place-items-center rounded-full bg-[#ffefbd] text-[#f59e0b]">
          <AlertTriangle className="size-8 stroke-[1.8]" />
        </span>
        <h1 className="mt-8 text-[23px] font-extrabold leading-7 text-[#101827]">Premium Canceled</h1>
        <p className="mx-auto mt-3 max-w-[275px] text-[13px] leading-5 text-[#667085]">
          Your subscription has been canceled. Your account will revert to the free plan at the end of the current billing period.
        </p>
      </section>

      <section className="mt-9 space-y-4">
        <div className="rounded-[13px] border border-[#d0d5dd] bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-extrabold leading-5 text-[#101827]">{annual ? 'Annual Premium' : 'Monthly Premium'}</p>
            <span className="rounded-md bg-[#dcfae6] px-2.5 py-1 text-[11px] font-bold text-[#12b76a]">Active</span>
          </div>
          <p className="mt-4 text-[20px] font-extrabold leading-6 text-[#7c3aed]">
            {annual ? '$119.99 / year' : '$14.99 / month'}
          </p>
        </div>

        <div className="rounded-[13px] border border-[#d0d5dd] bg-white px-4 py-4">
          <p className="text-[11px] font-extrabold leading-4 text-[#101827]">What changes in your account</p>
          <div className="mt-4 flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[#7c3aed] text-white">
              <UsersRound className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold leading-5 text-[#101827]">15 client limit</p>
              <p className="mt-1 text-[11px] leading-4 text-[#667085]">
                You will only be able to have 15 active registered clients. If you have more, you won&apos;t be able to add new ones until you reduce the number.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-auto grid gap-3 pt-8">
        <Button className="min-h-[54px] rounded-[12px] text-[14px] font-bold shadow-[0_12px_20px_rgb(76_29_149_/_0.28)]" fullWidth onClick={onBack}>
          Back to settings
        </Button>
        <Button className="min-h-[54px] rounded-[12px] bg-[#f4f6ff] text-[14px] font-bold text-[#7c3aed] shadow-[0_10px_18px_rgb(16_24_39_/_0.1)] hover:bg-[#f4f6ff]" fullWidth onClick={onViewPlans} variant="secondary">
          View subscription plans
        </Button>
      </div>
    </div>
  )
}

function SubscriptionShell({ children, onBack, title }: { children: React.ReactNode; onBack: () => void; title: string }) {
  return (
    <div className="min-h-full bg-[#f2f5ff] px-4 pb-6 pt-5">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <button aria-label="Back" className="-ml-1 grid size-8 place-items-center text-[#101827]" onClick={onBack} type="button"><ArrowLeft className="size-7 stroke-[1.9]" /></button>
          <h1 className="text-[24px] font-extrabold leading-7 text-[#101827]">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  )
}

function loadStripeScript() {
  const existing = document.getElementById('stripe-js') as HTMLScriptElement | null
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      if (window.Stripe) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Stripe.js could not be loaded.')), { once: true })
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'stripe-js'
    script.src = 'https://js.stripe.com/clover/stripe.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Stripe.js could not be loaded.'))
    document.head.appendChild(script)
  })
}

function EmbeddedStripeCheckout({ clientSecret, onComplete }: { clientSecret: string; onComplete: () => void | Promise<void> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<Error | null>(null)
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

  useEffect(() => {
    let active = true
    let checkout: EmbeddedCheckoutInstance | null = null

    async function mountCheckout() {
      try {
        if (!publishableKey) throw new Error('Stripe publishable key is not configured.')
        await loadStripeScript()
        if (!active || !containerRef.current) return
        const stripe = window.Stripe?.(publishableKey)
        if (!stripe) throw new Error('Stripe.js is not available.')
        checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: () => Promise.resolve(clientSecret),
          onComplete,
        })
        if (!active || !containerRef.current) {
          checkout.destroy()
          return
        }
        checkout.mount(containerRef.current)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason : new Error('Stripe checkout could not be loaded.'))
      }
    }

    void mountCheckout()
    return () => {
      active = false
      checkout?.destroy()
    }
  }, [clientSecret, publishableKey])

  if (error) return <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error.message}</p>
  return <div className="min-h-[520px] overflow-hidden rounded-[14px] bg-white" ref={containerRef} />
}

function PremiumChoiceCard({ billing, checked, onClick }: { billing: 'annual' | 'monthly'; checked: boolean; onClick: () => void }) {
  const annual = billing === 'annual'
  return (
    <button
      className={`relative flex w-full items-center gap-3 rounded-[16px] border bg-white px-4 py-5 text-left transition ${checked ? 'border-[#7c3aed] shadow-none' : 'border-[#d0d5dd]'}`}
      onClick={onClick}
      type="button"
    >
      {annual && (
        <span className="absolute right-4 top-0 flex -translate-y-px items-center gap-1 rounded-b-md bg-[#7c3aed] px-2.5 py-0.5 text-[11px] font-medium text-white">
          <img alt="" className="size-2.5 shrink-0" src="/Glamhour - Assets/Settings/account/my subscription/star.svg" />
          Recommended
        </span>
      )}
      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${checked ? 'border-[#8b5cf6]' : 'border-[#8b5cf6]'}`}>
        {checked && <span className="size-3 rounded-full bg-[#8b5cf6]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[16px] font-bold leading-5 text-[#101827]">{annual ? 'Annual Premium' : 'Monthly Premium'}</span>
          {annual && <span className="mt-0.5 rounded-md bg-[#dcfae6] px-2 py-0.5 text-[11px] font-semibold text-[#079455]">Save 33%</span>}
        </span>
        <span className="mt-1.5 block text-[21px] font-extrabold leading-6 text-[#101827]">
          {annual ? '$9.99 / month' : '$14.99 / month'}
        </span>
        <span className="mt-1.5 block text-[12px] leading-4 text-[#667085]">
          {annual ? '$119.99 billed annually' : 'Billed monthly · Cancel anytime'}
        </span>
      </span>
    </button>
  )
}

function PlanCard({ annual, badge, cta, description, disabled, features, loading, name, onClick, priceMain, priceSuffix, savings, subtitle }: {
  annual?: boolean
  badge?: string
  cta: string
  description?: string
  disabled?: boolean
  features: string[]
  loading?: boolean
  name: string
  onClick: () => void
  priceMain: string
  priceSuffix: string
  savings?: string
  subtitle: string
}) {
  return (
    <Card className={`overflow-hidden rounded-xl p-0 shadow-[0_10px_24px_rgb(16_24_39_/_0.08)] ${annual ? 'border-[#7c3aed] bg-[#eee9ff]' : 'border-[#d0d5dd] bg-white'}`}>
      {annual && (
        <div className="flex items-center justify-center gap-1 bg-[#7c3aed] py-1 text-center text-[10px] font-extrabold text-white">
          <img alt="" className="size-2.5 shrink-0" src="/Glamhour - Assets/Settings/account/my subscription/star.svg" />
          Recommended
        </div>
      )}
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[18px] font-bold leading-6 text-[#101827]">{name}</p>
          <div className="flex flex-col items-end gap-1">
            {!annual && badge && <span className="rounded-md bg-[#f2f4f7] px-2.5 py-1 text-[10px] font-medium text-[#667085]">{badge}</span>}
            {annual && savings && <span className="rounded-md bg-[#dcfae6] px-2.5 py-1 text-[10px] font-medium text-[#079455]">{savings}</span>}
          </div>
        </div>
        <div>
          <p className={`font-extrabold leading-none ${annual ? 'text-[32px] text-[#7c3aed]' : 'text-[31px] text-[#101827]'}`}>
            {priceMain}<span className="ml-1 text-[13px] font-medium text-[#344054]">{priceSuffix}</span>
          </p>
          <p className="mt-4 text-[12px] leading-5 text-[#667085]">{subtitle}</p>
          {description && <p className="mt-3 text-[13px] leading-5 text-[#667085]">{description}</p>}
        </div>
        <div className="space-y-2.5">{features.map((feature) => <Feature accent={annual || name.includes('Premium')} key={feature}>{feature}</Feature>)}</div>
        <Button
          className={disabled ? 'min-h-[56px] rounded-xl bg-[#d9d9d9] text-[15px] font-medium text-[#475467] shadow-[0_10px_18px_rgb(16_24_39_/_0.08)] hover:bg-[#d9d9d9]' : 'min-h-[56px] rounded-xl text-[15px] font-medium shadow-[0_12px_20px_rgb(76_29_149_/_0.26)]'}
          disabled={disabled}
          fullWidth
          loading={loading}
          onClick={onClick}
          variant={disabled ? 'secondary' : 'primary'}
        >
          {cta}
        </Button>
      </div>
    </Card>
  )
}

function Feature({ accent = false, children }: { accent?: boolean; children: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-medium leading-5 text-[#101827]">
      <span className={`grid size-4 shrink-0 place-items-center rounded-full ${accent ? 'bg-[#7c3aed] text-white' : 'bg-[#f2f4f7] text-[#667085]'}`}>
        <Check className="size-2.5 stroke-[3]" />
      </span>
      {children}
    </p>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><p className="text-xs text-muted">{label}</p><p className="text-xs font-bold text-ink">{value}</p></div>
}

function planDetails(plan: PremiumPlan) {
  return plan === 'premium_annual'
    ? {
      name: 'Annual Premium',
      primaryPrice: '$119.99 billed annually',
      secondaryPrice: '$9.99/month',
      confirmCopy: 'Best price value ratio. Premium access all year without interruptions.',
      cta: 'Continue with Annual - $119.99/year',
    }
    : {
      name: 'Monthly Premium',
      primaryPrice: '$14.99/month',
      secondaryPrice: 'Billed monthly',
      confirmCopy: 'Full access without restrictions. Cancel anytime.',
      cta: 'Continue with Monthly - $14.99/month',
    }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
}
