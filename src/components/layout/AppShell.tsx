import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { MobileFrame } from './MobileFrame'

export interface AppShellProps {
  children: ReactNode
  header?: ReactNode
  navigation?: ReactNode
  className?: string
  preview?: boolean
}

export function AppShell({ children, header, navigation, className, preview }: AppShellProps) {
  return (
    <MobileFrame preview={preview}>
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className={cn('flex-1 px-4 pb-28 pt-5', className)}>{children}</main>
        {navigation}
      </div>
    </MobileFrame>
  )
}
