import { CalendarHeart, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card } from '../../components'

export function EntryPage() {
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-auth-gradient p-4 pb-7">
      <div className="mb-auto pt-20 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-primary text-white shadow-action"><CalendarHeart className="size-10" /></span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em]">Glamhour</h1>
        <p className="mt-2 text-sm text-muted">Your salon's best hour, every hour.</p>
      </div>
      <Card className="space-y-3" padding="lg">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-lavender text-primary"><Sparkles className="size-5" /></span>
          <div><p className="font-semibold">Ready to grow?</p><p className="text-xs text-muted">Create your salon or return to your account.</p></div>
        </div>
        <Link to="/signup"><Button fullWidth size="lg">Create salon account</Button></Link>
        <Link to="/login"><Button fullWidth size="lg" variant="outline">Log in</Button></Link>
      </Card>
    </div>
  )
}
