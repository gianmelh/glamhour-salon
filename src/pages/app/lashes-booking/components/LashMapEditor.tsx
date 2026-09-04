import { cn } from '../../../../lib/cn'
import { lashesBookingAssets } from '../assets'
import { lashLengthOptions, lashMapPositions } from '../lashesDetailsSpec'
import { getLashEyeProgress } from '../lashesDetailsValidation'
import type { LashEyeName } from '../types'
import { LashesSectionTitle } from './lashesUi'

/**
 * Label anchors are independent from the mirrored artwork so length text stays
 * horizontal while the map geometry flips for each eye.
 */
const lashMapZoneCount: number = lashMapPositions
const lashMapHotspots = [
  { position: 8, left: '24.4%', top: '68%' },
  { position: 9, left: '33.8%', top: '44%' },
  { position: 10, left: '39.3%', top: '26.4%' },
  { position: 11, left: '49.9%', top: '20%' },
  { position: 12, left: '58.4%', top: '26.4%' },
  { position: 13, left: '67%', top: '44%' },
  { position: 14, left: '75.9%', top: '68%' },
] as const
const lashMapEmptyHotspots = Array.from({ length: lashMapZoneCount }, (_, index) => {
  const progress = lashMapZoneCount === 1 ? 0.5 : index / (lashMapZoneCount - 1)
  const arc = Math.sin(progress * Math.PI)
  return {
    position: 8 + index,
    left: `${12 + progress * 76}%`,
    top: `${68 - arc * 48}%`,
  }
})

type LashMapState = Partial<Record<LashEyeName, Array<{ position: number; length: number }>>>

function mirroredPercent(value: string) {
  const numeric = Number(value.replace('%', ''))
  return Number.isFinite(numeric) ? `${100 - numeric}%` : value
}

function hotspotsForEye(eye: LashEyeName) {
  if (eye === 'rightEye') return lashMapHotspots
  return lashMapHotspots.map((hotspot) => ({
    ...hotspot,
    left: mirroredPercent(hotspot.left),
  }))
}

function emptyHotspotsForEye(eye: LashEyeName) {
  if (eye === 'rightEye') return lashMapEmptyHotspots
  return lashMapEmptyHotspots.map((hotspot) => ({
    ...hotspot,
    left: mirroredPercent(hotspot.left),
  }))
}

function readLashMapEditorState(details: Record<string, unknown>) {
  const eye = (details.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
  const map = { ...((details.lashMap as LashMapState | undefined) ?? {}) }
  const length = Number(details.lashMapLength ?? details.defaultLength ?? 10)
  return { eye, map, length, current: map[eye] ?? [] }
}

function sideTotal(entries: Array<{ position: number; length: number }> | undefined) {
  return (entries ?? []).reduce((total, entry) => total + (Number(entry.length) || 0), 0)
}

export function LashMapEditor({ details, onChange }: {
  details: Record<string, unknown>
  onChange: (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => void
}) {
  const { eye, map, length, current } = readLashMapEditorState(details)
  const eyeLabel = eye === 'rightEye' ? 'Right side' : 'Left side'
  const activeHotspots = hotspotsForEye(eye)
  const emptyHotspots = emptyHotspotsForEye(eye)
  const progress = getLashEyeProgress(map)
  const rightCompleted = progress.find((item) => item.eye === 'rightEye')?.completed ?? 0
  const leftCompleted = progress.find((item) => item.eye === 'leftEye')?.completed ?? 0
  const rightComplete = rightCompleted >= lashMapPositions
  const leftComplete = leftCompleted >= lashMapPositions

  const assign = (position: number) => {
    onChange((currentDetails) => {
      const { eye: activeEye, map: lashMap, length: zoneLength, current: eyeEntries } = readLashMapEditorState(currentDetails)
      const next = [...eyeEntries.filter((item) => item.position !== position), { position, length: zoneLength }]
        .sort((a, b) => a.position - b.position)
      const nextMap = { ...lashMap, [activeEye]: next }
      return {
        ...currentDetails,
        lashMap: nextMap,
        activeLashEye: activeEye,
        lashMapLength: zoneLength,
        rightSide: sideTotal(nextMap.rightEye),
        leftSide: sideTotal(nextMap.leftEye),
      }
    })
  }

  const selectLength = (value: string) => {
    const nextLength = Number(value)
    onChange((currentDetails) => ({
      ...currentDetails,
      defaultLength: value,
      lashMapLength: Number.isFinite(nextLength) ? nextLength : undefined,
    }))
  }

  /** Switch which eye is being edited — same as Nails HandEditor, does not move map data. */
  const swapSides = () => {
    onChange((currentDetails) => {
      const activeEye = (currentDetails.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
      return {
        ...currentDetails,
        activeLashEye: activeEye === 'rightEye' ? 'leftEye' : 'rightEye',
      }
    })
  }

  return (
    <section className="flex w-full min-w-0 flex-col" style={{ gap: 24 }}>
      <div className="flex w-full min-w-0 flex-col" style={{ gap: 16 }}>
        <LashesSectionTitle>Lash map</LashesSectionTitle>
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 text-[12px] font-normal leading-[1.4] tracking-[0.24px] text-black">
            {eyeLabel} · {progress.find((item) => item.eye === eye)?.completed ?? 0}/{lashMapPositions} zones
          </p>
          <button
            className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-[#ebe7ff] px-3 py-1.5"
            onClick={swapSides}
            type="button"
          >
            <img alt="" className="size-6 shrink-0 object-contain" src={lashesBookingAssets.swap} />
            <span className="whitespace-nowrap text-[12px] font-normal leading-[1.4] tracking-[0.24px] text-[#0c111d]">Swap sides</span>
          </button>
        </div>
        {rightComplete && !leftComplete && eye === 'rightEye' && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Right eye complete. Tap Swap sides to map the left eye.
          </p>
        )}
        {rightComplete && !leftComplete && eye === 'leftEye' && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Tap each zone on the map to finish the left eye ({leftCompleted}/{lashMapPositions}).
          </p>
        )}
        {leftComplete && !rightComplete && eye === 'leftEye' && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Left eye complete. Tap Swap sides to map the right eye.
          </p>
        )}
        {leftComplete && !rightComplete && eye === 'rightEye' && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Tap each zone on the map to finish the right eye ({rightCompleted}/{lashMapPositions}).
          </p>
        )}
      </div>

      <div className="flex w-full min-w-0 flex-col gap-3">
        <p className="text-[13px] font-semibold text-[#0c111d]">Length (mm)</p>
        <div className="grid grid-cols-5 gap-2">
          {lashLengthOptions.map((option) => {
            const active = String(length).padStart(2, '0') === option
            return (
              <button
                className={cn(
                  'min-h-10 rounded-[12px] border px-2 text-[14px] font-semibold transition',
                  active
                    ? 'border-[#7344cd] bg-[#ebe7ff] text-[#0c111d]'
                    : 'border-[#d0d5dd] bg-white text-[#475467]',
                )}
                key={option}
                onClick={() => selectLength(option)}
                type="button"
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative aspect-[361/179] w-full min-w-0 overflow-hidden">
        <img
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 size-full object-contain',
            eye === 'leftEye' && '-scale-x-100',
          )}
          src={lashesBookingAssets.lashMap.clean}
        />
        {emptyHotspots.map(({ position, left, top }) => {
          const assigned = current.find((item) => item.position === position)
          if (assigned) return null
          return (
            <button
              aria-label={`Lash map position ${position}`}
              className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-dashed border-[#7444cf]/55 bg-white/45 text-[#7444cf]/70 transition"
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              <span className="text-[11px] font-semibold">{position}</span>
            </button>
          )
        })}
        {activeHotspots.map(({ position, left, top }) => {
          const assigned = current.find((item) => item.position === position)
          if (!assigned) return null
          return (
            <button
              aria-label={`Lash map position ${position}, length ${assigned.length}`}
              className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-transparent text-center text-[16px] font-semibold leading-none text-[#7444cf] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7444cf]/65"
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              {assigned.length}
            </button>
          )
        })}
      </div>
    </section>
  )
}
