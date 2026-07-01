import { Outlet } from 'react-router-dom'
import { MobileFrame } from '../components'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-auth-gradient sm:py-8">
      <MobileFrame className="bg-transparent sm:min-h-[844px] sm:rounded-2xl sm:shadow-2xl">
        <Outlet />
      </MobileFrame>
    </div>
  )
}
