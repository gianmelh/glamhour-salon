import { Bell, ChevronRight, Clock3, CreditCard, LogOut, Save, Scissors, UserRound, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Card, DataSourceNotice, ErrorState, LoadingState, MutationError, PageTitle, ScreenSection } from '../../components'
import { useNotifications, useProfessionals, useSalon, useSettings } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { glamhourApi } from '../../services/glamhour-api'

export function SettingsPage() {
  const navigate = useNavigate()
  const salon = useSalon()
  const settings = useSettings()
  const professionals = useProfessionals()
  const notifications = useNotifications()
  const mutation = useMutation(glamhourApi.updateSettings)
  if (salon.loading || settings.loading) return <LoadingState label="Loading settings..." />
  if (!salon.data || !settings.data) return <ErrorState description="Settings could not be loaded." onRetry={() => { salon.retry(); settings.retry() }} />
  const savePublicBooking = async () => {
    const updated = await mutation.mutate({ allowPublicBooking: !settings.data?.allow_public_booking })
    settings.setData(updated)
  }
  const settingsItems = [
    { label: 'Profile information', description: `${salon.data.name} · ${salon.data.email ?? 'No email'}`, icon: UserRound, to: '/register' },
    { label: 'Salon services', description: 'Categories, prices, and durations', icon: Scissors, to: '/app/services' },
    { label: 'Team & professionals', description: `${professionals.data?.length ?? 0} active staff records`, icon: UsersRound, to: '/app/staff' },
    { label: 'Working hours', description: `${settings.data.appointment_interval_minutes} minute appointment intervals`, icon: Clock3, to: '/onboarding/schedule' },
    { label: 'Notifications', description: `${notifications.data?.length ?? 0} recent notifications`, icon: Bell, to: '/app/settings' },
  ]
  return <div className="space-y-6"><DataSourceNotice visible={salon.isFallback || settings.isFallback || professionals.isFallback || notifications.isFallback} /><PageTitle title="Settings" subtitle="Manage your account, salon configuration, and subscription." /><Card className="flex items-center gap-3"><Avatar name={salon.data.name} size="lg" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{salon.data.name}</p><p className="text-xs text-muted">{salon.data.email ?? 'No email'}</p><p className="mt-1 text-[11px] text-muted">{salon.data.city}, {salon.data.region}</p></div><Badge tone="primary">Owner</Badge></Card><Card className="flex items-center gap-3" tone="lavender"><span className="grid size-11 place-items-center rounded-md bg-surface text-primary"><CreditCard className="size-5" /></span><div className="flex-1"><p className="text-sm font-semibold">Public booking</p><p className="text-xs text-muted">{settings.data.allow_public_booking ? 'Clients can use your booking link' : 'Booking link is disabled'}</p></div><Button loading={mutation.loading} onClick={savePublicBooking} size="sm" variant="outline"><Save className="size-4" /> {settings.data.allow_public_booking ? 'Disable' : 'Enable'}</Button></Card><MutationError error={mutation.error} /><ScreenSection title="Salon configuration"><Card padding="none">{settingsItems.map(({ label, description, icon: Icon, to }, index) => <Link className={`flex items-center gap-3 p-4 ${index < settingsItems.length - 1 ? 'border-b border-border' : ''}`} key={label} to={to}><span className="grid size-9 place-items-center rounded-md bg-lavender text-primary"><Icon className="size-4" /></span><div className="flex-1"><p className="text-xs font-semibold">{label}</p><p className="mt-0.5 text-[11px] text-muted">{description}</p></div><ChevronRight className="size-4 text-muted" /></Link>)}</Card></ScreenSection><Button fullWidth leadingIcon={<LogOut className="size-4" />} onClick={() => navigate('/entry')} variant="outline">Log out</Button></div>
}
