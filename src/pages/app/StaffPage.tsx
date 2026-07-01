import { Plus, UsersRound } from 'lucide-react'
import { Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, LoadingState, PageTitle, StaffCard } from '../../components'
import { useProfessionals } from '../../hooks/useGlamhourData'
import { staffCardProps } from '../../lib/view-models'

export function StaffPage() {
  const professionals = useProfessionals()
  if (professionals.loading) return <LoadingState label="Loading professionals..." />
  if (!professionals.data && professionals.error) return <ErrorState description={professionals.error.message} onRetry={professionals.retry} />
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={professionals.isFallback} />
      <PageTitle action={<Button size="icon"><Plus className="size-5" /></Button>} title="Staff & professionals" subtitle="Manage services, schedules, availability, and earnings." />
      <Card className="flex items-center gap-3" tone="lavender"><UsersRound className="size-6 text-primary" /><div className="flex-1"><p className="text-sm font-semibold">{professionals.data?.length ?? 0} active professionals</p><p className="text-xs text-muted">Live from your salon database</p></div><Badge tone="success">Active</Badge></Card>
      {professionals.data?.length ? <div className="space-y-3">{professionals.data.map((person) => <StaffCard key={person.id} {...staffCardProps(person)} />)}</div> : <EmptyState description="Add a professional to assign salon services." title="No professionals yet" />}
      <Button fullWidth leadingIcon={<Plus className="size-4" />} variant="outline">Add professional</Button>
    </div>
  )
}
