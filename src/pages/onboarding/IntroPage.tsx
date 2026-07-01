import { useState } from 'react'
import { ArrowRight, CalendarDays, ChartNoAxesCombined, Link2, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components'

const features = [
  { icon: CalendarDays, title: 'Your salon, beautifully organized', description: 'See appointments, availability, and your daily schedule at a glance.' },
  { icon: UsersRound, title: 'Keep clients and staff connected', description: 'Manage profiles, services, treatment notes, and team schedules.' },
  { icon: ChartNoAxesCombined, title: 'Know how your salon is growing', description: 'Track sales, tips, and provider earnings without extra spreadsheets.' },
  { icon: Link2, title: 'Let clients book with your link', description: 'Share one simple salon link wherever your clients already are.' },
]

export function IntroPage() {
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const feature = features[index]
  const Icon = feature.icon

  const next = () => index === features.length - 1 ? navigate('/entry') : setIndex(index + 1)

  return (
    <div className="flex min-h-dvh flex-col bg-auth-gradient px-5 pb-6 pt-12">
      <button className="self-end text-xs font-semibold text-primary-dark" onClick={() => navigate('/entry')} type="button">Skip</button>
      <div className="grid flex-1 content-center">
        <div className="mx-auto grid size-52 place-items-center rounded-full bg-surface/60 shadow-card">
          <div className="grid size-36 place-items-center rounded-2xl bg-lavender text-primary shadow-action">
            <Icon className="size-20" strokeWidth={1.25} />
          </div>
        </div>
        <h1 className="mx-auto mt-10 max-w-[310px] text-center text-3xl font-bold leading-tight tracking-[-0.035em]">{feature.title}</h1>
        <p className="mx-auto mt-4 max-w-[300px] text-center text-sm leading-6 text-muted">{feature.description}</p>
      </div>
      <div className="mb-5 flex justify-center gap-2">
        {features.map((item, itemIndex) => <span className={itemIndex === index ? 'h-2 w-7 rounded-full bg-primary' : 'size-2 rounded-full bg-primary/20'} key={item.title} />)}
      </div>
      <Button fullWidth onClick={next} size="lg" trailingIcon={<ArrowRight className="size-4" />}>{index === features.length - 1 ? 'Get started' : 'Continue'}</Button>
    </div>
  )
}
