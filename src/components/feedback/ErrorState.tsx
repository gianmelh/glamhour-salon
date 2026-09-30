import { CircleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'

export interface ErrorStateProps {
  title?: string
  description: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, compact, className }: ErrorStateProps) {
  return (
    <div className={cn(
      'grid place-items-center rounded-lg border border-danger/20 bg-danger-soft px-6 text-center',
      compact ? 'py-8' : 'py-10',
      className,
    )}>
      <span className={cn(
        'grid place-items-center rounded-full bg-surface text-danger',
        compact ? 'mb-3 size-10' : 'mb-3 size-12',
      )}>
        <CircleAlert className={compact ? 'size-5' : 'size-6'} />
      </span>
      <h3 className={cn('font-semibold text-ink', compact ? 'text-[13px]' : 'text-sm')}>{title}</h3>
      <p className={cn('mt-2 max-w-[260px] text-muted', compact ? 'text-[11px] leading-5' : 'text-xs leading-5')}>{description}</p>
      {onRetry && <Button className="mt-5" onClick={onRetry} size="sm" variant="outline">Try again</Button>}
    </div>
  )
}
