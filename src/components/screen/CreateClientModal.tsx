import { Link } from 'react-router-dom'
import { glamhourApi } from '../../services/glamhour-api'
import type { Client } from '../../types/api'
import { useSubscription } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateClientModal({ initialClient = null, open, onClose, onCreated }: { initialClient?: Client | null; open: boolean; onClose: () => void; onCreated: (client: Client) => void }) {
  const mutation = useMutation((input: Parameters<typeof glamhourApi.createClient>[0]) => (
    initialClient ? glamhourApi.updateClient(initialClient.id, input) : glamhourApi.createClient(input)
  ))
  const subscription = useSubscription()
  const clientLimitReached = !initialClient && subscription.data?.clientUsage.canCreateClient === false
  return (
    <Modal onClose={onClose} open={open} title={initialClient ? 'Edit client' : 'Add client'} variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        if (clientLimitReached) return
        const form = new FormData(event.currentTarget)
        const phone = String(form.get('phone') ?? '').trim()
        if (!phone) {
          event.currentTarget.reportValidity()
          return
        }
        const client = await mutation.mutate({
          fullName: String(form.get('fullName') ?? '').trim(),
          email: String(form.get('email') ?? '').trim() || undefined,
          phone,
          notes: String(form.get('notes') ?? '').trim() || undefined,
        })
        onCreated(client)
        onClose()
      }}>
        {clientLimitReached && (
          <div className="rounded-[16px] border border-[#fbbf24] bg-[#fffbeb] p-3 text-xs text-[#92400e]">
            <p className="font-bold">You reached 15 clients on the free plan.</p>
            <p className="mt-1">Upgrade to Premium to add more clients.</p>
            <Link
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-[10px] bg-glam-gradient px-3 text-sm font-semibold text-white shadow-action"
              to="/app/settings/subscription"
            >
              Upgrade
            </Link>
          </div>
        )}
        <Input defaultValue={initialClient?.full_name ?? ''} label="Full name" name="fullName" required />
        <Input defaultValue={initialClient?.email ?? ''} label="Email" name="email" type="email" />
        <Input defaultValue={initialClient?.phone ?? ''} label="Phone" minLength={7} name="phone" required />
        <Textarea defaultValue={initialClient?.notes ?? ''} label="Notes" name="notes" />
        <MutationError error={mutation.error} />
        {!clientLimitReached && (
          <Button fullWidth loading={mutation.loading} type="submit">{initialClient ? 'Save client' : 'Create client'}</Button>
        )}
      </form>
    </Modal>
  )
}
