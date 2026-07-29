import type { ReactNode } from 'react'
import { nailsBookingAssets } from '../../nails-booking/assets'
import type { BookingCategoryCode } from '../types'
import { registrationFlowLayout } from '../registrationFlowLayout'
import { BookingSectionTitle, CategoryTab, NailsStepHeader } from './shared'

const categoryTabs: Array<{ code: BookingCategoryCode; label: string; icon: string }> = [
  { code: 'nails', label: 'Nails', icon: nailsBookingAssets.categories.nails },
  { code: 'lashes', label: 'Lashes', icon: nailsBookingAssets.categories.lashes },
  { code: 'cosmetology', label: 'cosmetology', icon: nailsBookingAssets.categories.cosmetology },
  { code: 'micropigmentation', label: 'Micropigmentation', icon: nailsBookingAssets.categories.micropigmentation },
]

export function RegistrationCategoryTabs({ activeCategory }: { activeCategory: BookingCategoryCode }) {
  return (
    <div className="flex gap-[8px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categoryTabs.map((tab) => (
        <CategoryTab active={tab.code === activeCategory} icon={tab.icon} key={tab.code}>
          {tab.label}
        </CategoryTab>
      ))}
    </div>
  )
}

export function RegistrationFlowShell({
  activeCategory,
  children,
  footer,
  onBack,
  title = 'Details of service',
}: {
  activeCategory: BookingCategoryCode
  children: ReactNode
  footer?: ReactNode
  onBack: () => void
  title?: string
}) {
  return (
    <div
      className="mx-auto w-full bg-[#f2f5ff]"
      style={{ maxWidth: registrationFlowLayout.pageMaxWidth }}
    >
      <div
        className="flex flex-col pb-28"
        style={{
          gap: registrationFlowLayout.sectionGap,
          paddingInline: registrationFlowLayout.paddingX,
          paddingTop: registrationFlowLayout.paddingTop,
        }}
      >
        <NailsStepHeader onBack={onBack} title={title}>
          <RegistrationCategoryTabs activeCategory={activeCategory} />
        </NailsStepHeader>
        {children}
        {footer}
      </div>
    </div>
  )
}

export function RegistrationContinueSection({
  canContinue,
  disabledMessage,
  label = 'Continue',
  onContinue,
}: {
  canContinue: boolean
  disabledMessage?: string
  label?: string
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col items-center py-[32px]">
      {!canContinue && disabledMessage && (
        <p className="mb-3 px-2 text-center text-[12px] leading-[1.44] text-[#475467]">
          {disabledMessage}
        </p>
      )}
      <button
        className={[
          'w-full rounded-[16px] p-[16px] text-[18px] font-medium leading-[28px] text-[#f2f4f7]',
          'drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]',
          canContinue
            ? 'bg-gradient-to-b from-[#7a48db] to-[#412675]'
            : 'cursor-not-allowed bg-[#dcdcdc] text-[#475467] shadow-none',
        ].join(' ')}
        disabled={!canContinue}
        onClick={onContinue}
        type="button"
      >
        {label}
      </button>
    </div>
  )
}

export { BookingSectionTitle }
