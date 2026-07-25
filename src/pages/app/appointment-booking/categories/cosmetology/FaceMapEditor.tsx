import { useState, type PointerEvent } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'
import { Button } from '../../../../../components'
import { cosmetologyBookingAssets } from '../../assets'
import { HelpModal } from '../../components/HelpModal'
import { ChipGroup } from '../../components/shared'
import { cosmetologyAnnotationTypes } from './cosmetologyDetailsSpec'

/** Figma 662:8803 — Mark what is detected (face map + notes). */
export function FaceMapEditor({
  details,
  onChange,
}: {
  details: Record<string, unknown>
  onChange: (details: Record<string, unknown>) => void
}) {
  const [type, setType] = useState<string>(cosmetologyAnnotationTypes[0])
  const annotations = (details.faceAnnotations as Array<{ x: number; y: number; type: string }> | undefined) ?? []
  const notes = String(details.skinAlterationNotes ?? '')

  const add = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onChange({
      ...details,
      faceAnnotations: [...annotations, { x, y, type }],
    })
  }

  return (
    <div className="rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4" data-node-id="662:8803">
      <div className="mb-3">
        <p className="text-[28px] font-bold leading-[1.2] text-[#0c111d]">Mark what is detected</p>
        <p className="mt-2 text-[16px] leading-[1.4] text-[#475467]">
          Select an alteration type, then draw over the affected areas on the face.
        </p>
      </div>

      <ChipGroup
        label="Alteration type"
        onChange={(value) => setType(String(value))}
        options={[...cosmetologyAnnotationTypes]}
        value={type}
      />
      <div className="mt-2 flex justify-end">
        <HelpModal title="Facial mapping" triggerLabel="Help">
          Tap the face diagram to mark skin concerns. Choose the annotation type first, then tap the area on the face.
        </HelpModal>
      </div>

      <div
        className="relative mx-auto mt-4 aspect-[1842/2343] w-full max-w-[320px] cursor-crosshair overflow-hidden rounded-[16px] border border-[#d8deec] bg-white"
        onPointerDown={add}
      >
        <img alt="" className="absolute inset-0 size-full object-cover" src={cosmetologyBookingAssets.faceDiagram} />
        {annotations.map((annotation, index) => (
          <span
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#7344cd] shadow"
            key={`${annotation.x}-${annotation.y}-${index}`}
            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            title={annotation.type}
          />
        ))}
      </div>

      <label className="mt-4 flex w-full flex-col gap-2">
        <span className="text-[16px] leading-[1.4] text-black">Skin alteration notes</span>
        <textarea
          className="min-h-[139px] rounded-[12px] border border-[#d0d5dd] bg-[#fcfcfd] p-[14px] text-[15px] leading-[22.5px] text-black outline-none placeholder:text-[#999]"
          onChange={(event) => onChange({ ...details, skinAlterationNotes: event.target.value })}
          placeholder="e.g., closed comedones across forehead, hyperpigmentation on left cheekbone, mild redness around the nose"
          value={notes}
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => onChange({ ...details, faceAnnotations: annotations.slice(0, -1) })}
          type="button"
          variant="outline"
        >
          <Eraser className="size-4" /> Undo
        </Button>
        <Button
          onClick={() => onChange({ ...details, faceAnnotations: [] })}
          type="button"
          variant="outline"
        >
          <RotateCcw className="size-4" /> Clear
        </Button>
      </div>
    </div>
  )
}
