import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { Button, Card } from '../../../../components'

export function HelpModal({ title, children, triggerLabel }: { title: string; children: string; triggerLabel?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7344cd]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <HelpCircle className="size-4" />
        {triggerLabel ?? 'Help'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
          <Card className="w-full max-w-[393px] space-y-4 rounded-[24px] border-0 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[21px] font-bold text-[#0c111d]">{title}</h2>
              <button className="grid size-8 place-items-center rounded-full bg-[#f2f5ff]" onClick={() => setOpen(false)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-sm leading-6 text-[#475467]">{children}</p>
            <Button fullWidth onClick={() => setOpen(false)}>Got it</Button>
          </Card>
        </div>
      )}
    </>
  )
}

export function ContraindicationBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <Card className="rounded-[16px] border-[#fecdca] bg-[#fef3f2] p-4">
      <p className="text-sm font-bold text-[#b42318]">Medical alert</p>
      <p className="mt-1 text-sm text-[#7a271a]">
        One or more health answers may indicate contraindications. Review carefully before proceeding.
      </p>
    </Card>
  )
}
