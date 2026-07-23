import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, CreditCard, LogOut, Save, Scissors, UsersRound } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, LoadingState, PageTitle } from '../../components'
import { ScreenSection } from '../../components/screen/ScreenSection'
import { MutationError } from '../../components/screen/MutationError'
import { useNailSettings, useNotifications, useProfessionals, useSalon, useSettings } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { glamhourApi } from '../../services/glamhour-api'
import { cn } from '../../lib/cn'

export function SettingsPage() {
  const [tab, setTab] = useState<'account' | 'salon'>('salon')
  const salon = useSalon()
  const settings = useSettings()
  const professionals = useProfessionals()
  const notifications = useNotifications()
  const nails = useNailSettings()
  const mutation = useMutation(glamhourApi.updateSettings)

  if (salon.loading || settings.loading) return <LoadingState label="Loading settings..." />
  if (!salon.data || !settings.data) return <ErrorState description="Settings could not be loaded." onRetry={() => { salon.retry(); settings.retry() }} />

  const settingsData = settings.data
  const savePublicBooking = async () => {
    const updated = await mutation.mutate({ allowPublicBooking: !settingsData.allow_public_booking })
    settings.setData(updated)
  }

  const logOut = () => {
    window.sessionStorage.removeItem('glamhour:active-salon-id')
    window.location.href = '/login'
  }

  const activeStaff = professionals.data?.filter((professional) => professional.status === 'active').length ?? 0

  return (
    <div className="space-y-6">
      <DataSourceNotice visible={salon.isFallback || settings.isFallback || professionals.isFallback || notifications.isFallback} />
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
          <Card className="flex items-center gap-3" tone="lavender">
            <span className="grid size-11 place-items-center rounded-md bg-surface text-primary"><CreditCard className="size-5" /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Public booking</p>
              <p className="text-xs text-muted">{settingsData.allow_public_booking ? 'Clients can use your booking link' : 'Booking link is disabled'}</p>
            </div>
            <Button loading={mutation.loading} onClick={savePublicBooking} size="sm" variant="outline"><Save className="size-4" /> {settingsData.allow_public_booking ? 'Disable' : 'Enable'}</Button>
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
              <CategoryRow
                description={nails.data?.category.description ?? 'Manicures, pedicures, acrylics, and nail art.'}
                enabled={nails.data?.category.isEnabled ?? false}
                label="Nails"
                to="/app/settings/services/nails"
              />
              {['Lashes', 'Cosmetology', 'Micropigmentation'].map((label) => (
                <CategoryRow description="Service details coming from your salon catalog." enabled key={label} label={label} />
              ))}
            </Card>
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

function CardLink({ icon, label, description, to }: { icon: ReactNode; label: string; description: string; to: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card" to={to}>
      <span className="grid size-9 place-items-center rounded-md bg-lavender text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted">{description}</p>
      </div>
      <ChevronRight className="size-4 text-muted" />
    </Link>
  )
}

function CategoryRow({ label, description, enabled, to }: { label: string; description: string; enabled: boolean; to?: string }) {
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
  return to ? <Link className={className} to={to}>{content}</Link> : <div className={className}>{content}</div>
}
