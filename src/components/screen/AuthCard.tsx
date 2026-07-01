import type { ReactNode } from 'react'
import { Card } from '../ui'

export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="w-full" padding="lg">
      <h1 className="text-center text-xl font-bold tracking-[-0.02em]">{title}</h1>
      {description && <p className="mx-auto mt-2 max-w-[260px] text-center text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </Card>
  )
}
