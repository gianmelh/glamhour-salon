import { type ChangeEvent } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { cn } from '../../lib/cn'
import type { OnboardingDayInput, Service } from '../../types/api'
import { normalizeProfessionalDraft, type ProfessionalDraft } from './professionalDraft'
import { providerScheduleErrors } from '../../lib/provider-settings'
import { ProviderLanguages } from './ProviderLanguages'
import { ProviderWeeklySchedule } from './ProviderWeeklySchedule'
import { ProviderDialog } from '../layout/ProviderDialog'
import { MutationError } from './MutationError'

export function ProfessionalEditorModal({ draft: initialDraft, services, salonSchedule, loading, error, onChange, onSubmit, onCancel }: {
  draft: ProfessionalDraft
  services: Service[]
  salonSchedule: Record<string, OnboardingDayInput>
  loading: boolean
  error: Error | null
  onChange: (draft: ProfessionalDraft) => void
  onSubmit: (draft: ProfessionalDraft) => void
  onCancel: () => void
}) {
  const availableServices = services.filter((service) => service.is_active)
  const availableServiceIds = new Set(availableServices.map((service) => service.id))
  const normalizedDraft = normalizeProfessionalDraft(initialDraft, salonSchedule)
  const draft = {
    ...normalizedDraft,
    serviceAssignments: normalizedDraft.serviceAssignments.filter((assignment) => availableServiceIds.has(assignment.serviceId)),
  }
  const scheduleValid = draft.useSalonSchedule || Object.keys(providerScheduleErrors(draft.schedule!)).length === 0

  const selectedIds = new Set(draft.serviceAssignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId))
  const update = (patch: Partial<ProfessionalDraft>) => onChange({ ...draft, ...patch })
  const canSave = draft.fullName.trim().length > 0
    && draft.languages.length > 0
    && selectedIds.size > 0
    && scheduleValid

  const toggleService = (serviceId: string) => {
    const exists = draft.serviceAssignments.find((assignment) => assignment.serviceId === serviceId)
    update({
      serviceAssignments: exists
        ? draft.serviceAssignments.map((assignment) => assignment.serviceId === serviceId ? { ...assignment, isActive: !assignment.isActive } : assignment)
        : [...draft.serviceAssignments, {
          serviceId,
          isActive: true,
          durationOverrideMinutes: availableServices.find((service) => service.id === serviceId)?.duration_minutes ?? 60,
        }],
    })
  }

  const groupedServices = availableServices.reduce<Record<string, Service[]>>((acc, service) => {
    const key = service.category_name ?? service.category_code ?? 'Services'
    acc[key] = [...(acc[key] ?? []), service]
    return acc
  }, {})

  return (
    <ProviderDialog
      title={draft.id ? 'Edit provider' : 'Add provider'}
      description="Enter staff details and assign services."
      onClose={onCancel}
      actions={(
        <div className="space-y-3">
          <MutationError error={error} />
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={onCancel} variant="outline">Cancel</Button>
            <Button disabled={!canSave} loading={loading} onClick={() => onSubmit(draft)}>
              {draft.id ? 'Save provider' : 'Add provider'}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <PhotoPicker draft={draft} onChange={update} />
        <Input label="Full name" placeholder="Enter full name..." value={draft.fullName} onChange={(event) => update({ fullName: event.target.value })} />
        <Input label="Email" placeholder="provider@salon.com" type="email" value={draft.email ?? ''} onChange={(event) => update({ email: event.target.value })} />
        <Input label="Phone" placeholder="+1 555 000 0000" value={draft.phone ?? ''} onChange={(event) => update({ phone: event.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salon earnings %" max={100} min={0} type="number" value={draft.salonEarningsPercent} onChange={(event) => update({ salonEarningsPercent: Number(event.target.value), professionalEarningsPercent: 100 - Number(event.target.value) })} />
          <Input label="Provider earnings %" max={100} min={0} type="number" value={draft.professionalEarningsPercent} onChange={(event) => update({ professionalEarningsPercent: Number(event.target.value), salonEarningsPercent: 100 - Number(event.target.value) })} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[#11172a]">Languages</p>
          <ProviderLanguages languages={draft.languages} onChange={(languages) => update({ languages })} />
        </div>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#11172a]">Working hours</p>
              <p className="text-xs text-[#68738b]">Use the salon schedule</p>
            </div>
            <Toggle label="Use the salon schedule" checked={draft.useSalonSchedule} onChange={(checked) => update({ useSalonSchedule: checked, schedule: checked ? salonSchedule : draft.schedule })} />
          </div>
        </Card>

        {draft.useSalonSchedule && (
          <ProviderWeeklySchedule readOnly onChange={() => undefined} schedule={salonSchedule} salonSchedule={salonSchedule} />
        )}
        {!draft.useSalonSchedule && (
          <ProviderWeeklySchedule onChange={(schedule) => update({ schedule })} schedule={draft.schedule ?? salonSchedule} salonSchedule={salonSchedule} />
        )}

        <Card className="space-y-4">
          <div>
            <p className="text-sm font-bold text-[#11172a]">Services & treatments</p>
            <p className="mt-1 text-xs text-[#68738b]">Assign at least one service so this provider can be booked.</p>
          </div>
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div className="space-y-2" key={category}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#68738b]">{category}</p>
              {categoryServices.map((service) => {
                const assignment = draft.serviceAssignments.find((item) => item.serviceId === service.id)
                return (
                  <div className="grid grid-cols-[1fr_86px] gap-2" key={service.id}>
                    <button
                      aria-pressed={selectedIds.has(service.id)}
                      className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold', selectedIds.has(service.id) ? 'border-primary bg-[#f2edff]' : 'border-border bg-surface')}
                      onClick={() => toggleService(service.id)}
                      type="button"
                    >
                      <CheckMark checked={selectedIds.has(service.id)} /> {service.name}
                    </button>
                    <Input
                      aria-label={`${service.name} duration`}
                      min={1}
                      placeholder="60"
                      type="number"
                      value={assignment?.durationOverrideMinutes ?? service.duration_minutes}
                      onChange={(event) => update({
                        serviceAssignments: draft.serviceAssignments.map((item) => item.serviceId === service.id ? { ...item, durationOverrideMinutes: Number(event.target.value) } : item),
                      })}
                    />
                  </div>
                )
              })}
            </div>
          ))}
          {!availableServices.length && (
            <p className="text-xs text-[#68738b]">No assignable services found. Enable a service category in Settings, then add active services.</p>
          )}
          {availableServices.length > 0 && selectedIds.size === 0 && (
            <p className="text-xs font-semibold text-amber-700">Select at least one service to make this provider bookable.</p>
          )}
        </Card>

      </div>
    </ProviderDialog>
  )
}

function PhotoPicker({ draft, onChange }: { draft: ProfessionalDraft; onChange: (patch: Partial<ProfessionalDraft>) => void }) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Please upload an image smaller than 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange({ avatarUrl: String(reader.result), photoName: file.name })
    reader.readAsDataURL(file)
  }

  return (
    <label className="mx-auto grid w-fit cursor-pointer place-items-center gap-2 text-center text-xs text-[#68738b]">
      <span className="grid size-28 place-items-center overflow-hidden rounded-full border border-[#cbd4e3] bg-[#f2f5ff]">
        {draft.avatarUrl ? <img alt="Provider preview" className="size-full object-cover" src={draft.avatarUrl} /> : <span className="grid place-items-center gap-1"><UserRound className="size-8" /> Add photo</span>}
      </span>
      <span>Min 400x400px · Max 2MB</span>
      <input accept="image/png,image/jpeg" className="sr-only" type="file" onChange={handleFile} />
    </label>
  )
}

function Toggle({ checked, disabled = false, onChange, label }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={cn('relative h-8 w-14 shrink-0 rounded-full transition', checked ? 'bg-[#7a3fe0]' : 'bg-[#d8d8d8]')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className={cn('absolute top-1 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-7' : 'left-1')} />
    </button>
  )
}

function CheckMark({ checked }: { checked: boolean }) {
  return <span className={cn('grid size-5 place-items-center rounded border text-[13px]', checked ? 'border-primary bg-white text-primary' : 'border-border-strong bg-surface-soft')}>{checked ? '✓' : ''}</span>
}
