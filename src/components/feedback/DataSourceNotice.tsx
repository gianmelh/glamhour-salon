import { CloudOff } from 'lucide-react'

export function DataSourceNotice({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] text-warning">
      <CloudOff className="size-4 shrink-0" />
      API unavailable. Showing clearly labeled development fallback data.
    </div>
  )
}
