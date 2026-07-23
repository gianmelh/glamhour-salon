import { cn } from '../../../../lib/cn'
import { lashesBookingAssets } from '../assets'
import { lashMapPositions } from '../lashesDetailsSpec'
import { getLashEyeProgress } from '../lashesDetailsValidation'
import type { LashEyeName } from '../types'
import { LashesSectionTitle } from './lashesUi'

/** Label positions from Figma 650:6335–6341 (361px-wide map). */
const lashMapHotspots = [
  { position: 8, left: '3.05%', top: '61.7%' },
  { position: 9, left: '9.42%', top: '42.5%' },
  { position: 10, left: '16.62%', top: '28.5%' },
  { position: 11, left: '26.59%', top: '17.3%' },
  { position: 12, left: '44.88%', top: '5.6%' },
  { position: 13, left: '67.04%', top: '6.1%' },
  { position: 14, left: '90.58%', top: '11.7%' },
] as const

type LashMapState = Partial<Record<LashEyeName, Array<{ position: number; length: number }>>>

function readLashMapEditorState(details: Record<string, unknown>) {
  const eye = (details.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
  const map = { ...((details.lashMap as LashMapState | undefined) ?? {}) }
  const length = Number(details.lashMapLength ?? details.defaultLength ?? 10)
  return { eye, map, length, current: map[eye] ?? [] }
}

export function LashMapEditor({ details, onChange }: {
  details: Record<string, unknown>
  onChange: (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => void
}) {
  const { eye, map, current } = readLashMapEditorState(details)
  const eyeLabel = eye === 'rightEye' ? 'Right side' : 'Left side'
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
      return {
        ...currentDetails,
        lashMap: { ...lashMap, [activeEye]: next },
        activeLashEye: activeEye,
        lashMapLength: zoneLength,
      }
    })
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
            {eyeLabel} · {current.length}/{lashMapPositions} zones
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

      <div className="relative aspect-[361/179] w-full min-w-0 overflow-hidden">
        <img
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-contain object-left"
          src={lashesBookingAssets.lashMap.catEye}
        />
        {lashMapHotspots.map(({ position, left, top }) => {
          const assigned = current.find((item) => item.position === position)
          return (
            <button
              aria-label={`Lash map position ${position}${assigned ? `, length ${assigned.length}` : ''}`}
              className={cn(
                'absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[16px] font-normal leading-none',
                assigned ? 'font-semibold text-[#7444cf]' : 'text-transparent',
              )}
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              {assigned ? assigned.length : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
