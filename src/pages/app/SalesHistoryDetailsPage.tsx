import { ArrowLeft, CalendarDays, DollarSign, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar, Badge, Button, Card, ErrorState, LoadingState,
} from '../../components'
import { useSalesHistoryDetail } from '../../hooks/useGlamhourData'
import { formatDate, formatMoney, formatTime } from '../../lib/format'

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function detailEntries(details: Record<string, unknown> | null, categoryCode: string) {
  if (!details) return []
  const keysByCategory: Record<string, string[]> = {
    nails: ['service_type', 'shape', 'system', 'product_type', 'hand', 'finger_details', 'capsule_numbers', 'lengths', 'materials'],
    lashes: ['style', 'variant', 'volume', 'curl', 'thickness', 'length_mm', 'eye_shape', 'adhesive'],
    cosmetology: ['treatment_name', 'equipment', 'products', 'duration', 'intensity', 'depth', 'skin_type', 'alterations', 'facial_annotations'],
    micropigmentation: ['service_type', 'area', 'pigment', 'color_mix', 'needle', 'needle_size', 'first_session_date', 'control_date', 'observations'],
  }
  const keys = keysByCategory[categoryCode] ?? Object.keys(details)

  return keys
    .filter((key) => details[key] !== undefined && details[key] !== null && details[key] !== '')
    .map((key) => ({
      label: titleCase(key),
      value: Array.isArray(details[key]) || typeof details[key] === 'object'
        ? JSON.stringify(details[key])
        : String(details[key]),
    }))
}

export function SalesHistoryDetailsPage() {
  const { recordId = '' } = useParams()
  const navigate = useNavigate()
  const detail = useSalesHistoryDetail(recordId)

  if (detail.loading) return <LoadingState label="Loading service details..." />
  if (!detail.data) return <ErrorState description={detail.error?.message ?? 'Service details could not be loaded.'} onRetry={detail.retry} />

  const record = detail.data
  const detailRows = detailEntries(record.treatment_details, record.category_code)

  return (
    <div className="space-y-4">
      <button className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111827]" onClick={() => navigate(-1)} type="button">
        <ArrowLeft className="size-4" /> Sales history
      </button>

      <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#111827]">Service Details</h1>

      <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
        <div className="flex items-center gap-3">
          <Avatar name={record.client_name} src={record.provider_avatar_url ?? undefined} />
          <div>
            <p className="text-[13px] font-bold text-[#111827]">{record.client_name}</p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-[#68738b]"><CalendarDays className="size-3" /> {formatDate(record.completed_at ?? record.recorded_at)} · {formatTime(record.completed_at ?? record.recorded_at)}</p>
          </div>
        </div>
      </Card>

      <section>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#68738b]">Service details</p>
        <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Badge tone="primary">{record.category_name}</Badge>
              <p className="mt-3 text-[14px] font-bold text-[#111827]">{record.service_name}</p>
            </div>
            <p className="text-[18px] font-bold text-[#111827]">{formatMoney(record.total_minor, record.currency_code)}</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MoneyPill label="Salon earnings" value={record.salon_earnings_minor} currency={record.currency_code} />
            <MoneyPill label="Provider earnings" value={record.professional_earnings_minor} currency={record.currency_code} />
            <MoneyPill label="Tips" value={record.tip_minor} currency={record.currency_code} />
          </div>
        </Card>
      </section>

      <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
        <InfoRow icon={<UserRound className="size-4" />} label="Assigned provider" value={record.professional_name} />
        <InfoRow icon={<DollarSign className="size-4" />} label="Subtotal" value={formatMoney(record.subtotal_minor, record.currency_code)} />
      </Card>

      <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
        <p className="text-[12px] font-bold text-[#111827]">Technical details</p>
        {detailRows.length ? (
          <div className="mt-3 grid gap-2">
            {detailRows.map((row) => <InfoLine key={row.label} label={row.label} value={row.value} />)}
          </div>
        ) : (
          <p className="mt-2 text-[11px] leading-4 text-[#68738b]">No category-specific service details were saved for this record.</p>
        )}
      </Card>

      <Card className="rounded-lg border-0 bg-white shadow-[0_4px_14px_rgb(18_24_38_/_0.04)]">
        <p className="text-[12px] font-bold text-[#111827]">Notes</p>
        <p className="mt-2 text-[11px] leading-5 text-[#68738b]">{record.notes ?? 'No notes were saved for this service.'}</p>
        {record.recommendations && <p className="mt-3 text-[11px] leading-5 text-[#68738b]">Aftercare: {record.recommendations}</p>}
      </Card>

      <Button className="min-h-12 rounded-lg shadow-[0_10px_18px_rgb(78_35_153_/_0.42)]" fullWidth onClick={() => {
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
      }}>
        Schedule this service again
      </Button>
    </div>
  )
}

function MoneyPill({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div>
      <p className="text-[9px] text-[#68738b]">{label}</p>
      <p className="mt-1 rounded-lg bg-[#f8f9ff] px-2 py-2 text-center text-[11px] font-bold text-[#111827]">{formatMoney(value, currency)}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#eef0f6] py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="grid size-8 place-items-center rounded-md bg-[#eee8ff] text-[#7a3fe0]">{icon}</span>
      <span>
        <span className="block text-[10px] text-[#68738b]">{label}</span>
        <span className="mt-0.5 block text-[12px] font-bold text-[#111827]">{value}</span>
      </span>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md bg-[#f8f9ff] px-3 py-2">
      <span className="text-[10px] font-medium text-[#68738b]">{label}</span>
      <span className="break-words text-[11px] font-semibold text-[#111827]">{value}</span>
    </div>
  )
}

export default SalesHistoryDetailsPage
