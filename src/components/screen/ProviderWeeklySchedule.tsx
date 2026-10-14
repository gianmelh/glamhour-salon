import { cn } from '../../lib/cn'
import { providerScheduleErrors, normalizeProviderSchedule, providerWeekdays, type ProviderSchedule } from '../../lib/provider-settings'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

export function ProviderWeeklySchedule({ schedule, salonSchedule, onChange, readOnly = false }: {
  schedule: ProviderSchedule
  salonSchedule: ProviderSchedule
  onChange: (schedule: ProviderSchedule) => void
  readOnly?: boolean
}) {
  const effectiveSchedule = readOnly ? salonSchedule : normalizeProviderSchedule(schedule)
  const errors = providerScheduleErrors(effectiveSchedule)
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-lg font-bold text-[#11172a]">Weekly schedule</p>
        <p className="text-xs leading-5 text-[#68738b]">{readOnly ? 'Using the salon schedule.' : 'Set this provider’s working days and hours.'}</p>
      </div>
      {providerWeekdays.map((day) => {
        const value = effectiveSchedule[day] ?? { enabled: false, open: '09:00', close: '18:00' }
        const updateDay = (patch: Partial<typeof value>) => onChange({ ...effectiveSchedule, [day]: { ...value, ...patch } })
        return (
          <div className="border-b border-border pb-3 last:border-b-0" key={day}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#11172a]">{day}</p>
              </div>
              <button
                aria-label={`${day} working day`}
                aria-pressed={value.enabled}
                className={cn('relative h-8 w-14 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60', value.enabled ? 'bg-[#7a3fe0]' : 'bg-[#d8d8d8]')}
                disabled={readOnly}
                onClick={() => updateDay({ enabled: !value.enabled })}
                type="button"
              >
                <span className={cn('absolute top-1 size-6 rounded-full bg-white shadow transition-all', value.enabled ? 'left-7' : 'left-1')} />
              </button>
            </div>
            {value.enabled && (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <Input aria-label={`${day} opening time`} aria-invalid={Boolean(errors[day])} readOnly={readOnly} type="time" value={value.open} onChange={(event) => updateDay({ open: event.target.value })} />
                <span className="text-xs text-[#68738b]">to</span>
                <Input aria-label={`${day} closing time`} aria-invalid={Boolean(errors[day])} readOnly={readOnly} type="time" value={value.close} onChange={(event) => updateDay({ close: event.target.value })} />
              </div>
            )}
            {errors[day] && <p className="mt-2 text-xs text-danger" role="alert">{errors[day]}</p>}
          </div>
        )
      })}
    </Card>
  )
}
