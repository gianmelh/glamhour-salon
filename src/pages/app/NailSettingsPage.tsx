import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Clock3, Plus, Save, Trash2, UserRound } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../../components'
import { MutationError } from '../../components/screen/MutationError'
import { ScreenSection } from '../../components/screen/ScreenSection'
import { useAppointments, useNailSettings } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { cn } from '../../lib/cn'
import { glamhourApi } from '../../services/glamhour-api'
import type {
  Appointment, NailMaterialInput, NailSettingsResponse, NailSettingsServiceInput,
  ProfessionalWithNailSettings, UpsertProfessionalInput,
} from '../../types/api'

type ProviderDraft = UpsertProfessionalInput & { id?: string; photoName?: string }

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const languageOptions = ['English', 'Spanish', 'Portuguese', 'Arabic']

function moneyFromMinor(value: number) {
  return String(Math.round(value / 100))
}

function moneyToMinor(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0
}

function serviceInputFromResponse(service: NailSettingsResponse['services'][number], index: number): NailSettingsServiceInput {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    priceMinor: service.price_minor,
    durationMinutes: service.duration_minutes,
    isActive: service.is_active,
    sortOrder: service.sort_order ?? index + 1,
  }
}

function materialInputFromResponse(material: NailSettingsResponse['materials'][number], index: number): NailMaterialInput {
  return {
    id: material.id,
    serviceId: material.service_id,
    name: material.name,
    brand: material.brand,
    materialType: material.material_type,
    unit: material.unit,
    costMinor: material.cost_minor,
    isActive: material.is_active,
    sortOrder: material.sort_order ?? index + 1,
  }
}

function providerDraft(provider: ProfessionalWithNailSettings | undefined, settings: NailSettingsResponse): ProviderDraft {
  const defaultSchedule = settings.salonSchedule
  if (!provider) {
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
      schedule: defaultSchedule,
      serviceAssignments: [],
    }
  }

  return {
    id: provider.id,
    fullName: provider.full_name,
    email: provider.email ?? '',
    phone: provider.phone ?? '',
    avatarUrl: provider.avatar_url,
    languages: provider.languages,
    status: provider.status === 'inactive' ? 'inactive' : 'active',
    salonEarningsPercent: Number(provider.salon_earnings_percent),
    professionalEarningsPercent: Number(provider.professional_earnings_percent),
    useSalonSchedule: provider.use_salon_schedule,
    schedule: provider.schedule,
    serviceAssignments: provider.service_assignments.map((assignment) => ({
      serviceId: assignment.service_id,
      isActive: assignment.is_active,
      durationOverrideMinutes: assignment.duration_override_minutes,
      priceOverrideMinor: assignment.price_override_minor,
    })),
  }
}

export function NailSettingsPage() {
  const navigate = useNavigate()
  const settings = useNailSettings()
  const appointments = useAppointments()
  const [categoryEnabled, setCategoryEnabled] = useState(true)
  const [services, setServices] = useState<NailSettingsServiceInput[]>([])
  const [materials, setMaterials] = useState<NailMaterialInput[]>([])
  const [editor, setEditor] = useState<ProviderDraft | null>(null)
  const [message, setMessage] = useState('')
  const [deleteIssue, setDeleteIssue] = useState<{ provider: ProfessionalWithNailSettings; message: string } | null>(null)
  const saveSettings = useMutation((input: { categoryEnabled: boolean; services: NailSettingsServiceInput[]; materials: NailMaterialInput[]; forceDisable?: boolean }) => (
    glamhourApi.updateNailSettings(input)
  ))
  const saveProvider = useMutation((input: ProviderDraft) => (
    input.id ? glamhourApi.updateProfessional(input.id, input) : glamhourApi.createProfessional(input)
  ))
  const deleteProvider = useMutation((id: string) => glamhourApi.deleteProfessional(id))
  const reassignProvider = useMutation((input: { providerId: string; replacementProviderId: string; appointmentIds: string[] }) => (
    glamhourApi.reassignProfessional(input.providerId, { replacementProviderId: input.replacementProviderId, appointmentIds: input.appointmentIds })
  ))

  useEffect(() => {
    if (!settings.data) return
    // This page edits a local draft before persisting changes back to the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryEnabled(settings.data.category.isEnabled)
    setServices(settings.data.services.map(serviceInputFromResponse))
    setMaterials(settings.data.materials.map(materialInputFromResponse))
  }, [settings.data])

  const serviceOptions = useMemo(() => [
    { label: 'Any Nail service', value: '' },
    ...services.map((service) => ({ label: service.name, value: service.id ?? '' })).filter((option) => option.value),
  ], [services])

  if (settings.loading) return <LoadingState label="Loading Nail settings..." />
  if (!settings.data && settings.error) return <ErrorState description={settings.error.message} onRetry={settings.retry} />
  if (!settings.data) return <ErrorState description="Nail settings could not be loaded." onRetry={settings.retry} />

  const data = settings.data
  const staffLimitReached = data.activeStaffCount >= data.staffLimit

  const saveAll = async (forceDisable = false) => {
    setMessage('')
    const result = await saveSettings.mutate({ categoryEnabled, services, materials, forceDisable })
    setCategoryEnabled(result.category.isEnabled)
    setServices(result.services.map(serviceInputFromResponse))
    setMaterials(result.materials.map(materialInputFromResponse))
    setMessage('Your Nail service settings were saved.')
  }

  const openProvider = (provider?: ProfessionalWithNailSettings) => setEditor(providerDraft(provider, data))

  const submitProvider = async () => {
    if (!editor) return
    setMessage('')
    const payload = {
      ...editor,
      serviceAssignments: editor.serviceAssignments.filter((assignment) => assignment.isActive),
    }
    await saveProvider.mutate(payload)
    setEditor(null)
    await settings.retry()
    setMessage('Provider settings were saved.')
  }

  const removeProvider = async (provider: ProfessionalWithNailSettings) => {
    setDeleteIssue(null)
    try {
      await deleteProvider.mutate(provider.id)
      await settings.retry()
      setMessage('Provider was removed from your team.')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Cannot be deleted.'
      setDeleteIssue({ provider, message: reason })
    }
  }

  const futureAppointments = (providerId: string) => (appointments.data ?? []).filter((appointment) => (
    appointment.professional_id === providerId
    && new Date(appointment.starts_at).getTime() > Date.now()
    && !['completed', 'canceled', 'no_show'].includes(appointment.status_code)
  ))

  return (
    <div className="space-y-5 pb-8">
      <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => navigate('/app/settings')} type="button">
        <ChevronLeft className="size-4" /> Go back
      </button>

      <div>
        <h1 className="text-[28px] font-bold leading-tight text-[#11172a]">Nail Services</h1>
        <p className="mt-1 text-sm leading-5 text-[#68738b]">Maintain and configure services.</p>
      </div>

      {message && <p className="rounded-md bg-success-soft px-3 py-2 text-xs font-medium text-success">{message}</p>}
      <MutationError error={saveSettings.error} />

      <Card className="space-y-3 bg-[#f2f5ff]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#11172a]">Nails category</p>
            <p className="mt-1 text-xs leading-5 text-[#68738b]">{data.category.description ?? 'Manicures, pedicures, acrylics, and nail art.'}</p>
          </div>
          <Switch checked={categoryEnabled} onChange={setCategoryEnabled} />
        </div>
        {!categoryEnabled && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">Future Nail appointments must be reviewed before disabling this category.</p>
        )}
      </Card>

      <ScreenSection title="Services">
        <div className="space-y-3">
          {services.length ? services.map((service, index) => (
            <ServiceEditor
              key={service.id ?? index}
              service={service}
              update={(patch) => setServices((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))}
            />
          )) : <EmptyState compact description="Add Nail services to start taking appointments." title="No Nail services" />}
          <Button
            fullWidth
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setServices((current) => [...current, { name: 'New service', description: '', priceMinor: 0, durationMinutes: 60, isActive: true, sortOrder: current.length + 1 }])}
            variant="outline"
          >
            Add service
          </Button>
        </div>
      </ScreenSection>

      <ScreenSection title="Materials">
        <div className="space-y-3">
          {materials.map((material, index) => (
            <MaterialEditor
              key={material.id ?? index}
              material={material}
              serviceOptions={serviceOptions}
              update={(patch) => setMaterials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))}
              remove={() => setMaterials((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))}
          {!materials.length && <EmptyState compact description="Track acrylic, gel, capsules, top coats, and other Nail materials." title="No materials yet" />}
          <Button
            fullWidth
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setMaterials((current) => [...current, { name: 'New material', brand: '', materialType: '', unit: '', costMinor: null, serviceId: null, isActive: true, sortOrder: current.length + 1 }])}
            variant="outline"
          >
            Add material
          </Button>
        </div>
      </ScreenSection>

      <Button fullWidth loading={saveSettings.loading} onClick={() => saveAll()} size="lg">
        <Save className="size-4" /> Save changes
      </Button>

      <ScreenSection title="Team & Providers">
        <div className="space-y-3">
          {data.providers.map((provider) => (
            <ProviderCard
              futureAppointments={futureAppointments(provider.id).length}
              key={provider.id}
              onDelete={() => removeProvider(provider)}
              onEdit={() => openProvider(provider)}
              provider={provider}
              services={data.services}
            />
          ))}
          {!data.providers.length && <EmptyState compact description="Add providers and assign Nail services." title="No providers yet" />}
          {staffLimitReached ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">You've reached the limit of 10 active staff members. Upgrade your plan to add more providers.</p>
          ) : (
            <Button fullWidth leadingIcon={<Plus className="size-4" />} onClick={() => openProvider()} variant="secondary">Add New Provider</Button>
          )}
        </div>
      </ScreenSection>

      {editor && (
        <ProviderEditor
          draft={editor}
          loading={saveProvider.loading}
          salonSchedule={data.salonSchedule}
          services={data.services.filter((service) => service.is_active)}
          error={saveProvider.error}
          onCancel={() => setEditor(null)}
          onChange={setEditor}
          onSubmit={submitProvider}
        />
      )}

      {deleteIssue && (
        <ReassignPanel
          appointments={futureAppointments(deleteIssue.provider.id)}
          loading={reassignProvider.loading}
          message={deleteIssue.message}
          provider={deleteIssue.provider}
          providers={data.providers.filter((provider) => provider.id !== deleteIssue.provider.id && provider.status === 'active')}
          error={reassignProvider.error}
          onCancel={() => setDeleteIssue(null)}
          onSubmit={async (replacementProviderId) => {
            await reassignProvider.mutate({
              providerId: deleteIssue.provider.id,
              replacementProviderId,
              appointmentIds: futureAppointments(deleteIssue.provider.id).map((appointment) => appointment.id),
            })
            setDeleteIssue(null)
            await settings.retry()
            setMessage('Appointments were reassigned and the provider was deactivated.')
          }}
        />
      )}
    </div>
  )
}

function ServiceEditor({ service, update }: { service: NailSettingsServiceInput; update: (patch: Partial<NailSettingsServiceInput>) => void }) {
  return (
    <Card className={cn('space-y-3', service.isActive && 'border-primary/30 bg-[#f2edff]')}>
      <div className="flex items-center justify-between gap-3">
        <Input label="Service name" value={service.name} onChange={(event) => update({ name: event.target.value })} />
        <Switch checked={service.isActive} onChange={(checked) => update({ isActive: checked })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Base price" min={0} type="number" value={moneyFromMinor(service.priceMinor)} onChange={(event) => update({ priceMinor: moneyToMinor(event.target.value) })} />
        <Input label="Duration min" min={1} type="number" value={service.durationMinutes} onChange={(event) => update({ durationMinutes: Number(event.target.value) })} />
      </div>
      <Input label="Description" value={service.description ?? ''} onChange={(event) => update({ description: event.target.value })} />
    </Card>
  )
}

function MaterialEditor({ material, serviceOptions, update, remove }: {
  material: NailMaterialInput
  serviceOptions: Array<{ label: string; value: string }>
  update: (patch: Partial<NailMaterialInput>) => void
  remove: () => void
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Input label="Material name" value={material.name} onChange={(event) => update({ name: event.target.value })} />
        <button className="mt-5 grid size-10 place-items-center rounded-md border border-border text-danger" onClick={remove} type="button"><Trash2 className="size-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Brand" value={material.brand ?? ''} onChange={(event) => update({ brand: event.target.value })} />
        <Input label="Type" value={material.materialType ?? ''} onChange={(event) => update({ materialType: event.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Unit" value={material.unit ?? ''} onChange={(event) => update({ unit: event.target.value })} />
        <Input label="Cost" min={0} type="number" value={material.costMinor ? moneyFromMinor(material.costMinor) : ''} onChange={(event) => update({ costMinor: event.target.value ? moneyToMinor(event.target.value) : null })} />
      </div>
      <Select label="Assign to service" options={serviceOptions} value={material.serviceId ?? ''} onChange={(event) => update({ serviceId: event.target.value || null })} />
      <div className="flex items-center justify-between text-xs font-semibold text-ink">
        Active material <Switch checked={material.isActive} onChange={(checked) => update({ isActive: checked })} />
      </div>
    </Card>
  )
}

function ProviderCard({ provider, services, futureAppointments, onEdit, onDelete }: {
  provider: ProfessionalWithNailSettings
  services: NailSettingsResponse['services']
  futureAppointments: number
  onEdit: () => void
  onDelete: () => void
}) {
  const assignedServiceIds = new Set(provider.service_assignments.filter((assignment) => assignment.is_active).map((assignment) => assignment.service_id))
  const assignedServices = services.filter((service) => assignedServiceIds.has(service.id))
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar name={provider.full_name} src={provider.avatar_url ?? undefined} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#11172a]">{provider.full_name}</p>
          <div className="mt-1 flex flex-wrap gap-1">{provider.languages.map((language) => <Badge key={language}>{language}</Badge>)}</div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#68738b]"><Clock3 className="size-3.5" /> {provider.use_salon_schedule ? 'Standard Salon Hours' : 'Custom Working Hours'}</p>
        </div>
        <Badge tone={provider.status === 'active' ? 'success' : 'warning'}>{provider.status}</Badge>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#11172a]">Services</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {assignedServices.length ? assignedServices.map((service) => <Badge key={service.id}>{service.name}</Badge>) : <Badge tone="warning">No services assigned</Badge>}
        </div>
      </div>
      {futureAppointments > 0 && <p className="text-xs text-warning">{futureAppointments} future appointments</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onEdit} variant="secondary">Edit</Button>
        <Button onClick={onDelete} variant="outline">Delete</Button>
      </div>
    </Card>
  )
}

function ProviderEditor({ draft, services, salonSchedule, loading, error, onChange, onSubmit, onCancel }: {
  draft: ProviderDraft
  services: NailSettingsResponse['services']
  salonSchedule: Record<string, { enabled: boolean; open: string; close: string }>
  loading: boolean
  error: Error | null
  onChange: (draft: ProviderDraft) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const selectedIds = new Set(draft.serviceAssignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId))
  const update = (patch: Partial<ProviderDraft>) => onChange({ ...draft, ...patch })
  const toggleService = (serviceId: string) => {
    const exists = draft.serviceAssignments.find((assignment) => assignment.serviceId === serviceId)
    update({
      serviceAssignments: exists
        ? draft.serviceAssignments.map((assignment) => assignment.serviceId === serviceId ? { ...assignment, isActive: !assignment.isActive } : assignment)
        : [...draft.serviceAssignments, { serviceId, isActive: true, durationOverrideMinutes: services.find((service) => service.id === serviceId)?.duration_minutes ?? 60 }],
    })
  }

  return (
    <Card className="fixed inset-x-3 bottom-3 z-20 max-h-[88dvh] overflow-y-auto bg-[#f2f5ff] p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[#11172a]">Provider</p>
          <p className="text-xs text-[#68738b]">Enter the details of the staff member.</p>
        </div>
        <Button onClick={onCancel} size="sm" variant="ghost">Close</Button>
      </div>
      <div className="space-y-4">
        <PhotoPicker draft={draft} onChange={update} />
        <Input label="Full name" placeholder="Enter full name..." value={draft.fullName} onChange={(event) => update({ fullName: event.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salon Earnings" min={0} max={100} type="number" value={draft.salonEarningsPercent} onChange={(event) => update({ salonEarningsPercent: Number(event.target.value), professionalEarningsPercent: 100 - Number(event.target.value) })} />
          <Input label="Provider Earnings" min={0} max={100} type="number" value={draft.professionalEarningsPercent} onChange={(event) => update({ professionalEarningsPercent: Number(event.target.value), salonEarningsPercent: 100 - Number(event.target.value) })} />
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
              <p className="text-sm font-bold text-[#11172a]">Working Hours</p>
              <p className="text-xs text-[#68738b]">Set my schedule same than salon schedule</p>
            </div>
            <Switch checked={draft.useSalonSchedule} onChange={(checked) => update({ useSalonSchedule: checked, schedule: checked ? salonSchedule : draft.schedule })} />
          </div>
        </Card>
        {!draft.useSalonSchedule && <WeeklySchedule schedule={draft.schedule ?? salonSchedule} onChange={(schedule) => update({ schedule })} />}
        <Card className="space-y-3">
          <p className="text-sm font-bold text-[#11172a]">Services & Treatments</p>
          {services.map((service) => {
            const assignment = draft.serviceAssignments.find((item) => item.serviceId === service.id)
            return (
              <div className="grid grid-cols-[1fr_86px] gap-2" key={service.id}>
                <button
                  className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold', selectedIds.has(service.id) ? 'border-primary bg-[#f2edff]' : 'border-border bg-surface')}
                  onClick={() => toggleService(service.id)}
                  type="button"
                >
                  <CheckBox checked={selectedIds.has(service.id)} /> {service.name}
                </button>
                <Input
                  aria-label={`${service.name} duration`}
                  min={1}
                  placeholder="40 min"
                  type="number"
                  value={assignment?.durationOverrideMinutes ?? service.duration_minutes}
                  onChange={(event) => update({
                    serviceAssignments: draft.serviceAssignments.map((item) => item.serviceId === service.id ? { ...item, durationOverrideMinutes: Number(event.target.value) } : item),
                  })}
                />
              </div>
            )
          })}
        </Card>
        <MutationError error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onCancel} variant="outline">Back</Button>
          <Button loading={loading} onClick={onSubmit}>Save provider</Button>
        </div>
      </div>
    </Card>
  )
}

function PhotoPicker({ draft, onChange }: { draft: ProviderDraft; onChange: (patch: Partial<ProviderDraft>) => void }) {
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
    <label className="mx-auto grid w-fit place-items-center gap-2 text-center text-xs text-[#68738b]">
      <span className="grid size-28 place-items-center overflow-hidden rounded-full border border-[#cbd4e3] bg-[#f2f5ff]">
        {draft.avatarUrl ? <img alt="Provider preview" className="size-full object-cover" src={draft.avatarUrl} /> : <span className="grid place-items-center gap-1"><UserRound className="size-8" /> Add Photo</span>}
      </span>
      <span>Min 400x400px<br />Max 2MB</span>
      <input accept="image/png,image/jpeg" className="sr-only" type="file" onChange={handleFile} />
    </label>
  )
}

function WeeklySchedule({ schedule, onChange }: { schedule: Record<string, { enabled: boolean; open: string; close: string }>; onChange: (schedule: Record<string, { enabled: boolean; open: string; close: string }>) => void }) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-lg font-bold text-[#11172a]">Weekly Schedule</p>
        <p className="text-xs leading-5 text-[#68738b]">Configure opening and closing times for each day</p>
      </div>
      {weekdays.map((day) => {
        const value = schedule[day] ?? { enabled: false, open: '09:00', close: '18:00' }
        return (
          <div className="border-b border-border pb-3 last:border-b-0" key={day}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#11172a]">{day}</p>
              <Switch checked={value.enabled} onChange={(checked) => onChange({ ...schedule, [day]: { ...value, enabled: checked } })} />
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

function ReassignPanel({ provider, providers, appointments, message, loading, error, onCancel, onSubmit }: {
  provider: ProfessionalWithNailSettings
  providers: ProfessionalWithNailSettings[]
  appointments: Appointment[]
  message: string
  loading: boolean
  error: Error | null
  onCancel: () => void
  onSubmit: (replacementProviderId: string) => void
}) {
  const [replacementProviderId, setReplacementProviderId] = useState(providers[0]?.id ?? '')
  return (
    <Card className="fixed inset-x-3 bottom-3 z-30 max-h-[80dvh] overflow-y-auto p-5 shadow-2xl">
      <p className="text-lg font-bold text-[#11172a]">Cannot be deleted</p>
      <p className="mt-2 text-xs leading-5 text-[#68738b]">{message}</p>
      <p className="mt-3 text-xs font-semibold text-[#11172a]">{appointments.length} future appointments for {provider.full_name}</p>
      {providers.length ? (
        <div className="mt-4 space-y-4">
          <Select label="Reassign provider" options={providers.map((item) => ({ label: item.full_name, value: item.id }))} value={replacementProviderId} onChange={(event) => setReplacementProviderId(event.target.value)} />
          <MutationError error={error} />
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={onCancel} variant="outline">Cancel</Button>
            <Button disabled={!replacementProviderId || !appointments.length} loading={loading} onClick={() => onSubmit(replacementProviderId)}>Reassign</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">No eligible replacement provider is active.</p>
          <Button fullWidth onClick={onCancel} variant="outline">Cancel</Button>
        </div>
      )}
    </Card>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
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

function CheckBox({ checked }: { checked: boolean }) {
  return <span className={cn('grid size-5 place-items-center rounded border text-[13px]', checked ? 'border-primary bg-white text-primary' : 'border-border-strong bg-surface-soft')}>{checked ? '✓' : ''}</span>
}

export function NailSettingsEntryLink() {
  return <Link to="/app/settings/services/nails">Service details</Link>
}
