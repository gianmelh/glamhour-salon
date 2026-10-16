import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Clock3, Eye, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { Badge, Button, Card, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, PageTitle, Textarea } from '../../components'
import { ProviderDialog } from '../../components/layout/ProviderDialog'
import { MutationError } from '../../components/screen/MutationError'
import { useSalon, useServiceCategories, useServices } from '../../hooks/useGlamhourData'
import { glamhourApi } from '../../services/glamhour-api'
import { formatMoney } from '../../lib/format'
import { getServiceSuggestions } from '../../lib/service-presets'
import type { Service, ServiceCategory } from '../../types/api'

type ServiceDialog =
  | { mode: 'create'; name?: string }
  | { mode: 'edit' | 'view' | 'delete'; service: Service }

export function CategoryServicesPage() {
  const { categoryCode } = useParams()
  // Remount the editor and search when navigating between category URLs.
  return <CategoryServices key={categoryCode} categoryCode={categoryCode} />
}

function CategoryServices({ categoryCode }: { categoryCode?: string }) {
  const salon = useSalon()
  const categories = useServiceCategories(undefined, { includeAll: true })
  const enabledCategories = useServiceCategories()
  const services = useServices(undefined, { includeInactive: true })
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<ServiceDialog | null>(null)
  const [message, setMessage] = useState('')

  const retry = () => { salon.retry(); categories.retry(); enabledCategories.retry(); services.retry() }
  if (salon.loading || categories.loading || enabledCategories.loading || services.loading) return <LoadingState label="Loading services..." />
  if (!salon.data || !categories.data || !enabledCategories.data || !services.data) return <ErrorState description="Services could not be loaded." onRetry={retry} />
  const category = categories.data.find((item) => item.code === categoryCode)
  if (!category) return <div className="space-y-5"><BackLink /><EmptyState title="Category not found" description="Choose a service category from Salon Configuration." /></div>

  const salonData = salon.data
  const enabled = enabledCategories.data.some((item) => item.id === category.id)
  const categoryServices = services.data.filter((service) => service.category_id === category.id)
  const query = search.trim().toLocaleLowerCase()
  const visibleServices = categoryServices.filter((service) => `${service.name} ${service.description ?? ''}`.toLocaleLowerCase().includes(query))
  const existingNames = new Set(categoryServices.map((service) => service.name.trim().toLocaleLowerCase()))
  const suggestions = getServiceSuggestions(category).filter((name) => !existingNames.has(name.toLocaleLowerCase()) && name.toLocaleLowerCase().includes(query))
  const isFallback = salon.isFallback || categories.isFallback || enabledCategories.isFallback || services.isFallback
  const openDialog = (next: ServiceDialog) => { setMessage(''); setDialog(next) }
  const saved = (service: Service) => {
    services.setData((current) => {
      const list = current ?? []
      return list.some((item) => item.id === service.id)
        ? list.map((item) => item.id === service.id ? service : item)
        : [...list, service]
    })
    setSearch('')
    setDialog(null)
    setMessage('Service saved.')
  }

  return (
    <div className="space-y-5 pb-6">
      <BackLink />
      <DataSourceNotice visible={isFallback} />
      <PageTitle eyebrow="Salon Configuration" title={`${category.name} services`} subtitle="Manage the services, prices, and durations in this category." />
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{category.name}</p>
          <Badge tone={enabled ? 'success' : 'warning'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        {!enabled && <p className="text-xs leading-5 text-muted">You can manage these services while the category is disabled. Enable the category to offer them for new bookings.</p>}
        <Link className="inline-flex min-h-9 items-center text-xs font-semibold text-primary" state={{ salonId: salonData.id, salonName: salonData.name, returnTo: '/app/settings' }} to="/onboarding/categories">Manage service categories</Link>
      </Card>

      {message && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success" role="status">{message}</p>}
      <Button fullWidth disabled={isFallback} leadingIcon={<Plus className="size-4" />} onClick={() => openDialog({ mode: 'create' })}>Add service</Button>
      <Input aria-label="Search services" leadingIcon={<Search className="size-4" />} onChange={(event) => setSearch(event.target.value)} placeholder="Search services" value={search} />

      <section aria-label="Configured services" className="space-y-3">
        <h2 className="text-sm font-semibold">Your services ({categoryServices.length})</h2>
        {visibleServices.length ? visibleServices.map((service) => (
          <article aria-label={service.name} className="rounded-lg border border-border bg-surface p-4 shadow-card" key={service.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 break-words text-sm font-semibold">{service.name}</h3>
              {!service.is_active && <Badge tone="warning">Inactive</Badge>}
            </div>
            {service.description && <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted">{service.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="font-semibold text-primary">{formatMoney(service.price_minor, service.currency_code || salonData.currency_code)}</span>
              <span className="inline-flex items-center gap-1 text-muted"><Clock3 className="size-3.5" />{service.duration_minutes} min</span>
              <span className="text-muted">{service.is_publicly_bookable ? 'Public booking' : 'Internal only'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2">
              <Button aria-label={`View ${service.name}`} leadingIcon={<Eye className="size-3.5" />} onClick={() => openDialog({ mode: 'view', service })} size="sm" variant="ghost">View</Button>
              <Button aria-label={`Edit ${service.name}`} disabled={isFallback} leadingIcon={<Pencil className="size-3.5" />} onClick={() => openDialog({ mode: 'edit', service })} size="sm" variant="ghost">Edit</Button>
              <Button aria-label={`Delete ${service.name}`} className="text-danger" disabled={isFallback} leadingIcon={<Trash2 className="size-3.5" />} onClick={() => openDialog({ mode: 'delete', service })} size="sm" variant="ghost">Delete</Button>
            </div>
          </article>
        )) : <EmptyState title={query ? 'No matching services' : 'No services yet'} description={query ? 'Try another search or add a service.' : 'Choose a suggestion below or add your own service.'} />}
      </section>

      {suggestions.length > 0 && (
        <section aria-label="Suggested services" className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Suggested services</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Start with a suggestion and set your own price and duration.</p>
          </div>
          <Card padding="none">
            {suggestions.map((name) => (
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-b-0" key={name}>
                <span className="min-w-0 break-words text-xs font-medium">{name}</span>
                <Button aria-label={`Add ${name}`} className="shrink-0" disabled={isFallback} leadingIcon={<Plus className="size-3.5" />} onClick={() => openDialog({ mode: 'create', name })} size="sm" variant="ghost">Add</Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {category.code === 'nails' && <Link className="inline-flex min-h-11 items-center text-xs font-semibold text-primary" to="/app/settings/services/nails">Nail materials and provider settings</Link>}

      {dialog && (dialog.mode === 'create' || dialog.mode === 'edit') && (
        <ServiceEditorDialog category={category} currency={salonData.currency_code || 'USD'} initialName={dialog.mode === 'create' ? dialog.name : undefined} onClose={() => setDialog(null)} onSaved={saved} salonId={salonData.id} service={dialog.mode === 'edit' ? dialog.service : undefined} />
      )}
      {dialog?.mode === 'view' && (
        <ProviderDialog title="Service details" description={category.name} onClose={() => setDialog(null)} actions={<Button fullWidth disabled={isFallback} onClick={() => openDialog({ mode: 'edit', service: dialog.service })}>Edit service</Button>}>
          <ServiceDetails service={dialog.service} />
        </ProviderDialog>
      )}
      {dialog?.mode === 'delete' && (
        <DeleteServiceDialog onClose={() => setDialog(null)} onDeleted={() => {
          services.setData((current) => current?.filter((service) => service.id !== dialog.service.id))
          setDialog(null)
          setMessage('Service deleted. Existing appointments and history were kept.')
        }} salonId={salonData.id} service={dialog.service} />
      )}
    </div>
  )
}

function BackLink() {
  return <Link className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary" to="/app/settings"><ChevronLeft className="size-4" />Salon Configuration</Link>
}

function ServiceDetails({ service }: { service: Service }) {
  return (
    <div className="space-y-4">
      <h3 className="break-words text-base font-semibold">{service.name}</h3>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">{service.description || 'No description added.'}</p>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3"><dt>Price</dt><dd className="font-semibold">{formatMoney(service.price_minor, service.currency_code)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Duration</dt><dd>{service.duration_minutes} min</dd></div>
        <div className="flex justify-between gap-3"><dt>Status</dt><dd>{service.is_active ? 'Active' : 'Inactive'}</dd></div>
        <div className="flex justify-between gap-3"><dt>Public booking</dt><dd>{service.is_publicly_bookable ? 'Available' : 'Unavailable'}</dd></div>
      </dl>
    </div>
  )
}

function ServiceEditorDialog({ category, currency, initialName, onClose, onSaved, salonId, service }: {
  category: ServiceCategory
  currency: string
  initialName?: string
  onClose: () => void
  onSaved: (service: Service) => void
  salonId: string
  service?: Service
}) {
  const formId = useId()
  const [name, setName] = useState(service?.name ?? initialName ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [price, setPrice] = useState(service ? (service.price_minor / 100).toFixed(2) : '')
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60))
  const [isActive, setIsActive] = useState(service?.is_active ?? true)
  const [publicBooking, setPublicBooking] = useState(service?.is_publicly_bookable ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const currencyCode = service?.currency_code || currency
  const close = () => { if (!saving) onClose() }

  return (
    <ProviderDialog title={service ? 'Edit service' : 'Add service'} description={category.name} onClose={close} actions={
      <div className="flex gap-2">
        <Button className="flex-1" disabled={saving} onClick={close} variant="outline">Cancel</Button>
        <Button className="flex-1" form={formId} loading={saving} type="submit">{service ? 'Save service' : 'Create service'}</Button>
      </div>
    }>
      <form className="space-y-4" id={formId} onSubmit={async (event) => {
        event.preventDefault()
        if (saving) return
        const priceMinor = Math.round(Number(price) * 100)
        const durationMinutes = Number(duration)
        if (!name.trim() || !price.trim() || !Number.isSafeInteger(priceMinor) || priceMinor < 0 || priceMinor > 2147483647 || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 2147483647) {
          setError(new Error('Enter a service name, a valid price, and a duration in whole minutes.'))
          return
        }
        setSaving(true)
        setError(null)
        try {
          const input = { name: name.trim(), description: description.trim(), priceMinor, durationMinutes, currencyCode, isPubliclyBookable: publicBooking }
          const result = service
            ? await glamhourApi.updateService(service.id, { ...input, isActive }, salonId)
            : await glamhourApi.createServiceInSettings({ ...input, categoryId: category.id }, salonId)
          onSaved(result)
        } catch (reason) {
          setError(reason instanceof Error ? reason : new Error('Service could not be saved. Please try again.'))
        } finally {
          setSaving(false)
        }
      }}>
        <fieldset className="space-y-4" disabled={saving}>
          <Input label="Service name" maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} />
          <Textarea className="min-h-20" label="Description" maxLength={5000} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
          <Input label={`Price (${currencyCode})`} max="21474836.47" min="0" onChange={(event) => setPrice(event.target.value)} required step="0.01" type="number" value={price} />
          <Input label="Duration in minutes" max="2147483647" min="1" onChange={(event) => setDuration(event.target.value)} required step="1" type="number" value={duration} />
          {service && <label className="flex min-h-10 items-center gap-3 text-sm"><input checked={isActive} className="size-4 accent-primary" onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />Service is active</label>}
          <label className="flex min-h-10 items-center gap-3 text-sm"><input checked={publicBooking} className="size-4 accent-primary" onChange={(event) => setPublicBooking(event.target.checked)} type="checkbox" />Available for public booking</label>
        </fieldset>
        <div aria-live="polite"><MutationError error={error} /></div>
      </form>
    </ProviderDialog>
  )
}

function DeleteServiceDialog({ onClose, onDeleted, salonId, service }: { onClose: () => void; onDeleted: () => void; salonId: string; service: Service }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const close = () => { if (!deleting) onClose() }
  return (
    <ProviderDialog title="Delete service?" onClose={close} actions={
      <div className="flex gap-2">
        <Button className="flex-1" disabled={deleting} onClick={close} variant="outline">Cancel</Button>
        <Button className="flex-1" loading={deleting} onClick={async () => {
          if (deleting) return
          setDeleting(true)
          setError(null)
          try {
            await glamhourApi.deleteService(service.id, salonId)
            onDeleted()
          } catch (reason) {
            setError(reason instanceof Error ? reason : new Error('Service could not be deleted. Please try again.'))
          } finally {
            setDeleting(false)
          }
        }} variant="danger">Delete service</Button>
      </div>
    }>
      <p className="break-words text-sm leading-6">Delete <strong>{service.name}</strong> from this category? It will no longer be offered for new bookings. Existing appointments and service history will be kept.</p>
      <div aria-live="polite" className="mt-3"><MutationError error={error} /></div>
    </ProviderDialog>
  )
}
