import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { lashesSelectionShell } from './lashesUi'

export function LashSelectionCard({
  active,
  children,
  className,
  onClick,
  style,
}: {
  active?: boolean
  children: ReactNode
  className?: string
  onClick: () => void
  style?: CSSProperties
}) {
  return (
    <button
      className={cn(
        lashesSelectionShell(
          Boolean(active),
          'flex h-[82px] shrink-0 items-center justify-center rounded-[16px] border px-6 py-2',
        ),
        className,
      )}
      onClick={onClick}
      style={style}
      type="button"
    >
      {children}
    </button>
  )
}

export function LashTextCard({
  active,
  label,
  onClick,
  trailing,
  className,
  compact = false,
}: {
  active?: boolean
  label: string
  onClick: () => void
  trailing?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <LashSelectionCard
      active={active}
      className={cn(
        'flex-row items-center',
        compact ? 'h-[64px] w-full justify-between gap-1.5 px-3' : 'items-center gap-2 px-6',
        className,
      )}
      onClick={onClick}
    >
      <span className={cn(
        'whitespace-nowrap font-normal leading-[1.44] text-black',
        compact ? 'text-[16px] tracking-[-0.32px]' : 'text-[21px] tracking-[-0.42px]',
      )}>{label}</span>
      {trailing}
    </LashSelectionCard>
  )
}
