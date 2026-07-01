import { CircleAlert } from 'lucide-react'
import { Button } from '../ui/Button'

export interface ErrorStateProps {
  title?: string
  description: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: ErrorStateProps) {
  return (
    <div className="grid place-items-center rounded-lg border border-danger/20 bg-danger-soft px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-surface text-danger"><CircleAlert className="size-6" /></span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-[260px] text-xs leading-5 text-muted">{description}</p>
      {onRetry && <Button className="mt-5" onClick={onRetry} size="sm" variant="outline">Try again</Button>}
    </div>
  )
}
