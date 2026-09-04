import { cn } from '../../../../lib/cn'
import { lashesBookingAssets } from '../assets'
import { lashLengthOptions, lashMapPositions } from '../lashesDetailsSpec'
import { getLashEyeProgress } from '../lashesDetailsValidation'
import type { LashEyeName } from '../types'
import { LashesSectionTitle } from './lashesUi'

/**
 * Separator coordinates match the visible lash-map artwork in percent space.
 * Labels are calculated from each line midpoint, then offset to the visual left
 * so text/circles never inherit the mirrored geometry transform.
 */
const lashMapLabelGapPercent = 6
const lashMapSeparatorLines = [
  { position: 8, x1: 18, y1: 74, x2: 23, y2: 62 },
  { position: 9, x1: 31, y1: 57, x2: 36, y2: 45 },
  { position: 10, x1: 40, y1: 45, x2: 45, y2: 31 },
  { position: 11, x1: 53, y1: 40, x2: 49, y2: 18 },
  { position: 12, x1: 63, y1: 40, x2: 63, y2: 16 },
  { position: 13, x1: 76, y1: 42, x2: 81, y2: 18 },
  { position: 14, x1: 91, y1: 57, x2: 97, y2: 34 },
] as const

function hotspotFromSeparatorLine(line: (typeof lashMapSeparatorLines)[number], mirror = false) {
  const lineMidpointX = ((mirror ? 100 - line.x1 : line.x1) + (mirror ? 100 - line.x2 : line.x2)) / 2
  const lineMidpointY = (line.y1 + line.y2) / 2
  return {
    position: line.position,
    left: `${lineMidpointX - lashMapLabelGapPercent}%`,
    top: `${lineMidpointY}%`,
  }
}
const lashMapHotspots = lashMapSeparatorLines.map((line) => hotspotFromSeparatorLine(line))

type LashMapState = Partial<Record<LashEyeName, Array<{ position: number; length: number }>>>

function hotspotsForEye(eye: LashEyeName) {
  if (eye === 'rightEye') return lashMapHotspots
  return lashMapSeparatorLines.map((line) => hotspotFromSeparatorLine(line, true))
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
                'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition',
                assigned
                  ? 'size-8 border-0 bg-transparent text-center text-[16px] font-semibold leading-none text-[#7444cf] shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7444cf]/65'
                  : 'size-11 border border-dashed border-[#7444cf]/55 bg-white/45 text-[#7444cf]/70',
              )}
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              {assigned ? assigned.length : <span className="text-[11px] font-semibold">{position}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
