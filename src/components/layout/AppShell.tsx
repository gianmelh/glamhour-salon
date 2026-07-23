import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { MobileFrame } from './MobileFrame'

export interface AppShellProps {
  children: ReactNode
  header?: ReactNode
  navigation?: ReactNode
  className?: string
  frameClassName?: string
  preview?: boolean
}

export function AppShell({ children, header, navigation, className, frameClassName, preview }: AppShellProps) {
  return (
    <MobileFrame className={frameClassName} preview={preview}>
      <div className="flex h-dvh min-h-0 flex-col">
        {header}
        <main className={cn('min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto', className ?? 'px-4 pb-5 pt-5')}>{children}</main>
        {navigation}
      </div>
    </MobileFrame>
  )
}
