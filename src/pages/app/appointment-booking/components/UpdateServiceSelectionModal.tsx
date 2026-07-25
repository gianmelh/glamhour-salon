import { Button } from '../../../../components'

/** Figma 537:3731 — confirm replacing an existing nails/lashes service selection. */
export function UpdateServiceSelectionModal({
  open,
  onApply,
  onKeep,
}: {
  open: boolean
  onApply: () => void
  onKeep: () => void
}) {
  if (!open) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#0c111d]/40 p-4 backdrop-blur-[2px]"
      data-node-id="537:3731"
      role="dialog"
    >
      <div className="relative w-full max-w-[327px] rounded-[24px] bg-white px-6 pb-6 pt-8 shadow-[0px_16px_32px_rgba(12,17,29,0.18)]">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[#ebe7ff]">
          <span className="text-[28px] font-bold leading-none text-[#7344cd]">?</span>
        </div>
        <h2 className="text-center text-[21px] font-bold leading-[1.2] tracking-[-0.42px] text-[#0c111d]">
          Update your service selection?
        </h2>
        <p className="mt-3 text-center text-[14px] font-normal leading-[1.45] text-[#475467]">
          You can adjust your service, but your previous selection will be replaced.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            className="min-h-0 rounded-[16px] bg-gradient-to-b from-[#7a48db] to-[#412675] p-4 text-[18px] font-medium leading-7 text-[#f2f4f7] shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]"
            fullWidth
            onClick={onApply}
          >
            Apply changes
          </Button>
          <Button
            className="min-h-0 rounded-[16px] border border-[#7344cd] bg-white p-4 text-[18px] font-medium leading-7 text-[#7344cd]"
            fullWidth
            onClick={onKeep}
            variant="outline"
          >
            Keep selections
          </Button>
        </div>
      </div>
    </div>
  )
}
