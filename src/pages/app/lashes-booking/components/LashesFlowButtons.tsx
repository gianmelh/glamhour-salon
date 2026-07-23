import { cn } from '../../../../lib/cn'

export function LashesPrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'w-full rounded-[16px] p-4 text-[18px] font-medium leading-[28px]',
        disabled
          ? 'bg-[#dcdcdc] text-[#475467] drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]'
          : 'bg-gradient-to-b from-[#7a48db] to-[#412675] text-[#f2f4f7] drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]',
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function LashesSecondaryButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="w-full rounded-[16px] bg-[#dcdcdc] p-4 text-[18px] font-medium leading-[28px] text-[#475467] drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
