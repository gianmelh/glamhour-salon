import { useState, type PointerEvent } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'
import { Button } from '../../../../../components'
import { cn } from '../../../../../lib/cn'
import { cosmetologyBookingAssets } from '../../assets'
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
  const [showOnlyCurrentType, setShowOnlyCurrentType] = useState(false)
  const annotations = (details.faceAnnotations as Array<{ x: number; y: number; type: string }> | undefined) ?? []
  const visibleAnnotations = showOnlyCurrentType
    ? annotations.filter((annotation) => annotation.type === type)
    : annotations
  const notes = String(details.skinAlterationNotes ?? '')
  const annotationColors: Record<string, string> = {
    'Active acne': '#ff6b7a',
    Pigmentation: '#6ea8ff',
    'Sensitivity/redness': '#f7c948',
    'Dullness/uneven tone': '#a78bfa',
    'Fine lines/wrinkles': '#34d399',
    'Contraindicated area': '#ef4444',
  }

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
    <div className="rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4 shadow-sm" data-node-id="662:8803">
      <div className="mb-3">
        <p className="text-[28px] font-extrabold leading-[1.2] text-[#0c111d]">Mark what is detected</p>
        <p className="mt-2 text-[16px] leading-[1.4] text-[#475467]">
          Select an alteration type, then draw over the affected areas on the face.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#68738b]">Alteration type</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cosmetologyAnnotationTypes.map((option) => (
            <button
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition',
                type === option ? 'border-[#7344cd] bg-[#ebe7ff] text-[#0c111d]' : 'border-[#d0d5dd] bg-white text-[#475467]',
              )}
              key={option}
              onClick={() => setType(option)}
              type="button"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: annotationColors[option] ?? '#7344cd' }} />
              {option}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[#475467]">
          <input
            checked={showOnlyCurrentType}
            className="size-4 accent-[#7344cd]"
            onChange={(event) => setShowOnlyCurrentType(event.target.checked)}
            type="checkbox"
          />
          Show only this alteration
        </label>
      </div>

      <div
        className="relative mx-auto mt-4 aspect-[1842/2343] w-full max-w-[320px] cursor-crosshair overflow-hidden rounded-[16px] border border-[#d8deec] bg-white"
        onPointerDown={add}
      >
        <img alt="" className="absolute inset-0 size-full object-cover" src={cosmetologyBookingAssets.faceDiagram} />
        {visibleAnnotations.map((annotation, index) => (
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            key={`${annotation.x}-${annotation.y}-${annotation.type}-${index}`}
            style={{
              backgroundColor: annotationColors[annotation.type] ?? '#7344cd',
              left: `${annotation.x}%`,
              top: `${annotation.y}%`,
            }}
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
      <Button
        className="mt-3 min-h-[48px] rounded-[12px]"
        fullWidth
        onClick={() => onChange({ ...details, faceMapSavedAt: new Date().toISOString() })}
        type="button"
      >
        Save annotations
      </Button>
    </div>
  )
}
