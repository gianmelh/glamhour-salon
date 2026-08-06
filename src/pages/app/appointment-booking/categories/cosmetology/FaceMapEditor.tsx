import { useState, type PointerEvent } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'
import { Button } from '../../../../../components'
import { cn } from '../../../../../lib/cn'
import { cosmetologyBookingAssets } from '../../assets'
import { cosmetologyAnnotationTypes } from './cosmetologyDetailsSpec'

const annotationColors: Record<string, string> = {
  'Active acne': '#ff6b7a',
  Pigmentation: '#6ea8ff',
  'Sensitivity/redness': '#f7c948',
  'Dullness/uneven tone': '#a78bfa',
  'Fine lines/wrinkles': '#34d399',
  'Contraindicated area': '#ef4444',
}

/** Figma 662:8803 — Mark what is detected (face map + notes). */
export function FaceMapEditor({
  details,
  onChange,
  onSave,
}: {
  details: Record<string, unknown>
  onChange: (details: Record<string, unknown>) => void
  onSave?: () => void
}) {
  const [type, setType] = useState<string>(cosmetologyAnnotationTypes[0])
  const [showOnlyCurrentType, setShowOnlyCurrentType] = useState(false)
  const annotations = (details.faceAnnotations as Array<{ x: number; y: number; type: string }> | undefined) ?? []
  const visibleAnnotations = showOnlyCurrentType
    ? annotations.filter((annotation) => annotation.type === type)
    : annotations
  const notes = String(details.skinAlterationNotes ?? '')
  const canSave = annotations.length > 0 || notes.trim().length > 0

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
    <div className="flex w-full max-w-[393px] flex-col gap-6" data-node-id="662:8803">
      <p className="text-[16px] leading-[1.4] text-[#475467]">
        Select an alteration type, then draw over the affected areas on the face.
      </p>

      <div className="space-y-2">
        <p className="text-[12px] tracking-[0.24px] text-black">Alteration type</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cosmetologyAnnotationTypes.map((option) => (
            <button
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[16px] leading-[1.4] transition',
                type === option ? 'bg-[#f2f5ff] text-[#0c111d]' : 'bg-white text-[#475467] ring-1 ring-[#d0d5dd]',
              )}
              key={option}
              onClick={() => setType(option)}
              type="button"
            >
              <span
                className="size-6 shrink-0 rounded-full"
                style={{ backgroundColor: annotationColors[option] ?? '#7344cd' }}
              />
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
        className="relative mx-auto aspect-[1842/2343] w-full max-w-[361px] cursor-crosshair overflow-hidden bg-white"
        onPointerDown={add}
      >
        <img
          alt="Face mapping diagram"
          className="pointer-events-none absolute inset-0 size-full object-cover"
          src={cosmetologyBookingAssets.faceDiagram}
        />
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

      <label className="flex w-full flex-col gap-2">
        <span className="text-[16px] leading-[1.4] text-black">Skin alteration notes</span>
        <textarea
          className="min-h-[139px] rounded-[12px] border border-[#d0d5dd] bg-[#fcfcfd] p-[14px] text-[15px] leading-[22.5px] tracking-[-0.3px] text-black outline-none placeholder:text-[#999]"
          onChange={(event) => onChange({ ...details, skinAlterationNotes: event.target.value })}
          placeholder="e.g., closed comedones across forehead, hyperpigmentation on left cheekbone, mild redness around the nose"
          value={notes}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
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

      <button
        className={cn(
          'min-h-[60px] w-full rounded-[16px] p-4 text-[18px] font-medium leading-7',
          canSave
            ? 'bg-gradient-to-b from-[#7a48db] to-[#412675] text-[#f2f4f7] drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]'
            : 'cursor-not-allowed bg-[#dcdcdc] text-[#475467]',
        )}
        disabled={!canSave}
        onClick={() => {
          onChange({ ...details, faceMapSavedAt: new Date().toISOString() })
          onSave?.()
        }}
        type="button"
      >
        Save annotations
      </button>
    </div>
  )
}
