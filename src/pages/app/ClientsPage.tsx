import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Card, CreateClientModal, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, PageTitle } from '../../components'
import { useClients, useSubscription } from '../../hooks/useGlamhourData'
import { applyClientAccess } from '../../lib/client-access'
import type { Client } from '../../types/api'

export function ClientsPage() {
  const clients = useClients()
  const subscription = useSubscription()
  const [open, setOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  if (clients.loading || subscription.loading) return <LoadingState label="Loading clients..." />
  if (!clients.data && clients.error) return <ErrorState description={clients.error.message} onRetry={clients.retry} />
  const usage = subscription.data?.clientUsage
  const displayClients = applyClientAccess(clients.data ?? [], subscription.data)
  const lockedCount = displayClients.filter((client) => client.subscription_locked).length
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={clients.isFallback} />
      <PageTitle action={<Button onClick={() => { setEditingClient(null); setOpen(true) }} size="icon"><Plus className="size-5" /></Button>} title="Clients" subtitle="Search profiles, health notes, and appointment history." />
      <Input aria-label="Search clients" leadingIcon={<Search className="size-4" />} placeholder="Search clients" />
      {usage?.limit && usage.count > usage.limit && (
        <Card className="rounded-[14px] border-[#fec84b] bg-[#fffbeb] p-3">
          <p className="text-sm font-extrabold text-[#92400e]">{usage.count} / {usage.limit} - Limit reached</p>
          <p className="mt-1 text-xs leading-5 text-[#92400e]">{lockedCount} clients are locked until you upgrade again or reduce the list to {usage.limit} clients.</p>
        </Card>
      )}
      {displayClients.length ? (
        <div className="space-y-3">
          {displayClients.map((client) => (
            <Card className={`flex items-center gap-3 ${client.subscription_locked ? 'border-[#fec84b] bg-[#fffbeb]' : ''}`} key={client.id}>
              <Avatar name={client.full_name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{client.full_name}</p>
                  {client.subscription_locked && (
                    <span className="shrink-0 rounded-md bg-[#fef0c7] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b54708]">
                      Locked
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">
                  {client.subscription_locked ? 'Locked on Free plan' : client.email ?? client.phone ?? 'No contact information'}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted">
                  {client.subscription_locked ? 'Upgrade to Premium to use this client again.' : client.notes ?? 'No client notes'}
                </p>
              </div>
              {client.subscription_locked ? (
                <Link className="shrink-0 text-xs font-bold text-[#7c3aed]" to="/app/settings/subscription">Upgrade</Link>
              ) : (
                <button className="shrink-0 text-xs font-semibold text-primary" onClick={() => { setEditingClient(client); setOpen(true) }} type="button">Edit</button>
              )}
            </Card>
          ))}
        </div>
      ) : <EmptyState description="Add your first client to start scheduling services." title="No clients yet" />}
      <CreateClientModal
        initialClient={editingClient}
        onClose={() => { setOpen(false); setEditingClient(null) }}
        onCreated={(client) => clients.setData((current) => [client, ...(current ?? []).filter((item) => item.id !== client.id)])}
        open={open}
      />
    </div>
  )
}
