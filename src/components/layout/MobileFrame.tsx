import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface MobileFrameProps {
  children: ReactNode
  className?: string
  preview?: boolean
}

export function MobileFrame({ children, className, preview = false }: MobileFrameProps) {
  return (
    <div className={cn(
      'mx-auto w-[393px] max-w-full bg-[#f2f5ff]',
      preview ? 'min-h-[780px] overflow-hidden rounded-2xl border-4 border-ink/90 shadow-2xl' : 'min-h-dvh',
      className,
    )}>
      {children}
    </div>
  )
}
