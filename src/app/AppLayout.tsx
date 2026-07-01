import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, Avatar, BottomNavigation, Header } from '../components'
import { useSalon } from '../hooks/useGlamhourData'

const routeToNav: Record<string, string> = {
  home: 'home',
  appointments: 'calendar',
  calendar: 'calendar',
  sales: 'sales',
  share: 'share',
  settings: 'settings',
  clients: 'home',
  services: 'home',
  staff: 'home',
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const salon = useSalon()
  const routeSegment = location.pathname.split('/')[2] ?? 'home'

  return (
    <div className="min-h-screen bg-[#eceaf5] sm:py-6">
      <AppShell
        header={<Header action={<Avatar name={salon.data?.name ?? 'Glamhour'} size="sm" />} title={salon.data?.name ?? 'Glamhour'} />}
        navigation={<BottomNavigation activeItem={routeToNav[routeSegment] ?? 'home'} onChange={(item) => navigate(`/app/${item}`)} />}
      >
        <Outlet />
      </AppShell>
    </div>
  )
}
