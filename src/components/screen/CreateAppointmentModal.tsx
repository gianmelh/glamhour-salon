import { glamhourApi } from '../../services/glamhour-api'
import type { Appointment, Client, Professional, Service } from '../../types/api'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Select, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateAppointmentModal({ clients, professionals, services, open, onClose, onCreated }: {
  clients: Client[]; professionals: Professional[]; services: Service[]; open: boolean; onClose: () => void; onCreated: (appointment: Appointment) => void
}) {
  const mutation = useMutation(glamhourApi.createAppointment)
  return (
    <Modal onClose={onClose} open={open} title="Create appointment" variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const startsAt = new Date(String(form.get('startsAt')))
        const service = services.find((item) => item.id === String(form.get('serviceId')))
        const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 60) * 60_000)
        const appointment = await mutation.mutate({ clientId: String(form.get('clientId')), professionalId: String(form.get('professionalId')), serviceIds: [String(form.get('serviceId'))], startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), customerNotes: String(form.get('notes')) })
        onCreated(appointment)
        onClose()
      }}>
        <Select label="Client" name="clientId" options={clients.map((item) => ({ label: item.full_name, value: item.id }))} />
        <Select label="Professional" name="professionalId" options={professionals.map((item) => ({ label: item.full_name, value: item.id }))} />
        <Select label="Service" name="serviceId" options={services.map((item) => ({ label: item.name, value: item.id }))} />
        <Input label="Start date and time" name="startsAt" required type="datetime-local" />
        <Textarea label="Client notes" name="notes" />
        <MutationError error={mutation.error} />
        <Button fullWidth loading={mutation.loading} type="submit">Create appointment</Button>
      </form>
    </Modal>
  )
}
