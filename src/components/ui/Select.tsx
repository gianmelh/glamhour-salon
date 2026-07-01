import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: Array<{ label: string; value: string }>
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, hint, error, options, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="grid gap-1.5 text-xs font-medium text-ink" htmlFor={inputId}>
      {label}
      <span className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-12 w-full appearance-none rounded-md border bg-surface px-3 pr-10 text-sm text-ink outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10',
            error ? 'border-danger' : 'border-border-strong',
            className,
          )}
          {...props}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </span>
      {(error || hint) && <span className={cn('font-normal', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</span>}
    </label>
  )
})
