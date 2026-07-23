import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button } from '../../../../components'
import { cosmetologyBookingAssets } from '../assets'

export function SignatureBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [drawing, setDrawing] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const points = useMemo(() => value ? value.split(' ').map((pair) => pair.split(',').map(Number)) : [], [value])

  const addPoint = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.round(event.clientX - rect.left)
    const y = Math.round(event.clientY - rect.top)
    const current = valueRef.current
    onChange(`${current}${current ? ' ' : ''}${x},${y}`)
  }

  const stopDrawing = (event: PointerEvent<HTMLDivElement>) => {
    setDrawing(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#68738b]">{label}</p>
      <div
        className="relative h-32 touch-none rounded-[18px] border border-[#d8deec] bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrawing(true)
          addPoint(event)
        }}
        onPointerMove={(event) => { if (drawing) addPoint(event) }}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      >
        <svg className="pointer-events-none absolute inset-0 size-full"><path d={path} fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="3" /></svg>
        {!value && <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-[#8a94aa]">Draw signature here</span>}
      </div>
      <Button className="mt-2" onClick={() => onChange('')} type="button" variant="outline">Clear signature</Button>
    </div>
  )
}

export function PhototypePicker({ value, onChange, label = 'Fitzpatrick phototype' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const options = Object.entries(cosmetologyBookingAssets.phototypes)
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#68738b]">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(([label, image]) => (
          <button
            className={`overflow-hidden rounded-[12px] border ${value === label ? 'border-[#7a3fe0] ring-2 ring-[#7a3fe0]/20' : 'border-[#d8deec]'}`}
            key={label}
            onClick={() => onChange(label)}
            type="button"
          >
            <img alt="" className="aspect-square w-full object-cover" src={image} />
            <p className="py-1 text-center text-[10px] font-semibold text-[#111827]">{label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
