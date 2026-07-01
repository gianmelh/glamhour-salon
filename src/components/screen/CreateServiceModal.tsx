import { glamhourApi } from '../../services/glamhour-api'
import type { Service, ServiceCategory } from '../../types/api'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Select, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateServiceModal({ categories, open, onClose, onCreated }: { categories: ServiceCategory[]; open: boolean; onClose: () => void; onCreated: (service: Service) => void }) {
  const mutation = useMutation(glamhourApi.createService)
  return (
    <Modal onClose={onClose} open={open} title="Add service" variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const service = await mutation.mutate({ categoryId: String(form.get('categoryId')), name: String(form.get('name')), description: String(form.get('description')), durationMinutes: Number(form.get('durationMinutes')), priceMinor: Math.round(Number(form.get('price')) * 100) })
        onCreated(service)
        onClose()
      }}>
        <Select label="Category" name="categoryId" options={categories.map((item) => ({ label: item.name, value: item.id }))} />
        <Input label="Service name" name="name" required />
        <Input label="Duration in minutes" min="1" name="durationMinutes" required type="number" />
        <Input label="Price" min="0" name="price" required step="0.01" type="number" />
        <Textarea label="Description" name="description" />
        <MutationError error={mutation.error} />
        <Button fullWidth loading={mutation.loading} type="submit">Create service</Button>
      </form>
    </Modal>
  )
}
