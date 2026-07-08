import {
  BriefcaseBusiness, Check, ChevronUp, Clock3, Languages, Plus, Sparkles, Trash2,
  UserRound, WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, DataSourceNotice, ErrorState, Input, LoadingState } from '../../components'
import { fallbackCategories } from '../../data/fallback-data'
import { useProfessionals, useServiceCategories, useServices } from '../../hooks/useGlamhourData'
import { ApiClientError } from '../../lib/api'
import { cn } from '../../lib/cn'
import { glamhourApi } from '../../services/glamhour-api'
import type { Professional, Service, ServiceCategory } from '../../types/api'

const steps = ['categories', 'services', 'schedule', 'team', 'complete'] as const
type Step = typeof steps[number]

type OnboardingState = {
  salonId?: string
  salonName?: string
  email?: string
}

type DraftService = {
  id: string
  categoryId: string
  name: string
  selected: boolean
  price: string
  duration: string
  section?: 'service' | 'material'
}

type DraftDay = {
  enabled: boolean
  open: string
  close: string
}

type DraftProvider = {
  id: string
  name: string
  email: string
  phone: string
  photoPreview?: string
  languages: string[]
  salonPercent: string
  professionalPercent: string
  serviceIds: string[]
  schedule: Record<string, DraftDay>
  useSalonSchedule?: boolean
}

type OnboardingDraft = {
  selectedCategoryIds: string[]
  services: DraftService[]
  schedule: Record<string, DraftDay>
  providers: DraftProvider[]
  activeProviderId?: string
}

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const defaultSchedule = weekDays.reduce<Record<string, DraftDay>>((days, day, index) => {
  days[day] = { enabled: index < 6, open: '09:00', close: '18:00' }
  return days
}, {})

const categoryDescriptions: Record<string, string> = {
  nails: 'Manicures, pedicures, acrylics, and nail art.',
  lashes: 'Eyelash extensions, lifts, and tinting services.',
  cosmetology: 'Facials, skincare treatments, and beauty enhancements.',
  micropigmentation: 'Microblading, lip liner, eyeliner, and more pigmentation services.',
}

const nailSetupItems = ['Full set', 'Fill in', 'Removal', 'Manicure', 'Gel Polish', 'Dual System', 'Press on', 'Pedicure', 'Other']

const stepHeaderSubtitles: Partial<Record<Step, string>> = {
  schedule: 'Set your regular operating hours.',
  team: 'Set your regular operating hours.',
}

const languageLabels: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
}

function formatLanguageLabel(language: string) {
  return languageLabels[language] ?? language
}

function formatTimeDisplay(value: string) {
  const [hourValue, minute = '00'] = value.split(':')
  const hour = Number(hourValue)
  if (!Number.isFinite(hour)) {
    return value
  }

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${period}`
}

function parseTimeDisplay(value: string, fallback: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!match) {
    return fallback
  }

  const rawHour = Number(match[1])
  const minute = match[2] ?? '00'
  const period = match[3]?.toUpperCase()
  if (!Number.isInteger(rawHour) || rawHour < 1 || rawHour > 23 || Number(minute) > 59) {
    return fallback
  }

  let hour = rawHour
  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minute}`
}

function storageKey(salonId?: string) {
  return `glamhour:onboarding:${salonId ?? 'draft'}`
}

function readStoredDraft(salonId?: string) {
  try {
    const savedDraft = window.localStorage.getItem(storageKey(salonId))
    return savedDraft ? JSON.parse(savedDraft) as OnboardingDraft : null
  } catch {
    window.localStorage.removeItem(storageKey(salonId))
    return null
  }
}

function serviceIdSuffix(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function withRequiredDraftServices(draft: OnboardingDraft, categories: ServiceCategory[]) {
  const services = [...draft.services]
  const serviceDraftKeys = new Set(services.map((service) => `${service.categoryId}:${service.name.toLowerCase()}:${service.section ?? 'service'}`))

  categories.forEach((category) => {
    if (category.code !== 'nails') {
      return
    }

    nailSetupItems.forEach((name) => {
      const serviceKey = `${category.id}:${name.toLowerCase()}:service`
      if (!serviceDraftKeys.has(serviceKey)) {
        services.push({
          id: `${category.id}-service-${serviceIdSuffix(name)}`,
          categoryId: category.id,
          name,
          selected: false,
          price: '',
          duration: '60',
          section: 'service',
        })
        serviceDraftKeys.add(serviceKey)
      }

      const materialKey = `${category.id}:${name.toLowerCase()}:material`
      if (!serviceDraftKeys.has(materialKey)) {
        services.push({
          id: `${category.id}-material-${serviceIdSuffix(name)}`,
          categoryId: category.id,
          name,
          selected: false,
          price: '',
          duration: '60',
          section: 'material',
        })
        serviceDraftKeys.add(materialKey)
      }
    })
  })

  return { ...draft, services }
}

function sanitizeStoredDraft(draft: OnboardingDraft | null, categories: ServiceCategory[]) {
  if (!draft) {
    return null
  }

  const categoryIds = new Set(categories.map((category) => category.id))
  const sanitizedDraft = {
    ...draft,
    selectedCategoryIds: draft.selectedCategoryIds.filter((id) => categoryIds.has(id)),
    services: draft.services.filter((service) => categoryIds.has(service.categoryId)),
  }

  return sanitizedDraft.services.length && sanitizedDraft.selectedCategoryIds.length ? withRequiredDraftServices(sanitizedDraft, categories) : null
}

function createDraft(categories: ServiceCategory[], services: Service[], professionals: Professional[]): OnboardingDraft {
  const selectedCategoryIds: string[] = []
  const serviceDrafts: DraftService[] = services.length
    ? services.map((service) => ({
        id: service.id,
        categoryId: service.category_id,
        name: service.name,
        selected: false,
        price: String(Math.round(service.price_minor / 100)),
        duration: String(service.duration_minutes),
        section: 'service' as const,
      }))
    : categories.flatMap((category) => ['Signature', 'Maintenance'].map((kind, index) => ({
        id: `${category.id}-${index}`,
        categoryId: category.id,
        name: `${category.name} ${kind}`,
        selected: false,
        price: index === 0 ? '85' : '55',
        duration: index === 0 ? '90' : '60',
        section: 'service' as const,
      })))
  const serviceDraftKeys = new Set(serviceDrafts.map((service) => `${service.categoryId}:${service.name.toLowerCase()}:${service.section ?? 'service'}`))

  categories.forEach((category) => {
    if (category.code !== 'nails') {
      return
    }

    nailSetupItems.forEach((name) => {
      const serviceKey = `${category.id}:${name.toLowerCase()}:service`
      if (!serviceDraftKeys.has(serviceKey)) {
        serviceDrafts.push({
          id: `${category.id}-service-${serviceIdSuffix(name)}`,
          categoryId: category.id,
          name,
          selected: false,
          price: '',
          duration: '60',
          section: 'service',
        })
        serviceDraftKeys.add(serviceKey)
      }

      const materialKey = `${category.id}:${name.toLowerCase()}:material`
      if (!serviceDraftKeys.has(materialKey)) {
        serviceDrafts.push({
          id: `${category.id}-material-${serviceIdSuffix(name)}`,
          categoryId: category.id,
          name,
          selected: false,
          price: '',
          duration: '60',
          section: 'material',
        })
        serviceDraftKeys.add(materialKey)
      }
    })
  })

  return {
    selectedCategoryIds,
    services: serviceDrafts,
    schedule: defaultSchedule,
    providers: professionals.slice(0, 1).map((professional) => ({
      id: professional.id,
      name: professional.full_name,
      email: professional.email ?? '',
      phone: professional.phone ?? '',
      languages: professional.languages.length ? professional.languages : ['en'],
      salonPercent: professional.salon_earnings_percent.split('.')[0] ?? '60',
      professionalPercent: professional.professional_earnings_percent.split('.')[0] ?? '40',
      serviceIds: serviceDrafts.filter((service) => service.selected).map((service) => service.id),
      schedule: defaultSchedule,
      useSalonSchedule: false,
    })),
  }
}

function createBlankProvider(schedule: Record<string, DraftDay>): DraftProvider {
  return {
    id: `provider-${Date.now()}`,
    name: '',
    email: '',
    phone: '',
    languages: ['en'],
    salonPercent: '40',
    professionalPercent: '60',
    serviceIds: [],
    schedule,
    useSalonSchedule: true,
  }
}

export function SetupPage() {
  const { step = 'categories' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const onboardingState = (location.state ?? {}) as OnboardingState
  const salonId = onboardingState.salonId ?? window.sessionStorage.getItem('glamhour:active-salon-id') ?? undefined
  const salonName = onboardingState.salonName ?? 'your salon'
  const currentStep = steps.includes(step as Step) ? step as Step : 'categories'
  const categories = useServiceCategories()
  const services = useServices(salonId)
  const professionals = useProfessionals(salonId)
  const categoryData = categories.data?.length ? categories.data : fallbackCategories
  const [draftOverride, setDraftOverride] = useState<OnboardingDraft | null>(() => readStoredDraft(salonId))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const sanitizedDraftOverride = useMemo(() => {
    if (!categoryData.length) {
      return null
    }

    return sanitizeStoredDraft(draftOverride, categoryData)
  }, [categoryData, draftOverride])
  const generatedDraft = useMemo(() => {
    if (!categoryData.length || !services.data || !professionals.data) {
      return null
    }

    return createDraft(categoryData, services.data, professionals.data)
  }, [categoryData, professionals.data, services.data])
  const draft = sanitizedDraftOverride ?? generatedDraft

  useEffect(() => {
    if (draftOverride) {
      window.localStorage.setItem(storageKey(salonId), JSON.stringify(draftOverride))
    }
  }, [draftOverride, salonId])

  const loading = categories.loading || services.loading || professionals.loading || !draft
  if (loading) return <div className="min-h-dvh bg-canvas p-4"><LoadingState label="Loading salon setup..." /></div>
  if (!services.data || !professionals.data) return <div className="min-h-dvh bg-canvas p-4"><ErrorState description="Salon setup data could not be loaded." onRetry={() => { categories.retry(); services.retry(); professionals.retry() }} /></div>

  const stepIndex = Math.max(0, steps.indexOf(currentStep))
  const canContinue = isStepComplete(currentStep, draft)
  const headerSubtitle = stepHeaderSubtitles[currentStep] ?? "Let's get your business ready for clients."
  const isTeamEditor = currentStep === 'team' && Boolean(draft.activeProviderId)
  const primaryActionLabel = currentStep === 'complete' ? 'Go to calendar' : currentStep === 'team' ? (isTeamEditor ? 'Add provider' : 'Finish') : 'Continue'

  function updateDraft(updater: (current: OnboardingDraft) => OnboardingDraft) {
    setDraftOverride((current) => {
      const baseDraft = current ?? draft
      return baseDraft ? updater(baseDraft) : current
    })
  }

  async function saveStep(nextStep: Step, completed: boolean) {
    if (!salonId || !draft) {
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      await glamhourApi.saveOnboarding({
        step: nextStep,
        completed,
        draft,
      }, salonId)
    } catch (error) {
      setSaveError(
        error instanceof ApiClientError
          ? error.message
          : 'Onboarding could not be saved. Please try again.',
      )
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  async function goNext() {
    if (!canContinue || isSaving) {
      return
    }

    if (currentStep === 'complete') {
      await saveStep('complete', true)
      window.localStorage.removeItem(storageKey(salonId))
      navigate('/app/calendar', { replace: true })
      return
    }

    if (currentStep === 'team') {
      if (!draft) {
        return
      }

      await saveStep('team', false)
      if (draft.activeProviderId) {
        updateDraft((current) => ({ ...current, activeProviderId: undefined }))
        return
      }

      navigate(`/onboarding/${steps[stepIndex + 1]}`, {
        state: { ...onboardingState, salonId, salonName },
      })
      return
    }

    const nextStep = steps[stepIndex + 1]
    await saveStep(currentStep, false)
    navigate(`/onboarding/${nextStep}`, {
      state: { ...onboardingState, salonId, salonName },
    })
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate('/register')
      return
    }

    navigate(`/onboarding/${steps[stepIndex - 1]}`, {
      state: { ...onboardingState, salonId, salonName },
    })
  }

  if (currentStep === 'complete') {
    return (
      <main className="min-h-dvh bg-[linear-gradient(180deg,#77777d_0%,#8d8d95_45%,#5d35a9_100%)] px-5 py-7">
        <section className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-[375px] flex-col justify-center">
          <DataSourceNotice visible={categories.isFallback || services.isFallback || professionals.isFallback} />
          <CompleteStep isSaving={isSaving} onGoToCalendar={goNext} />
          {saveError && <p className="mt-4 rounded-md bg-[#fff0f0] px-3 py-2 text-[11px] text-[#e05252]">{saveError}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#fff8fb_0%,#f1efff_58%,#a684ff_100%)] px-4 py-7">
      <section className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-[375px] flex-col">
        <DataSourceNotice visible={categories.isFallback || services.isFallback || professionals.isFallback} />
        <header>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#10172a]">Salon Setup</h1>
              <p className="mt-2 whitespace-nowrap text-[16px] leading-5 text-[#747d96]">{headerSubtitle}</p>
            </div>
            <p className="shrink-0 pb-1 text-[12px] font-medium text-[#626b84]">Step {Math.min(stepIndex + 1, 4)} of 4</p>
          </div>
          <div className="mt-5 h-2 rounded-full bg-white/75">
            <div className="h-full rounded-full bg-[#6734c7] transition-all" style={{ width: `${((Math.min(stepIndex, 3) + 1) / 4) * 100}%` }} />
          </div>
        </header>

        <div className="mt-8 flex-1">
          {currentStep === 'categories' && <CategoriesStep categories={categoryData} draft={draft} updateDraft={updateDraft} />}
          {currentStep === 'services' && <ServicesStep categories={categoryData} draft={draft} updateDraft={updateDraft} />}
          {currentStep === 'schedule' && <ScheduleStep draft={draft} updateDraft={updateDraft} />}
          {currentStep === 'team' && <TeamStep categories={categoryData} draft={draft} updateDraft={updateDraft} />}
        </div>
        {saveError && <p className="mt-4 rounded-md bg-[#fff0f0] px-3 py-2 text-[11px] text-[#e05252]">{saveError}</p>}

        <div className="mt-8 pb-1">
          <Button
            className={cn('min-h-16 rounded-xl text-[16px] font-medium shadow-[0_14px_24px_rgb(67_47_129_/_0.24)] disabled:opacity-100', !canContinue && 'bg-none bg-[#dfdfdf] text-[#4f5a6b] shadow-[0_14px_24px_rgb(58_43_102_/_0.18)]')}
            disabled={!canContinue}
            fullWidth
            loading={isSaving}
            onClick={goNext}
            size="lg"
          >
            {primaryActionLabel}
          </Button>
          {stepIndex > 0 && (
            <Button
              className="mt-3 min-h-11 rounded-xl border-0 bg-white/85 text-[13px] font-medium text-[#6734c7] shadow-[0_8px_18px_rgb(67_47_129_/_0.12)] hover:bg-white"
              disabled={isSaving}
              fullWidth
              onClick={goBack}
              size="md"
              type="button"
              variant="outline"
            >
              Go back
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}

function OnboardingPanel({ title, subtitle, children, className, backgroundColor }: { title: string; subtitle: string; children: ReactNode; className?: string; backgroundColor?: string }) {
  return (
    <Card className={cn('rounded-2xl border-[#dfe3ee] px-5 pb-6 pt-6 shadow-[0_8px_22px_rgb(59_45_115_/_0.10)]', !backgroundColor && 'bg-[#f5f6ff]', className)} padding="none" style={backgroundColor ? { backgroundColor } : undefined}>
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-[#10172a]">{title}</h2>
      <p className="mt-2 max-w-[280px] text-[16px] leading-5 text-[#747d96]">{subtitle}</p>
      {children}
    </Card>
  )
}

function CategoriesStep({ categories, draft, updateDraft }: { categories: ServiceCategory[]; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  return (
    <OnboardingPanel title="Service Categories" subtitle="Enable the sections that apply to your business.">
      <div className="mt-5 space-y-4">
        {categories.map((category) => {
          const selected = draft.selectedCategoryIds.includes(category.id)
          return (
            <button
              className={cn(
                'flex min-h-[104px] w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition',
                selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white',
              )}
              key={category.id}
              onClick={() => updateDraft((current) => ({
                ...current,
                selectedCategoryIds: selected
                  ? current.selectedCategoryIds.filter((id) => id !== category.id)
                  : [...current.selectedCategoryIds, category.id],
                services: current.services.map((service) => service.categoryId === category.id ? { ...service, selected: false } : service),
              }))}
              type="button"
            >
              <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)]', selected ? 'border-[#cbb9ff] bg-white' : 'border-[#d5dce8] bg-[#f6f9ff]')}>
                {selected && <Check className="size-3 text-[#7a3fe0]" />}
              </span>
              <span>
                <span className="block text-[16px] font-bold leading-5 tracking-[-0.01em] text-[#111827]">{category.name}</span>
                <span className="mt-2 block text-[16px] leading-5 text-[#6f7890]">
                  {categoryDescriptions[category.code] ?? 'Services, pricing, schedule, and provider setup.'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </OnboardingPanel>
  )
}

function ServicesStep({ categories, draft, updateDraft }: { categories: ServiceCategory[]; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const selectedCategories = categories.filter((category) => draft.selectedCategoryIds.includes(category.id))
  return (
    <OnboardingPanel backgroundColor="#F2F5FF" title="Select Services" subtitle="Choose the services you offer and set your base prices.">
      <div className="mt-5 space-y-5">
        {selectedCategories.map((category) => (
          category.code === 'nails'
            ? <NailServicesSetup category={category} draft={draft} key={category.id} updateDraft={updateDraft} />
            : <GenericServicesSetup category={category} draft={draft} key={category.id} updateDraft={updateDraft} />
        ))}
      </div>
    </OnboardingPanel>
  )
}

function NailServicesSetup({ category, draft, updateDraft }: { category: ServiceCategory; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const [servicesExpanded, setServicesExpanded] = useState(true)
  const [materialsExpanded, setMaterialsExpanded] = useState(true)
  const services = draft.services.filter((service) => service.categoryId === category.id)
  const treatmentServices = nailSetupItems
    .map((name) => services.find((service) => service.name.toLowerCase() === name.toLowerCase() && (service.section ?? 'service') === 'service'))
    .filter((service): service is DraftService => Boolean(service))
  const materialServices = nailSetupItems
    .map((name) => services.find((service) => service.name.toLowerCase() === name.toLowerCase() && service.section === 'material'))
    .filter((service): service is DraftService => Boolean(service))

  return (
    <div className="rounded-2xl border border-[#d6dce8] bg-white px-6 py-7 shadow-[0_3px_10px_rgb(34_42_66_/_0.03)]">
      <div>
        <p className="text-[20px] font-bold leading-6 text-[#10172a]">Nail Services</p>
        <p className="mt-2 text-[15px] leading-5 text-[#68738b]">Main treatments and services</p>
      </div>

      <div className="mt-7">
        <button
          aria-expanded={servicesExpanded}
          className="mb-4 flex w-full items-center justify-between text-left"
          onClick={() => setServicesExpanded((expanded) => !expanded)}
          type="button"
        >
          <p className="text-[16px] leading-5 text-[#68738b]">Services</p>
          <ChevronUp className={cn('size-5 text-[#10172a] transition-transform', !servicesExpanded && 'rotate-180')} />
        </button>
        {servicesExpanded && (
          <div className="space-y-2">
            {treatmentServices.map((service) => (
              <NailServicePriceRow key={service.id} service={service} updateDraft={updateDraft} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-[#d6dce7] pt-6">
        <button
          aria-expanded={materialsExpanded}
          className="mb-4 flex w-full items-center justify-between text-left"
          onClick={() => setMaterialsExpanded((expanded) => !expanded)}
          type="button"
        >
          <p className="text-[16px] leading-5 text-[#68738b]">Materials</p>
          <ChevronUp className={cn('size-5 text-[#10172a] transition-transform', !materialsExpanded && 'rotate-180')} />
        </button>
        {materialsExpanded && (
          <div className="space-y-2">
            {materialServices.map((service) => (
              <NailMaterialRow key={service.id} service={service} updateDraft={updateDraft} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NailServicePriceRow({ service, updateDraft }: { service: DraftService; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  function toggleService() {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? { ...item, selected: !item.selected } : item),
    }))
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_82px] items-center gap-2">
      <button
        aria-checked={service.selected}
        className={cn('flex min-h-[53px] min-w-0 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-left transition', service.selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white')}
        onClick={toggleService}
        role="checkbox"
        type="button"
      >
        <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)] transition', service.selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}>
          <Check className="size-3" />
        </span>
        <span className="truncate text-[15px] font-medium leading-5 text-[#1b2133]">{service.name}</span>
      </button>
      <span className="text-[18px] leading-none text-[#10172a]">$</span>
      <label className="grid min-h-[53px] items-center overflow-hidden rounded-2xl border border-[#d7dce8] bg-white px-2 text-[12px] font-medium text-[#7b8498]">
        <input
          aria-label={`${service.name} base price`}
          className="[appearance:textfield] min-w-0 bg-transparent text-center text-[12px] text-[#1b2133] outline-none placeholder:text-[12px] placeholder:text-[#7b8498] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => {
            const price = event.target.value
            updateDraft((current) => ({
              ...current,
              services: current.services.map((item) => item.id === service.id ? { ...item, price, selected: price.trim() ? true : item.selected } : item),
            }))
          }}
          placeholder="e.g. 40"
          type="number"
          value={service.price}
        />
      </label>
    </div>
  )
}

function NailMaterialRow({ service, updateDraft }: { service: DraftService; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  function toggleService() {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? { ...item, selected: !item.selected } : item),
    }))
  }

  return (
    <button
      aria-checked={service.selected}
      className={cn('flex min-h-[53px] w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 text-left transition', service.selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white')}
      onClick={toggleService}
      role="checkbox"
      type="button"
    >
      <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)] transition', service.selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}>
        <Check className="size-3" />
      </span>
      <span className="truncate text-[15px] font-medium leading-5 text-[#1b2133]">{service.name}</span>
    </button>
  )
}

function GenericServicesSetup({ category, draft, updateDraft }: { category: ServiceCategory; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-bold leading-4 text-[#10172a]">{category.name} Services</p>
      <div className="space-y-2">
        {draft.services.filter((service) => service.categoryId === category.id).map((service) => (
          <div
            className={cn(
              'rounded-xl border px-3 py-2.5 transition',
              service.selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white',
            )}
            key={service.id}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_46px_46px] items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  aria-label={service.selected ? 'Remove service' : 'Add service'}
                  className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)]', service.selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}
                  onClick={() => updateDraft((current) => ({ ...current, services: current.services.map((item) => item.id === service.id ? { ...item, selected: !item.selected } : item) }))}
                  type="button"
                >
                  <Check className="size-3" />
                </button>
                <p className="truncate text-[12px] font-medium leading-4 text-[#1b2133]">{service.name}</p>
              </div>
              <Input
                aria-label={`${service.name} price`}
                className="min-h-7 rounded-lg px-1.5 text-center text-[11px]"
                onChange={(event) => updateDraft((current) => ({ ...current, services: current.services.map((item) => item.id === service.id ? { ...item, price: event.target.value } : item) }))}
                type="number"
                value={service.price}
              />
              <Input
                aria-label={`${service.name} duration`}
                className="min-h-7 rounded-lg px-1.5 text-center text-[11px]"
                onChange={(event) => updateDraft((current) => ({ ...current, services: current.services.map((item) => item.id === service.id ? { ...item, duration: event.target.value } : item) }))}
                type="number"
                value={service.duration}
              />
            </div>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_46px_46px] gap-2 text-[9px] font-medium leading-3 text-[#8b92a1]">
              <span />
              <span className="text-center">Price</span>
              <span className="text-center">Min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScheduleStep({ draft, updateDraft }: { draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  return (
    <OnboardingPanel backgroundColor="#FFFFFF" title="Weekly Schedule" subtitle="Configure opening and closing times for each day">
      <div className="mt-7">
        {weekDays.map((day) => {
          const schedule = draft.schedule[day]
          return (
            <div className="border-b border-[#e7eaf2] py-4 first:pt-0 last:pb-0" key={day}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-bold leading-5 text-[#1b2133]">{day}</p>
                <button
                  aria-label={schedule.enabled ? `Disable ${day}` : `Enable ${day}`}
                  aria-pressed={schedule.enabled}
                  className={cn('relative h-7 w-12 rounded-full transition', schedule.enabled ? 'bg-[#7a3fe0]' : 'bg-[#e1e1e1]')}
                  onClick={() => updateDraft((current) => ({ ...current, schedule: { ...current.schedule, [day]: { ...schedule, enabled: !schedule.enabled } } }))}
                  type="button"
                >
                  <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(27_31_47_/_0.18)] transition-all', schedule.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
              {schedule.enabled && (
                <div className="mt-4 grid grid-cols-[88px_auto_88px] items-center gap-3">
                  <label className="block">
                    <span className="sr-only">{day} opening time</span>
                    <ScheduleTimeInput
                      onCommit={(value) => updateDraft((current) => ({ ...current, schedule: { ...current.schedule, [day]: { ...schedule, open: value } } }))}
                      value={schedule.open}
                    />
                  </label>
                  <span className="text-center text-[14px] font-medium text-[#7b8498]">to</span>
                  <label className="block">
                    <span className="sr-only">{day} closing time</span>
                    <ScheduleTimeInput
                      onCommit={(value) => updateDraft((current) => ({ ...current, schedule: { ...current.schedule, [day]: { ...schedule, close: value } } }))}
                      value={schedule.close}
                    />
                  </label>
                </div>
              )}
              {!schedule.enabled && (
                <div className="mt-4">
                  <span className="text-[13px] font-medium text-[#9aa2b3]">Closed</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </OnboardingPanel>
  )
}

function ScheduleTimeInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [displayValue, setDisplayValue] = useState(() => formatTimeDisplay(value))

  function commitValue() {
    const nextValue = parseTimeDisplay(displayValue, value)
    onCommit(nextValue)
    setDisplayValue(formatTimeDisplay(nextValue))
  }

  return (
    <input
      className="min-h-10 w-full rounded-lg border-0 bg-[#fbfcff] px-2 text-center text-[13px] font-medium text-[#7b8498] outline-none focus:ring-2 focus:ring-[#7a3fe0]/15"
      onBlur={commitValue}
      onChange={(event) => setDisplayValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
      placeholder="9:00 AM"
      value={displayValue}
    />
  )
}

function ProviderWeeklySchedule({ schedule, updateDay }: { schedule: Record<string, DraftDay>; updateDay: (day: string, patch: Partial<DraftDay>) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#d7dce8] bg-white px-5 py-6 shadow-[0_3px_10px_rgb(34_42_66_/_0.03)]">
      <h3 className="text-[22px] font-bold leading-7 text-[#10172a]">Weekly Schedule</h3>
      <p className="mt-2 text-[15px] leading-5 text-[#6f7890]">Configure opening and closing times for each day</p>
      <div className="mt-7">
        {weekDays.map((day) => {
          const daySchedule = schedule[day]
          return (
            <div className="border-b border-[#e7eaf2] py-4 first:pt-0 last:pb-0" key={day}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-bold leading-5 text-[#1b2133]">{day}</p>
                <button
                  aria-label={daySchedule.enabled ? `Disable ${day}` : `Enable ${day}`}
                  aria-pressed={daySchedule.enabled}
                  className={cn('relative h-7 w-12 rounded-full transition', daySchedule.enabled ? 'bg-[#7a3fe0]' : 'bg-[#e1e1e1]')}
                  onClick={() => updateDay(day, { enabled: !daySchedule.enabled })}
                  type="button"
                >
                  <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(27_31_47_/_0.18)] transition-all', daySchedule.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
              {daySchedule.enabled && (
                <div className="mt-4 grid grid-cols-[88px_auto_88px] items-center gap-3">
                  <ScheduleTimeInput onCommit={(value) => updateDay(day, { open: value })} value={daySchedule.open} />
                  <span className="text-center text-[14px] font-medium text-[#7b8498]">to</span>
                  <ScheduleTimeInput onCommit={(value) => updateDay(day, { close: value })} value={daySchedule.close} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamStep({ categories, draft, updateDraft }: { categories: ServiceCategory[]; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const activeProvider = draft.providers.find((provider) => provider.id === draft.activeProviderId)

  function addProvider() {
    const provider = createBlankProvider(draft.schedule)
    updateDraft((current) => ({
      ...current,
      activeProviderId: provider.id,
      providers: [...current.providers, provider],
    }))
  }

  function editProvider(providerId: string) {
    updateDraft((current) => ({ ...current, activeProviderId: providerId }))
  }

  return (
    <OnboardingPanel title="Team & Providers" subtitle="Add the staff members who work at your salon.">
      <div className="mt-5 space-y-4">
        {activeProvider ? (
          <ProviderEditor categories={categories} draft={draft} provider={activeProvider} salonSchedule={draft.schedule} updateDraft={updateDraft} />
        ) : (
          <ProviderSummaryList categories={categories} draft={draft} onAddProvider={addProvider} onEditProvider={editProvider} />
        )}
      </div>
    </OnboardingPanel>
  )
}

function ProviderSummaryList({ categories, draft, onAddProvider, onEditProvider }: { categories: ServiceCategory[]; draft: OnboardingDraft; onAddProvider: () => void; onEditProvider: (providerId: string) => void }) {
  return (
    <div className="space-y-5">
      {draft.providers.map((provider) => (
        <ProviderSummaryCard categories={categories} draft={draft} key={provider.id} onEdit={() => onEditProvider(provider.id)} provider={provider} />
      ))}

      <button
        className="grid min-h-[180px] w-full place-items-center rounded-2xl border border-[#d7dce8] bg-white px-5 py-8 text-center transition hover:border-[#cbb9ff] hover:bg-[#fbf9ff]"
        onClick={onAddProvider}
        type="button"
      >
        <span>
          <span className="mx-auto grid size-8 place-items-center rounded-full text-[#7a3fe0]">
            <Plus className="size-5" />
          </span>
          <span className="mt-2 block text-[13px] font-medium text-[#747d96]">Add New Provider</span>
        </span>
      </button>
    </div>
  )
}

function ProviderSummaryCard({ categories, draft, provider, onEdit }: { categories: ServiceCategory[]; draft: OnboardingDraft; provider: DraftProvider; onEdit: () => void }) {
  const serviceMap = new Map(draft.services.map((service) => [service.id, service]))
  const providerServices = provider.serviceIds
    .map((serviceId) => serviceMap.get(serviceId))
    .filter((service): service is DraftService => Boolean(service))
    .filter((service) => service.section !== 'material')
  const categoryIds = new Set(providerServices.map((service) => service.categoryId))
  const providerCategories = categories.filter((category) => categoryIds.has(category.id))
  const languageChips = provider.languages.length ? provider.languages.map(formatLanguageLabel) : ['English']
  const scheduleLabel = provider.useSalonSchedule === false ? 'Custom Working Hours' : 'Standard Salon Hours'

  return (
    <div className="rounded-2xl border border-[#d7dce8] bg-white p-6 shadow-[0_8px_18px_rgb(59_45_115_/_0.08)]">
      <div className="flex items-start gap-4">
        <span className="mt-1 grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d7dce8] bg-[#f7f8ff] text-[#69748c]">
          {provider.photoPreview ? (
            <img alt={`${provider.name || 'Provider'} preview`} className="size-full object-cover" src={provider.photoPreview} />
          ) : (
            <UserRound className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px] font-bold leading-6 text-[#10172a]">{provider.name || 'Provider'}</h3>
          <p className="mt-1 text-[12px] font-medium leading-4 text-[#1b2133]">Languages</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {languageChips.map((language) => (
              <span className="rounded-md bg-[#f0f2fb] px-2 py-1 text-[11px] font-medium leading-none text-[#69748c]" key={language}>{language}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#69748c]">
          <Clock3 className="size-4" />
          <span>{scheduleLabel}</span>
        </div>

        <ProviderSummarySection icon={<Sparkles className="size-4" />} label="SERVICES" values={providerCategories.map((category) => category.name)} />
        <ProviderSummarySection icon={<Sparkles className="size-4" />} label="SPECIALTIES" values={providerServices.map((service) => service.name)} />
      </div>

      <Button className="mt-7 min-h-14 rounded-xl border-0 bg-[#f4f5ff] text-[16px] font-medium text-[#7a3fe0] shadow-[0_12px_22px_rgb(59_45_115_/_0.16)] hover:bg-[#eef0ff]" fullWidth onClick={onEdit} type="button" variant="outline">
        Edit
      </Button>
    </div>
  )
}

function ProviderSummarySection({ icon, label, values }: { icon: ReactNode; label: string; values: string[] }) {
  const visibleValues = values.slice(0, 4)

  return (
    <div>
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#1b2133]">
        <span className="text-[#69748c]">{icon}</span>
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleValues.length ? visibleValues.map((value) => (
          <span className="rounded-full border border-[#d7dce8] bg-white px-2.5 py-1 text-[11px] font-medium leading-none text-[#1b2133]" key={value}>{value}</span>
        )) : (
          <span className="text-[12px] font-medium text-[#8b92a1]">No items selected</span>
        )}
      </div>
    </div>
  )
}

function ProviderEditor({ categories, draft, provider, salonSchedule, updateDraft }: { categories: ServiceCategory[]; draft: OnboardingDraft; provider: DraftProvider; salonSchedule: Record<string, DraftDay>; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const providerServices = draft.services.filter((service) => service.section !== 'material')
  const providerServiceIds = new Set(provider.serviceIds)
  const usesSalonSchedule = provider.useSalonSchedule === true
  const [photoError, setPhotoError] = useState('')

  function updateProvider(patch: Partial<DraftProvider>) {
    updateDraft((current) => ({
      ...current,
      providers: current.providers.map((item) => item.id === provider.id ? { ...item, ...patch } : item),
    }))
  }

  function categoryServices(categoryId: string) {
    return providerServices.filter((service) => service.categoryId === categoryId)
  }

  function categoryAssigned(categoryId: string) {
    return categoryServices(categoryId).some((service) => providerServiceIds.has(service.id))
  }

  function toggleCategory(categoryId: string) {
    const serviceIds = categoryServices(categoryId).map((service) => service.id)
    if (!serviceIds.length) {
      return
    }

    if (categoryAssigned(categoryId)) {
      updateProvider({ serviceIds: provider.serviceIds.filter((serviceId) => !serviceIds.includes(serviceId)) })
      return
    }

    updateDraft((current) => ({
      ...current,
      services: current.services.map((service) => (
        serviceIds.includes(service.id) && Number(service.price) > 0
          ? { ...service, selected: true }
          : service
      )),
      providers: current.providers.map((item) => item.id === provider.id ? { ...item, serviceIds: [...new Set([...item.serviceIds, ...serviceIds])] } : item),
    }))
  }

  function toggleProviderService(serviceId: string, selected: boolean) {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((service) => (
        service.id === serviceId && selected && Number(service.price) > 0
          ? { ...service, selected: true }
          : service
      )),
      providers: current.providers.map((item) => item.id === provider.id
        ? { ...item, serviceIds: selected ? [...new Set([...item.serviceIds, serviceId])] : item.serviceIds.filter((id) => id !== serviceId) }
        : item),
    }))
  }

  function updateProviderServiceDuration(serviceId: string, duration: string) {
    const service = draft.services.find((item) => item.id === serviceId)
    updateService(serviceId, { duration, selected: service ? Number(service.price) > 0 : false })
    toggleProviderService(serviceId, true)
  }

  function updateService(serviceId: string, patch: Partial<DraftService>) {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((service) => service.id === serviceId ? { ...service, ...patch } : service),
    }))
  }

  function updatePhoto(file: File | undefined) {
    if (!file) {
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Please upload an image smaller than 2MB.')
      return
    }

    setPhotoError('')
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        updateProvider({ photoPreview: reader.result })
      }
    })
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-2xl border border-[#d7dce8] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1b2133]">Provider</p>
          <p className="mt-1 text-[11px] leading-4 text-[#7b8498]">Enter the details of the staff member.</p>
        </div>
        <button
          aria-label="Close provider"
          className="grid size-8 place-items-center rounded-md text-[#8b92a1] hover:bg-[#fff0f0] hover:text-[#e05252]"
          onClick={() => updateDraft((current) => ({ ...current, activeProviderId: undefined, providers: current.providers.filter((item) => item.id !== provider.id) }))}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="space-y-3">
        <label className="mx-auto block w-fit cursor-pointer text-center">
          <input accept="image/*" className="sr-only" onChange={(event) => updatePhoto(event.target.files?.[0])} type="file" />
          <span className="mx-auto grid size-28 place-items-center overflow-hidden rounded-full border border-[#c7cede] bg-[#f7f8ff] text-[#69748c]">
            {provider.photoPreview ? (
              <img alt={`${provider.name || 'Provider'} preview`} className="size-full object-cover" src={provider.photoPreview} />
            ) : (
              <span className="grid justify-items-center gap-1">
                <UserRound className="size-7" />
                <span className="text-[11px] font-medium leading-4">Add Photo</span>
              </span>
            )}
          </span>
          <span className="mt-3 block text-[10px] leading-4 text-[#7b8498]">Min 400x400px</span>
          <span className="block text-[10px] leading-4 text-[#7b8498]">Max 2MB</span>
          {photoError && <span className="mt-2 block max-w-[220px] text-[11px] font-medium leading-4 text-[#e05252]">{photoError}</span>}
        </label>

        <Input label="Full name" onChange={(event) => updateProvider({ name: event.target.value })} placeholder="Enter full name..." value={provider.name} />

        <div className="grid grid-cols-2 gap-2">
          <Input label="Salon Earnings" leadingIcon={<BriefcaseBusiness className="size-4" />} onChange={(event) => updateProvider({ salonPercent: event.target.value, professionalPercent: String(Math.max(0, 100 - Number(event.target.value || 0))) })} placeholder="e.g. 40%" type="number" value={provider.salonPercent} />
          <Input label="Provider Earnings" leadingIcon={<WalletCards className="size-4" />} onChange={(event) => updateProvider({ professionalPercent: event.target.value, salonPercent: String(Math.max(0, 100 - Number(event.target.value || 0))) })} placeholder="e.g. 60%" type="number" value={provider.professionalPercent} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#242a39]"><Languages className="size-4 text-[#7a3fe0]" /> Languages</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['en', 'English'],
              ['es', 'Spanish'],
              ['pt', 'Portuguese'],
            ].map(([language, label]) => {
              const selected = provider.languages.includes(language)
              return (
                <button
                  className={cn('min-h-9 rounded-md border text-[11px] font-semibold', selected ? 'border-[#7a3fe0] bg-[#eee8ff] text-[#5d2caf]' : 'border-[#dde1ec] bg-white text-[#8b92a1]')}
                  key={language}
                  onClick={() => updateProvider({ languages: selected ? provider.languages.filter((item) => item !== language) : [...provider.languages, language] })}
                  type="button"
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#dde1ec] bg-white px-4 py-4">
            <span>
              <span className="block text-[15px] font-bold leading-5 text-[#1b2133]">Working Hours</span>
              <span className="mt-1 block text-[13px] leading-5 text-[#6f7890]">Set my schedule same than salon schedule</span>
            </span>
            <button
              aria-label="Set my schedule same as the salon schedule"
              aria-pressed={usesSalonSchedule}
              className={cn('relative h-7 w-12 shrink-0 rounded-full transition', usesSalonSchedule ? 'bg-[#7a3fe0]' : 'bg-[#e1e1e1]')}
              onClick={() => updateProvider({ schedule: usesSalonSchedule ? provider.schedule : salonSchedule, useSalonSchedule: !usesSalonSchedule })}
              type="button"
            >
              <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(27_31_47_/_0.18)] transition-all', usesSalonSchedule ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
          {usesSalonSchedule && (
            <ProviderWeeklySchedule
              schedule={provider.schedule}
              updateDay={(day, patch) => updateProvider({
                schedule: {
                  ...provider.schedule,
                  [day]: { ...provider.schedule[day], ...patch },
                },
              })}
            />
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[#242a39]">Services & Treatments</p>
          <div className="space-y-3">
            {categories.map((category) => {
              const selected = categoryAssigned(category.id)
              return (
                <button
                  className={cn('flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition', selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#dde1ec] bg-white')}
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  type="button"
                >
                  <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border', selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}>
                    <Check className="size-3" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold leading-4 text-[#1b2133]">{category.name}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#7b8498]">
                      {categoryDescriptions[category.code] ?? category.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold text-[#242a39]">Services</p>
          <div className="space-y-2">
            {providerServices.map((service) => {
              const selected = provider.serviceIds.includes(service.id)
              return (
                <div
                  className={cn('grid grid-cols-[minmax(0,1fr)_86px] items-center gap-2 rounded-md border px-3 py-2 text-xs', selected ? 'border-[#7a3fe0] bg-[#f4efff]' : 'border-[#dde1ec] bg-white')}
                  key={service.id}
                >
                  <button
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => toggleProviderService(service.id, !selected)}
                    type="button"
                  >
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border', selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}>
                      <Check className="size-3" />
                    </span>
                    <span className="truncate font-medium text-[#1b2133]">{service.name}</span>
                  </button>
                  <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border border-[#dde1ec] bg-white px-2 py-1">
                    <input
                      aria-label={`${service.name} duration`}
                      className="min-w-0 bg-transparent text-right text-[11px] text-[#1b2133] outline-none placeholder:text-[#8b92a1]"
                      onChange={(event) => updateProviderServiceDuration(service.id, event.target.value)}
                      placeholder="e.g. 40"
                      type="number"
                      value={service.duration}
                    />
                    <span className="text-[10px] font-medium text-[#8b92a1]">min</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CompleteStep({ isSaving, onGoToCalendar }: { isSaving: boolean; onGoToCalendar: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[330px] rounded-[24px] bg-white px-6 pb-6 pt-7 text-center shadow-[0_28px_60px_rgb(24_20_43_/_0.30)]">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-[linear-gradient(180deg,#8a48e9_0%,#5d2caf_100%)] text-white shadow-[0_12px_26px_rgb(122_63_224_/_0.42)]">
        <Check className="size-10 stroke-[3.2]" />
      </span>
      <h1 className="mt-7 text-[22px] font-bold leading-7 tracking-[-0.01em] text-[#10172a]">Your salon is ready to book</h1>
      <p className="mx-auto mt-3 max-w-[245px] text-[15px] leading-5 text-[#777f91]">Your salon is fully set up and ready to welcome clients.</p>
      <Button
        className="mt-5 min-h-14 rounded-xl text-[16px] font-medium shadow-[0_12px_24px_rgb(67_47_129_/_0.30)]"
        fullWidth
        loading={isSaving}
        onClick={onGoToCalendar}
        size="lg"
      >
        Go to calendar
      </Button>
    </div>
  )
}

function isStepComplete(step: Step, draft: OnboardingDraft) {
  if (step === 'categories') return draft.selectedCategoryIds.length > 0
  if (step === 'services') return draft.services.some((service) => service.selected && service.section !== 'material' && Number(service.price) > 0 && Number(service.duration) > 0)
  if (step === 'schedule') return Object.values(draft.schedule).some((day) => day.enabled && day.open && day.close && day.open < day.close)
  if (step === 'team') return draft.providers.length > 0 && draft.providers.every((provider) => provider.name.trim() && provider.serviceIds.length > 0 && Number(provider.salonPercent) + Number(provider.professionalPercent) === 100)
  return true
}
