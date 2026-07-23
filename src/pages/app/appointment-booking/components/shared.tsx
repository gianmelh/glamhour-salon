import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { Card } from '../../../../components'
import type { NailTypeImageVariant } from '../../nails-booking/assets'
import { nailsBookingAssets } from '../../nails-booking/assets'

export function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[393px] space-y-5">
      <header>
        <h1 className="text-[32px] font-extrabold leading-tight text-[#111827]">{title}</h1>
        <p className="mt-2 text-[15px] leading-6 text-[#68738b]">{subtitle}</p>
      </header>
      {children}
    </div>
  )
}

export function CategoryStepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <button className="-ml-1 grid size-8 place-items-center text-[#111827]" onClick={onBack} type="button" aria-label="Back">
        <svg aria-hidden className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="text-[21px] font-extrabold leading-tight text-[#111827]">{title}</h1>
    </header>
  )
}

export function FieldCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 rounded-[22px] border-[#dde3f1] bg-white">
      <p className="text-lg font-bold text-[#111827]">{title}</p>
      {children}
    </Card>
  )
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#eef1f7] pb-2 last:border-b-0">
      <span className="text-sm text-[#68738b] capitalize">{label}</span>
      <span className="text-right text-sm font-bold text-[#111827]">{value}</span>
    </div>
  )
}

export function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={cn(
        'flex-1 rounded-full border px-3 py-2 text-xs font-bold',
        active ? 'border-[#7a3fe0] bg-[#eee9ff] text-[#7a3fe0]' : 'border-[#dde3f1] bg-white text-[#68738b]',
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function ChipGroup({ label, options, value, multiple, onChange }: {
  label: string
  options: string[]
  value?: string | string[]
  multiple?: boolean
  onChange: (value: string | string[]) => void
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : [])
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#68738b]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={cn(
              'rounded-full border px-3 py-2 text-xs font-semibold',
              selected.has(option) ? 'border-[#7a3fe0] bg-[#eee9ff] text-[#7a3fe0]' : 'border-[#dde3f1] bg-white text-[#68738b]',
            )}
            key={option}
            onClick={() => {
              if (!multiple) onChange(option)
              else {
                const next = new Set(selected)
                if (next.has(option)) next.delete(option)
                else next.add(option)
                onChange([...next])
              }
            }}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export function OptionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">{title}</h2>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

export function NailsStepHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <header className="space-y-6">
      <div className="flex items-start gap-4">
        <button className="flex h-9 w-[18px] shrink-0 items-center text-black" onClick={onBack} type="button" aria-label="Back">
          <svg aria-hidden className="h-9 w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">{title}</h1>
      </div>
      {children}
    </header>
  )
}

export function CategoryTab({ active, icon, children }: { active?: boolean; icon: string; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex h-[54px] shrink-0 items-center gap-1 rounded-[16px] border border-[#d0d5dd] px-2 py-3 text-[21px] font-normal leading-[1.44] tracking-[-0.42px] text-black',
      active ? 'bg-[#ebe7ff]' : 'bg-[#fcfcfd]',
    )}>
      <img alt="" className="size-[30px] object-cover" src={icon} />
      {children}
    </span>
  )
}

function selectionCardShell(active: boolean, className?: string) {
  return cn(
    'border border-solid',
    active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
    className,
  )
}

export function BookingSectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">
      {children}
    </h2>
  )
}

/** Figma 335:7174–335:7175 — dual-system / press-on service cards. */
export function ServiceTypeCard({ active, label, onClick, imageSrc, variant = 'dual-system' }: {
  active: boolean
  label: string
  onClick: () => void
  imageSrc: string
  variant?: 'dual-system' | 'press-on'
}) {
  const isPressOn = variant === 'press-on'
  return (
    <button
      className={selectionCardShell(
        active,
        'flex h-[82px] w-[163.5px] shrink-0 items-center justify-center gap-[8px] rounded-[16px] px-[24px] py-[8px]',
      )}
      onClick={onClick}
      type="button"
    >
      <span className={cn(
        'relative flex shrink-0 items-center justify-center',
        isPressOn ? 'size-[49px]' : 'h-[27px] w-[36px]',
      )}>
        <span className="flex-none rotate-90">
          <img
            alt=""
            className={cn('object-cover', isPressOn ? 'size-[49px]' : 'h-[36px] w-[27px]')}
            src={imageSrc}
          />
        </span>
      </span>
      <span className="whitespace-nowrap text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">
        {label}
      </span>
    </button>
  )
}

/** Figma 335:7215–335:7225 — material selection cards. */
export function MaterialCard({ active, label, onClick, imageSrc, imageFrame, imageCrop, className }: {
  active: boolean
  label: string
  onClick: () => void
  imageSrc?: string
  imageFrame?: string
  imageCrop?: string
  className?: string
}) {
  return (
    <button
      className={selectionCardShell(
        active,
        cn(
          'flex h-[82px] shrink-0 items-center justify-center gap-[8px] rounded-[16px] px-[24px] py-[8px]',
          className,
        ),
      )}
      onClick={onClick}
      type="button"
    >
      {imageSrc && (
        <span className={cn('relative shrink-0', imageFrame ?? 'h-[67px] w-[37px]')}>
          {imageCrop ? (
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <img alt="" className={imageCrop} src={imageSrc} />
            </span>
          ) : (
            <img alt="" className="absolute inset-0 size-full max-w-none object-cover" src={imageSrc} />
          )}
        </span>
      )}
      <span className="whitespace-nowrap text-[21px] font-normal leading-[1.44] tracking-[-0.42px] text-black">
        {label}
      </span>
    </button>
  )
}

const nailTypeImageRotation = '-rotate-90'
const nailTypeImageSlot = 'flex h-[62px] w-[58px] items-center justify-center'

/** Per-variant image fit inside the shared slot — rotation applied uniformly. */
const nailTypeImageSpec: Record<NailTypeImageVariant, string> = {
  stiletto: 'h-[58px] w-[62px] object-contain object-center',
  coffin: 'h-[58px] w-[58px] object-contain object-center',
  almond: 'h-[58px] w-[58px] object-contain object-center',
  oval: 'h-[58px] w-[58px] object-contain object-center',
  squoval: 'h-[58px] w-[58px] object-contain object-center',
  square: 'h-[58px] w-[58px] object-contain object-center',
  round: 'h-[44px] w-[58px] object-contain object-center',
  custom: 'h-[58px] w-[58px] object-contain object-center',
}

function NailTypeCardImage({ imageSrc, variant }: { imageSrc: string; variant: NailTypeImageVariant }) {
  return (
    <div className={nailTypeImageSlot}>
      <img alt="" className={cn(nailTypeImageRotation, nailTypeImageSpec[variant])} src={imageSrc} />
    </div>
  )
}

/** Figma 335:7185–335:7212 — nail shape selection cards. */
export function NailTypeCard({ active, label, onClick, imageSrc, variant, className }: {
  active: boolean
  label: string
  onClick: () => void
  imageSrc: string
  variant: NailTypeImageVariant
  className?: string
}) {
  return (
    <button
      className={selectionCardShell(
        active,
        cn(
          'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_58px] items-center gap-[8px] rounded-[16px] px-[8px] text-left',
          className,
        ),
      )}
      onClick={onClick}
      type="button"
    >
      <span className="whitespace-nowrap text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">
        {label}
      </span>
      <NailTypeCardImage imageSrc={imageSrc} variant={variant} />
    </button>
  )
}

/** Figma 335:7227 — hand selection section shell. */
export function HandSelectionSection({ mode, handTitle, onSwap, onModeChange, handImageSrc, markers }: {
  mode: 'finger' | 'hand'
  handTitle: string
  onSwap: () => void
  onModeChange: (mode: 'finger' | 'hand') => void
  handImageSrc: string
  markers: ReactNode
}) {
  return (
    <section className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <BookingSectionTitle>Select finger</BookingSectionTitle>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-normal leading-[1.44] tracking-[-0.24px] text-black">
            You are currently seeing the full hand.
          </p>
          <button
            className="flex items-center justify-center gap-[10px] rounded-full bg-[#ebe7ff] px-[12px] py-[6px]"
            onClick={onSwap}
            type="button"
          >
            <img alt="" className="size-[24px]" src={nailsBookingAssets.hands.swap} />
            <span className="whitespace-nowrap text-[12px] font-normal leading-[1.4] tracking-[0.24px] text-[#0c111d]">
              Swap sides
            </span>
          </button>
        </div>
      </div>

      <div className="flex gap-[16px]">
        <button
          className={cn(
            'flex h-[54px] min-w-0 flex-1 items-center justify-center gap-[8px] rounded-[16px] p-[4px]',
            mode === 'finger' ? 'bg-[#7344cd]' : 'border border-solid border-[#d0d5dd] bg-[#fcfcfd]',
          )}
          onClick={() => onModeChange('finger')}
          type="button"
        >
          <img alt="" className="size-[34px]" src={nailsBookingAssets.hands.fingerToFingerIcon} />
          <span className={cn(
            'whitespace-nowrap text-[12px] font-normal leading-[1.44] tracking-[-0.24px]',
            mode === 'finger' ? 'text-[#f2f5ff]' : 'text-black',
          )}>
            Finger to finger
          </span>
        </button>
        <button
          className={cn(
            'flex h-[54px] min-w-0 flex-1 items-center justify-center gap-[8px] rounded-[16px] p-[4px]',
            mode === 'hand' ? 'bg-[#7344cd]' : 'border border-solid border-[#d0d5dd] bg-[#fcfcfd]',
          )}
          onClick={() => onModeChange('hand')}
          type="button"
        >
          <img alt="" className="size-[34px]" src={nailsBookingAssets.hands.fullHandIcon} />
          <span className={cn(
            'whitespace-nowrap text-[12px] font-normal leading-[1.44] tracking-[-0.24px]',
            mode === 'hand' ? 'text-[#f2f5ff]' : 'text-black',
          )}>
            Full hand
          </span>
        </button>
      </div>

      <p className="text-center text-[21px] font-bold leading-[1.2] text-black">{handTitle}</p>

      <div className="inline-grid grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
        <img alt="" className="col-1 row-1 size-[342.5px] object-cover" src={handImageSrc} />
        {markers}
      </div>
    </section>
  )
}

/** Figma 335:7242–335:7246 — finger marker ellipses on hand diagram. */
export function FingerMarker({ left, top, src, onClick }: {
  left: number
  top: number
  src: string
  onClick?: () => void
}) {
  const El = onClick ? 'button' : 'div'
  return (
    <El
      className={cn('relative col-1 row-1 size-[21.553px]', onClick && 'cursor-pointer')}
      onClick={onClick}
      style={{ marginLeft: left, marginTop: top }}
      type={onClick ? 'button' : undefined}
    >
      <img alt="" className="absolute inset-0 size-full" src={src} />
    </El>
  )
}

export function OptionTile({ active, label, onClick, previewImage, materialPreview, className }: {
  active: boolean
  label: string
  onClick: () => void
  previewImage?: string
  materialPreview?: string
  className?: string
}) {
  return (
    <button
      className={cn(
        'flex h-[82px] min-w-0 items-center justify-between gap-2 rounded-[16px] border bg-[#fcfcfd] px-2 py-2 text-left text-[16px] font-normal tracking-[-0.32px] text-black',
        active ? 'border-[#7344cd] bg-[#ebe7ff] ring-1 ring-[#7344cd]/30' : 'border-[#d0d5dd]',
        className,
      )}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 leading-tight">{label}</span>
      {previewImage && <img alt="" className="h-11 w-16 shrink-0 object-contain" src={previewImage} />}
      {materialPreview && <span className="size-7 rounded-lg bg-gradient-to-br from-[#f2ebe3] to-[#b98f70]" />}
    </button>
  )
}

export function ImageOptionTile({ active, label, image, onClick }: {
  active: boolean
  label: string
  image: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'overflow-hidden rounded-[12px] border bg-white text-left shadow-[0_8px_18px_rgba(29,21,71,0.03)]',
        active ? 'border-[#7a3fe0] ring-2 ring-[#7a3fe0]/20' : 'border-[#d8deec]',
      )}
      onClick={onClick}
      type="button"
    >
      <img alt="" className="h-[88px] w-full object-cover" src={image} />
      <p className={cn('px-2 py-2 text-[12px] font-semibold', active ? 'text-[#7a3fe0]' : 'text-[#111827]')}>{label}</p>
    </button>
  )
}

export function CategoryPill({ active, icon, children }: { active?: boolean; icon: string; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex h-[54px] shrink-0 items-center gap-1 rounded-[16px] border px-2 py-3 text-[21px] font-normal leading-none tracking-[-0.42px]',
      active ? 'border-[#d0d5dd] bg-[#ebe7ff] text-black' : 'border-[#d0d5dd] bg-[#fcfcfd] text-black',
    )}>
      <img alt="" className="size-[30px] object-contain" src={icon} /> {children}
    </span>
  )
}
