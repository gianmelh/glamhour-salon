import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-soft text-muted ring-border',
  primary: 'bg-lavender text-primary ring-primary/15',
  success: 'bg-success-soft text-success ring-success/15',
  warning: 'bg-warning-soft text-warning ring-warning/15',
  danger: 'bg-danger-soft text-danger ring-danger/15',
  info: 'bg-info-soft text-info ring-info/15',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', tones[tone], className)} {...props} />
}
