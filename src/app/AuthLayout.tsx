import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { MobileFrame } from '../components'

export function AuthLayout() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  if ((pathname === '/terms' || pathname === '/privacy') && searchParams.get('from') === 'home') {
    return (
      <div className="min-h-screen bg-surface-soft px-4 py-6 sm:py-12">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-auth-gradient sm:py-8">
      <MobileFrame className="bg-transparent sm:min-h-[844px] sm:rounded-2xl sm:shadow-2xl">
        <Outlet />
      </MobileFrame>
    </div>
  )
}
