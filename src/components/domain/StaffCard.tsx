import { Clock3, Pencil } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

export interface StaffCardProps {
  name: string
  role: string
  status?: 'Available' | 'Busy' | 'Off'
  nextAppointment?: string
  image?: string
  onEdit?: () => void
}

export function StaffCard({ name, role, status = 'Available', nextAppointment, image, onEdit }: StaffCardProps) {
  const tone = status === 'Available' ? 'success' : status === 'Busy' ? 'warning' : 'neutral'
  return (
    <Card className="flex items-center gap-3">
      <Avatar name={name} src={image} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted">{role}</p>
        {nextAppointment && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Clock3 className="size-3" />{nextAppointment}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Badge tone={tone}>{status}</Badge>
        {onEdit && <Button aria-label={`Edit ${name}`} leadingIcon={<Pencil className="size-3.5" />} onClick={onEdit} size="sm" variant="outline">Edit</Button>}
      </div>
    </Card>
  )
}
