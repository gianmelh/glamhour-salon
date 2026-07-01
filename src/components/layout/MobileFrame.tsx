import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface MobileFrameProps {
  children: ReactNode
  className?: string
  preview?: boolean
}

export function MobileFrame({ children, className, preview = false }: MobileFrameProps) {
  return (
    <div className={cn('mx-auto min-h-dvh w-full max-w-[390px] overflow-hidden bg-canvas', preview && 'min-h-[780px] rounded-2xl border-4 border-ink/90 shadow-2xl', className)}>
      {children}
    </div>
  )
}
