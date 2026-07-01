import { Clock3 } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

type AppointmentStatus = 'Upcoming' | 'In progress' | 'Completed' | 'Canceled'

export interface AppointmentCardProps {
  time: string
  client: string
  service: string
  professional: string
  status: AppointmentStatus
}

const statusTone = {
  Upcoming: 'neutral',
  'In progress': 'primary',
  Completed: 'success',
  Canceled: 'danger',
} as const

export function AppointmentCard({ time, client, service, professional, status }: AppointmentCardProps) {
  return (
    <Card className="flex items-start gap-3">
      <div className="grid min-w-12 place-items-center rounded-md bg-surface-soft px-2 py-2 text-center">
        <Clock3 className="mb-1 size-3.5 text-primary" />
        <span className="text-[11px] font-bold">{time}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{client}</p>
            <p className="text-xs text-muted">{service}</p>
          </div>
          <Badge tone={statusTone[status]}>{status}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Avatar name={professional} size="sm" />
          <span className="text-xs text-muted">with {professional}</span>
        </div>
      </div>
    </Card>
  )
}
