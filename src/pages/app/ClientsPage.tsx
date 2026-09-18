import { Eye, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Card, CreateClientModal, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, Modal, PageTitle } from '../../components'
import { useClients, useSubscription } from '../../hooks/useGlamhourData'
import { applyClientAccess } from '../../lib/client-access'
import type { Client } from '../../types/api'

export function ClientsPage() {
  const clients = useClients()
  const subscription = useSubscription()
  const [open, setOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  if (clients.loading || subscription.loading) return <LoadingState label="Loading clients..." />
  if (!clients.data && clients.error) return <ErrorState description={clients.error.message} onRetry={clients.retry} />
  const usage = subscription.data?.clientUsage
  const displayClients = applyClientAccess(clients.data ?? [], subscription.data).filter((client) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [client.full_name, client.email, client.phone, client.notes].some((value) => value?.toLowerCase().includes(term))
  })
  const lockedCount = displayClients.filter((client) => client.subscription_locked).length
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={clients.isFallback} />
      <PageTitle action={<Button onClick={() => { setEditingClient(null); setOpen(true) }} size="icon"><Plus className="size-5" /></Button>} title="Clients" subtitle="Search profiles, health notes, and appointment history." />
      <Input aria-label="Search clients" leadingIcon={<Search className="size-4" />} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" value={search} />
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
              <div className="flex shrink-0 items-center gap-2">
                <button aria-label={`View ${client.full_name}`} className="grid size-8 place-items-center rounded-full bg-[#f2f4f7] text-[#475467]" onClick={() => setViewingClient(client)} type="button">
                  <Eye className="size-4" />
                </button>
                {client.subscription_locked ? (
                  <Link className="text-xs font-bold text-[#7c3aed]" to="/app/settings/subscription">Upgrade</Link>
                ) : (
                  <button className="text-xs font-semibold text-primary" onClick={() => { setEditingClient(client); setOpen(true) }} type="button">Edit</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState description={search ? 'No clients match your search.' : 'Add your first client to start scheduling services.'} title={search ? 'No clients found' : 'No clients yet'} />}
      <ClientDetailsModal client={viewingClient} onClose={() => setViewingClient(null)} />
      <CreateClientModal
        initialClient={editingClient}
        onClose={() => { setOpen(false); setEditingClient(null) }}
        onCreated={(client) => clients.setData((current) => [client, ...(current ?? []).filter((item) => item.id !== client.id)])}
        open={open}
      />
    </div>
  )
}

function ClientDetailsModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  return (
    <Modal onClose={onClose} open={Boolean(client)} title="Client details" variant="modal">
      {client && (
        <div className="space-y-4">
          {client.subscription_locked && (
            <div className="rounded-[14px] border border-[#fec84b] bg-[#fffbeb] p-3 text-xs text-[#92400e]">
              <p className="font-bold">Locked on Free plan</p>
              <p className="mt-1 leading-5">Upgrade to Premium to edit this client or use them in a new booking.</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar name={client.full_name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#101827]">{client.full_name}</p>
              <p className="text-xs text-muted">{client.preferred_language ?? 'No preferred language'}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm">
            <DetailRow label="Phone" value={client.phone} />
            <DetailRow label="Email" value={client.email} />
            <DetailRow label="Date of birth" value={client.date_of_birth} />
            <DetailRow label="Notes" value={client.notes} />
          </div>
        </div>
      )}
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-[#f8f9fc] p-3">
      <p className="text-[11px] font-bold uppercase text-[#748096]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#101827]">{value || 'Not provided'}</p>
    </div>
  )
}
