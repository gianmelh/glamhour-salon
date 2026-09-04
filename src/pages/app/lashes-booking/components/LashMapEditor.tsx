import { cn } from '../../../../lib/cn'
import { lashesBookingAssets } from '../assets'
import { lashLengthOptions, lashMapPositions } from '../lashesDetailsSpec'
import { getLashEyeProgress } from '../lashesDetailsValidation'
import type { LashEyeName } from '../types'
import { LashesSectionTitle } from './lashesUi'

const lashMapAssetWidth = 361
const lashMapBackgroundScale = 1.48

function backgroundSpaceX(sourceX: number) {
  return 50 + ((sourceX / lashMapAssetWidth) - 0.5) * 100 * lashMapBackgroundScale
}

/**
 * Horizontal anchors come from the source lash-map geometry, then are projected
 * through the same background scale used by the artwork. Vertical placement keeps
 * the arc that already matches the working zones.
 */
const lashMapZoneCount: number = lashMapPositions
const lashMapSourceXAnchors = [88, 122, 142, 180, 211, 242, 274]
const lashMapHotspots = lashMapSourceXAnchors.map((sourceX, index) => {
  const progress = lashMapZoneCount === 1 ? 0.5 : index / (lashMapZoneCount - 1)
  const arc = Math.sin(progress * Math.PI)
  return {
    position: 8 + index,
    left: `${backgroundSpaceX(sourceX)}%`,
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
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 bg-no-repeat',
            eye === 'leftEye' && '-scale-x-100',
          )}
          style={{
            backgroundImage: `url("${String(details.style ?? '').toLowerCase().includes('cat') ? lashesBookingAssets.lashMap.catEye : lashesBookingAssets.lashMap.clean}")`,
            backgroundPosition: '50% 58%',
            backgroundSize: '148% auto',
          }}
        />
        {activeHotspots.map(({ position, left, top }) => {
          const assigned = current.find((item) => item.position === position)
          return (
            <button
              aria-label={`Lash map position ${position}${assigned ? `, length ${assigned.length}` : ''}`}
              className={cn(
                'absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border transition',
                assigned
                  ? 'border-transparent bg-transparent text-[#7444cf] shadow-none hover:bg-white/35 focus-visible:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7444cf]/65'
                  : 'border-dashed border-[#7444cf]/55 bg-white/45 text-[#7444cf]/70',
              )}
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              {assigned ? (
                <span className="pointer-events-none grid min-h-6 min-w-6 place-items-center text-center text-[16px] font-semibold leading-none text-[#7444cf]">
                  {assigned.length}
                </span>
              ) : <span className="text-[11px] font-semibold">{position}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
