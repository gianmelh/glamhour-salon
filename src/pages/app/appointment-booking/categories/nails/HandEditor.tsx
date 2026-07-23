import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  isHandComplete,
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
    <div className="space-y-4">
      <div className="relative flex h-[82px] items-center justify-center rounded-[16px] border border-solid border-[#d0d5dd] bg-[#fcfcfd] px-[24px]">
        <select
          className="w-full appearance-none bg-transparent text-center text-[16px] font-normal tracking-[-0.32px] text-black outline-none"
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
      <p className="text-center text-[12px] font-normal tracking-[-0.24px] text-black">{label}</p>
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
    if (details.activeHand && details.activeHand !== hand) setHand(details.activeHand as HandName)
    if (details.activeFinger && details.activeFinger !== finger) setFinger(details.activeFinger as FingerName)
    if (details.handMode && details.handMode !== mode) setMode(details.handMode as 'finger' | 'hand')
  }, [details.activeFinger, details.activeHand, details.handMode, finger, hand, mode])

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
      return {
        ...current,
        [hand]: { ...currentHand, [finger]: { ...currentFinger, [key]: value } },
        activeHand: hand,
        activeFinger: finger,
        handMode: mode,
      }
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

  const handTitle = hand === 'rightHand' ? 'Righ hand' : 'Left hand'
  const currentHandProgress = getHandProgress(handData)
  const rightHandComplete = isHandComplete(details.rightHand as Record<string, Record<string, string>> | undefined)
  const leftHandComplete = isHandComplete(details.leftHand as Record<string, Record<string, string>> | undefined)

  if (mode === 'finger') {
    return (
      <div className="relative flex size-full flex-col content-stretch items-start gap-[16px]" data-node-id="335:7227">
        <div className="relative flex shrink-0 flex-col content-stretch items-start gap-[4px]" data-node-id="335:7228">
          <p className="relative w-[343px] shrink-0 text-[28px] font-extrabold not-italic leading-[1.44] tracking-[-0.56px] text-black [word-break:break-word]" data-node-id="335:7229">
            Select finger
          </p>
          <div className="relative flex w-full shrink-0 content-stretch items-center justify-between" data-node-id="728:9243">
            <p className="relative shrink-0 whitespace-nowrap text-[12px] font-normal not-italic leading-[1.44] tracking-[-0.24px] text-black [word-break:break-word]">
              {`Editing ${fingerLabels[finger].toLowerCase()} on ${hand === 'rightHand' ? 'right' : 'left'} hand · ${currentHandProgress.completed}/${currentHandProgress.total} fingers`}
            </p>
            <button
              className="relative flex shrink-0 content-stretch items-center justify-center gap-[10px] rounded-[22686000px] bg-[#ebe7ff] px-[12px] py-[6px]"
              onClick={swapSides}
              type="button"
            >
              <div className="relative size-[24px] shrink-0">
                <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.swap} />
              </div>
              <p className="relative shrink-0 whitespace-nowrap text-[12px] font-normal not-italic leading-[1.4] tracking-[0.24px] text-[#0c111d] [word-break:break-word]">
                Swap sides
              </p>
            </button>
          </div>
        </div>

        <div className="relative flex w-full shrink-0 content-stretch items-center gap-[16px]" data-node-id="335:7231">
          <button
            className="relative flex h-[54px] min-w-px flex-[1_0_0] cursor-pointer content-stretch items-center justify-center gap-[8px] rounded-[16px] bg-[#7344cd] p-[4px]"
            onClick={() => { setMode('finger'); patch({ handMode: 'finger' }) }}
            type="button"
          >
            <div className="relative size-[34px] shrink-0">
              <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.fingerToFingerIcon} />
            </div>
            <p className="relative shrink-0 whitespace-nowrap text-left text-[12px] font-normal not-italic leading-[1.44] tracking-[-0.24px] text-[#f2f5ff] [word-break:break-word]">
              Finger to finger
            </p>
          </button>
          <button
            className="relative flex h-[54px] min-w-px flex-[1_0_0] content-stretch items-center justify-center gap-[8px] rounded-[16px] border border-solid border-[#d0d5dd] bg-[#fcfcfd] p-[4px]"
            onClick={() => { setMode('hand'); patch({ handMode: 'hand' }) }}
            type="button"
          >
            <div className="relative size-[34px] shrink-0">
              <img alt="" className="absolute inset-0 block size-full max-w-none" src={nailsBookingAssets.hands.fullHandIcon} />
            </div>
            <p className="relative shrink-0 whitespace-nowrap text-[12px] font-normal not-italic leading-[1.44] tracking-[-0.24px] text-black [word-break:break-word]">
              Full hand
            </p>
          </button>
        </div>

        <p className="relative w-[min-content] min-w-full shrink-0 py-4 text-center text-[21px] font-bold not-italic leading-[1.2] text-black [word-break:break-word]">
          {fingerLabels[finger]}
        </p>

        <div className="relative mx-auto flex h-[285px] w-[343px] items-center justify-center">
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
            className="h-[285px] w-[176px] object-contain"
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

        {rightHandComplete && !leftHandComplete && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Right hand complete. Tap Swap sides to measure the left hand.
          </p>
        )}

        <div className="grid grid-cols-2 gap-[16px]">
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
