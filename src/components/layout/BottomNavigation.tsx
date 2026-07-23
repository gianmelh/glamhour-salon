import type { LucideIcon } from 'lucide-react'
import { CalendarDays, DollarSign, Home, Settings, UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface NavigationItem {
  id: string
  label: string
  icon: LucideIcon
}

const defaultNavigationItems: NavigationItem[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'sales', label: 'Revenue', icon: DollarSign },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'staff', label: 'Profile', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export interface BottomNavigationProps {
  activeItem: string
  onChange?: (id: string) => void
  items?: NavigationItem[]
}

export function BottomNavigation({ activeItem, onChange, items = defaultNavigationItems }: BottomNavigationProps) {
  return (
    <nav className="z-30 flex h-[70px] w-full shrink-0 items-center justify-around border-t border-[#eaecf0] bg-white px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-3px_16px_rgb(16_24_39/0.04)]">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === activeItem
        return (
          <button aria-label={label} className={cn('grid size-11 place-items-center rounded-full transition', active ? 'bg-[#eee8ff] text-[#7a3fe0]' : 'text-[#111827] hover:bg-[#f6f3ff]')} key={id} onClick={() => onChange?.(id)} type="button">
            <span className="grid size-9 place-items-center rounded-full">
              <Icon className="size-[21px]" strokeWidth={2.1} />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
