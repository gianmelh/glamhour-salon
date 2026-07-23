import { CalendarRange, ChevronDown, DollarSign, Share2, UserRound, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Avatar, Badge, Button, Card, ErrorState, LoadingState, Select,
} from '../../components'
import { useProfessionals, useSalesHistory, useServiceCategories } from '../../hooks/useGlamhourData'
import { formatMoney, formatShortDate } from '../../lib/format'
import type { SalesHistoryItem } from '../../types/api'

function todayMinus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function categoryTone(categoryCode: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (categoryCode === 'nails') return 'primary'
  if (categoryCode === 'lashes') return 'info'
  if (categoryCode === 'cosmetology') return 'warning'
  if (categoryCode === 'micropigmentation') return 'success'
  return 'neutral'
}

export function SalesPage() {
  const navigate = useNavigate()
  const [providerId, setProviderId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [startDate, setStartDate] = useState(todayMinus(60))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const filters = useMemo(() => ({
    professionalId: providerId || undefined,
    categoryId: categoryId || undefined,
    startDate,
    endDate,
  }), [categoryId, endDate, providerId, startDate])
  const sales = useSalesHistory(filters)
  const professionals = useProfessionals()
  const categories = useServiceCategories()

  if (sales.loading || professionals.loading || categories.loading) return <LoadingState label="Loading sales history..." />
  if (!sales.data) return <ErrorState description={sales.error?.message ?? 'Sales history could not be loaded.'} onRetry={sales.retry} />

  const providerOptions = [
    { label: 'All providers', value: '' },
    ...(professionals.data ?? []).map((professional) => ({ label: professional.full_name, value: professional.id })),
  ]
  const categoryOptions = [
    { label: 'All categories', value: '' },
    ...(categories.data ?? []).map((category) => ({ label: category.name, value: category.id })),
  ]
  const summary = sales.data.summary
  const noRecords = sales.data.records.length === 0
  const selectedProviderWithoutServices = providerId && summary.selectedProviderHasServices === false

  return (
    <div className="-mx-4 -mt-5 min-h-dvh space-y-6 bg-[#f2f5ff] px-5 pb-8 pt-8">
      <header>
        <h1 className="text-[32px] font-extrabold leading-tight text-[#111827]">Sales History</h1>
        <p className="mt-2 text-[17px] leading-6 text-[#68738b]">View your past appointments and service details.</p>
      </header>

      <Card className="space-y-4 rounded-[18px] border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
        <Select label="LIST BY" onChange={(event) => setProviderId(event.target.value)} options={providerOptions} value={providerId} />
        <Select label="CATEGORY" onChange={(event) => setCategoryId(event.target.value)} options={categoryOptions} value={categoryId} />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink">Date range</p>
          <DateField ariaLabel="Start date" value={startDate} onChange={setStartDate} />
          <DateField ariaLabel="End date" value={endDate} onChange={setEndDate} />
        </div>
      </Card>

      <div className="grid gap-4">
        <IncomeCard icon={<DollarSign className="size-5" />} label="Salon total income" value={formatMoney(summary.salonIncome, summary.currencyCode)} />
        <IncomeCard icon={<UserRound className="size-5" />} label="Provider total income" value={formatMoney(summary.providerIncome, summary.currencyCode)} />
        <IncomeCard icon={<DollarSign className="size-5" />} label="Tips" value={formatMoney(summary.tips, summary.currencyCode)} />
      </div>

      {selectedProviderWithoutServices ? (
        <ProviderWithoutServicesState
          avatarUrl={summary.selectedProviderAvatarUrl}
          name={summary.selectedProviderName ?? 'Provider'}
        />
      ) : noRecords ? (
        <NoRecordsState
          endDate={endDate}
          onClear={() => {
            setProviderId('')
            setCategoryId('')
            setStartDate('')
            setEndDate('')
          }}
          startDate={startDate}
          totalAvailableCount={summary.totalAvailableCount}
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#111827]">Completed services</h2>
            <Badge tone="primary">{summary.recordCount} records</Badge>
          </div>
          <div className="space-y-3">
            {sales.data.records.map((record) => (
              <SalesRecordCard key={record.id} onBookAgain={() => {
                window.sessionStorage.setItem('glamhour:new-appointment-draft', JSON.stringify({
                  categoryId: record.category_id ?? '',
                  categoryCode: record.category_code,
                  serviceId: record.service_id ?? '',
                  clientId: record.client_id,
                  providerId: record.professional_id,
                  startsAt: '',
                  notes: record.notes ?? '',
                  details: record.treatment_details ?? {},
                }))
                navigate('/app/appointments/new')
              }} record={record} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function IncomeCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-[18px] border-0 bg-white px-6 py-5 shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
      <div className="flex items-center gap-4">
        <span className="grid size-[68px] place-items-center rounded-[18px] bg-[#eee8ff] text-[#7a3fe0]">{icon}</span>
        <span>
          <span className="block text-[17px] font-medium text-[#111827]">{label}</span>
          <span className="mt-2 block text-[34px] font-medium leading-none text-[#111827]">{value}</span>
        </span>
      </div>
    </Card>
  )
}

function DateField({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel: string }) {
  return (
    <label className="relative block">
      <CalendarRange className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7b8498]" />
      <input
        aria-label={ariaLabel}
        className="min-h-[58px] w-full rounded-[14px] border border-[#b8bfcb] bg-white px-12 pr-4 text-[18px] font-medium leading-none text-[#111827] outline-none transition focus:border-[#7a3fe0] focus:ring-3 focus:ring-[#7a3fe0]/10"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  )
}

function SalesRecordCard({ record, onBookAgain }: { record: SalesHistoryItem; onBookAgain: () => void }) {
  return (
    <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={record.client_name} src={record.provider_avatar_url ?? undefined} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#111827]">{record.client_name}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#68738b]">{formatShortDate(record.completed_at ?? record.recorded_at)} · {record.professional_name}</p>
          </div>
        </div>
        <Badge tone={categoryTone(record.category_code)}>{record.category_name}</Badge>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-[#111827]">{record.service_name}</p>
          <p className="mt-1 text-[17px] font-bold text-[#7a3fe0]">{formatMoney(record.total_minor, record.currency_code)}</p>
        </div>
        <ChevronDown className="mt-4 size-4 text-[#68738b]" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-[#68738b]">
        <span>Salon: <strong className="text-[#111827]">{formatMoney(record.salon_earnings_minor, record.currency_code)}</strong></span>
        <span>Provider: <strong className="text-[#111827]">{formatMoney(record.professional_earnings_minor, record.currency_code)}</strong></span>
        <span>Tips: <strong className="text-[#111827]">{formatMoney(record.tip_minor, record.currency_code)}</strong></span>
      </div>

      {record.notes && <p className="mt-3 rounded-md bg-[#f8f9ff] px-3 py-3 text-[11px] leading-4 text-[#68738b]">“{record.notes}”</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`/app/sales-history/${record.id}`}>
          <Button className="min-h-11 rounded-lg text-[12px]" fullWidth variant="secondary">Details</Button>
        </Link>
        <Button className="min-h-11 rounded-lg text-[12px]" fullWidth onClick={onBookAgain}>Book again</Button>
      </div>
    </Card>
  )
}

function NoRecordsState({ startDate, endDate, totalAvailableCount, onClear }: { startDate: string; endDate: string; totalAvailableCount: number; onClear: () => void }) {
  return (
    <Card className="rounded-[18px] border-0 bg-white px-6 py-12 text-center shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-[#eee8ff] text-[#7a3fe0]">
        <CalendarRange className="size-7" />
      </span>
      <h2 className="mt-4 text-[15px] font-bold text-[#111827]">No appointments found</h2>
      <p className="mx-auto mt-2 max-w-[245px] text-[11px] leading-4 text-[#68738b]">No records found between {startDate || 'the selected start date'} and {endDate || 'the selected end date'}. Try expanding the date range.</p>
      <div className="mt-8 space-y-3 text-left">
        <EmptyAction title="Change the date range" to="#" />
        <button className="w-full text-left" onClick={onClear} type="button"><EmptyAction title="Clear date filter" /></button>
        <EmptyAction title="Go to Share" to="/app/share" />
        <EmptyAction title="Create appointment" to="/app/appointments" />
      </div>
      {totalAvailableCount > 0 && <p className="mt-4 text-[10px] text-[#68738b]">There are {totalAvailableCount} records total in the history. Adjust the filters to view them.</p>}
    </Card>
  )
}

function ProviderWithoutServicesState({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <Card className="rounded-[18px] border-0 bg-white py-8 text-center shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
      <Avatar className="mx-auto" name={name} src={avatarUrl ?? undefined} />
      <h2 className="mt-4 text-[15px] font-bold text-[#111827]">No services assigned</h2>
      <p className="mx-auto mt-2 max-w-[255px] text-[11px] leading-4 text-[#68738b]">{name} has no services linked to their profile. Assign services from settings so they can receive appointments and appear in the history.</p>
      <div className="mt-5 space-y-2 text-left">
        <EmptyAction icon={<UserRound className="size-4" />} title="Go to Settings" to="/app/settings" />
        <EmptyAction icon={<UsersRound className="size-4" />} title="View providers" to="/app/staff" />
        <EmptyAction icon={<CalendarRange className="size-4" />} title="Manage services" to="/app/services" />
        <EmptyAction icon={<Share2 className="size-4" />} title="Go to Share" to="/app/share" />
      </div>
    </Card>
  )
}

function EmptyAction({ title, to, icon }: { title: string; to?: string; icon?: React.ReactNode }) {
  const content = (
    <span className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[14px] bg-[#f8f9ff] p-4">
      <span className="grid size-8 place-items-center rounded-md bg-[#eee8ff] text-[#7a3fe0]">{icon ?? <CalendarRange className="size-4" />}</span>
      <span className="text-[11px] font-bold text-[#111827]">{title}</span>
      <span className="text-[#7a3fe0]">›</span>
    </span>
  )
  return to ? <Link to={to}>{content}</Link> : content
}
