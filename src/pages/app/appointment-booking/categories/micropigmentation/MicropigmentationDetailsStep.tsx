import { Check } from 'lucide-react'
import { Button, Card, Input, Textarea } from '../../../../../components'
import { cn } from '../../../../../lib/cn'
import { formatMoney } from '../../../../../lib/format'
import { micropigmentationBookingAssets } from '../../assets'
import { CategoryStepHeader, ChipGroup, FieldCard } from '../../components/shared'
import { mergeSignature } from '../../components/signatureHelpers'
import { SignatureBox } from '../../components/SignatureBox'
import { TreatmentPhotoFlow } from '../../components/TreatmentPhotoFlow'
import type { CategoryStepProps } from '../../types'

const procedureGroups = {
  Eyebrows: ['Microblading', 'Microshading', 'Hybrid', 'Removal'],
  Lips: ['Lip Liner', 'Micropigmentation', 'Hydragloss'],
  Eyes: ['Eyeliner'],
} as const

export function MicropigmentationDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-6 px-5 pb-8">
      <CategoryStepHeader onBack={onBack} title="Details of service" />

      <img alt="" className="h-32 w-full rounded-[16px] object-cover" src={micropigmentationBookingAssets.hero} />

      <section className="space-y-3">
        <h2 className="text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">Service</h2>
        {services.map((service) => (
          <button className="w-full text-left" key={service.id} onClick={() => onChange({ serviceId: service.id, details })} type="button">
            <Card className={cn('rounded-[18px] border-[#dde3f1] bg-white', selectedServiceId === service.id && 'border-[#7344cd] bg-[#ebe7ff]')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-[#111827]">{service.name}</p>
                  <p className="mt-1 text-xs text-[#68738b]">{service.duration_minutes} min · {formatMoney(service.price_minor, service.currency_code)}</p>
                </div>
                {selectedServiceId === service.id && <Check className="size-5 text-[#7344cd]" />}
              </div>
            </Card>
          </button>
        ))}
      </section>

      {Object.entries(procedureGroups).map(([area, procedures]) => (
        <div className="rounded-[18px] border border-[#d0d5dd] bg-[#fcfcfd] p-4" key={area}>
          <p className="mb-2 text-[21px] font-bold text-[#0c111d]">{area}</p>
          {area === 'Eyebrows' && (
            <img alt="" className="mb-3 h-24 w-full rounded-[12px] object-cover" src={micropigmentationBookingAssets.eyebrowDiagram} />
          )}
          {area === 'Lips' && (
            <img alt="" className="mb-3 h-24 w-full rounded-[12px] object-cover" src={micropigmentationBookingAssets.lipDiagram} />
          )}
          <div className="flex flex-wrap gap-2">
            {procedures.map((procedure) => (
              <button
                className={cn('rounded-full border px-3 py-2 text-xs font-semibold', details.procedure === procedure ? 'border-[#7344cd] bg-[#ebe7ff] text-[#7344cd]' : 'border-[#dde3f1] bg-white text-[#68738b]')}
                key={procedure}
                onClick={() => onChange({ details: { ...details, area, procedure } })}
                type="button"
              >
                {procedure}
              </button>
            ))}
          </div>
        </div>
      ))}

      <FieldCard title="Clinical measurements">
        <Input label="Brow width (mm)" value={String(details.brow_width_mm ?? '')} onChange={(event) => set('brow_width_mm', event.target.value)} />
        <Input label="Brow height (mm)" value={String(details.brow_height_mm ?? '')} onChange={(event) => set('brow_height_mm', event.target.value)} />
        <Input label="Lip width (mm)" value={String(details.lip_width_mm ?? '')} onChange={(event) => set('lip_width_mm', event.target.value)} />
        <ChipGroup label="Skin undertone" options={['Warm', 'Cool', 'Neutral']} value={String(details.undertone ?? '')} onChange={(value) => set('undertone', value)} />
      </FieldCard>

      <FieldCard title="Pigment & tools">
        <Input label="Pigment brand" value={String(details.pigment_brand ?? '')} onChange={(event) => set('pigment_brand', event.target.value)} />
        <Input label="Color mix" value={String(details.color_mix ?? '')} onChange={(event) => set('color_mix', event.target.value)} />
        <Input label="Needle type / size" value={String(details.needle ?? '')} onChange={(event) => set('needle', event.target.value)} />
        <Input label="Touch-up date" type="date" value={String(details.touch_up_date ?? '')} onChange={(event) => set('touch_up_date', event.target.value)} />
        <Textarea label="Procedure notes" value={String(details.procedure_notes ?? '')} onChange={(event) => set('procedure_notes', event.target.value)} />
      </FieldCard>

      <FieldCard title="Design approval">
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
      </FieldCard>

      <TreatmentPhotoFlow
        category="micropigmentation"
        details={details}
        onChange={(next) => onChange({ details: next })}
        title="Reference / before photo"
      />

      <Button
        className="rounded-[16px] shadow-[0_16px_8px_rgba(0,0,0,0.09)]"
        disabled={!selectedServiceId}
        fullWidth
        onClick={onNext}
      >
        Continue
      </Button>
    </div>
  )
}
