import { useState } from 'react'
import { Calendar, CircleAlert, Clock, Hand, Phone, UserRound, X } from 'lucide-react'
import { Button, Card, MutationError } from '../../../../components'
import { cn } from '../../../../lib/cn'
import type { Client, Service, ServiceCategory } from '../../../../types/api'
import { healthQuestionnaires } from '../health-questionnaires'

function formatAppointmentDate(date: string) {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatAmount(minor: number) {
  const amount = minor / 100
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function buildServiceDisplayName(service: Service, details: Record<string, unknown>) {
  const serviceType = String(details.nailServiceType ?? service.name)
  const materials = Array.isArray(details.materialLabels) && details.materialLabels.length
    ? details.materialLabels
    : Array.isArray(details.materials)
      ? details.materials
      : []
  const material = materials[0] ? String(materials[0]) : ''
  return material ? `${serviceType} - ${material}` : serviceType
}

const conciseHealthLabels: Record<string, string> = {
  chemical_allergies: 'Chemical allergy',
  adhesive_allergies: 'Adhesive allergy',
  allergies_reactions: 'Allergy reaction',
  previous_reactions: 'Previous reaction',
  latex_allergy: 'Latex allergy',
  extreme_sensitivity: 'Sensitive skin',
  fume_sensitivity: 'Fume sensitivity',
  ocular_irritation: 'Eye irritation',
  skin_conditions: 'Skin condition',
  nail_infections: 'Nail infection',
  autoimmune: 'Autoimmune condition',
  coagulation_meds: 'Medication sensitivity',
  diabetic: 'Diabetes',
  diabetes_healing: 'Diabetes',
  pregnant: 'Pregnancy',
  pregnancy_breastfeeding: 'Pregnancy',
  nail_biting: 'Nail biting',
  chemical_work: 'Chemical exposure',
  recent_services: 'Recent service',
  home_removers: 'At-home removers',
  ocular_problems: 'Ocular condition',
  ocular_surgery: 'Recent eye surgery',
  contact_lenses: 'Contact lenses',
  ocular_medications: 'Eye medication',
  sleep_prone: 'Sleeps face down',
  oil_products: 'Oil products',
  eye_rubbing: 'Eye rubbing',
  endocrine: 'Endocrine condition',
  cardiovascular: 'Cardiovascular condition',
  systemic_neurological: 'Neurological condition',
  oncology: 'Oncology history',
  facial_procedures: 'Facial procedure',
  medications: 'Current medication',
  smoking_alcohol: 'Smoking/alcohol',
  skin_concerns: 'Skin concern',
  recent_peel: 'Recent peel/laser',
  sun_exposure: 'Sun exposure',
  retinoids: 'Retinoids/acids',
  facial_hair_removal: 'Recent hair removal',
  first_time: 'First service',
  endocrine_cardiovascular: 'Medical history',
  implants: 'Implants',
  herpes: 'Herpes simplex',
  previous_removal: 'Previous removal',
  keloid_history: 'Keloid history',
  blood_thinners: 'Blood thinners',
  recent_tattoo: 'Recent tattoo/PMU',
}

const allergyQuestionIds = new Set([
  'chemical_allergies',
  'adhesive_allergies',
  'allergies_reactions',
  'previous_reactions',
  'latex_allergy',
  'extreme_sensitivity',
  'fume_sensitivity',
  'ocular_irritation',
  'chemical_work',
  'home_removers',
])

function fallbackShortLabel(label: string) {
  return label
    .replace(/^Do you (have|suffer from|work with|use) /i, '')
    .replace(/^Have you (experienced|had) /i, '')
    .replace(/^Are you (taking|currently using) /i, '')
    .replace(/\?$/, '')
}

function healthHighlights(category: ServiceCategory, details: Record<string, unknown>) {
  const answers = details.healthAnswers as Record<string, string> | undefined
  const definition = healthQuestionnaires[category.code as keyof typeof healthQuestionnaires]
  const questionLabels = new Map(
    definition?.sections.flatMap((section) => section.questions.map((question) => [question.id, question.label])) ?? [],
  )
  const positiveIds = Object.entries(answers ?? {})
    .filter(([, value]) => value === 'yes')
    .map(([id]) => id)

  return {
    allergies: positiveIds
      .filter((id) => allergyQuestionIds.has(id))
      .map((id) => conciseHealthLabels[id] ?? fallbackShortLabel(questionLabels.get(id) ?? id)),
    medical: positiveIds
      .filter((id) => !allergyQuestionIds.has(id))
      .map((id) => conciseHealthLabels[id] ?? fallbackShortLabel(questionLabels.get(id) ?? id)),
  }
}

function HighlightChip({ children, tone = 'warning' }: { children: string; tone?: 'warning' | 'medical' }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-9 max-w-full items-center gap-2 rounded-[9px] px-3 text-[13px] leading-tight text-[#101828]',
        tone === 'medical' ? 'bg-[#ffe4ef]' : 'bg-[#fff1dc]',
      )}
    >
      <CircleAlert className={cn('size-4 shrink-0', tone === 'medical' ? 'text-[#f044d4]' : 'text-[#ff8a00]')} />
      <span className="truncate">{children}</span>
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/80">
        <X className="size-3.5 text-[#667085]" />
      </span>
    </span>
  )
}

export function AppointmentDetailsStep({ category, service, client, date, details, notes, loading, error, onDetailsChange, onEdit, onNext }: {
  category: ServiceCategory
  service: Service
  client: Client
  date: string
  details: Record<string, unknown>
  notes: string
  loading?: boolean
  error?: Error | null
  onDetailsChange?: (details: Record<string, unknown>) => void
  onEdit: () => void
  onNext: () => void
}) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const displayName = buildServiceDisplayName(service, details)
  const highlights = healthHighlights(category, details)
  const priceIsEditable = service.price_minor <= 0
  const manualPriceMinor = typeof details.appointmentPriceMinor === 'number' ? details.appointmentPriceMinor : service.price_minor
  const amountValue = priceIsEditable ? formatAmount(manualPriceMinor) : formatAmount(service.price_minor)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[393px] flex-col pb-8">
      <header className="flex min-w-0 items-center gap-3">
        <button className="-ml-1 grid size-9 shrink-0 place-items-center text-[#111827]" onClick={onEdit} type="button" aria-label="Back">
          <svg aria-hidden className="h-8 w-5" fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="min-w-0 truncate text-[29px] font-extrabold leading-[1.15] tracking-normal text-[#0c111d]">
          Appointment Details
        </h1>
      </header>

      <p className="mt-5 text-[16px] leading-6 text-[#667085]">Review and edit appointment information</p>

      <div className="mt-9 rounded-[16px] bg-glam-gradient px-4 py-[17px] text-white shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-[50px] shrink-0 place-items-center rounded-[12px] bg-white/20">
            <Hand className="size-6 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-white/82">Service</p>
            <p className="truncate text-[18px] font-bold leading-6">{displayName}</p>
          </div>
        </div>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-[20px] font-extrabold leading-tight text-[#0c111d]">Client Information</h2>
        <label className="grid gap-2 text-[16px] text-[#101828]">
          Client name
          <input
            className="min-h-[49px] w-full rounded-[15px] border border-[#d0d5dd] bg-white px-4 text-[16px] text-[#667085] outline-none shadow-sm"
            readOnly
            value={client.full_name}
          />
        </label>
      </section>

      <section className="mt-9 space-y-4">
        <h2 className="text-[20px] font-extrabold leading-tight text-[#0c111d]">Appointment Settings</h2>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <label className="grid min-w-0 gap-2 text-[16px] text-[#101828]">
            Date
            <span className="relative block">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7f3ff2]" />
              <input
                className="min-h-[50px] w-full rounded-[7px] border border-[#d0d5dd] bg-white pl-12 pr-3 text-[15px] text-[#344054] outline-none shadow-sm"
                readOnly
                value={formatAppointmentDate(date)}
              />
            </span>
          </label>
          <label className="grid min-w-0 gap-2 text-[16px] text-[#101828]">
            Duration
            <span className="flex items-center gap-2">
              <span className="relative min-w-0 flex-1">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7f3ff2]" />
                <input
                  className="min-h-[50px] w-full rounded-[15px] border border-[#d0d5dd] bg-white pl-10 pr-3 text-[15px] text-[#667085] outline-none shadow-sm"
                  readOnly
                  value={service.duration_minutes}
                />
              </span>
              <span className="shrink-0 text-[16px] text-[#101828]">min</span>
            </span>
          </label>
        </div>
        <label className="grid gap-2 text-[16px] text-[#101828]">
          Amount
          <span className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-[18px] leading-none text-[#101828]">$</span>
            <input
              className="min-h-[50px] w-full rounded-[15px] border border-[#d0d5dd] bg-white px-4 text-[16px] text-[#667085] outline-none shadow-sm"
              inputMode="decimal"
              min="0"
              onChange={(event) => {
                const nextPriceMinor = Math.max(0, Math.round(Number(event.target.value || '0') * 100))
                onDetailsChange?.({ ...details, appointmentPriceMinor: nextPriceMinor })
              }}
              readOnly={!priceIsEditable}
              step="0.01"
              type="number"
              value={amountValue}
            />
          </span>
          {priceIsEditable && <span className="text-xs text-[#667085]">This service has no base price yet. Add the appointment amount.</span>}
        </label>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="inline-flex items-center gap-2 text-[20px] font-extrabold leading-tight text-[#0c111d]">
          Important Highlights
          <CircleAlert className="size-5 text-[#ff8a00]" />
        </h2>
        <div className="space-y-2">
          <p className="text-[16px] text-[#667085]">Allergies</p>
          <div className="flex flex-wrap gap-2">
            {highlights.allergies.length
              ? highlights.allergies.map((item) => <HighlightChip key={item}>{item}</HighlightChip>)
              : <p className="text-sm text-[#98a2b3]">No allergy highlights</p>}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[16px] text-[#667085]">Medical Conditions</p>
          <div className="flex flex-wrap gap-2">
            {highlights.medical.length
              ? highlights.medical.map((item) => <HighlightChip key={item} tone="medical">{item}</HighlightChip>)
              : <p className="text-sm text-[#98a2b3]">No medical highlights</p>}
          </div>
        </div>
        <label className="grid gap-2 text-[16px] text-[#667085]">
          Additional Notes
          <textarea
            className="min-h-[122px] resize-none rounded-[12px] border border-[#d0d5dd] bg-white px-4 py-3 text-[16px] leading-6 text-[#667085] outline-none shadow-sm placeholder:text-[#98a2b3]"
            placeholder="Add any special instructions or notes..."
            readOnly
            value={notes}
          />
        </label>
      </section>

      <div className="mt-9 grid gap-3">
        <MutationError error={error ?? null} />
        <Button className="min-h-[62px] rounded-[15px] text-[18px] font-medium shadow-[0_12px_18px_rgba(75,38,138,0.3)]" fullWidth loading={loading} onClick={onNext}>
          Confirm
        </Button>
        <Button className="min-h-[62px] rounded-[15px] border-0 bg-white text-[18px] font-medium text-[#7344cd] shadow-[0_14px_24px_rgba(16,24,40,0.14)] hover:bg-white" fullWidth onClick={() => setShowUpdateModal(true)} variant="outline">
          Go back
        </Button>
      </div>

      {showUpdateModal && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
          <div className="w-full max-w-[393px] space-y-4 rounded-[24px] border-0 bg-white p-6 shadow-xl">
            <h2 className="text-[21px] font-bold text-[#0c111d]">Edit selections?</h2>
            <p className="text-sm text-[#475467]">
              You will return to the service details step. Your health questionnaire answers will be kept.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button fullWidth onClick={() => setShowUpdateModal(false)} variant="outline">Cancel</Button>
              <Button fullWidth onClick={() => { setShowUpdateModal(false); onEdit() }}>Edit</Button>
            </div>
          </div>
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
