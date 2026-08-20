import { ChevronLeft, Clock, DollarSign } from 'lucide-react'
import { Card } from '../../../../components'
import { formatMoney } from '../../../../lib/format'
import type { Service, ServiceCategory } from '../../../../types/api'

export function ServiceSelectionStep({ category, services, selectedServiceId, onBack, onSelect }: {
  category: ServiceCategory
  services: Service[]
  selectedServiceId: string
  onBack: () => void
  onSelect: (service: Service) => void
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[393px] bg-[#f2f5ff] px-5 pb-8 pt-10 text-[#101828]">
      <button className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" onClick={onBack} type="button">
        <ChevronLeft className="size-5" /> Back
      </button>
      <header>
        <h1 className="text-[28px] font-extrabold leading-tight">{category.name}</h1>
        <p className="mt-2 text-[15px] leading-6 text-[#667085]">Select a service to schedule an appointment.</p>
      </header>

      <section className="mt-6 space-y-3">
        {services.map((service) => {
          const selected = selectedServiceId === service.id
          return (
            <button className="block w-full text-left" key={service.id} onClick={() => onSelect(service)} type="button">
              <Card className={selected ? 'rounded-[16px] border-[#7a3fe0] bg-[#f4f0ff] p-4' : 'rounded-[16px] border-[#d0d5dd] bg-white p-4'}>
                <p className="text-[17px] font-bold text-[#101828]">{service.name}</p>
                {service.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#667085]">{service.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-[#344054]">
                  <span className="inline-flex items-center gap-1 rounded-[8px] bg-[#f8f9ff] px-2.5 py-1.5">
                    <Clock className="size-4 text-[#7344cd]" /> {service.duration_minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[8px] bg-[#f8f9ff] px-2.5 py-1.5">
                    <DollarSign className="size-4 text-[#7344cd]" /> {formatMoney(service.price_minor, service.currency_code)}
                  </span>
                </div>
              </Card>
            </button>
          )
        })}
        {!services.length && (
          <Card className="rounded-[16px] border-[#d0d5dd] bg-white p-4 text-center text-sm text-[#667085]">
            No services configured for this category.
          </Card>
        )}
      </section>
    </main>
  )
}
