import { Clock3, MoreHorizontal, Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'

export interface ServiceCardProps {
  name: string
  category: string
  duration: string
  price: string
  onClick?: () => void
}

export function ServiceCard({ name, category, duration, price, onClick }: ServiceCardProps) {
  return (
    <Card className="flex items-center gap-3" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="grid size-11 shrink-0 place-items-center rounded-md bg-lavender text-primary"><Sparkles className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="mt-0.5 text-xs text-muted">{category}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Clock3 className="size-3.5" />{duration}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-ink">{price}</p>
        <MoreHorizontal className="ml-auto mt-2 size-4 text-muted" />
      </div>
    </Card>
  )
}
