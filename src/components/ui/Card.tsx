import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'lavender' | 'soft'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ tone = 'default', padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border shadow-card',
        tone === 'default' && 'bg-surface',
        tone === 'lavender' && 'border-primary/10 bg-lavender',
        tone === 'soft' && 'bg-surface-soft',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-4',
        padding === 'lg' && 'p-5',
        className,
      )}
      {...props}
    />
  )
}
