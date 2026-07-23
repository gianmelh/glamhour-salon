import { cn } from '../../../../lib/cn'
import {
  lashCurlIconSpecs,
  lashVolumeIconSpecs,
} from '../lashIconSpecs'
import {
  lashCurlOptions,
  lashEyeShapeRows,
  lashLengthOptions,
  lashStyleOptions,
  lashThicknessOptions,
  lashVolumeOptions,
  lashesDetailsLayout,
} from '../lashesDetailsSpec'
import { LashInlineIcon } from './LashInlineIcon'
import { LashSelectionCard, LashTextCard } from './LashSelectionCard'
import { LashOptionGrid, lashesSelectionShell } from './lashesUi'

export function LashStylePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <LashOptionGrid gap={lashesDetailsLayout.optionGridGap}>
      {lashStyleOptions.map((option) => (
        <LashSelectionCard
          active={value === option.key}
          className="h-[64px] w-full px-3"
          key={option.key}
          onClick={() => onChange(option.key)}
        >
          <span className="whitespace-nowrap text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">{option.label}</span>
        </LashSelectionCard>
      ))}
    </LashOptionGrid>
  )
}

export function LashEyeShapePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex w-full min-w-0 flex-col" style={{ gap: lashesDetailsLayout.eyeShapeGap }}>
      {lashEyeShapeRows.map((row) => (
        <div className="flex w-full min-w-0" key={row.join('-')} style={{ gap: lashesDetailsLayout.eyeShapeGap }}>
          {row.map((label) => (
            <button
              className={cn(
                lashesSelectionShell(
                  value === label,
                  'flex h-[82px] min-w-0 items-center rounded-[16px] px-2 text-left',
                ),
                row.length === 1 ? 'w-[160px] max-w-full' : 'flex-1',
              )}
              key={label}
              onClick={() => onChange(label)}
              type="button"
            >
              <span className="whitespace-nowrap text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">{label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function LashVolumePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <LashOptionGrid gap={lashesDetailsLayout.optionGridGap}>
      {lashVolumeOptions.map((option) => {
        const spec = lashVolumeIconSpecs[option]
        return (
          <LashTextCard
            active={value === option}
            compact
            key={option}
            label={option}
            onClick={() => onChange(option)}
            trailing={spec ? <LashInlineIcon spec={spec} /> : null}
          />
        )
      })}
    </LashOptionGrid>
  )
}

export function LashCurlPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <LashOptionGrid gap={lashesDetailsLayout.optionGridGap}>
      {lashCurlOptions.map((option) => {
        const spec = lashCurlIconSpecs[option]
        return (
          <LashTextCard
            active={value === option}
            compact
            key={option}
            label={option}
            onClick={() => onChange(option)}
            trailing={spec ? <LashInlineIcon spec={spec} /> : null}
          />
        )
      })}
    </LashOptionGrid>
  )
}

export function LashThicknessPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <LashOptionGrid gap={lashesDetailsLayout.optionGridGap}>
      {lashThicknessOptions.map((option) => (
        <LashTextCard active={value === option} compact key={option} label={option} onClick={() => onChange(option)} />
      ))}
    </LashOptionGrid>
  )
}

export function LashLengthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <LashOptionGrid gap={lashesDetailsLayout.optionGridGap}>
      {lashLengthOptions.map((option) => (
        <LashTextCard active={value === option} compact key={option} label={option} onClick={() => onChange(option)} />
      ))}
    </LashOptionGrid>
  )
}
