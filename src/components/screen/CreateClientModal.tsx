import { glamhourApi } from '../../services/glamhour-api'
import type { Client } from '../../types/api'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateClientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (client: Client) => void }) {
  const mutation = useMutation(glamhourApi.createClient)
  return (
    <Modal onClose={onClose} open={open} title="Add client" variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const client = await mutation.mutate({ fullName: String(form.get('fullName')), email: String(form.get('email')), phone: String(form.get('phone')), notes: String(form.get('notes')) })
        onCreated(client)
        onClose()
      }}>
        <Input label="Full name" name="fullName" required />
        <Input label="Email" name="email" type="email" />
        <Input label="Phone" name="phone" />
        <Textarea label="Notes" name="notes" />
        <MutationError error={mutation.error} />
        <Button fullWidth loading={mutation.loading} type="submit">Create client</Button>
      </form>
    </Modal>
  )
}
