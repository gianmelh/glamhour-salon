import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserRound } from 'lucide-react'
import { Button, Card, Input } from '../../../../components'
import { MutationError } from '../../../../components/screen/MutationError'
import { useMutation } from '../../../../hooks/useMutation'
import { cn } from '../../../../lib/cn'
import { formatShortDate } from '../../../../lib/format'
import { glamhourApi } from '../../../../services/glamhour-api'
import type { Client, HealthProfileVersion } from '../../../../types/api'
import { HealthQuestionnaireActions, HealthQuestionnaireForm } from '../components/HealthQuestionnaireForm'
import { isHealthQuestionnaireComplete } from '../health-questionnaires'
import type { BookingCategoryCode } from '../types'
import { ClientSearchCard } from './AppointmentDetailsStep'

function normalizeProfileAnswers(answers: Record<string, unknown> | undefined) {
  if (!answers) return {}
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => {
      if (value === true) return [key, 'yes']
      if (value === false) return [key, 'no']
      if (typeof value === 'string') return [key, value]
      return [key, String(value)]
    }),
  )
}

export function ClientStep({ clients, selectedClientId, onSelect, onNext, onCreate }: {
  clients: Client[]
  selectedClientId: string
  onSelect: (id: string) => void
  onNext: () => void
  onCreate: (client: Client) => void
}) {
  const createClient = useMutation(glamhourApi.createClient)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = query
      ? clients.filter((client) => client.full_name.toLowerCase().includes(query) || (client.phone ?? '').includes(query))
      : clients
    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [clients, search])

  const selectedClient = clients.find((client) => client.id === selectedClientId)

  if (creating) {
    return (
      <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
        <header>
          <h1 className="text-[28px] font-extrabold text-[#0c111d]">Create client</h1>
          <p className="mt-2 text-[15px] text-[#667085]">Add a new client to continue booking.</p>
        </header>
        <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          <Input label="Full name" placeholder="e.g. Sarah Johnson" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Input label="Phone number" placeholder="e.g. +52 55 1234 5678" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
          <Button
            disabled={!newName.trim()}
            fullWidth
            loading={createClient.loading}
            onClick={async () => {
              const client = await createClient.mutate({ fullName: newName.trim(), phone: newPhone.trim() || undefined })
              onCreate(client)
              onSelect(client.id)
              setCreating(false)
              setNewName('')
              setNewPhone('')
            }}
          >
            Save client
          </Button>
          <MutationError error={createClient.error} />
          <Button fullWidth onClick={() => setCreating(false)} variant="outline">Cancel</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
      <header className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-[12px] bg-[#ebe7ff]">
          <Search className="size-5 text-[#7344cd]" />
        </span>
        <div>
          <h1 className="text-[28px] font-extrabold text-[#0c111d]">Search client</h1>
          <p className="mt-1 text-[15px] text-[#667085]">Search for a registered client to reuse their health profile.</p>
        </div>
      </header>

      <Input label="Name" placeholder="e.g. Sarah Johnson" value={search} onChange={(event) => setSearch(event.target.value)} />

      {selectedClient && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Selected client</p>
          <button className="w-full text-left" onClick={() => onSelect(selectedClient.id)} type="button">
            <ClientSearchCard client={selectedClient} selected subtitle="Tap to confirm selection" />
          </button>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Recent clients</p>
        {filtered.slice(0, 8).map((client) => (
          <button className="w-full text-left" key={client.id} onClick={() => onSelect(client.id)} type="button">
            <ClientSearchCard
              client={client}
              selected={selectedClientId === client.id}
              subtitle={client.email ?? undefined}
            />
          </button>
        ))}
        {!filtered.length && (
          <Card className="rounded-[16px] border-[#d0d5dd] bg-white p-4 text-center text-sm text-[#667085]">
            No clients match your search.
          </Card>
        )}
      </section>

      <Button disabled={!selectedClientId} fullWidth onClick={onNext}>Continue</Button>
      <Button fullWidth onClick={() => setCreating(true)} variant="outline">
        <Plus className="size-4" /> Create new client
      </Button>
    </div>
  )
}

export function HealthStep({ category, client, details, notes, onChange, onNext }: {
  category: { code: string; name: string }
  client: Client
  details: Record<string, unknown>
  notes: string
  onChange: (details: Record<string, unknown>, notes: string) => void
  onNext: () => void
}) {
  const [profile, setProfile] = useState<HealthProfileVersion | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const categoryCode = category.code as BookingCategoryCode

  useEffect(() => {
    let active = true
    queueMicrotask(() => setProfileLoading(true))
    glamhourApi.healthProfile(client.id, category.code).then((result) => {
      if (active) setProfile(result)
    }).catch(() => {
      if (active) setProfile(null)
    }).finally(() => {
      if (active) setProfileLoading(false)
    })
    return () => { active = false }
  }, [category.code, client.id])

  if (profileLoading) {
    return (
      <div className="mx-auto w-full max-w-[393px] px-5 pb-8">
        <p className="text-[16px] text-[#667085]">Checking health profile...</p>
      </div>
    )
  }

  if (!editing && profile?.is_valid && !isHealthQuestionnaireComplete(categoryCode, details)) {
    return (
      <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
        <header>
          <h1 className="text-[28px] font-extrabold text-[#0c111d]">Client loaded</h1>
          <p className="mt-2 text-[15px] text-[#667085]">A valid health profile exists for this client.</p>
        </header>

        <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-[#7344cd]" />
            <div>
              <p className="font-bold text-[#0c111d]">{client.full_name}</p>
              <p className="text-sm text-[#667085]">{category.name}</p>
            </div>
          </div>
          <div className={cn('flex justify-between gap-3 border-t border-[#eef1f7] pt-3 text-sm')}>
            <span className="text-[#667085]">Valid until</span>
            <span className="font-bold text-[#0c111d]">{formatShortDate(profile.valid_until)}</span>
          </div>
        </Card>

        <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-[#fcfcfd] p-4">
          <p className="font-bold text-[#0c111d]">Has any medical, allergy, medication, or health information changed?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => setEditing(true)} variant="outline">Yes, update</Button>
            <Button onClick={() => {
              onChange({
                ...details,
                usedExistingHealthProfile: true,
                existingQuestionnaireId: profile.questionnaire_id ?? null,
                healthAnswers: normalizeProfileAnswers(profile.answers),
              }, notes)
              onNext()
            }}>No, continue</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[393px] px-5 pb-24">
      <HealthQuestionnaireForm
        categoryCode={categoryCode}
        client={client}
        details={details}
        notes={notes}
        onChange={onChange}
      />
      <HealthQuestionnaireActions
        categoryCode={categoryCode}
        details={details}
        onSubmit={onNext}
      />
    </div>
  )
}
