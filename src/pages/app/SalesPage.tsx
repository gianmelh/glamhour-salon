import { CalendarRange, ChevronRight, DollarSign, TrendingUp } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, LoadingState, PageTitle, ScreenSection } from '../../components'
import { useProfessionals, useSalesHistory } from '../../hooks/useGlamhourData'
import { formatMoney, formatShortDate } from '../../lib/format'

export function SalesPage() {
  const sales = useSalesHistory()
  const professionals = useProfessionals()
  if (sales.loading) return <LoadingState label="Loading sales history..." />
  if (!sales.data && sales.error) return <ErrorState description={sales.error.message} onRetry={sales.retry} />
  const total = sales.data?.reduce((sum, item) => sum + item.total_minor, 0) ?? 0
  const salonEarnings = sales.data?.reduce((sum, item) => sum + item.salon_earnings_minor, 0) ?? 0
  return <div className="space-y-5"><DataSourceNotice visible={sales.isFallback || professionals.isFallback} /><PageTitle action={<Button size="icon" variant="outline"><CalendarRange className="size-4" /></Button>} title="Sales history" subtitle="Review completed services and salon earnings." /><div className="grid grid-cols-2 gap-3"><Metric icon={<DollarSign />} label="Total sales" value={formatMoney(total)} /><Metric icon={<TrendingUp />} label="Salon earnings" value={formatMoney(salonEarnings)} /></div><div className="flex gap-2 overflow-x-auto pb-1"><Badge tone="primary">All professionals</Badge>{professionals.data?.map((item) => <Badge key={item.id}>{item.full_name.split(' ')[0]}</Badge>)}</div><ScreenSection title="Completed services">{sales.data?.length ? <div className="space-y-3">{sales.data.map((sale) => <Card key={sale.appointment_id}><div className="flex items-start gap-3"><Avatar name={sale.client_name} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{sale.client_name}</p><p className="text-xs text-muted">Completed salon service</p><p className="mt-2 text-[11px] text-muted">{formatShortDate(sale.starts_at)} · {sale.professional_name}</p></div><div className="text-right"><p className="text-sm font-bold">{formatMoney(sale.total_minor, sale.currency_code)}</p><ChevronRight className="ml-auto mt-2 size-4 text-muted" /></div></div><p className="mt-3 border-t border-border pt-3 text-[11px] text-muted">{formatMoney(sale.salon_earnings_minor)} salon · {formatMoney(sale.professional_earnings_minor)} provider</p></Card>)}</div> : <EmptyState description="Completed appointments will appear here." title="No sales history" />}</ScreenSection></div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><span className="grid size-8 place-items-center rounded-md bg-lavender text-primary [&>svg]:size-4">{icon}</span><p className="mt-3 text-[11px] text-muted">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>
}
