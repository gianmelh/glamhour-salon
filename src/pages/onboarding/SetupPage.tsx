import { Check, Clock3, Plus, UsersRound } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, DataSourceNotice, ErrorState, Input, LoadingState, PageTitle, ServiceCard, StaffCard } from '../../components'
import { useProfessionals, useServiceCategories, useServices } from '../../hooks/useGlamhourData'
import { serviceCardProps, staffCardProps } from '../../lib/view-models'
import type { Professional, Service, ServiceCategory } from '../../types/api'

const steps = ['categories', 'services', 'schedule', 'team', 'complete']

type OnboardingState = {
  salonId?: string
  salonName?: string
  email?: string
}

export function SetupPage() {
  const { step = 'categories' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const onboardingState = (location.state ?? {}) as OnboardingState
  const categories = useServiceCategories(onboardingState.salonId)
  const services = useServices(onboardingState.salonId)
  const professionals = useProfessionals(onboardingState.salonId)
  const stepIndex = Math.max(0, steps.indexOf(step))
  const next = () => {
    navigate(step === 'complete' ? '/app/home' : `/onboarding/${steps[stepIndex + 1]}`, {
      state: onboardingState,
    })
  }
  if (categories.loading || services.loading || professionals.loading) return <div className="min-h-dvh bg-canvas p-4"><LoadingState label="Loading salon setup..." /></div>
  if (!categories.data || !services.data || !professionals.data) return <div className="min-h-dvh bg-canvas p-4"><ErrorState description="Salon setup data could not be loaded." onRetry={() => { categories.retry(); services.retry(); professionals.retry() }} /></div>

  return (
    <div className="min-h-dvh bg-canvas px-4 pb-7 pt-8">
      <DataSourceNotice visible={categories.isFallback || services.isFallback || professionals.isFallback} />
      <div className="mb-7 flex gap-1.5">{steps.map((item, index) => <span className={index <= stepIndex ? 'h-1.5 flex-1 rounded-full bg-primary' : 'h-1.5 flex-1 rounded-full bg-primary/15'} key={item} />)}</div>
      {step === 'categories' && <CategoriesStep categories={categories.data} />}
      {step === 'services' && <ServicesStep services={services.data} />}
      {step === 'schedule' && <ScheduleStep salonName={onboardingState.salonName} />}
      {step === 'team' && <TeamStep professionals={professionals.data} />}
      {step === 'complete' && <CompleteStep />}
      <Button className="mt-7" fullWidth onClick={next} size="lg">{step === 'complete' ? 'Go to my salon' : 'Continue'}</Button>
    </div>
  )
}

function CategoriesStep({ categories }: { categories: ServiceCategory[] }) {
  return <><PageTitle eyebrow="Step 1 of 4" title="What does your salon offer?" subtitle="Choose all categories that apply. You can update these later." /><div className="mt-7 grid grid-cols-2 gap-3">{categories.map((category, index) => <Card className={index < 3 ? 'border-primary bg-lavender text-primary' : ''} key={category.id} padding="lg"><span className="mb-5 grid size-10 place-items-center rounded-md bg-surface text-primary shadow-card"><Check className="size-5" /></span><p className="font-semibold">{category.name}</p></Card>)}</div></>
}

function ServicesStep({ services }: { services: Service[] }) {
  return <><PageTitle eyebrow="Step 2 of 4" title="Set up your services" subtitle="Choose your starting services, prices, and durations." /><div className="mt-6 space-y-3">{services.slice(0, 3).map((service) => <ServiceCard key={service.id} {...serviceCardProps(service)} />)}<Button fullWidth leadingIcon={<Plus className="size-4" />} variant="outline">Add another service</Button></div></>
}

function ScheduleStep({ salonName }: { salonName?: string }) {
  return <><PageTitle eyebrow="Step 3 of 4" title={`When is ${salonName ?? 'your salon'} open?`} subtitle="Set your regular weekly salon hours." /><div className="mt-6 space-y-3">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <Card className="flex items-center gap-3" key={day} padding="sm"><input defaultChecked={index < 6} className="accent-primary" type="checkbox" /><span className="w-20 text-xs font-semibold">{day}</span>{index < 6 ? <><Input aria-label={`${day} opening time`} className="min-h-9 px-2 text-xs" defaultValue="9:00 AM" /><span className="text-muted">–</span><Input aria-label={`${day} closing time`} className="min-h-9 px-2 text-xs" defaultValue="6:00 PM" /></> : <span className="text-xs text-muted">Closed</span>}</Card>)}</div></>
}

function TeamStep({ professionals }: { professionals: Professional[] }) {
  return <><PageTitle eyebrow="Step 4 of 4" title="Meet your team" subtitle="Add professionals and match them with services and working hours." /><div className="mt-6 space-y-3">{professionals.slice(0, 2).map((person) => <StaffCard key={person.id} {...staffCardProps(person)} />)}<Button fullWidth leadingIcon={<UsersRound className="size-4" />} variant="outline">Add a professional</Button></div></>
}

function CompleteStep() {
  return <div className="grid min-h-[640px] place-items-center text-center"><div><span className="mx-auto grid size-24 place-items-center rounded-full bg-primary text-white shadow-action"><Check className="size-12" /></span><h1 className="mt-7 text-3xl font-bold tracking-[-0.04em]">Your salon is ready!</h1><p className="mx-auto mt-3 max-w-[300px] text-sm leading-6 text-muted">Glow Salon is configured. Start managing appointments, clients, services, and your team.</p><Card className="mt-7 flex items-center gap-3 text-left" tone="lavender"><Clock3 className="size-5 text-primary" /><div><p className="text-xs font-semibold">Next best step</p><p className="text-[11px] text-muted">Create your first appointment or share your booking link.</p></div></Card></div></div>
}
