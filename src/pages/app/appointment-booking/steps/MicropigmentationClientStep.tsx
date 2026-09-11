import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Phone, Plus, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, Input } from '../../../../components'
import { MutationError } from '../../../../components/screen/MutationError'
import { useSubscription } from '../../../../hooks/useGlamhourData'
import { useMutation } from '../../../../hooks/useMutation'
import { cn } from '../../../../lib/cn'
import { applyClientAccess, clientUsageLabel } from '../../../../lib/client-access'
import { deferTask } from '../../../../lib/defer'
import { formatShortDate } from '../../../../lib/format'
import { glamhourApi } from '../../../../services/glamhour-api'
import { formatClientBirthDate } from '../dateMask'
import type { Client, HealthProfileVersion } from '../../../../types/api'
import { ClientSearchCard } from './AppointmentDetailsStep'

type ClientVisitLabel = {
  kind: 'upcoming' | 'last'
  date: string
}

function profileSummary(profile: HealthProfileVersion | null) {
  const answers = profile?.answers ?? {}
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = answers[key]
      if (value == null || value === '' || value === false || value === 'no') continue
      if (Array.isArray(value)) return value.filter(Boolean).join(', ')
      if (typeof value === 'boolean') return value ? 'Yes' : undefined
      return String(value)
    }
    return undefined
  }

  return {
    allergies: read('allergies', 'allergyReactionNotes', 'latex_allergy', 'chemical_allergies'),
    conditions: read('healthHistory', 'medical_conditions', 'diabetic', 'blood_disorders'),
    medications: read('currentMedications', 'medications'),
    notes: read('procedure_notes', 'additional_notes', 'notes'),
  }
}

export function MicropigmentationClientStep({
  clients,
  clientVisitByClientId,
  selectedClientId,
  onSelect,
  onNext,
  onCreate,
  onContinueWithProfile,
}: {
  clients: Client[]
  clientVisitByClientId: Record<string, ClientVisitLabel>
  selectedClientId: string
  onSelect: (id: string) => void
  onNext: () => void
  onCreate: (client: Client) => void
  onContinueWithProfile: (details: Record<string, unknown>) => void
}) {
  const createClient = useMutation(glamhourApi.createClient)
  const subscription = useSubscription()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [profile, setProfile] = useState<HealthProfileVersion | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStage, setProfileStage] = useState<'search' | 'loaded'>('search')
  const displayClients = useMemo(() => applyClientAccess(clients, subscription.data), [clients, subscription.data])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = query
      ? displayClients.filter((client) => client.full_name.toLowerCase().includes(query) || (client.phone ?? '').includes(query))
      : displayClients
    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [displayClients, search])

  const selectedClient = displayClients.find((client) => client.id === selectedClientId)
  const clientLimitReached = subscription.data?.clientUsage.canCreateClient === false
  const clientLimitPending = subscription.loading || !subscription.data
  const canCreateClient = !clientLimitPending && !clientLimitReached
  const lastVisitLabel = (clientId: string) => {
    const visit = clientVisitByClientId[clientId]
    if (!visit) return undefined
    return visit.kind === 'upcoming'
      ? `Upcoming ${formatShortDate(visit.date)}`
      : `Last visit ${formatShortDate(visit.date)}`
  }

  useEffect(() => {
    if (!selectedClientId) {
      deferTask(() => {
        setProfile(null)
        setProfileStage('search')
      })
      return
    }
    let active = true
    deferTask(() => setProfileLoading(true))
    glamhourApi.healthProfile(selectedClientId, 'micropigmentation').then((result) => {
      if (!active) return
      setProfile(result)
      setProfileStage(result?.is_valid ? 'loaded' : 'search')
    }).catch(() => {
      if (!active) return
      setProfile(null)
      setProfileStage('search')
    }).finally(() => {
      if (active) setProfileLoading(false)
    })
    return () => { active = false }
  }, [selectedClientId])

  if (creating) {
    return (
      <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
        <header>
          <h1 className="text-[28px] font-extrabold text-[#0c111d]">Create client</h1>
          <p className="mt-2 text-[15px] text-[#667085]">Add a new client to continue booking.</p>
        </header>
        <Card className="space-y-4 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          {clientLimitReached && (
            <div className="rounded-[16px] border border-[#fbbf24] bg-[#fffbeb] p-3 text-xs text-[#92400e]">
              <p className="font-bold">You reached 15 clients on the free plan.</p>
              <p className="mt-1">Upgrade to Premium to add more clients.</p>
            </div>
          )}
          <Input label="Full name" placeholder="e.g. Sarah Johnson" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Input label="Phone number" placeholder="e.g. +52 55 1234 5678" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
          {clientLimitReached ? (
            <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-glam-gradient px-4 text-sm font-medium text-white shadow-action" to="/app/settings/subscription">
              Upgrade
            </Link>
          ) : (
            <Button
              disabled={!canCreateClient || !newName.trim() || newPhone.trim().length < 7}
              fullWidth
              loading={createClient.loading}
              onClick={async () => {
                const client = await createClient.mutate({ fullName: newName.trim(), phone: newPhone.trim() })
                onCreate(client)
                onSelect(client.id)
                setCreating(false)
                setNewName('')
                setNewPhone('')
                onNext()
              }}
            >
              Save client
            </Button>
          )}
          <MutationError error={createClient.error} />
          <Button fullWidth onClick={() => setCreating(false)} variant="outline">Cancel</Button>
        </Card>
      </div>
    )
  }

  if (profileStage === 'loaded' && selectedClient && profile?.is_valid) {
    const summary = profileSummary(profile)
    return (
      <div className="mx-auto w-full max-w-[393px] space-y-5 px-5 pb-8">
        <header className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[#ebe7ff]">
            <Search className="size-5 text-[#7344cd]" />
          </span>
          <div>
            <h1 className="text-[28px] font-extrabold text-[#0c111d]">Health profile loaded</h1>
            <p className="mt-1 text-[15px] text-[#667085]">
              Saved health information will be used automatically. The questionnaire will be skipped.
            </p>
          </div>
        </header>

        <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#ebe7ff]">
              <UserRound className="size-5 text-[#7344cd]" />
            </span>
            <div>
              <p className="font-bold text-[#0c111d]">{selectedClient.full_name}</p>
              {selectedClient.phone && (
                <p className="inline-flex items-center gap-1 text-sm text-[#667085]">
                  <Phone className="size-3.5" /> {selectedClient.phone}
                </p>
              )}
              <p className="text-sm text-[#667085]">{lastVisitLabel(selectedClient.id) ?? 'Registered client'}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 rounded-[20px] border-[#d0d5dd] bg-[#fcfcfd] p-4">
          <p className="font-bold text-[#0c111d]">Health summary</p>
          <SummaryRow icon="warn" label="Allergies" value={summary.allergies} />
          <SummaryRow icon="info" label="Medical conditions" value={summary.conditions} />
          <SummaryRow icon="info" label="Medications" value={summary.medications} />
          <SummaryRow icon="info" label="Additional notes" value={summary.notes} />
        </Card>

        <Button
          fullWidth
          onClick={() => {
            onContinueWithProfile({
              usedExistingHealthProfile: true,
              existingQuestionnaireId: profile.questionnaire_id ?? null,
              generalFullName: selectedClient.full_name,
              generalPhone: selectedClient.phone ?? '',
              generalEmail: selectedClient.email ?? '',
              generalDateOfBirth: formatClientBirthDate(selectedClient.date_of_birth),
              healthAnswers: profile.answers ?? {},
              healthHistory: Array.isArray(profile.answers?.healthHistory)
                ? profile.answers?.healthHistory
                : [],
              currentMedications: String(profile.answers?.currentMedications ?? summary.medications ?? ''),
              allergyReactionNotes: String(profile.answers?.allergyReactionNotes ?? summary.allergies ?? ''),
            })
            onNext()
          }}
        >
          Continue with this client
        </Button>
        <Button
          fullWidth
          onClick={() => {
            setProfileStage('search')
            onSelect('')
          }}
          variant="outline"
        >
          Go back
        </Button>
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

      {profileLoading && selectedClientId && (
        <p className="text-sm text-[#667085]">Checking health profile...</p>
      )}

      {selectedClient && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Selected client</p>
          <button className="w-full text-left" onClick={() => onSelect(selectedClient.id)} type="button">
            <ClientSearchCard client={selectedClient} selected subtitle={lastVisitLabel(selectedClient.id) ?? 'Tap to confirm selection'} />
          </button>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Recent clients</p>
          <p className="text-xs font-semibold text-[#667085]">Total clients {clientUsageLabel(clients.length, subscription.data)}</p>
        </div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((client) => (
            <button className="w-full text-left disabled:opacity-60" disabled={client.subscription_locked} key={client.id} onClick={() => onSelect(client.id)} type="button">
              <ClientSearchCard
                client={client}
                selected={selectedClientId === client.id}
                subtitle={client.subscription_locked ? 'Locked on Free plan' : lastVisitLabel(client.id) ?? client.email ?? undefined}
              />
            </button>
          ))}
          {!filtered.length && (
            <Card className="rounded-[16px] border-[#d0d5dd] bg-white p-4 text-center text-sm text-[#667085]">
              No clients match your search.
            </Card>
          )}
        </div>
      </section>

      <Button
        disabled={!selectedClientId || profileLoading || selectedClient?.subscription_locked}
        fullWidth
        onClick={() => {
          if (profile?.is_valid) {
            setProfileStage('loaded')
            return
          }
          onNext()
        }}
      >
        Continue
      </Button>
      {selectedClient?.subscription_locked && (
        <p className="rounded-md bg-[#fffbeb] px-3 py-2 text-xs font-semibold text-[#92400e]">
          This client is locked on the Free plan. Upgrade to Premium to continue.
        </p>
      )}
      {clientLimitReached ? (
        <>
          <Button disabled fullWidth variant="outline">
            <Plus className="size-4" /> Create new client
          </Button>
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-glam-gradient px-4 text-sm font-medium text-white shadow-action" to="/app/settings/subscription">
            Upgrade
          </Link>
        </>
      ) : (
        <Button disabled={!canCreateClient} fullWidth onClick={() => { if (canCreateClient) setCreating(true) }} variant="outline">
          <Plus className="size-4" /> Create new client
        </Button>
      )}
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: 'warn' | 'info'
  label: string
  value?: string
}) {
  return (
    <div className={cn('flex items-start gap-2 text-sm')}>
      {icon === 'warn'
        ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#7344cd]" />
        : <Info className="mt-0.5 size-4 shrink-0 text-[#7344cd]" />}
      <div>
        <p className="font-semibold text-[#0c111d]">{label}</p>
        <p className="text-[#667085]">{value || 'None recorded'}</p>
      </div>
    </div>
  )
}
