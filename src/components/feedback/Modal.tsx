import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  variant?: 'modal' | 'sheet'
}

export function Modal({ open, title, description, children, footer, onClose, variant = 'modal' }: ModalProps) {
  if (!open) return null

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]" role="dialog">
      <button aria-label="Close modal" className="absolute inset-0" onClick={onClose} type="button" />
      <section className={cn(
        'relative z-10 w-full max-w-[360px] bg-surface p-5',
        variant === 'modal'
          ? 'rounded-xl shadow-2xl'
          : 'absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] mx-auto max-w-[390px] rounded-2xl shadow-sheet',
      )}>
        <button aria-label="Close" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-surface-soft text-muted hover:text-ink" onClick={onClose} type="button"><X className="size-4" /></button>
        {variant === 'sheet' && <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />}
        <h2 className="pr-8 text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm leading-5 text-muted">{description}</p>}
        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex gap-3">{footer}</div>}
      </section>
    </div>
  )
}
