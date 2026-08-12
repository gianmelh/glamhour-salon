import { glamhourApi } from '../../services/glamhour-api'
import type { Client } from '../../types/api'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateClientModal({ initialClient = null, open, onClose, onCreated }: { initialClient?: Client | null; open: boolean; onClose: () => void; onCreated: (client: Client) => void }) {
  const mutation = useMutation((input: Parameters<typeof glamhourApi.createClient>[0]) => (
    initialClient ? glamhourApi.updateClient(initialClient.id, input) : glamhourApi.createClient(input)
  ))
  return (
    <Modal onClose={onClose} open={open} title={initialClient ? 'Edit client' : 'Add client'} variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
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
        <Input defaultValue={initialClient?.full_name ?? ''} label="Full name" name="fullName" required />
        <Input defaultValue={initialClient?.email ?? ''} label="Email" name="email" type="email" />
        <Input defaultValue={initialClient?.phone ?? ''} label="Phone" minLength={7} name="phone" required />
        <Textarea defaultValue={initialClient?.notes ?? ''} label="Notes" name="notes" />
        <MutationError error={mutation.error} />
        <Button fullWidth loading={mutation.loading} type="submit">{initialClient ? 'Save client' : 'Create client'}</Button>
      </form>
    </Modal>
  )
}
