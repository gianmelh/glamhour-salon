import { cn } from '../../../../lib/cn'

export function lashesSelectionShell(active: boolean, className?: string) {
  return cn(
    'border border-solid',
    active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
    className,
  )
}
