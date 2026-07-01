import type { LucideIcon } from 'lucide-react'
import { CalendarX2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, description, icon: Icon = CalendarX2, action, compact }: EmptyStateProps) {
  return (
    <div className={cn('grid place-items-center rounded-lg border border-border bg-surface px-6 text-center shadow-card', compact ? 'py-8' : 'py-14')}>
      <span className="mb-4 grid size-14 place-items-center rounded-lg bg-lavender text-primary"><Icon className="size-7" strokeWidth={1.7} /></span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-[260px] text-xs leading-5 text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
