import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { Button, Card, EmptyState, LoadingState, ProviderDialog, Textarea } from '../../../components'
import { useApiResource } from '../../../hooks/useApiResource'
import { ApiClientError } from '../../../lib/api'
import { localDateString } from '../../../lib/date'
import { glamhourApi } from '../../../services/glamhour-api'
import type { Client, ClientClinicalForm } from '../../../types/api'
import { HealthQuestionnaireForm } from '../appointment-booking/components/HealthQuestionnaireForm'
import { CATEGORY_ORDER, categoryNames } from '../appointment-booking/constants'
import { formatClientBirthDate } from '../appointment-booking/dateMask'
import type { BookingCategoryCode } from '../appointment-booking/types'
import { ClientClinicalFormSummary } from './ClientClinicalFormSummary'
import { clinicalDate, clinicalFormDetails, clinicalFormMissingItems, clinicalFormSubmission, isLegacyClinicalForm } from './clinicalFormDetails'
import { ClientCategoryFormEditor } from './ClientCategoryFormEditor'
import { ClientCategoryFormSummary } from './ClientCategoryFormSummary'

type Draft = {
  legacy: boolean
  details: Record<string, unknown>
  notes: string
  expectedProfileId: string | null
  expectedRevision: string | null
  initialValue: string
}

export function ClientClinicalFormsDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const resource = useApiResource(useCallback(async () => {
    const [forms, categories, allCategories] = await Promise.all([
      glamhourApi.clientClinicalForms(client.id), glamhourApi.categories(), glamhourApi.categories(undefined, { includeAll: true }),
    ])
    return { forms, categories, allCategories }
  }, [client.id]))
  const [category, setCategory] = useState<BookingCategoryCode | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const saveInFlight = useRef(false)
  const [saveError, setSaveError] = useState<Error | null>(null)
  const [notice, setNotice] = useState('')
  const [pendingLeave, setPendingLeave] = useState<'close' | 'cancel' | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const record = resource.data?.forms.find((form) => form.category === category)
  const missing = category && draft ? clinicalFormMissingItems(category, draft.details, draft.legacy) : []
  const dirty = draft && JSON.stringify([draft.details, draft.notes]) !== draft.initialValue
  const conflict = saveError instanceof ApiClientError && saveError.status === 409
  const editing = Boolean(draft)

  useLayoutEffect(() => {
    content.current?.parentElement?.scrollTo({ top: 0 })
  }, [category, editing, pendingLeave])

  function leave(destination: 'close' | 'cancel', discard = false) {
    if (saveInFlight.current) return
    if (dirty && !discard) { setPendingLeave(destination); return }
    if (destination === 'close') { onClose(); return }
    setDraft(null)
    setSaveError(null)
    setPendingLeave(null)
    if (!record) setCategory(null)
  }

  function edit(code: BookingCategoryCode, current?: ClientClinicalForm) {
    const details = clinicalFormDetails(current)
    const legacy = Boolean(current && isLegacyClinicalForm(code, details))
    if (!legacy) {
      details.usedExistingHealthProfile = false
      if (code === 'cosmetology' || code === 'micropigmentation') {
        details.generalFullName ??= client.full_name
        details.generalPhone ??= client.phone ?? ''
        details.generalEmail ??= client.email ?? ''
        details.generalDateOfBirth ??= formatClientBirthDate(client.date_of_birth)
      }
      if (code === 'lashes') details.registrationStep = 'details'
    }
    const now = new Date()
    if ((legacy || code === 'cosmetology' || code === 'micropigmentation') && !details.consentDate) details.consentDate = localDateString(now)
    if (legacy && !details.consentTime) details.consentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const notes = current?.notes ?? ''
    setCategory(code)
    setDraft({ legacy, details, notes, expectedProfileId: current?.id ?? null, expectedRevision: current?.revision ?? null, initialValue: JSON.stringify([details, notes]) })
    setSaveError(null)
    setNotice('')
  }

  async function save(submittedDetails = draft?.details) {
    if (!category || !draft || !submittedDetails || clinicalFormMissingItems(category, submittedDetails, draft.legacy).length || client.subscription_locked || saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await glamhourApi.saveClientClinicalForm(client.id, category, {
        details: clinicalFormSubmission(submittedDetails), notes: draft.notes, expectedProfileId: draft.expectedProfileId, expectedRevision: draft.expectedRevision,
      })
      resource.setData((current) => current && ({ ...current, forms: [...current.forms.filter((form) => form.category !== saved.category), saved] }))
      setDraft(null)
      setNotice(`${categoryNames[category]} clinical form saved.`)
    } catch (error) {
      setSaveError(error instanceof Error ? error : new Error('The clinical form could not be saved.'))
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  const actions = pendingLeave ? (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={() => setPendingLeave(null)} variant="outline">Keep editing</Button>
      <Button onClick={() => leave(pendingLeave, true)} variant="danger">Discard changes</Button>
    </div>
  ) : draft ? (
    <div className="space-y-3">
      {saveError && <p className="text-sm text-danger" role="alert">{saveError.message}</p>}
      {conflict && <Button fullWidth onClick={() => { setDraft(null); setCategory(null); setSaveError(null); resource.retry() }} variant="outline">Reload saved forms</Button>}
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={saving} onClick={() => leave('cancel')} variant="outline">Cancel</Button>
        <Button disabled={missing.length > 0 || conflict || client.subscription_locked} loading={saving} onClick={() => void save()}>Save form</Button>
      </div>
    </div>
  ) : category && record ? (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={() => { setCategory(null); setNotice('') }} variant="outline">Back to forms</Button>
      {!client.subscription_locked && <Button onClick={() => edit(category, record)}>Edit form</Button>}
    </div>
  ) : undefined

  return (
    <ProviderDialog actions={actions} description={client.full_name} onClose={() => leave('close')} title="Clinical forms">
      <div className="space-y-4" ref={content}>
        {client.subscription_locked && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This client is locked on the Free plan. You can view their clinical forms. Upgrade to edit or add forms.</p>}
        {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
        {pendingLeave && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">You have unsaved changes. Discard them to continue?</p>}
        {resource.loading ? <LoadingState label="Loading clinical forms..." /> : resource.error ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-danger">Could not load clinical forms. {resource.error.message}</p>
            <Button onClick={resource.retry} variant="outline">Retry</Button>
          </div>
        ) : draft && category ? (
          <>
            <p className="text-sm text-muted">{record ? 'Update' : 'Add'} the {categoryNames[category].toLowerCase()} form for {client.full_name}.</p>
            <div aria-busy={saving} inert={saving || Boolean(pendingLeave)}>
              {draft.legacy ? <HealthQuestionnaireForm
                categoryCode={category} client={client} details={draft.details} notes={draft.notes}
                serviceDate={String(draft.details.consentDate ?? '')} serviceTime={String(draft.details.consentTime ?? '')}
                onChange={(details, notes) => setDraft((current) => current && ({ ...current, details, notes }))}
              /> : <>
                <ClientCategoryFormEditor category={category} client={client} details={draft.details}
                  serviceCategory={resource.data?.allCategories.find((item) => item.code === category)}
                  onBack={() => leave('cancel')}
                  onChange={(details) => setDraft((current) => current && ({ ...current, details }))}
                  onSubmit={(details) => save(details)}
                />
                <Textarea label="Additional clinical notes" value={draft.notes} onChange={(event) => setDraft((current) => current && ({ ...current, notes: event.target.value }))} />
              </>}
            </div>
            {missing.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Complete these items to save:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">{missing.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>}
          </>
        ) : category && record ? (
          <>
            <div>
              <h3 className="text-lg font-bold">{categoryNames[category]}</h3>
              <p className="mt-1 text-xs text-muted">Recorded {clinicalDate(record.completed_at ?? record.valid_from)} · {record.is_valid ? 'Valid' : 'Needs review'}</p>
              <p className="mt-1 text-xs text-muted">Valid until {clinicalDate(record.valid_until)}</p>
            </div>
            {isLegacyClinicalForm(category, clinicalFormDetails(record))
              ? <ClientClinicalFormSummary category={category} client={client} record={record} />
              : <ClientCategoryFormSummary client={client} record={record} />}
          </>
        ) : (
          <>
            <p className="text-sm leading-5 text-muted">Manage health information by service category, including forms completed during appointments.</p>
            {CATEGORY_ORDER.filter((code) => resource.data?.categories.some((item) => item.code === code && item.is_active) || resource.data?.forms.some((form) => form.category === code)).map((code) => {
              const form = resource.data?.forms.find((item) => item.category === code)
              const enabled = resource.data?.categories.some((item) => item.code === code && item.is_active)
              return (
                <section aria-label={`${categoryNames[code]} clinical form`} className="space-y-3 rounded-xl border border-border bg-white p-4" key={code}>
                  <div className="flex items-start gap-3">
                    <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h3 className="break-words font-bold">{categoryNames[code]}</h3>
                      <p className="mt-1 text-xs text-muted">{form ? `Recorded ${clinicalDate(form.completed_at ?? form.valid_from)}` : 'No clinical information yet'}</p>
                      {form && <p className="mt-1 text-xs text-muted">{form.is_valid ? `Valid until ${clinicalDate(form.valid_until)}` : 'Needs review'}</p>}
                      {!enabled && <p className="mt-1 text-xs text-muted">Category currently disabled</p>}
                    </div>
                  </div>
                  {form ? <Button fullWidth onClick={() => setCategory(code)} variant="outline">View form</Button>
                    : <Button disabled={client.subscription_locked} fullWidth onClick={() => edit(code)} variant="outline"><Plus className="size-4" /> Add form</Button>}
                </section>
              )
            })}
            {!CATEGORY_ORDER.some((code) => resource.data?.categories.some((item) => item.code === code && item.is_active) || resource.data?.forms.some((form) => form.category === code)) && <EmptyState title="No clinical forms" description="Enable a service category in Settings to add a clinical form." />}
            <Card className="text-xs leading-5 text-muted">Each category has its own clinical record for this client. Updates preserve the information recorded in previous appointments.</Card>
          </>
        )}
      </div>
    </ProviderDialog>
  )
}
