import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, leadingIcon, trailingIcon, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="grid gap-1.5 text-xs font-medium text-ink" htmlFor={inputId}>
      {label}
      <span className="relative block">
        {leadingIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{leadingIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-12 w-full rounded-md border bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:bg-surface-soft disabled:text-subtle',
            Boolean(leadingIcon) && 'pl-10',
            Boolean(trailingIcon) && 'pr-10',
            error ? 'border-danger focus:border-danger focus:ring-danger/10' : 'border-border-strong',
            className,
          )}
          {...props}
        />
        {trailingIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{trailingIcon}</span>}
      </span>
      {(error || hint) && <span className={cn('font-normal', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</span>}
    </label>
  )
})
