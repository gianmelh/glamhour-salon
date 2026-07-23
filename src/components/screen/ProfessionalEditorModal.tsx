import { type ChangeEvent } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { cn } from '../../lib/cn'
import type { OnboardingDayInput, Service, UpsertProfessionalInput } from '../../types/api'
import { MutationError } from './MutationError'

export type ProfessionalDraft = UpsertProfessionalInput & { id?: string; photoName?: string }

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const languageOptions = ['English', 'Spanish', 'Portuguese', 'Arabic']

export const defaultSalonSchedule: Record<string, OnboardingDayInput> = Object.fromEntries(
  weekdays.map((day) => [day, { enabled: day !== 'Sunday', open: '09:00', close: '18:00' }]),
)

export function emptyProfessionalDraft(salonSchedule = defaultSalonSchedule): ProfessionalDraft {
  return {
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: null,
    languages: ['English'],
    status: 'active',
    salonEarningsPercent: 40,
    professionalEarningsPercent: 60,
    useSalonSchedule: true,
    schedule: salonSchedule,
    serviceAssignments: [],
  }
}

export function ProfessionalEditorModal({ draft, services, salonSchedule, loading, error, onChange, onSubmit, onCancel }: {
  draft: ProfessionalDraft
  services: Service[]
  salonSchedule: Record<string, OnboardingDayInput>
  loading: boolean
  error: Error | null
  onChange: (draft: ProfessionalDraft) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const selectedIds = new Set(draft.serviceAssignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId))
  const update = (patch: Partial<ProfessionalDraft>) => onChange({ ...draft, ...patch })
  const canSave = draft.fullName.trim().length > 0
    && draft.languages.length > 0
    && selectedIds.size > 0

  const toggleService = (serviceId: string) => {
    const exists = draft.serviceAssignments.find((assignment) => assignment.serviceId === serviceId)
    update({
      serviceAssignments: exists
        ? draft.serviceAssignments.map((assignment) => assignment.serviceId === serviceId ? { ...assignment, isActive: !assignment.isActive } : assignment)
        : [...draft.serviceAssignments, {
          serviceId,
          isActive: true,
          durationOverrideMinutes: services.find((service) => service.id === serviceId)?.duration_minutes ?? 60,
        }],
    })
  }

  const groupedServices = services.reduce<Record<string, Service[]>>((acc, service) => {
    const key = service.category_name ?? service.category_code ?? 'Services'
    acc[key] = [...(acc[key] ?? []), service]
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 p-3 sm:place-items-center">
      <Card className="max-h-[88dvh] w-full max-w-[393px] overflow-y-auto bg-[#f2f5ff] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-[#11172a]">{draft.id ? 'Edit provider' : 'Add provider'}</p>
            <p className="text-xs text-[#68738b]">Enter staff details and assign services.</p>
          </div>
          <Button onClick={onCancel} size="sm" variant="ghost">Close</Button>
        </div>

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
            <div className="flex flex-wrap gap-2">
              {languageOptions.map((language) => (
                <button
                  className={cn('rounded-md border px-3 py-2 text-xs font-semibold', draft.languages.includes(language) ? 'border-primary bg-lavender text-primary' : 'border-border bg-surface text-[#68738b]')}
                  key={language}
                  onClick={() => update({ languages: draft.languages.includes(language) ? draft.languages.filter((item) => item !== language) : [...draft.languages, language] })}
                  type="button"
                >
                  {language}
                </button>
              ))}
            </div>
          </div>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#11172a]">Working hours</p>
                <p className="text-xs text-[#68738b]">Use the salon schedule</p>
              </div>
              <Toggle checked={draft.useSalonSchedule} onChange={(checked) => update({ useSalonSchedule: checked, schedule: checked ? salonSchedule : draft.schedule })} />
            </div>
          </Card>

          {!draft.useSalonSchedule && (
            <WeeklySchedule onChange={(schedule) => update({ schedule })} schedule={draft.schedule ?? salonSchedule} />
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
            {!services.length && (
              <p className="text-xs text-[#68738b]">No assignable services found. Enable a service category in Settings, then add active services.</p>
            )}
            {services.length > 0 && selectedIds.size === 0 && (
              <p className="text-xs font-semibold text-amber-700">Select at least one service to make this provider bookable.</p>
            )}
          </Card>

          <MutationError error={error} />
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={onCancel} variant="outline">Cancel</Button>
            <Button disabled={!canSave} loading={loading} onClick={onSubmit}>
              {draft.id ? 'Save provider' : 'Add provider'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
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

function WeeklySchedule({ schedule, onChange }: { schedule: Record<string, OnboardingDayInput>; onChange: (schedule: Record<string, OnboardingDayInput>) => void }) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-lg font-bold text-[#11172a]">Weekly schedule</p>
        <p className="text-xs leading-5 text-[#68738b]">Configure opening and closing times for each day.</p>
      </div>
      {weekdays.map((day) => {
        const value = schedule[day] ?? { enabled: false, open: '09:00', close: '18:00' }
        return (
          <div className="border-b border-border pb-3 last:border-b-0" key={day}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#11172a]">{day}</p>
              <Toggle checked={value.enabled} onChange={(checked) => onChange({ ...schedule, [day]: { ...value, enabled: checked } })} />
            </div>
            {value.enabled && (
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input aria-label={`${day} opening time`} type="time" value={value.open} onChange={(event) => onChange({ ...schedule, [day]: { ...value, open: event.target.value } })} />
                <span className="text-xs text-[#68738b]">to</span>
                <Input aria-label={`${day} closing time`} type="time" value={value.close} onChange={(event) => onChange({ ...schedule, [day]: { ...value, close: event.target.value } })} />
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-pressed={checked}
      className={cn('relative h-8 w-14 shrink-0 rounded-full transition', checked ? 'bg-[#7a3fe0]' : 'bg-[#d8d8d8]')}
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
