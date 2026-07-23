import { useMemo, useState } from 'react'
import { Plus, UsersRound } from 'lucide-react'
import { Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, LoadingState, PageTitle, ProfessionalEditorModal, StaffCard, emptyProfessionalDraft, type ProfessionalDraft } from '../../components'
import { useNailSettings, useProfessionals, useServiceCategories, useServices } from '../../hooks/useGlamhourData'
import { useMutation } from '../../hooks/useMutation'
import { staffCardProps } from '../../lib/view-models'
import { glamhourApi } from '../../services/glamhour-api'

export function StaffPage() {
  const professionals = useProfessionals()
  const services = useServices()
  const categories = useServiceCategories()
  const nailSettings = useNailSettings()
  const [editor, setEditor] = useState<ProfessionalDraft | null>(null)
  const [message, setMessage] = useState('')
  const saveProvider = useMutation((input: ProfessionalDraft) => (
    input.id ? glamhourApi.updateProfessional(input.id, input) : glamhourApi.createProfessional(input)
  ))

  const enabledCategoryIds = useMemo(
    () => new Set((categories.data ?? []).map((category) => category.id)),
    [categories.data],
  )
  const assignableServices = useMemo(() => {
    const list = (services.data ?? []).filter((service) => service.is_active)
    if (!enabledCategoryIds.size) return list
    return list.filter((service) => enabledCategoryIds.has(service.category_id))
  }, [enabledCategoryIds, services.data])

  if (professionals.loading || services.loading || categories.loading) return <LoadingState label="Loading professionals..." />
  if (!professionals.data && professionals.error) {
    return <ErrorState description={professionals.error.message} onRetry={professionals.retry} />
  }

  const activeCount = professionals.data?.filter((professional) => professional.status === 'active').length ?? 0
  const staffLimitReached = activeCount >= 10

  const salonSchedule = nailSettings.data?.salonSchedule

  const openEditor = () => setEditor(emptyProfessionalDraft(salonSchedule))

  const submitProvider = async () => {
    if (!editor) return
    setMessage('')
    const payload = {
      ...editor,
      serviceAssignments: editor.serviceAssignments.filter((assignment) => assignment.isActive),
    }
    const saved = await saveProvider.mutate(payload)
    professionals.setData((current) => {
      const list = current ?? []
      const index = list.findIndex((item) => item.id === saved.id)
      if (index >= 0) {
        const next = [...list]
        next[index] = saved
        return next
      }
      return [...list, saved].sort((a, b) => a.full_name.localeCompare(b.full_name))
    })
    setEditor(null)
    setMessage(editor.id ? 'Provider updated successfully.' : 'Provider added successfully.')
  }

  return (
    <div className="space-y-5 pb-8">
      <DataSourceNotice visible={professionals.isFallback} />
      <PageTitle
        action={(
          <Button disabled={staffLimitReached} onClick={openEditor} size="icon">
            <Plus className="size-5" />
          </Button>
        )}
        subtitle="Manage services, schedules, availability, and earnings."
        title="Staff & professionals"
      />

      {message && <p className="rounded-md bg-success-soft px-3 py-2 text-xs font-medium text-success">{message}</p>}

      <Card className="flex items-center gap-3" tone="lavender">
        <UsersRound className="size-6 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{activeCount} / 10 active professionals</p>
          <p className="text-xs text-muted">Live from your salon database</p>
        </div>
        <Badge tone={staffLimitReached ? 'warning' : 'success'}>{staffLimitReached ? 'Limit reached' : 'Active'}</Badge>
      </Card>

      {staffLimitReached && (
        <Card className="border-[#f6d6a8] bg-[#fff9ed]">
          <p className="text-sm font-semibold">Staff limit reached</p>
          <p className="mt-1 text-xs leading-5 text-muted">You&apos;ve reached the limit of 10 active staff members. Upgrade your plan to add more providers.</p>
        </Card>
      )}

      {professionals.data?.length ? (
        <div className="space-y-3">
          {professionals.data.map((person) => (
            <StaffCard key={person.id} {...staffCardProps(person)} />
          ))}
        </div>
      ) : (
        <EmptyState description="Add a professional to assign salon services." title="No professionals yet" />
      )}

      <Button
        disabled={staffLimitReached}
        fullWidth
        leadingIcon={<Plus className="size-4" />}
        onClick={openEditor}
        variant="outline"
      >
        {staffLimitReached ? 'Upgrade to add more providers' : 'Add professional'}
      </Button>

      {editor && (
        <ProfessionalEditorModal
          draft={editor}
          error={saveProvider.error}
          loading={saveProvider.loading}
          onCancel={() => setEditor(null)}
          onChange={setEditor}
          onSubmit={submitProvider}
          salonSchedule={salonSchedule ?? editor.schedule ?? emptyProfessionalDraft().schedule!}
          services={assignableServices}
        />
      )}
    </div>
  )
}
