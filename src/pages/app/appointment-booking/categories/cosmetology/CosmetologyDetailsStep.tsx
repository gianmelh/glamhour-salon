import { Check } from 'lucide-react'
import { cn } from '../../../../../lib/cn'
import { formatMoney } from '../../../../../lib/format'
import type { Service } from '../../../../../types/api'
import {
  BookingSectionTitle,
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import { ChipGroup } from '../../components/shared'
import { TreatmentPhotoFlow } from '../../components/TreatmentPhotoFlow'
import type { CategoryStepProps } from '../../types'
import {
  cosmetologyEquipmentOptions,
  cosmetologySkinTypes,
  getCosmetologyDetailsMissingItems,
} from './cosmetologyDetailsSpec'
import { FaceMapEditor } from './FaceMapEditor'

function RegistrationServiceCard({
  active,
  onClick,
  service,
}: {
  active: boolean
  onClick: () => void
  service: Service
}) {
  return (
    <button className="w-full text-left" onClick={onClick} type="button">
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-[16px] border px-4 py-4',
        active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
      )}>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">{service.name}</p>
          <p className="mt-1 text-[12px] leading-[1.44] text-[#475467]">
            {service.duration_minutes} min · {formatMoney(service.price_minor, service.currency_code)}
          </p>
        </div>
        {active && <Check className="size-5 shrink-0 text-[#7344cd]" />}
      </div>
    </button>
  )
}

export function CosmetologyDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })
  const missingItems = getCosmetologyDetailsMissingItems(details)
  const canContinue = Boolean(selectedServiceId) && missingItems.length === 0

  return (
    <RegistrationFlowShell activeCategory="cosmetology" onBack={onBack}>
      <section className="flex flex-col gap-4">
        <BookingSectionTitle>Service</BookingSectionTitle>
        <div className="flex flex-col gap-2">
          {services.map((service) => (
            <RegistrationServiceCard
              active={selectedServiceId === service.id}
              key={service.id}
              onClick={() => onChange({ serviceId: service.id, details })}
              service={service}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <BookingSectionTitle>Skin profile</BookingSectionTitle>
        <ChipGroup
          label="Skin type"
          onChange={(value) => set('skin_type', value)}
          options={[...cosmetologySkinTypes]}
          value={String(details.skin_type ?? '')}
        />
        <ChipGroup
          label="Equipment"
          multiple
          onChange={(value) => set('equipment', value)}
          options={[...cosmetologyEquipmentOptions]}
          value={details.equipment as string[] | undefined}
        />
      </section>

      <section>
        <BookingSectionTitle>Facial map</BookingSectionTitle>
        <FaceMapEditor details={details} onChange={(next) => onChange({ details: next })} />
      </section>

      <section className="flex flex-col gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <BookingSectionTitle>Products & notes</BookingSectionTitle>
        <label className="flex flex-col gap-2">
          <span className="text-[16px] leading-[1.4] text-black">Products / chemicals used</span>
          <textarea
            className="min-h-[96px] rounded-[12px] border border-[#d0d5dd] bg-white p-[14px] text-[15px] leading-[22.5px] text-black outline-none placeholder:text-[#999]"
            onChange={(event) => set('products', event.target.value)}
            placeholder="List products or chemicals used during treatment"
            value={String(details.products ?? '')}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[16px] leading-[1.4] text-black">Aftercare recommendations</span>
          <textarea
            className="min-h-[96px] rounded-[12px] border border-[#d0d5dd] bg-white p-[14px] text-[15px] leading-[22.5px] text-black outline-none placeholder:text-[#999]"
            onChange={(event) => set('aftercare', event.target.value)}
            placeholder="Share aftercare guidance for the client"
            value={String(details.aftercare ?? '')}
          />
        </label>
      </section>

      <TreatmentPhotoFlow
        category="cosmetology"
        details={details}
        onChange={(next) => onChange({ details: next })}
        title="Before treatment photo"
      />

      <RegistrationContinueSection
        canContinue={canContinue}
        disabledMessage={missingItems.length ? `To continue, complete: ${missingItems.join(' · ')}` : undefined}
        onContinue={onNext}
      />
    </RegistrationFlowShell>
  )
}
