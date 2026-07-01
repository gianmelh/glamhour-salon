import { Clock3 } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export interface StaffCardProps {
  name: string
  role: string
  status?: 'Available' | 'Busy' | 'Off'
  nextAppointment?: string
  image?: string
}

export function StaffCard({ name, role, status = 'Available', nextAppointment, image }: StaffCardProps) {
  const tone = status === 'Available' ? 'success' : status === 'Busy' ? 'warning' : 'neutral'
  return (
    <Card className="flex items-center gap-3">
      <Avatar name={name} src={image} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted">{role}</p>
        {nextAppointment && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Clock3 className="size-3" />{nextAppointment}</p>}
      </div>
      <Badge tone={tone}>{status}</Badge>
    </Card>
  )
}
