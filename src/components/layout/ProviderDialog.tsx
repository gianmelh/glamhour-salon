import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

export interface ProviderDialogProps {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  onClose: () => void
  className?: string
}

/** Keep provider actions above the app chrome and outside the scrolling form. */
export function ProviderDialog({ title, description, children, actions, onClose, className }: ProviderDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialog = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const app = document.getElementById('root')
    const wasInert = app?.inert ?? false
    document.body.style.overflow = 'hidden'
    if (app) app.inert = true
    dialog.current?.querySelector('button')?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previousOverflow
      if (app) app.inert = wasInert
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[999] flex h-dvh items-end justify-center bg-black/40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:items-center">
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn('flex max-h-full w-full max-w-[393px] flex-col overflow-hidden rounded-2xl border border-border bg-[#f2f5ff] shadow-2xl', className)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])
            .filter((element) => element.getClientRects().length > 0)
          const first = focusable[0]
          const last = focusable.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        ref={dialog}
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#11172a]" id={titleId}>{title}</h2>
            {description && <p className="text-xs text-[#68738b]" id={descriptionId}>{description}</p>}
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">Close</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4" data-provider-dialog-body>
          {children}
        </div>
        {actions && <footer className="shrink-0 border-t border-border px-5 py-4">{actions}</footer>}
      </section>
    </div>,
    document.body,
  )
}
