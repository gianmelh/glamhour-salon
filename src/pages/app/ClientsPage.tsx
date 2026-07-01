import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, Card, CreateClientModal, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, PageTitle } from '../../components'
import { useClients } from '../../hooks/useGlamhourData'

export function ClientsPage() {
  const clients = useClients()
  const [open, setOpen] = useState(false)
  if (clients.loading) return <LoadingState label="Loading clients..." />
  if (!clients.data && clients.error) return <ErrorState description={clients.error.message} onRetry={clients.retry} />
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={clients.isFallback} />
      <PageTitle action={<Button onClick={() => setOpen(true)} size="icon"><Plus className="size-5" /></Button>} title="Clients" subtitle="Search profiles, health notes, and appointment history." />
      <Input aria-label="Search clients" leadingIcon={<Search className="size-4" />} placeholder="Search clients" />
      {clients.data?.length ? <div className="space-y-3">{clients.data.map((client) => <Card className="flex items-center gap-3" key={client.id}><Avatar name={client.full_name} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{client.full_name}</p><p className="truncate text-xs text-muted">{client.email ?? client.phone ?? 'No contact information'}</p><p className="mt-1 truncate text-[11px] text-muted">{client.notes ?? 'No client notes'}</p></div><span className="text-xs font-semibold text-primary">View</span></Card>)}</div> : <EmptyState description="Add your first client to start scheduling services." title="No clients yet" />}
      <CreateClientModal onClose={() => setOpen(false)} onCreated={(client) => clients.setData((current) => [...(current ?? []), client])} open={open} />
    </div>
  )
}
