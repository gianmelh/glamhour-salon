import type { LucideIcon } from 'lucide-react'
import { CalendarDays, DollarSign, Home, Link, Settings } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface NavigationItem {
  id: string
  label: string
  icon: LucideIcon
}

const defaultNavigationItems: NavigationItem[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'sales', label: 'Sales', icon: DollarSign },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'share', label: 'Link', icon: Link },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export interface BottomNavigationProps {
  activeItem: string
  onChange?: (id: string) => void
  items?: NavigationItem[]
}

export function BottomNavigation({ activeItem, onChange, items = defaultNavigationItems }: BottomNavigationProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex min-h-[72px] w-full max-w-[390px] items-start justify-around border-t border-border bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-3px_16px_rgb(16_24_39/0.06)]">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === activeItem
        return (
          <button className={cn('grid min-w-14 place-items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition', active ? 'text-primary' : 'text-ink hover:bg-surface-soft')} key={id} onClick={() => onChange?.(id)} type="button">
            <span className={cn('grid size-8 place-items-center rounded-md', active && 'bg-lavender')}>
              <Icon className="size-[19px]" strokeWidth={1.8} />
            </span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
