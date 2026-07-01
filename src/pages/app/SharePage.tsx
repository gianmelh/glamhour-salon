import { Check, Copy, Link2, MessageCircle, MessagesSquare, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, DataSourceNotice, ErrorState, LoadingState, PageTitle } from '../../components'
import { useSalon } from '../../hooks/useGlamhourData'

export function SharePage() {
  const [copied, setCopied] = useState(false)
  const salon = useSalon()
  if (salon.loading) return <LoadingState label="Loading salon link..." />
  if (!salon.data) return <ErrorState description={salon.error?.message ?? 'Salon could not be loaded'} onRetry={salon.retry} />
  const bookingUrl = `${window.location.host}/book/${salon.data.slug}`
  return <div className="space-y-6"><DataSourceNotice visible={salon.isFallback} /><PageTitle title="Your salon link" subtitle="Share your booking link so clients can schedule services online." /><Card className="py-8 text-center" tone="lavender"><span className="mx-auto grid size-16 place-items-center rounded-xl bg-surface text-primary shadow-card"><Link2 className="size-8" /></span><h2 className="mt-4 text-lg font-semibold">{salon.data.name} is ready to book</h2><p className="mx-auto mt-2 max-w-[270px] text-xs leading-5 text-muted">Clients can browse your services and request an available time through this link.</p></Card><Card><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Booking link</p><div className="mt-3 flex items-center gap-2 rounded-md bg-surface-soft p-2 pl-3"><span className="min-w-0 flex-1 truncate text-xs font-medium">{bookingUrl}</span><Button onClick={async () => { await navigator.clipboard?.writeText(bookingUrl); setCopied(true) }} size="sm" variant={copied ? 'secondary' : 'primary'}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}</Button></div></Card><div><p className="mb-3 text-sm font-semibold">Share with clients</p><div className="grid grid-cols-3 gap-3"><ShareOption icon={<MessageCircle />} label="WhatsApp" /><ShareOption icon={<MessagesSquare />} label="SMS" /><ShareOption icon={<Share2 />} label="More" /></div></div></div>
}

function ShareOption({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <button className="grid place-items-center gap-2 rounded-lg border border-border bg-surface p-4 text-xs font-semibold shadow-card" type="button"><span className="grid size-10 place-items-center rounded-full bg-lavender text-primary [&>svg]:size-5">{icon}</span>{label}</button>
}
