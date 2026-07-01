import { LoaderCircle } from 'lucide-react'

export interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = 'Loading your salon data...' }: LoadingStateProps) {
  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-border bg-surface p-8 text-center shadow-card">
      <div>
        <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
        <p className="mt-3 text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}
