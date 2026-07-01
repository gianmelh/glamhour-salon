import { UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-lg' }

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lavender font-semibold text-primary', sizes[size], className)}>
      {src ? <img className="size-full object-cover" src={src} alt={name} /> : initials || <UserRound className="size-1/2" />}
    </span>
  )
}
