import { useState } from 'react'
import { Pencil, Phone, UserRound } from 'lucide-react'
import { Button, Card } from '../../../../components'
import { cn } from '../../../../lib/cn'
import type { Client, Service, ServiceCategory } from '../../../../types/api'
import { buildReviewSections } from '../reviewSummary'
import { CategoryStepHeader, ReviewRow } from '../components/shared'

export function AppointmentDetailsStep({ category, service, client, details, notes, onEdit, onNext }: {
  category: ServiceCategory
  service: Service
  client: Client
  details: Record<string, unknown>
  notes: string
  onEdit: () => void
  onNext: () => void
}) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const sections = buildReviewSections(category, service, client, undefined, '', details, notes)
    .filter((section) => section.title !== 'Appointment')

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-6 px-5 pb-8">
      <CategoryStepHeader onBack={onEdit} title="Appointment details" />

      <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#ebe7ff]">
            <UserRound className="size-5 text-[#7344cd]" />
          </span>
          <div>
            <p className="font-bold text-[#0c111d]">{client.full_name}</p>
            {client.phone && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-[#7344cd]">
                <Phone className="size-3.5" /> {client.phone}
              </p>
            )}
          </div>
        </div>
        <ReviewRow label="Service" value={`${category.name} · ${service.name}`} />
      </Card>

      {sections.map((section) => (
        <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-white p-4" key={section.title}>
          <p className="text-[21px] font-bold text-[#0c111d]">{section.title}</p>
          {section.rows.map((row) => (
            <ReviewRow key={`${section.title}-${row.label}`} label={row.label} value={row.value} />
          ))}
        </Card>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <Button fullWidth onClick={() => setShowUpdateModal(true)} variant="outline">
          <Pencil className="size-4" /> Update
        </Button>
        <Button className="rounded-[16px]" fullWidth onClick={onNext}>Continue</Button>
      </div>

      {showUpdateModal && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
          <Card className="w-full max-w-[393px] space-y-4 rounded-[24px] border-0 p-6 shadow-xl">
            <h2 className="text-[21px] font-bold text-[#0c111d]">Update selections?</h2>
            <p className="text-sm text-[#475467]">
              You will return to the service details step. Your health questionnaire answers will be kept.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button fullWidth onClick={() => setShowUpdateModal(false)} variant="outline">Cancel</Button>
              <Button fullWidth onClick={() => { setShowUpdateModal(false); onEdit() }}>Update</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export function ClientSearchCard({ client, selected, subtitle }: {
  client: Client
  selected?: boolean
  subtitle?: string
}) {
  return (
    <Card className={cn('rounded-[16px] border-[#d0d5dd] bg-white p-4', selected && 'border-[#7344cd] bg-[#ebe7ff]')}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#ebe7ff]">
          <UserRound className="size-5 text-[#7344cd]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#0c111d]">{client.full_name}</p>
          {client.phone && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-[#7344cd]">
              <Phone className="size-3.5 shrink-0" /> {client.phone}
            </p>
          )}
          {subtitle && <p className="mt-1 text-xs text-[#667085]">{subtitle}</p>}
        </div>
      </div>
    </Card>
  )
}
