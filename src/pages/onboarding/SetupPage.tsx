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
import { cosmetologyServiceTypes } from '../app/appointment-booking/categories/cosmetology/cosmetologyDetailsSpec'
import { micropigmentationProcedureGroups } from '../app/appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec'
import { lashStyleOptions, lashVariantOptions } from '../app/lashes-booking/lashesDetailsSpec'
import {
  nailMaterialSetupItems,
  nailServiceSetupItems,
} from './onboardingNailsSpec'

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
  isCustom?: boolean
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
  categoryIds?: string[]
  serviceIds: string[]
  serviceDurations?: Record<string, string>
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

type ServiceSetupSection = {
  title: string
  subtitle: string
  servicesLabel: string
  materialsLabel: string
  serviceItems: readonly string[]
  materialItems: readonly string[]
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

const serviceSetupSections: Record<string, ServiceSetupSection> = {
  nails: {
    title: 'Nail Services',
    subtitle: 'Main treatments and services',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    serviceItems: nailServiceSetupItems,
    materialItems: nailMaterialSetupItems.map((material) => material.name),
  },
  lashes: {
    title: 'Lash Services',
    subtitle: 'Extensions, lifts, tinting, and lash styling',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    serviceItems: [
      ...lashVariantOptions.map((option) => option.title),
      'Lash Lift',
      'Lash Tint',
      'Removal',
      'Refill',
      'Other',
    ],
    materialItems: [
      ...lashStyleOptions.map((option) => option.label),
      'Lash Adhesive',
      'Lash Cleanser',
      'Other',
    ],
  },
  cosmetology: {
    title: 'Cosmetology Services',
    subtitle: 'Facials, skincare treatments, and beauty enhancements',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    serviceItems: [...cosmetologyServiceTypes, 'Hydrating Facial', 'Radiofrequency', 'Other'],
    materialItems: ['Serums', 'Peels', 'Masks', 'LED Therapy', 'Ozone Steam', 'Other'],
  },
  micropigmentation: {
    title: 'Micropigmentation Services',
    subtitle: 'Brows, lips, eyes, removal, and enhancement procedures',
    servicesLabel: 'Services',
    materialsLabel: 'Materials',
    serviceItems: [...Object.values(micropigmentationProcedureGroups).flat(), 'Other'],
    materialItems: ['Pigments', 'Needles', 'Anesthetics', 'Aftercare', 'Other'],
  },
}

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

function isCustomServiceDraft(service: DraftService) {
  return Boolean(service.isCustom || service.id.includes('-custom-service-'))
}

function isGeneratedPlaceholderService(serviceName: string, category: ServiceCategory | undefined) {
  if (!category || category.code === 'nails') return false
  const normalizedName = serviceName.trim().toLowerCase()
  const normalizedCategoryName = category.name.trim().toLowerCase()
  return normalizedName === `${normalizedCategoryName} signature`
    || normalizedName === `${normalizedCategoryName} maintenance`
}

function isLegacyCustomServicePlaceholder(service: DraftService) {
  const normalizedName = service.name.trim().toLowerCase()
  return isCustomServiceDraft(service) && (normalizedName === 'other' || /^new service(?:\s+\d+)?$/.test(normalizedName))
}

function normalizeStoredService(service: DraftService) {
  const normalizedName = service.name.trim().toLowerCase()
  if (normalizedName === 'other' && service.id.endsWith('-service-other')) {
    return { ...service, selected: false, isCustom: undefined }
  }

  if (isLegacyCustomServicePlaceholder(service)) {
    return { ...service, name: '', selected: true, isCustom: true }
  }

  return service
}

function getServiceSetupSection(category: ServiceCategory) {
  return serviceSetupSections[category.code]
}

function withRequiredDraftServices(draft: OnboardingDraft, categories: ServiceCategory[]) {
  const services = [...draft.services]
  const serviceDraftKeys = new Set(services.map((service) => `${service.categoryId}:${service.name.toLowerCase()}:${service.section ?? 'service'}`))

  categories.forEach((category) => {
    const setupSection = getServiceSetupSection(category)
    if (!setupSection) {
      return
    }

    setupSection.serviceItems.forEach((name) => {
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
    })

    setupSection.materialItems.forEach((material) => {
      const materialKey = `${category.id}:${material.toLowerCase()}:material`
      if (!serviceDraftKeys.has(materialKey)) {
        services.push({
          id: `${category.id}-material-${serviceIdSuffix(material)}`,
          categoryId: category.id,
          name: material,
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
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const legacyMaterialNames = new Set(nailServiceSetupItems.map((name) => name.toLowerCase()))
  const sanitizedDraft = {
    ...draft,
    selectedCategoryIds: draft.selectedCategoryIds.filter((id) => categoryIds.has(id)),
    services: draft.services
      .map(normalizeStoredService)
      .filter((service) => {
        if (!categoryIds.has(service.categoryId)) return false
        if (isGeneratedPlaceholderService(service.name, categoryById.get(service.categoryId))) return false
        if (service.section !== 'material') return true
        return !legacyMaterialNames.has(service.name.toLowerCase())
      }),
  }

  return sanitizedDraft.selectedCategoryIds.length ? withRequiredDraftServices(sanitizedDraft, categories) : null
}

function isSetupTreatmentService(service: DraftService, categories: ServiceCategory[]) {
  const category = categories.find((item) => item.id === service.categoryId)
  const setupSection = category ? getServiceSetupSection(category) : undefined
  return Boolean(
    setupSection
    && service.section !== 'material'
    && setupSection.serviceItems.some((name) => name.toLowerCase() === service.name.toLowerCase()),
  )
}

function getSetupTreatmentServices(draft: OnboardingDraft, categories: ServiceCategory[]) {
  return categories.flatMap((category) => {
    const setupSection = getServiceSetupSection(category)
    if (!setupSection) return []
    return setupSection.serviceItems
      .map((name) => draft.services.find((service) => service.categoryId === category.id && isSetupTreatmentService(service, categories) && service.name.toLowerCase() === name.toLowerCase()))
      .filter((service): service is DraftService => Boolean(service))
  })
}

function getProviderCategoryServices(draft: OnboardingDraft) {
  return draft.services.filter((service) => service.section !== 'material')
}

function getSelectedProviderCategoryServices(draft: OnboardingDraft) {
  const selectedCategoryIds = new Set(draft.selectedCategoryIds)
  return getProviderCategoryServices(draft).filter((service) => selectedCategoryIds.has(service.categoryId))
}

function createDraft(categories: ServiceCategory[], services: Service[], professionals: Professional[]): OnboardingDraft {
  const selectedCategoryIds: string[] = []
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const serviceDrafts: DraftService[] = services.length
    ? services
      .filter((service) => !isGeneratedPlaceholderService(service.name, categoryById.get(service.category_id)))
      .map((service) => ({
        id: service.id,
        categoryId: service.category_id,
        name: service.name,
        selected: false,
        price: String(Math.round(service.price_minor / 100)),
        duration: String(service.duration_minutes),
        section: 'service' as const,
      }))
    : []
  const serviceDraftKeys = new Set(serviceDrafts.map((service) => `${service.categoryId}:${service.name.toLowerCase()}:${service.section ?? 'service'}`))

  categories.forEach((category) => {
    const setupSection = getServiceSetupSection(category)
    if (!setupSection) {
      return
    }

    setupSection.serviceItems.forEach((name) => {
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
    })

    setupSection.materialItems.forEach((material) => {
      const materialKey = `${category.id}:${material.toLowerCase()}:material`
      if (!serviceDraftKeys.has(materialKey)) {
        serviceDrafts.push({
          id: `${category.id}-material-${serviceIdSuffix(material)}`,
          categoryId: category.id,
          name: material,
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
      categoryIds: [],
      serviceIds: serviceDrafts.filter((service) => service.selected).map((service) => service.id),
      serviceDurations: {},
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
    categoryIds: [],
    serviceIds: [],
    serviceDurations: {},
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
      navigate('/app/home', { replace: true })
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
  const setupCategories = selectedCategories.filter((category) => getServiceSetupSection(category))
  return (
    <OnboardingPanel backgroundColor="#F2F5FF" title="Select Services" subtitle="Choose the services you offer and set your base prices.">
      <div className="mt-5 space-y-5">
        {setupCategories.length
          ? setupCategories.map((category) => (
            <CategoryServicesSetup category={category} draft={draft} key={category.id} updateDraft={updateDraft} />
          ))
          : (
            <p className="rounded-xl bg-white px-4 py-3 text-[13px] leading-5 text-[#68738b]">
              Service setup can be completed later in Settings.
            </p>
          )}
      </div>
    </OnboardingPanel>
  )
}

function CategoryServicesSetup({ category, draft, updateDraft }: { category: ServiceCategory; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const [servicesExpanded, setServicesExpanded] = useState(true)
  const [materialsExpanded, setMaterialsExpanded] = useState(true)
  const [focusedCustomServiceId, setFocusedCustomServiceId] = useState<string>()
  const [focusedCustomMaterialId, setFocusedCustomMaterialId] = useState<string>()
  const setupSection = getServiceSetupSection(category)
  const services = draft.services.filter((service) => service.categoryId === category.id)
  const serviceItems = setupSection?.serviceItems ?? []
  const materialItems = setupSection?.materialItems ?? []
  const otherService = serviceItems.includes('Other')
    ? services.find((service) => service.name.toLowerCase() === 'other' && (service.section ?? 'service') === 'service' && !isCustomServiceDraft(service))
    : undefined
  const defaultServiceNames = new Set(serviceItems.map((name) => name.toLowerCase()))
  const treatmentServices = serviceItems
    .filter((name) => name.toLowerCase() !== 'other')
    .map((name) => services.find((service) => service.name.toLowerCase() === name.toLowerCase() && (service.section ?? 'service') === 'service'))
    .filter((service): service is DraftService => Boolean(service))
  const customServices = services.filter((service) => (
    (service.section ?? 'service') === 'service'
    && (isCustomServiceDraft(service) || !defaultServiceNames.has(service.name.toLowerCase()))
    && !treatmentServices.some((item) => item.id === service.id)
  ))
  const otherMaterial = materialItems.includes('Other')
    ? services.find((service) => service.name.toLowerCase() === 'other' && service.section === 'material' && !isCustomServiceDraft(service))
    : undefined
  const defaultMaterialNames = new Set(materialItems.map((name) => name.toLowerCase()))
  const materialServices = materialItems
    .filter((material) => material.toLowerCase() !== 'other')
    .map((material) => services.find((service) => service.name.toLowerCase() === material.toLowerCase() && service.section === 'material'))
    .filter((service): service is DraftService => Boolean(service))
  const customMaterials = services.filter((service) => (
    service.section === 'material'
    && (isCustomServiceDraft(service) || !defaultMaterialNames.has(service.name.toLowerCase()))
    && !materialServices.some((item) => item.id === service.id)
  ))

  if (!setupSection) {
    return null
  }

  function addCustomService() {
    const serviceId = `${category.id}-custom-service-${Date.now()}`
    setFocusedCustomServiceId(serviceId)
    updateDraft((current) => {
      return {
        ...current,
        services: [
          ...current.services,
          {
            id: serviceId,
            categoryId: category.id,
            name: '',
            selected: true,
            price: '',
            duration: '60',
            section: 'service',
            isCustom: true,
          },
        ],
      }
    })
  }

  function selectOtherService() {
    const serviceId = `${category.id}-custom-service-${Date.now()}`
    setFocusedCustomServiceId(serviceId)
    updateDraft((current) => ({
      ...current,
      services: [
        ...current.services.filter((service) => service.id !== otherService?.id),
        {
          id: serviceId,
          categoryId: category.id,
          name: '',
          selected: true,
          price: '',
          duration: '60',
          section: 'service',
          isCustom: true,
        },
      ],
    }))
  }

  function removeCustomService(serviceId: string) {
    updateDraft((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== serviceId),
      providers: current.providers.map((provider) => ({
        ...provider,
        serviceIds: provider.serviceIds.filter((id) => id !== serviceId),
      })),
    }))
  }

  function addCustomMaterial() {
    const materialId = `${category.id}-custom-material-${Date.now()}`
    setFocusedCustomMaterialId(materialId)
    updateDraft((current) => ({
      ...current,
      services: [
        ...current.services,
        {
          id: materialId,
          categoryId: category.id,
          name: '',
          selected: true,
          price: '',
          duration: '60',
          section: 'material',
          isCustom: true,
        },
      ],
    }))
  }

  function selectOtherMaterial() {
    const materialId = `${category.id}-custom-material-${Date.now()}`
    setFocusedCustomMaterialId(materialId)
    updateDraft((current) => ({
      ...current,
      services: [
        ...current.services.filter((service) => service.id !== otherMaterial?.id),
        {
          id: materialId,
          categoryId: category.id,
          name: '',
          selected: true,
          price: '',
          duration: '60',
          section: 'material',
          isCustom: true,
        },
      ],
    }))
  }

  function removeCustomMaterial(materialId: string) {
    updateDraft((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== materialId),
    }))
  }

  return (
    <div className="rounded-2xl border border-[#d6dce8] bg-white px-6 py-7 shadow-[0_3px_10px_rgb(34_42_66_/_0.03)]">
      <div>
        <p className="text-[20px] font-bold leading-6 text-[#10172a]">{setupSection.title}</p>
        <p className="mt-2 text-[15px] leading-5 text-[#68738b]">{setupSection.subtitle}</p>
      </div>

      <div className="mt-7">
        <button
          aria-expanded={servicesExpanded}
          className="mb-4 flex w-full items-center justify-between text-left"
          onClick={() => setServicesExpanded((expanded) => !expanded)}
          type="button"
        >
          <p className="text-[16px] leading-5 text-[#68738b]">{setupSection.servicesLabel}</p>
          <ChevronUp className={cn('size-5 text-[#10172a] transition-transform', !servicesExpanded && 'rotate-180')} />
        </button>
        {servicesExpanded && (
          <div className="space-y-2">
            {[...treatmentServices, ...customServices].map((service) => (
              <ServicePriceRow
                autoFocusName={service.id === focusedCustomServiceId}
                editableName={isCustomServiceDraft(service)}
                key={service.id}
                onRemove={isCustomServiceDraft(service) ? () => removeCustomService(service.id) : undefined}
                service={service}
                updateDraft={updateDraft}
              />
            ))}
            {otherService && (
              <OtherServiceRow onSelect={selectOtherService} />
            )}
            <button
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c7cede] bg-[#fbfcff] px-4 text-[14px] font-medium text-[#6734c7] transition hover:border-[#bda9f6] hover:bg-[#f7f3ff]"
              onClick={addCustomService}
              type="button"
            >
              <Plus className="size-4" />
              Add service
            </button>
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
          <p className="text-[16px] leading-5 text-[#68738b]">{setupSection.materialsLabel}</p>
          <ChevronUp className={cn('size-5 text-[#10172a] transition-transform', !materialsExpanded && 'rotate-180')} />
        </button>
        {materialsExpanded && (
          <div className="space-y-2">
            {[...materialServices, ...customMaterials].map((service) => (
              <MaterialRow
                autoFocusName={service.id === focusedCustomMaterialId}
                editableName={isCustomServiceDraft(service)}
                key={service.id}
                onRemove={isCustomServiceDraft(service) ? () => removeCustomMaterial(service.id) : undefined}
                service={service}
                updateDraft={updateDraft}
              />
            ))}
            {otherMaterial && (
              <OtherMaterialRow onSelect={selectOtherMaterial} />
            )}
            <button
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c7cede] bg-[#fbfcff] px-4 text-[14px] font-medium text-[#6734c7] transition hover:border-[#bda9f6] hover:bg-[#f7f3ff]"
              onClick={addCustomMaterial}
              type="button"
            >
              <Plus className="size-4" />
              Add material
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ServicePriceRow({
  autoFocusName = false,
  editableName = false,
  onRemove,
  service,
  updateDraft,
}: {
  autoFocusName?: boolean
  editableName?: boolean
  onRemove?: () => void
  service: DraftService
  updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void
}) {
  function toggleService() {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? { ...item, selected: !item.selected } : item),
    }))
  }

  function updateServiceName(name: string) {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? {
        ...item,
        name,
        selected: true,
        isCustom: true,
      } : item),
    }))
  }

  return (
    <div className={cn('grid items-center gap-2', onRemove ? 'grid-cols-[minmax(0,1fr)_auto_82px_32px]' : 'grid-cols-[minmax(0,1fr)_auto_82px]')}>
      <div
        className={cn('flex min-h-[53px] min-w-0 items-center gap-3 rounded-2xl border px-4 text-left transition', service.selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white')}
      >
        <button
          aria-checked={service.selected}
          aria-label={`${service.selected ? 'Disable' : 'Enable'} ${service.name || 'custom service'}`}
          className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)] transition', service.selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}
          onClick={toggleService}
          role="checkbox"
          type="button"
        >
          <Check className="size-3" />
        </button>
        {editableName ? (
          <input
            aria-label={`${service.name || 'Custom service'} name`}
            className="min-h-[40px] min-w-0 flex-1 cursor-text bg-transparent text-[15px] font-medium leading-5 text-[#1b2133] outline-none placeholder:text-[#8b92a1]"
            autoFocus={autoFocusName}
            onChange={(event) => updateServiceName(event.target.value)}
            placeholder="Service name"
            value={service.name}
          />
        ) : (
          <button
            className="min-w-0 flex-1 text-left"
            onClick={toggleService}
            type="button"
          >
            <span className="block truncate text-[15px] font-medium leading-5 text-[#1b2133]">{service.name}</span>
          </button>
        )}
      </div>
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
      {onRemove && (
        <button
          aria-label={`Remove ${service.name || 'custom service'}`}
          className="grid size-8 place-items-center rounded-md text-[#8b92a1] transition hover:bg-[#fff0f0] hover:text-[#e05252]"
          onClick={onRemove}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

function OtherServiceRow({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_82px] items-center gap-2">
      <button
        aria-label="Add custom service"
        className="flex min-h-[53px] min-w-0 items-center gap-3 rounded-2xl border border-[#d7dce8] bg-white px-4 text-left transition hover:border-[#cbb9ff] hover:bg-[#fbf9ff]"
        onClick={onSelect}
        type="button"
      >
        <span className="grid size-4 shrink-0 place-items-center rounded-[4px] border border-[#d5dce8] bg-[#f6f9ff] shadow-[0_2px_5px_rgb(24_32_50_/_0.08)]" />
        <span className="truncate text-[15px] font-medium leading-5 text-[#1b2133]">Other</span>
      </button>
      <span className="text-[18px] leading-none text-[#10172a]">$</span>
      <span className="grid min-h-[53px] items-center rounded-2xl border border-[#d7dce8] bg-white px-2 text-center text-[12px] font-medium text-[#7b8498]">
        e.g. 40
      </span>
    </div>
  )
}

function MaterialRow({
  autoFocusName = false,
  editableName = false,
  onRemove,
  service,
  updateDraft,
}: {
  autoFocusName?: boolean
  editableName?: boolean
  onRemove?: () => void
  service: DraftService
  updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void
}) {
  function toggleService() {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? { ...item, selected: !item.selected } : item),
    }))
  }

  function updateMaterialName(name: string) {
    updateDraft((current) => ({
      ...current,
      services: current.services.map((item) => item.id === service.id ? {
        ...item,
        name,
        selected: true,
        isCustom: true,
      } : item),
    }))
  }

  return (
    <div className={cn('grid items-center gap-2', onRemove ? 'grid-cols-[minmax(0,1fr)_32px]' : 'grid-cols-[minmax(0,1fr)]')}>
      <div className={cn(
        'flex min-h-[53px] w-full items-center gap-3 rounded-2xl border px-4 text-left transition',
        service.selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white',
      )}>
        <button
          aria-checked={service.selected}
          aria-label={`${service.selected ? 'Disable' : 'Enable'} ${service.name || 'custom material'}`}
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)] transition',
            service.selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent',
          )}
          onClick={toggleService}
          role="checkbox"
          type="button"
        >
          <Check className="size-3" />
        </button>
        {editableName ? (
          <input
            aria-label={`${service.name || 'Custom material'} name`}
            autoFocus={autoFocusName}
            className="min-h-[40px] min-w-0 flex-1 cursor-text bg-transparent text-[15px] font-medium leading-5 text-[#1b2133] outline-none placeholder:text-[#8b92a1]"
            onChange={(event) => updateMaterialName(event.target.value)}
            placeholder="Material name"
            value={service.name}
          />
        ) : (
          <button
            className="min-w-0 flex-1 text-left"
            onClick={toggleService}
            type="button"
          >
            <span className="block truncate text-[15px] font-medium leading-5 text-[#1b2133]">{service.name}</span>
          </button>
        )}
      </div>
      {onRemove && (
        <button
          aria-label={`Remove ${service.name || 'custom material'}`}
          className="grid size-8 place-items-center rounded-md text-[#8b92a1] transition hover:bg-[#fff0f0] hover:text-[#e05252]"
          onClick={onRemove}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

function OtherMaterialRow({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      aria-label="Add custom material"
      className="flex min-h-[53px] w-full min-w-0 items-center gap-3 rounded-2xl border border-[#d7dce8] bg-white px-4 text-left transition hover:border-[#cbb9ff] hover:bg-[#fbf9ff]"
      onClick={onSelect}
      type="button"
    >
      <span className="grid size-4 shrink-0 place-items-center rounded-[4px] border border-[#d5dce8] bg-[#f6f9ff] shadow-[0_2px_5px_rgb(24_32_50_/_0.08)]" />
      <span className="truncate text-[15px] font-medium leading-5 text-[#1b2133]">Other</span>
    </button>
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

function ProviderWeeklySchedule({ schedule, updateDay, readOnly = false }: { schedule: Record<string, DraftDay>; updateDay: (day: string, patch: Partial<DraftDay>) => void; readOnly?: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#d7dce8] bg-white px-5 py-6 shadow-[0_3px_10px_rgb(34_42_66_/_0.03)]">
      <h3 className="text-[22px] font-bold leading-7 text-[#10172a]">Weekly Schedule</h3>
      <p className="mt-2 text-[15px] leading-5 text-[#6f7890]">{readOnly ? 'Using the salon schedule.' : 'Configure opening and closing times for each day'}</p>
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
                  disabled={readOnly}
                  onClick={() => updateDay(day, { enabled: !daySchedule.enabled })}
                  type="button"
                >
                  <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(27_31_47_/_0.18)] transition-all', daySchedule.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
              {daySchedule.enabled && (
                <div className="mt-4 grid grid-cols-[88px_auto_88px] items-center gap-3">
                  {readOnly ? <ReadOnlyTime value={daySchedule.open} /> : <ScheduleTimeInput onCommit={(value) => updateDay(day, { open: value })} value={daySchedule.open} />}
                  <span className="text-center text-[14px] font-medium text-[#7b8498]">to</span>
                  {readOnly ? <ReadOnlyTime value={daySchedule.close} /> : <ScheduleTimeInput onCommit={(value) => updateDay(day, { close: value })} value={daySchedule.close} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReadOnlyTime({ value }: { value: string }) {
  return (
    <span className="grid min-h-10 w-full place-items-center rounded-lg bg-[#f4f6fb] px-2 text-center text-[13px] font-medium text-[#7b8498]">
      {formatTimeDisplay(value)}
    </span>
  )
}

function TeamStep({ categories, draft, updateDraft }: { categories: ServiceCategory[]; draft: OnboardingDraft; updateDraft: (updater: (current: OnboardingDraft) => OnboardingDraft) => void }) {
  const activeProvider = draft.providers.find((provider) => provider.id === draft.activeProviderId)

  function addProvider() {
    if (draft.providers.length >= 10) {
      return
    }

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
  const staffLimitReached = draft.providers.length >= 10

  return (
    <div className="space-y-5">
      {draft.providers.map((provider) => (
        <ProviderSummaryCard categories={categories} draft={draft} key={provider.id} onEdit={() => onEditProvider(provider.id)} provider={provider} />
      ))}

      <button
        className={cn('grid min-h-[180px] w-full place-items-center rounded-2xl border border-[#d7dce8] bg-white px-5 py-8 text-center transition hover:border-[#cbb9ff] hover:bg-[#fbf9ff]', staffLimitReached && 'cursor-not-allowed opacity-70 hover:border-[#d7dce8] hover:bg-white')}
        disabled={staffLimitReached}
        onClick={onAddProvider}
        type="button"
      >
        <span>
          <span className="mx-auto grid size-8 place-items-center rounded-full text-[#7a3fe0]">
            <Plus className="size-5" />
          </span>
          <span className="mt-2 block text-[13px] font-medium text-[#747d96]">{staffLimitReached ? 'Staff limit reached' : 'Add New Provider'}</span>
          {staffLimitReached && <span className="mx-auto mt-2 block max-w-[240px] text-[11px] leading-4 text-[#8b92a1]">You’ve reached the limit of 10 active staff members. Upgrade your plan to add more providers.</span>}
        </span>
      </button>
    </div>
  )
}

function ProviderSummaryCard({ categories, draft, provider, onEdit }: { categories: ServiceCategory[]; draft: OnboardingDraft; provider: DraftProvider; onEdit: () => void }) {
  const categoryServiceMap = new Map(getProviderCategoryServices(draft).map((service) => [service.id, service]))
  const treatmentServiceMap = new Map(getSetupTreatmentServices(draft, categories).map((service) => [service.id, service]))
  const providerCategoryServices = provider.serviceIds
    .map((serviceId) => categoryServiceMap.get(serviceId))
    .filter((service): service is DraftService => Boolean(service))
  const providerTreatmentServices = provider.serviceIds
    .map((serviceId) => treatmentServiceMap.get(serviceId))
    .filter((service): service is DraftService => Boolean(service))
  const categoryIds = new Set([
    ...(provider.categoryIds ?? []),
    ...providerCategoryServices.map((service) => service.categoryId),
  ])
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
        <ProviderSummarySection icon={<Sparkles className="size-4" />} label="SPECIALTIES" values={providerTreatmentServices.map((service) => service.name)} />
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
  const selectedCategoryIds = new Set(draft.selectedCategoryIds)
  const providerServices = getSetupTreatmentServices(draft, categories).filter((service) => selectedCategoryIds.has(service.categoryId))
  const providerCategoryServices = getProviderCategoryServices(draft)
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
    return providerCategoryServices.filter((service) => service.categoryId === categoryId)
  }

  function categoryAssigned(categoryId: string) {
    return (provider.categoryIds ?? []).includes(categoryId)
      || categoryServices(categoryId).some((service) => providerServiceIds.has(service.id))
  }

  function toggleCategory(categoryId: string) {
    const serviceIds = categoryServices(categoryId).map((service) => service.id)
    if (!serviceIds.length) {
      updateProvider({
        categoryIds: categoryAssigned(categoryId)
          ? (provider.categoryIds ?? []).filter((id) => id !== categoryId)
          : [...new Set([...(provider.categoryIds ?? []), categoryId])],
      })
      return
    }

    if (categoryAssigned(categoryId)) {
      updateProvider({
        categoryIds: (provider.categoryIds ?? []).filter((id) => id !== categoryId),
        serviceIds: provider.serviceIds.filter((serviceId) => !serviceIds.includes(serviceId)),
      })
      return
    }

    updateDraft((current) => ({
      ...current,
      services: current.services.map((service) => (
        serviceIds.includes(service.id) && Number(service.price) > 0
          ? { ...service, selected: true }
          : service
      )),
      providers: current.providers.map((item) => item.id === provider.id ? {
        ...item,
        categoryIds: [...new Set([...(item.categoryIds ?? []), categoryId])],
        serviceIds: [...new Set([...item.serviceIds, ...serviceIds])],
      } : item),
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
    updateDraft((current) => ({
      ...current,
      providers: current.providers.map((item) => item.id === provider.id ? {
        ...item,
        serviceDurations: {
          ...(item.serviceDurations ?? {}),
          [serviceId]: duration,
        },
        serviceIds: [...new Set([...item.serviceIds, serviceId])],
      } : item),
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
              readOnly
              schedule={salonSchedule}
              updateDay={() => undefined}
            />
          )}
          {!usesSalonSchedule && (
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

          <p className="mb-3 mt-4 text-[16px] leading-5 text-[#68738b]">Services</p>
          <div className="space-y-2">
            {providerServices.map((service) => {
              const selected = provider.serviceIds.includes(service.id)
              return (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_74px_auto] items-center gap-2"
                  key={service.id}
                >
                  <button
                    className={cn('flex min-h-[48px] min-w-0 items-center gap-3 rounded-2xl border px-4 text-left transition', selected ? 'border-[#e8ddff] bg-[#eee8ff]' : 'border-[#d7dce8] bg-white')}
                    onClick={() => toggleProviderService(service.id, !selected)}
                    type="button"
                  >
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-[0_2px_5px_rgb(24_32_50_/_0.08)]', selected ? 'border-[#cbb9ff] bg-white text-[#7a3fe0]' : 'border-[#d5dce8] bg-[#f6f9ff] text-transparent')}>
                      <Check className="size-3" />
                    </span>
                    <span className="truncate text-[15px] font-medium leading-5 text-[#1b2133]">{service.name}</span>
                  </button>
                  <label className="grid min-h-[48px] items-center overflow-hidden rounded-2xl border border-[#d7dce8] bg-white px-2">
                    <input
                      aria-label={`${service.name} duration`}
                      className="[appearance:textfield] min-w-0 bg-transparent text-center text-[12px] text-[#1b2133] outline-none placeholder:text-[12px] placeholder:text-[#7b8498] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      onChange={(event) => updateProviderServiceDuration(service.id, event.target.value)}
                      placeholder={service.duration || '60'}
                      type="number"
                      value={provider.serviceDurations?.[service.id] ?? service.duration}
                    />
                  </label>
                  <span className="text-[15px] leading-none text-[#10172a]">min</span>
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
  if (step === 'services') {
    const services = getSelectedProviderCategoryServices(draft)
    if (!services.length) return true
    return services.some((service) => service.selected && service.name.trim() && Number(service.price) > 0 && Number(service.duration) > 0)
  }
  if (step === 'schedule') return Object.values(draft.schedule).some((day) => day.enabled && day.open && day.close && day.open < day.close)
  if (step === 'team') {
    const hasAssignableServices = getSelectedProviderCategoryServices(draft).length > 0
    return draft.providers.length > 0 && draft.providers.every((provider) => (
      provider.name.trim()
      && (!hasAssignableServices || provider.serviceIds.length > 0)
      && Number(provider.salonPercent) + Number(provider.professionalPercent) === 100
    ))
  }
  return true
}
