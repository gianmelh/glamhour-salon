import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { deferTask } from '../../../../../lib/defer'
import { nailsBookingAssets } from '../../../nails-booking/assets'
import type { FingerName, HandName } from '../../types'
import { FingerMarker, HandSelectionSection } from '../../components/shared'
import {
  capsuleNumberOptions,
  fingerLabels,
  fingerMarkerPositions,
  fingerOrder,
  fingerWidthOptions,
  getHandProgress,
  mirrorFingerMarkerPosition,
} from './nailsFingerOptions'

const handImages: Record<HandName, string> = {
  rightHand: nailsBookingAssets.hands.right,
  leftHand: nailsBookingAssets.hands.left,
}

const ellipseImages = {
  ellipse1: nailsBookingAssets.hands.ellipse1,
  ellipse3: nailsBookingAssets.hands.ellipse3,
}

function MeasurementDropdown({ label, value, options, placeholder, onChange }: {
  label: string
  value: string
  options: Array<{ label: string; value: string }>
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="relative flex min-h-[64px] items-center justify-center rounded-[12px] border border-solid border-[#d0d5dd] bg-[#fcfcfd] px-3">
        <select
          className="w-full min-w-0 appearance-none bg-transparent pr-5 text-center text-[15px] font-normal tracking-normal text-black outline-none"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option disabled value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rotate-90 text-[#7344cd]" />
      </div>
      <p className="text-center text-[12px] font-normal tracking-normal text-black">{label}</p>
    </div>
  )
}

export function HandEditor({ details, onChange }: {
  details: Record<string, unknown>
  onChange: (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => void
}) {
  const [hand, setHand] = useState<HandName>((details.activeHand as HandName | undefined) ?? 'rightHand')
  const [finger, setFinger] = useState<FingerName>((details.activeFinger as FingerName | undefined) ?? 'index')
  const [mode, setMode] = useState<'finger' | 'hand'>((details.handMode as 'finger' | 'hand' | undefined) ?? 'hand')

  useEffect(() => {
    let active = true
    deferTask(() => {
      if (!active) return
      if (details.activeHand && details.activeHand !== hand) setHand(details.activeHand as HandName)
      if (details.activeFinger && details.activeFinger !== finger) setFinger(details.activeFinger as FingerName)
      if (details.handMode && details.handMode !== mode) setMode(details.handMode as 'finger' | 'hand')
    })
    return () => { active = false }
  }, [details.activeFinger, details.activeHand, details.handMode, finger, hand, mode])

  useEffect(() => {
    if (!details.handMode) {
      onChange({
        ...details,
        activeHand: hand,
        activeFinger: finger,
        handMode: mode,
      })
    }
  }, [details, finger, hand, mode, onChange])

  const patch = (next: Record<string, unknown>) => onChange({
    ...details,
    ...next,
    activeHand: (next.activeHand as HandName | undefined) ?? hand,
    activeFinger: (next.activeFinger as FingerName | undefined) ?? finger,
    handMode: (next.handMode as 'finger' | 'hand' | undefined) ?? mode,
  })

  const handData = { ...((details[hand] as Record<string, Record<string, string>> | undefined) ?? {}) }
  const fingerData = { ...(handData[finger] ?? {}) }

  const updateFingerField = (key: 'widthMm' | 'capsuleNumber', value: string) => {
    onChange((current) => {
      const currentHand = { ...((current[hand] as Record<string, Record<string, string>> | undefined) ?? {}) }
      const currentFinger = { ...(currentHand[finger] ?? {}) }
      const nextHandData = { ...currentHand, [finger]: { ...currentFinger, [key]: value } }
      const nextDetails = {
        ...current,
        [hand]: nextHandData,
        activeHand: hand,
        activeFinger: finger,
        handMode: mode,
      }

      return nextDetails
    })
  }

  const swapSides = () => {
    const nextHand: HandName = hand === 'rightHand' ? 'leftHand' : 'rightHand'
    setHand(nextHand)
    patch({ activeHand: nextHand })
  }

  const selectFinger = (name: FingerName) => {
    setFinger(name)
    setMode('finger')
    patch({ activeFinger: name, handMode: 'finger' })
  }

  const fingerIndex = fingerOrder.indexOf(finger)
  const moveFinger = (direction: -1 | 1) => {
    selectFinger(fingerOrder[Math.min(fingerOrder.length - 1, Math.max(0, fingerIndex + direction))])
  }

  const handTitle = hand === 'rightHand' ? 'Right hand' : 'Left hand'
  const currentHandProgress = getHandProgress(handData)
  if (mode === 'finger') {
    return (
      <div className="relative flex w-full min-w-0 flex-col content-stretch items-start gap-[16px]" data-node-id="335:7227">
        <div className="relative flex w-full min-w-0 shrink-0 flex-col content-stretch items-start gap-[4px]" data-node-id="335:7228">
          <p className="relative w-full shrink-0 text-[26px] font-extrabold not-italic leading-[1.3] tracking-normal text-black [word-break:break-word]" data-node-id="335:7229">
            Select finger
          </p>
          <div className="relative flex w-full flex-wrap content-stretch items-center justify-between gap-2" data-node-id="728:9243">
            <p className="relative min-w-0 flex-1 text-[12px] font-normal not-italic leading-[1.44] tracking-normal text-black [word-break:break-word]">
              {`Editing ${fingerLabels[finger].toLowerCase()} on ${hand === 'rightHand' ? 'right' : 'left'} hand · ${currentHandProgress.completed}/${currentHandProgress.total} fingers`}
            </p>
            <button
              className="relative flex shrink-0 content-stretch items-center justify-center gap-[8px] rounded-full bg-[#ebe7ff] px-[10px] py-[6px]"
              onClick={swapSides}
              type="button"
            >
              <div className="relative size-[18px] shrink-0">
                <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.swap} />
              </div>
              <p className="relative shrink-0 whitespace-nowrap text-[11px] font-normal not-italic leading-[1.4] tracking-normal text-[#0c111d] [word-break:break-word]">
                Swap sides
              </p>
            </button>
          </div>
        </div>

        <div className="relative grid w-full min-w-0 shrink-0 grid-cols-2 gap-3" data-node-id="335:7231">
          <button
            className="relative flex h-[48px] min-w-0 cursor-pointer content-stretch items-center justify-center gap-[6px] rounded-[12px] bg-[#7344cd] px-2 py-1"
            onClick={() => { setMode('finger'); patch({ handMode: 'finger' }) }}
            type="button"
          >
            <div className="relative size-[24px] shrink-0">
              <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.fingerToFingerIcon} />
            </div>
            <p className="relative min-w-0 truncate whitespace-nowrap text-left text-[11px] font-normal not-italic leading-[1.44] tracking-normal text-[#f2f5ff] [word-break:break-word]">
              Finger to finger
            </p>
          </button>
          <button
            className="relative flex h-[48px] min-w-0 content-stretch items-center justify-center gap-[6px] rounded-[12px] border border-solid border-[#d0d5dd] bg-[#fcfcfd] px-2 py-1"
            onClick={() => { setMode('hand'); patch({ handMode: 'hand' }) }}
            type="button"
          >
            <div className="relative size-[24px] shrink-0">
              <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.fullHandIcon} />
            </div>
            <p className="relative min-w-0 truncate whitespace-nowrap text-[11px] font-normal not-italic leading-[1.44] tracking-normal text-black [word-break:break-word]">
              Full hand
            </p>
          </button>
        </div>

        <p className="relative w-[min-content] min-w-full shrink-0 py-4 text-center text-[21px] font-bold not-italic leading-[1.2] text-black [word-break:break-word]">
          {fingerLabels[finger]}
        </p>

        <div className="relative mx-auto flex aspect-[343/285] w-full max-w-[343px] items-center justify-center">
          <button
            aria-label="Previous finger"
            className="absolute left-0 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center text-[#7344cd] disabled:opacity-30"
            disabled={fingerIndex === 0}
            onClick={() => moveFinger(-1)}
            type="button"
          >
            <ChevronLeft className="size-10" strokeWidth={2.5} />
          </button>
          <img
            alt={`${fingerLabels[finger]} finger`}
            className="h-full max-h-[285px] w-[52%] max-w-[176px] object-contain"
            src={nailsBookingAssets.hands.singleFinger}
          />
          <button
            aria-label="Next finger"
            className="absolute right-0 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center text-[#7344cd] disabled:opacity-30"
            disabled={fingerIndex === fingerOrder.length - 1}
            onClick={() => moveFinger(1)}
            type="button"
          >
            <ChevronRight className="size-10" strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-3">
          <MeasurementDropdown
            label="Finger width"
            onChange={(value) => updateFingerField('widthMm', value)}
            options={fingerWidthOptions}
            placeholder="mm"
            value={fingerData.widthMm ?? ''}
          />
          <MeasurementDropdown
            label="Capsule number"
            onChange={(value) => updateFingerField('capsuleNumber', value)}
            options={capsuleNumberOptions}
            placeholder="#"
            value={fingerData.capsuleNumber ?? ''}
          />
        </div>
      </div>
    )
  }

  const markers = fingerOrder.map((name) => {
    const basePosition = fingerMarkerPositions[name]
    const position = hand === 'leftHand'
      ? mirrorFingerMarkerPosition(basePosition)
      : basePosition
    const data = handData[name]
    const filled = Boolean(data?.widthMm && data?.capsuleNumber)

    if (filled) {
      return (
        <button
          className="relative col-1 row-1 size-[21.553px] cursor-pointer text-center"
          key={name}
          onClick={() => selectFinger(name)}
          style={{ marginLeft: position.left, marginTop: position.top }}
          type="button"
        >
          <span className="absolute inset-0 grid place-items-center rounded-full bg-white text-[10px] font-bold text-[#7344cd]">
            {data.capsuleNumber}
          </span>
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[12px] font-normal tracking-[-0.24px] text-black">
            {data.widthMm}mm
          </span>
        </button>
      )
    }

    return (
      <FingerMarker
        key={name}
        left={position.left}
        onClick={() => selectFinger(name)}
        src={ellipseImages[position.ellipse]}
        top={position.top}
      />
    )
  })

  return (
    <HandSelectionSection
      handImageSrc={handImages[hand]}
      handTitle={handTitle}
      markers={markers}
      mode={mode}
      onModeChange={(nextMode) => { setMode(nextMode); patch({ handMode: nextMode }) }}
      onSwap={swapSides}
    />
  )
}
