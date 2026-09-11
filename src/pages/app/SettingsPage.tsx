import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, CreditCard, LogOut, MessageCircle, MessageSquare, Plus, Save, Scissors, UsersRound } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, Input, LoadingState, PageTitle } from '../../components'
import { ScreenSection } from '../../components/screen/ScreenSection'
import { MutationError } from '../../components/screen/MutationError'
import { useNailSettings, useNotifications, useProfessionals, useSalon, useServiceCategories, useServices, useSettings, useSubscription } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { glamhourApi } from '../../services/glamhour-api'
import { cn } from '../../lib/cn'
import { mergePublicBookingShareSettings, publicBookingShareSettings } from '../../lib/public-booking-settings'
import { deferTask } from '../../lib/defer'

const categoryDescriptions: Record<string, string> = {
  nails: 'Manicures, pedicures, acrylics, and nail art.',
  lashes: 'Eyelash extensions, lifts, and tinting services.',
  cosmetology: 'Facials, skincare treatments, and beauty enhancements.',
  micropigmentation: 'Microblading, lip liner, eyeliner, and more pigmentation services.',
}

export function SettingsPage() {
  const [tab, setTab] = useState<'account' | 'salon'>(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('publicBooking') === '1'
      ? 'account'
      : 'salon'
  ))
  const [shareForm, setShareForm] = useState(publicBookingShareSettings(undefined))
  const salon = useSalon()
  const settings = useSettings()
  const professionals = useProfessionals()
  const notifications = useNotifications()
  const nails = useNailSettings()
  const categories = useServiceCategories(undefined, { includeAll: true })
  const services = useServices()
  const subscription = useSubscription()
  const mutation = useMutation(glamhourApi.updateSettings)

  useEffect(() => {
    if (!settings.data) return
    deferTask(() => setShareForm(publicBookingShareSettings(settings.data!.settings_json)))
  }, [settings.data])

  useEffect(() => {
    const refreshSubscription = () => subscription.retry()
    window.addEventListener('focus', refreshSubscription)
    document.addEventListener('visibilitychange', refreshSubscription)
    return () => {
      window.removeEventListener('focus', refreshSubscription)
      document.removeEventListener('visibilitychange', refreshSubscription)
    }
  }, [subscription.retry])

  if (salon.loading || settings.loading || categories.loading || services.loading || subscription.loading) return <LoadingState label="Loading settings..." />
  if (!salon.data || !settings.data || !categories.data || !services.data || !subscription.data) return <ErrorState description="Settings could not be loaded." onRetry={() => { salon.retry(); settings.retry(); categories.retry(); services.retry(); subscription.retry() }} />

  const settingsData = settings.data
  const categoryData = categories.data
  const serviceData = services.data
  const subscriptionData = subscription.data
  const clientUsageColor = registeredClientsBarColor(subscriptionData.clientUsage.count)
  const clientLimit = subscriptionData.clientUsage.limit ?? 15
  const setupState = { salonId: salon.data.id, salonName: salon.data.name }
  const savePublicBooking = async () => {
    const updated = await mutation.mutate({
      allowPublicBooking: true,
      settingsJson: mergePublicBookingShareSettings(settingsData.settings_json, shareForm),
    })
    settings.setData(updated)
  }

  const logOut = () => {
    window.sessionStorage.removeItem('glamhour:active-salon-id')
    window.location.href = '/login'
  }

  const activeStaff = professionals.data?.filter((professional) => professional.status === 'active').length ?? 0

  return (
    <div className="space-y-6">
      <DataSourceNotice visible={salon.isFallback || settings.isFallback || professionals.isFallback || notifications.isFallback || categories.isFallback || services.isFallback} />
      <PageTitle title="Settings" subtitle="Manage your account settings and salon preferences." />

      <div className="grid grid-cols-2 rounded-lg bg-surface-soft p-1">
        <TabButton active={tab === 'account'} onClick={() => setTab('account')}>Account</TabButton>
        <TabButton active={tab === 'salon'} onClick={() => setTab('salon')}>Salon Configuration</TabButton>
      </div>

      {tab === 'account' ? (
        <div className="space-y-4">
          <Card className="flex items-center gap-3">
            <Avatar name={salon.data.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{salon.data.name}</p>
              <p className="text-xs text-muted">{salon.data.email ?? 'No email'}</p>
              <p className="mt-1 text-[11px] text-muted">{salon.data.city}, {salon.data.region}</p>
            </div>
            <Badge tone="primary">Owner</Badge>
          </Card>
          <Card className="rounded-[18px] border-[#d8dce8] bg-white px-6 py-6 shadow-[0_2px_2px_rgb(16_24_39_/_0.03),0_14px_28px_rgb(16_24_39_/_0.09)]">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#eee9ff] text-[#7c3aed]">
                <CreditCard className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[20px] font-extrabold leading-6 text-[#101827]">Subscription</h2>
                <p className="mt-0.5 text-[15px] font-medium leading-5 text-[#667085]">
                  {subscriptionData.hasPremiumAccess ? subscriptionLabel(subscriptionData.subscription?.planCode) : 'Free plan'}
                </p>
              </div>
            </div>

            <div className="my-3.5 h-px bg-[#d0d5dd]" />

            {subscriptionData.hasPremiumAccess ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#667085]">Registered clients</p>
                <p className="text-[13px] font-bold text-[#667085]">Unlimited</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#667085]">Registered clients</p>
                  <p className="text-[13px] font-bold text-[#667085]">{subscriptionData.clientUsage.count} / {clientLimit}</p>
                </div>
                <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#edf0f4]">
                  <div className={`h-full rounded-full ${clientUsageColor}`} style={{ width: `${Math.min(100, (subscriptionData.clientUsage.count / clientLimit) * 100)}%` }} />
                </div>
                {subscriptionData.clientUsage.canCreateClient
                  ? subscriptionData.clientUsage.nearLimit && <p className="mt-2 text-xs font-semibold text-warning">Near the limit.</p>
                  : <p className="mt-2 text-xs font-semibold text-danger">{subscriptionData.clientUsage.count} / {clientLimit} - Limit reached.</p>}
              </div>
            )}

            <Link className="mt-7 inline-flex min-h-[46px] w-full items-center justify-center rounded-[13px] bg-glam-gradient px-5 text-[15px] font-medium text-white shadow-[0_10px_18px_rgb(76_29_149_/_0.22)]" to="/app/settings/subscription">
              {subscriptionData.hasPremiumAccess ? 'See details' : 'Upgrade'}
            </Link>
          </Card>
          <Card className="space-y-4" id="public-booking" tone="lavender">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-surface text-primary"><CreditCard className="size-5" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Public booking</p>
                <p className="text-xs text-muted">{settingsData.allow_public_booking ? 'Clients can use your booking link' : 'Save these details to activate your booking link'}</p>
              </div>
              <Badge tone={settingsData.allow_public_booking ? 'success' : 'warning'}>{settingsData.allow_public_booking ? 'Enabled' : 'Disabled'}</Badge>
            </div>
            <div className="grid gap-3">
              <Input
                label="WhatsApp number"
                leadingIcon={<MessageCircle className="size-4" />}
                onChange={(event) => setShareForm((current) => ({ ...current, whatsappPhone: event.target.value }))}
                placeholder="+1 305 555 0100"
                value={shareForm.whatsappPhone}
              />
              <Input
                label="SMS / Message number"
                leadingIcon={<MessageSquare className="size-4" />}
                onChange={(event) => setShareForm((current) => ({ ...current, smsPhone: event.target.value }))}
                placeholder="+1 305 555 0100"
                value={shareForm.smsPhone}
              />
              <Input
                label="Facebook link"
                leadingIcon={<img alt="" className="size-4" src="/Glamhour - Assets/Salon link/Icon-2.svg" />}
                onChange={(event) => setShareForm((current) => ({ ...current, facebookUrl: event.target.value }))}
                placeholder="https://facebook.com/your-salon"
                value={shareForm.facebookUrl}
              />
              <Input
                label="Instagram link"
                leadingIcon={<img alt="" className="size-4" src="/Glamhour - Assets/Salon link/Icon-1.svg" />}
                onChange={(event) => setShareForm((current) => ({ ...current, instagramUrl: event.target.value }))}
                placeholder="https://instagram.com/your-salon"
                value={shareForm.instagramUrl}
              />
            </div>
            <Button fullWidth loading={mutation.loading} onClick={savePublicBooking} size="sm" variant="outline"><Save className="size-4" /> Save public booking</Button>
          </Card>
          <MutationError error={mutation.error} />
        </div>
      ) : (
        <div className="space-y-5">
          <ScreenSection title="Weekly Schedule">
            <CardLink
              description={`${settingsData.appointment_interval_minutes} minute appointment intervals`}
              icon={<CalendarDays className="size-4" />}
              label="Working hours"
              to="/onboarding/schedule"
            />
          </ScreenSection>

          <ScreenSection title="Service Categories">
            <Card padding="none">
              {categoryData.map((category) => {
                const configuredServices = serviceData.filter((service) => service.category_id === category.id && service.is_active)
                const enabled = category.code === 'nails'
                  ? (nails.data?.category.isEnabled ?? configuredServices.length > 0)
                  : configuredServices.length > 0
                return (
                  <CategoryRow
                    description={category.description ?? categoryDescriptions[category.code] ?? 'Service details coming from your salon catalog.'}
                    enabled={enabled}
                    key={category.id}
                    label={category.name}
                    state={setupState}
                    to={category.code === 'nails' && enabled ? '/app/settings/services/nails' : '/onboarding/categories'}
                  />
                )
              })}
            </Card>
            <CardLink
              description="Add or remove service categories using the onboarding setup flow."
              icon={<Plus className="size-4" />}
              label="Add service categories"
              state={setupState}
              to="/onboarding/categories"
            />
          </ScreenSection>

          <ScreenSection title="Team & Providers">
            <CardLink
              description={`${activeStaff} / 10 active staff members`}
              icon={<UsersRound className="size-4" />}
              label="Team & Providers"
              to="/app/settings/services/nails"
            />
          </ScreenSection>
        </div>
      )}

      <Button fullWidth leadingIcon={<LogOut className="size-4" />} onClick={logOut} variant="outline">Log out</Button>
    </div>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      className={cn('min-h-10 rounded-md text-xs font-semibold transition', active ? 'bg-surface text-primary shadow-sm' : 'text-muted')}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function subscriptionLabel(planCode?: string) {
  if (planCode === 'premium_annual') return 'Annual Premium'
  if (planCode === 'premium_monthly') return 'Premium monthly'
  return 'Free plan'
}

function registeredClientsBarColor(count: number) {
  if (count <= 5) return 'bg-[#16c784]'
  if (count <= 10) return 'bg-[#f79009]'
  return 'bg-[#ef4444]'
}

function CardLink({ icon, label, description, state, to }: { icon: ReactNode; label: string; description: string; state?: unknown; to: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card" state={state} to={to}>
      <span className="grid size-9 place-items-center rounded-md bg-lavender text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted">{description}</p>
      </div>
      <ChevronRight className="size-4 text-muted" />
    </Link>
  )
}

function CategoryRow({ label, description, enabled, state, to }: { label: string; description: string; enabled: boolean; state?: unknown; to?: string }) {
  const content = (
    <>
      <span className="grid size-9 place-items-center rounded-md bg-lavender text-primary"><Scissors className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-ink">{label}</p>
          <Badge tone={enabled ? 'success' : 'warning'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>
      </div>
      {to ? <ChevronRight className="size-4 text-muted" /> : <span className="text-[11px] text-muted">Soon</span>}
    </>
  )
  const className = 'flex items-center gap-3 border-b border-border p-4 last:border-b-0'
  return to ? <Link className={className} state={state} to={to}>{content}</Link> : <div className={className}>{content}</div>
}
