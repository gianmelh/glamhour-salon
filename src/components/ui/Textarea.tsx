import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, hint, error, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="grid gap-1.5 text-xs font-medium text-ink" htmlFor={inputId}>
      {label}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'min-h-28 w-full resize-y rounded-md border bg-surface px-3 py-3 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-primary focus:ring-3 focus:ring-primary/10',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...props}
      />
      {(error || hint) && <span className={cn('font-normal', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</span>}
    </label>
  )
})
