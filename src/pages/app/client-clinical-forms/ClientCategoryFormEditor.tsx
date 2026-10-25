import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { Client, Service, ServiceCategory } from '../../../types/api'
import { CategoryServiceStep } from '../appointment-booking/CategoryServiceStep'
import { mergeDetailsPatchForCategory } from '../appointment-booking/categoryDetails'
import { categoryNames } from '../appointment-booking/constants'
import {
  cosmetologyServiceDisplayName,
  cosmetologyServiceSlug,
  cosmetologyServiceTypes,
  matchCosmetologyService,
  normalizeCosmetologyHistoryLabel,
} from '../appointment-booking/categories/cosmetology/cosmetologyDetailsSpec'
import {
  matchMicropigmentationService,
  micropigmentationProcedureGroups,
  micropigmentationServiceDefaults,
  normalizeMicropigmentationHistoryLabel,
} from '../appointment-booking/categories/micropigmentation/micropigmentationDetailsSpec'
import type { BookingCategoryCode, DraftPatch } from '../appointment-booking/types'
import { clinicalFormSubmission } from './clinicalFormDetails'

type Props = {
  category: BookingCategoryCode
  serviceCategory?: ServiceCategory
  client: Client
  details: Record<string, unknown>
  onChange: (details: Record<string, unknown>) => void
  onSubmit: (details: Record<string, unknown>) => void | Promise<void>
  onBack: () => void
}

const localTimestamp = '1970-01-01T00:00:00.000Z'

function editorServices(category: BookingCategoryCode, metadata: ServiceCategory, client: Client, details: Record<string, unknown>): Service[] {
  const makeService = (name: string, index: number, slug?: string): Service => ({
    // Nails requests category materials. An empty service id deliberately omits
    // the service filter; the nonempty local catalogue still prevents creation.
    id: category === 'nails' ? '' : `clinical-form-${category}-${index}`,
    salon_id: client.salon_id,
    category_id: metadata.id,
    category_code: category,
    category_name: metadata.name,
    name,
    slug: slug ?? null,
    description: null,
    form_template_id: null,
    duration_minutes: 60,
    price_minor: 0,
    currency_code: 'USD',
    is_active: true,
    is_publicly_bookable: false,
    sort_order: index,
    created_at: localTimestamp,
    updated_at: localTimestamp,
  })

  if (category === 'cosmetology') {
    const types = new Set<string>(cosmetologyServiceTypes)
    if (typeof details.serviceType === 'string' && details.serviceType.trim()) types.add(normalizeCosmetologyHistoryLabel(details.serviceType))
    return [...types].map((type, index) => makeService(cosmetologyServiceDisplayName(type), index, cosmetologyServiceSlug(type)))
  }
  if (category === 'micropigmentation') {
    const procedures = new Set<string>(Object.values(micropigmentationProcedureGroups).flat())
    const saved = [details.procedure, ...(Array.isArray(details.procedures) ? details.procedures : [])]
    for (const procedure of saved) {
      if (typeof procedure === 'string' && procedure.trim()) procedures.add(normalizeMicropigmentationHistoryLabel(procedure))
    }
    return [...procedures].map((procedure, index) => {
      const defaults = micropigmentationServiceDefaults(procedure)
      return makeService(defaults.name, index, defaults.slug)
    })
  }
  return [makeService(`${metadata.name} clinical form`, 0)]
}

/** Reuse the original category forms with a local catalogue, without bookings. */
export function ClientCategoryFormEditor({ category, serviceCategory, client, details, onChange, onSubmit, onBack }: Props) {
  const metadata = useMemo<ServiceCategory>(() => serviceCategory ?? ({
    id: '', code: category, name: categoryNames[category], description: null, icon_key: null,
    sort_order: 0, is_active: true, created_at: localTimestamp, updated_at: localTimestamp,
  }), [category, serviceCategory])
  // Include historical custom labels as well as every selectable option so the
  // category forms always resolve locally, including disabled catalog entries.
  const services = useMemo(() => editorServices(category, metadata, client, details), [category, metadata, client, details])
  const selectedService = category === 'cosmetology'
    ? matchCosmetologyService(services, String(details.serviceType ?? ''))
    : category === 'micropigmentation'
      ? matchMicropigmentationService(services, String(details.procedure ?? (Array.isArray(details.procedures) ? details.procedures[0] : '') ?? ''))
      : services[0]
  const latest = useRef({ category, details, onChange, onSubmit })
  useLayoutEffect(() => {
    latest.current = { category, details, onChange, onSubmit }
  }, [category, details, onChange, onSubmit])

  const applyPatch = useCallback((patch: DraftPatch) => {
    const current = latest.current
    // Some existing Continue handlers pass their click event as the optional
    // details argument. Only plain data patches may enter a client record.
    if (patch.details && typeof patch.details !== 'function' && Object.getPrototypeOf(patch.details) !== Object.prototype) return current.details
    const next = typeof patch.details === 'function'
      ? patch.details(current.details)
      : mergeDetailsPatchForCategory(current.category, current.details, patch.details ?? {})
    return next
  }, [])
  const changeDetails = useCallback((patch: DraftPatch) => {
    if (!patch.details) return
    const next = applyPatch(patch)
    latest.current.details = next
    latest.current.onChange(next)
  }, [applyPatch])
  const submitDetails = useCallback(async (patch: DraftPatch = {}) => {
    const next = clinicalFormSubmission(applyPatch(patch))
    await latest.current.onSubmit(next)
  }, [applyPatch])

  return (
    <div className="-mx-5">
    <CategoryServiceStep
      category={metadata}
      categorySource={[metadata]}
      details={details}
      onBack={onBack}
      onChange={changeDetails}
      onNext={submitDetails}
      selectedServiceId={selectedService?.id ?? services[0].id}
      services={services}
    />
    </div>
  )
}
