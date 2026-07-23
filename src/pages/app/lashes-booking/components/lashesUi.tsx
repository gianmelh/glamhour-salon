import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { lashesDetailsLayout } from '../lashesDetailsSpec'

export function lashesSelectionShell(active: boolean, className?: string) {
  return cn(
    'border border-solid',
    active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
    className,
  )
}

export function LashesSectionTitle({ children }: { children: string }) {
  return (
    <h2 className="w-full text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">
      {children}
    </h2>
  )
}

export function LashesInProgressBadge() {
  return (
    <span className="inline-flex h-8 shrink-0 items-center rounded-[8px] bg-[#ebe7ff] px-3 py-2 text-[12px] font-bold uppercase leading-[18px] tracking-[0.6px] text-[#7444cf]">
      In progress
    </span>
  )
}

/** Figma 335:10353 — header block inside frame padding. */
export function LashesStepHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <header className="flex w-full min-w-0 flex-col" style={{ gap: lashesDetailsLayout.headerBlockGap }}>
      <div className="flex w-full min-w-0 flex-col" style={{ gap: 12 }}>
        <div className="flex w-full min-w-0 items-start" style={{ gap: lashesDetailsLayout.headerTitleGap }}>
          <button
            className="flex shrink-0 items-center text-black"
            onClick={onBack}
            style={{ width: lashesDetailsLayout.backIconWidth, height: 36 }}
            type="button"
            aria-label="Back"
          >
            <svg aria-hidden className="h-9 w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 text-[28px] font-extrabold leading-[1.44] tracking-[-0.56px] text-black">
            {title}
          </h1>
        </div>
        <div className="flex w-full justify-end">
          <LashesInProgressBadge />
        </div>
      </div>
      {children}
    </header>
  )
}

export function LashesCategoryTab({ active, icon, children }: { active?: boolean; icon: string; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex h-[54px] w-full min-w-0 items-center gap-1 rounded-[16px] border border-[#d0d5dd] px-2 py-3',
      active ? 'bg-[#ebe7ff]' : 'bg-[#f2f5ff]',
    )}>
      <img alt="" className="size-[30px] shrink-0 object-contain" src={icon} />
      <span className="min-w-0 truncate text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">{children}</span>
    </span>
  )
}

/** Category tabs in a 2-column grid — avoids horizontal overlap. */
export function LashCategoryGrid({ children, gap }: { children: ReactNode; gap: number }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2" style={{ gap }}>
      {children}
    </div>
  )
}

export function LashSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex w-full min-w-0 flex-col" style={{ gap: lashesDetailsLayout.sectionGap }}>
      <LashesSectionTitle>{title}</LashesSectionTitle>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** Figma horizontal carousels — bleed to frame edges, inner track scrolls. */
export function LashHorizontalTrack({ children, gap }: { children: ReactNode; gap: number }) {
  return (
    <div
      className={cn(
        '-mx-4 min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 touch-pan-x',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex w-max flex-nowrap items-start" style={{ gap }}>
        {children}
      </div>
    </div>
  )
}

/** Two-column option grid for volume, curl, thickness, length. */
export function LashOptionGrid({ children, gap }: { children: ReactNode; gap: number }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2" style={{ gap }}>
      {children}
    </div>
  )
}
