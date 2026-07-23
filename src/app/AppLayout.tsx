import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, Avatar, BottomNavigation, Header } from '../components'
import { useSalon } from '../hooks/useGlamhourData'

const routeToNav: Record<string, string> = {
  home: 'home',
  appointments: 'calendar',
  calendar: 'calendar',
  sales: 'sales',
  share: 'home',
  settings: 'settings',
  clients: 'home',
  services: 'home',
  staff: 'staff',
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const salon = useSalon()
  const routeSegment = location.pathname.split('/')[2] ?? 'home'
  const isAppointmentFlow = location.pathname.startsWith('/app/appointments/new')

  return (
    <div className="min-h-screen bg-[#eceaf5] sm:py-6">
      <AppShell
        className={isAppointmentFlow ? 'px-0 pt-0' : undefined}
        header={routeSegment === 'home' || isAppointmentFlow ? undefined : <Header action={<Avatar name={salon.data?.name ?? 'Glamhour'} size="sm" />} title={salon.data?.name ?? 'Glamhour'} />}
        navigation={<BottomNavigation activeItem={isAppointmentFlow ? 'home' : (routeToNav[routeSegment] ?? 'home')} onChange={(item) => navigate(`/app/${item}`)} />}
      >
        <Outlet />
      </AppShell>
    </div>
  )
}
