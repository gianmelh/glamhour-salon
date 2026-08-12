import { glamhourApi } from '../../services/glamhour-api'
import type { Appointment, Client, Professional, Service } from '../../types/api'
import { useMutation } from '../../hooks/useMutation'
import { Modal } from '../feedback/Modal'
import { Button, Input, Select, Textarea } from '../ui'
import { MutationError } from './MutationError'

export function CreateAppointmentModal({ clients, professionals, services, open, onClose, onCreated, initialValues }: {
  clients: Client[]; professionals: Professional[]; services: Service[]; open: boolean; onClose: () => void; onCreated: (appointment: Appointment) => void
  initialValues?: {
    clientId?: string
    professionalId?: string
    serviceId?: string
  }
}) {
  const mutation = useMutation(glamhourApi.createAppointment)
  return (
    <Modal onClose={onClose} open={open} title="Create appointment" variant="sheet">
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const date = String(form.get('date') ?? '')
        const time = String(form.get('time') ?? '')
        const startsAt = new Date(`${date}T${time}`)
        const service = services.find((item) => item.id === String(form.get('serviceId')))
        const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 60) * 60_000)
        const professionalId = String(form.get('professionalId') ?? '')
        const appointment = await mutation.mutate({
          clientId: String(form.get('clientId')),
          professionalId: professionalId || null,
          serviceIds: [String(form.get('serviceId'))],
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          customerNotes: String(form.get('notes') ?? '').trim() || undefined,
        })
        onCreated(appointment)
        onClose()
      }}>
        <Select defaultValue={initialValues?.clientId ?? ''} label="Client" name="clientId" options={[{ label: 'Select client', value: '' }, ...clients.map((item) => ({ label: item.full_name, value: item.id }))]} required />
        <Select defaultValue={initialValues?.serviceId ?? ''} label="Service" name="serviceId" options={[{ label: 'Select service', value: '' }, ...services.map((item) => ({ label: item.name, value: item.id }))]} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Day" name="date" required type="date" />
          <Input label="Time" name="time" required type="time" />
        </div>
        <Select defaultValue={initialValues?.professionalId ?? ''} label="Professional" name="professionalId" options={[{ label: 'No provider yet', value: '' }, ...professionals.map((item) => ({ label: item.full_name, value: item.id }))]} />
        <Textarea label="Client notes" name="notes" />
        <MutationError error={mutation.error} />
        <Button fullWidth loading={mutation.loading} type="submit">Create appointment</Button>
      </form>
    </Modal>
  )
}
