import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface HeaderProps {
  title?: string
  backLabel?: string
  onBack?: () => void
  action?: ReactNode
  transparent?: boolean
}

export function Header({ title, backLabel = 'Back', onBack, action, transparent }: HeaderProps) {
  return (
    <header className={cn('sticky top-0 z-20 grid min-h-14 grid-cols-[1fr_auto_1fr] items-center px-4', !transparent && 'border-b border-border bg-surface/95 backdrop-blur')}>
      <div>
        {onBack && (
          <button className="inline-flex items-center gap-1 text-xs font-medium text-ink hover:text-primary" onClick={onBack} type="button">
            <ArrowLeft className="size-4" />
            {backLabel}
          </button>
        )}
      </div>
      <strong className="text-sm font-semibold">{title}</strong>
      <div className="justify-self-end">{action}</div>
    </header>
  )
}
