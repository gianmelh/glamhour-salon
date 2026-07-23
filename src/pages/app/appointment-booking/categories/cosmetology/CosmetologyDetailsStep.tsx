import { useState, type PointerEvent } from 'react'
import { Check, Eraser, RotateCcw } from 'lucide-react'
import { Button, Card, Textarea } from '../../../../../components'
import { cn } from '../../../../../lib/cn'
import { formatMoney } from '../../../../../lib/format'
import { cosmetologyBookingAssets } from '../../assets'
import { HelpModal } from '../../components/HelpModal'
import { CategoryStepHeader, ChipGroup, FieldCard } from '../../components/shared'
import { PhototypePicker } from '../../components/SignatureBox'
import { TreatmentPhotoFlow } from '../../components/TreatmentPhotoFlow'
import type { CategoryStepProps } from '../../types'

export function FaceMapEditor({ details, onChange }: { details: Record<string, unknown>; onChange: (details: Record<string, unknown>) => void }) {
  const [type, setType] = useState('Active acne')
  const annotations = (details.faceAnnotations as Array<{ x: number; y: number; type: string }> | undefined) ?? []

  const add = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onChange({ ...details, faceAnnotations: [...annotations, { x, y, type }] })
  }

  return (
    <div className="rounded-[20px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
      <ChipGroup label="Annotation type" options={['Active acne', 'Pigmentation', 'Sensitivity/redness', 'Dullness', 'Fine lines', 'Contraindicated area']} value={type} onChange={(value) => setType(String(value))} />
      <div className="mt-2 flex justify-end">
        <HelpModal title="Facial mapping" triggerLabel="Help">
          Tap the face diagram to mark skin concerns. Choose the annotation type first, then tap the area on the face.
        </HelpModal>
      </div>
      <div className="relative mx-auto mt-4 h-72 max-w-[240px] cursor-crosshair overflow-hidden rounded-[48%] border-2 border-[#d8deec] bg-white" onPointerDown={add}>
        <img alt="" className="absolute inset-0 size-full object-cover opacity-90" src={cosmetologyBookingAssets.faceDiagram} />
        {annotations.map((annotation, index) => (
          <span
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#7a3fe0] shadow"
            key={`${annotation.x}-${annotation.y}-${index}`}
            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            title={annotation.type}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => onChange({ ...details, faceAnnotations: annotations.slice(0, -1) })} type="button" variant="outline"><Eraser className="size-4" /> Undo</Button>
        <Button onClick={() => onChange({ ...details, faceAnnotations: [] })} type="button" variant="outline"><RotateCcw className="size-4" /> Clear</Button>
      </div>
    </div>
  )
}

export function CosmetologyDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-6 px-5 pb-8">
      <CategoryStepHeader onBack={onBack} title="Details of service" />

      <section className="space-y-3">
        <h2 className="text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">Service</h2>
        {services.map((service) => (
          <button className="w-full text-left" key={service.id} onClick={() => onChange({ serviceId: service.id, details })} type="button">
            <Card className={cn('rounded-[18px] border-[#dde3f1] bg-white', selectedServiceId === service.id && 'border-[#7a3fe0] bg-[#eee9ff]')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-[#111827]">{service.name}</p>
                  <p className="mt-1 text-xs text-[#68738b]">{service.duration_minutes} min · {formatMoney(service.price_minor, service.currency_code)}</p>
                </div>
                {selectedServiceId === service.id && <Check className="size-5 text-[#7a3fe0]" />}
              </div>
            </Card>
          </button>
        ))}
      </section>

      <FieldCard title="Fitzpatrick phototype & skin">
        <PhototypePicker onChange={(value) => set('phototype', value)} value={String(details.phototype ?? '')} />
        <ChipGroup label="Skin type" options={['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive']} value={String(details.skin_type ?? '')} onChange={(value) => set('skin_type', value)} />
        <ChipGroup label="Equipment" multiple options={['Ozone steam', 'Ultrasonic peeling', 'Microdermabrasion', 'High frequency', 'Radiofrequency', 'Ultrasound', 'Dermapen', 'LED phototherapy', 'Chemical peel']} value={details.equipment as string[] | undefined} onChange={(value) => set('equipment', value)} />
      </FieldCard>

      <section>
        <h2 className="mb-3 text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">Facial map</h2>
        <FaceMapEditor details={details} onChange={(next) => onChange({ details: next })} />
      </section>

      <FieldCard title="Products & notes">
        <Textarea label="Products / chemicals used" value={String(details.products ?? '')} onChange={(event) => set('products', event.target.value)} />
        <Textarea label="Aftercare recommendations" value={String(details.aftercare ?? '')} onChange={(event) => set('aftercare', event.target.value)} />
      </FieldCard>

      <TreatmentPhotoFlow
        category="cosmetology"
        details={details}
        onChange={(next) => onChange({ details: next })}
        title="Before treatment photo"
      />

      <Button className="rounded-[16px] shadow-[0_16px_8px_rgba(0,0,0,0.09)]" disabled={!selectedServiceId} fullWidth onClick={onNext}>Continue</Button>
    </div>
  )
}
