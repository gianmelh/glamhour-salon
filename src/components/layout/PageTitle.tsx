import type { ReactNode } from 'react'

export interface PageTitleProps {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
}

export function PageTitle({ title, subtitle, eyebrow, action }: PageTitleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="max-w-[290px]">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
