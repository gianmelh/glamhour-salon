import { Check } from 'lucide-react'
import { cn } from '../../../../lib/cn'
import { formatMoney } from '../../../../lib/format'
import type { Service } from '../../../../types/api'
import { micropigmentationBookingAssets } from '../../assets'
import {
  BookingSectionTitle,
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import { ChipGroup } from '../../components/shared'
import { mergeSignature } from '../../components/signatureHelpers'
import { SignatureBox } from '../../components/SignatureBox'
import { TreatmentPhotoFlow } from '../../components/TreatmentPhotoFlow'
import type { CategoryStepProps } from '../../types'
import {
  getMicropigmentationDetailsMissingItems,
  micropigmentationProcedureGroups,
  micropigmentationSessionTypes,
  micropigmentationUndertones,
} from './micropigmentationDetailsSpec'

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

const areaImages = {
  Eyebrows: micropigmentationBookingAssets.eyebrowDiagram,
  Lips: micropigmentationBookingAssets.lipDiagram,
} as const

export function MicropigmentationDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })
  const missingItems = getMicropigmentationDetailsMissingItems(details)
  const canContinue = Boolean(selectedServiceId) && missingItems.length === 0

  return (
    <RegistrationFlowShell activeCategory="micropigmentation" onBack={onBack}>
      <img alt="" className="h-32 w-full rounded-[16px] object-cover" src={micropigmentationBookingAssets.hero} />

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

      {Object.entries(micropigmentationProcedureGroups).map(([area, procedures]) => (
        <section className="rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4" key={area}>
          <BookingSectionTitle>{area}</BookingSectionTitle>
          {area in areaImages && (
            <img alt="" className="mb-3 h-24 w-full rounded-[12px] object-cover" src={areaImages[area as keyof typeof areaImages]} />
          )}
          <div className="flex flex-wrap gap-2">
            {procedures.map((procedure) => (
              <button
                className={cn(
                  'rounded-full border px-3 py-2 text-[12px] font-semibold leading-[1.44]',
                  details.procedure === procedure && details.area === area
                    ? 'border-[#7344cd] bg-[#ebe7ff] text-[#7344cd]'
                    : 'border-[#d0d5dd] bg-white text-[#475467]',
                )}
                key={procedure}
                onClick={() => onChange({ details: { ...details, area, procedure } })}
                type="button"
              >
                {procedure}
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <BookingSectionTitle>Clinical measurements</BookingSectionTitle>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Brow width (mm)</span>
          <input
            className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none"
            onChange={(event) => set('brow_width_mm', event.target.value)}
            value={String(details.brow_width_mm ?? '')}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Brow height (mm)</span>
          <input
            className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none"
            onChange={(event) => set('brow_height_mm', event.target.value)}
            value={String(details.brow_height_mm ?? '')}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Lip width (mm)</span>
          <input
            className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none"
            onChange={(event) => set('lip_width_mm', event.target.value)}
            value={String(details.lip_width_mm ?? '')}
          />
        </label>
        <ChipGroup
          label="Skin undertone"
          onChange={(value) => set('undertone', value)}
          options={[...micropigmentationUndertones]}
          value={String(details.undertone ?? '')}
        />
        <ChipGroup
          label="Session type"
          onChange={(value) => set('session_type', value)}
          options={[...micropigmentationSessionTypes]}
          value={String(details.session_type ?? '')}
        />
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Session number</span>
          <input
            className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none"
            inputMode="numeric"
            onChange={(event) => set('session_number', event.target.value)}
            placeholder="1"
            value={String(details.session_number ?? '')}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Related treatment ID (optional)</span>
          <input
            className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none"
            onChange={(event) => set('related_treatment_id', event.target.value)}
            placeholder="Links touch-ups to the initial session"
            value={String(details.related_treatment_id ?? '')}
          />
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <BookingSectionTitle>Pigment & tools</BookingSectionTitle>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Pigment brand</span>
          <input className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none" onChange={(event) => set('pigment_brand', event.target.value)} value={String(details.pigment_brand ?? '')} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Color mix</span>
          <input className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none" onChange={(event) => set('color_mix', event.target.value)} value={String(details.color_mix ?? '')} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Needle type / size</span>
          <input className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none" onChange={(event) => set('needle', event.target.value)} value={String(details.needle ?? '')} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Touch-up date</span>
          <input className="min-h-[48px] rounded-[16px] border border-[#d0d5dd] bg-white px-3 text-[16px] text-black outline-none" onChange={(event) => set('touch_up_date', event.target.value)} type="date" value={String(details.touch_up_date ?? '')} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.08em] text-[#475467]">Procedure notes</span>
          <textarea
            className="min-h-[96px] rounded-[12px] border border-[#d0d5dd] bg-white p-[14px] text-[15px] leading-[22.5px] text-black outline-none placeholder:text-[#999]"
            onChange={(event) => set('procedure_notes', event.target.value)}
            placeholder="Add pigment, technique, or session notes"
            value={String(details.procedure_notes ?? '')}
          />
        </label>
      </section>

      <section className="rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
        <BookingSectionTitle>Design approval</BookingSectionTitle>
        <SignatureBox
          label="Client design approval"
          onChange={(value) => onChange({
            details: {
              ...details,
              clientDesignSignature: value,
              signatures: mergeSignature(
                details.signatures as Parameters<typeof mergeSignature>[0],
                { type: 'design_approval', signerName: String(details.healthFullName ?? 'Client'), data: value },
              ),
            },
          })}
          value={String(details.clientDesignSignature ?? '')}
        />
      </section>

      <TreatmentPhotoFlow
        category="micropigmentation"
        details={details}
        onChange={(next) => onChange({ details: next })}
        title="Reference / before photo"
      />

      <RegistrationContinueSection
        canContinue={canContinue}
        disabledMessage={missingItems.length ? `To continue, complete: ${missingItems.join(' · ')}` : undefined}
        onContinue={onNext}
      />
    </RegistrationFlowShell>
  )
}
