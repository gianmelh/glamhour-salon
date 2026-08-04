import { useMemo, useState } from 'react'
import { cn } from '../../../../../lib/cn'
import { useNailsServiceMaterials } from '../../../../../hooks/useServiceMaterials'
import { hasNailsDownstreamSelections } from '../../../nails-booking/nailsDetailsTypes'
import { normalizeServiceName } from '../../constants'
import { glamhourApi } from '../../../../../services/glamhour-api'
import {
  BookingSectionTitle,
  MaterialCard,
  NailTypeCard,
  ServiceTypeCard,
} from '../../components/shared'
import {
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import { UpdateServiceSelectionModal } from '../../components/UpdateServiceSelectionModal'
import type { CategoryStepProps } from '../../types'
import type { ServiceCategory } from '../../../../../types/api'
import { HandEditor } from './HandEditor'
import { getNailsDetailsMissingItems } from './nailsFingerOptions'
import {
  buildMaterialSpecs,
  nailTypeRows,
  serviceTypeOptions,
} from './nailsDetailsSpec'

type PendingSelection =
  | { kind: 'service'; label: string }
  | { kind: 'nailType'; label: string }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function NailsDetailsStep({ category, categorySource, services, selectedServiceId, details, onChange, onBack, onNext, onServiceCreated }: CategoryStepProps & { category: ServiceCategory }) {
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]
  const materialsQuery = useNailsServiceMaterials(selectedService?.id, selectedService?.category_id)
  const materialSpecs = useMemo(
    () => buildMaterialSpecs(materialsQuery.data),
    [materialsQuery.data],
  )
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState('')

  const setDetails = (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => {
    onChange({ details: next })
  }

  const applyServiceType = (label: string) => {
    const match = services.find((service) => normalizeServiceName(service.name).includes(normalizeServiceName(label)))
    onChange({
      serviceId: match?.id ?? '',
      details: { ...details, nailServiceType: label },
    })
  }

  const requestServiceTypeChange = (label: string) => {
    const current = String(details.nailServiceType ?? '')
    if (current && current !== label && hasNailsDownstreamSelections(details)) {
      setPendingSelection({ kind: 'service', label })
      return
    }
    applyServiceType(label)
  }

  const requestNailTypeChange = (label: string) => {
    const current = String(details.nailType ?? '')
    if (current && current !== label && hasNailsDownstreamSelections(details)) {
      setPendingSelection({ kind: 'nailType', label })
      return
    }
    setDetails({ ...details, nailType: label })
  }

  const selectedType = String(details.nailServiceType ?? '')
  const selectedNailType = String(details.nailType ?? '')
  const selectedMaterialIds = new Set((details.materialIds as string[] | undefined) ?? [])
  const selectedMaterialLabels = new Set((details.materialLabels as string[] | undefined) ?? (details.materials as string[] | undefined) ?? [])
  const otherMaterialSelected = selectedMaterialIds.has('other') || selectedMaterialLabels.has('Other')
  const missingItems = getNailsDetailsMissingItems(details)
  const materialsLoading = materialsQuery.loading
  const materialsError = materialsQuery.error
  const canContinue = missingItems.length === 0

  const ensureSelectedService = async () => {
    const serviceType = String(details.nailServiceType ?? selectedType)
    const selectedServiceMatchesType = selectedServiceId
      && serviceType
      && services.some((service) => (
        service.id === selectedServiceId
        && normalizeServiceName(service.name).includes(normalizeServiceName(serviceType))
    ))
    if (selectedServiceMatchesType) return selectedServiceId

    const matchingService = services.find((service) => (
      serviceType
      && service.is_active
      && normalizeServiceName(service.name).includes(normalizeServiceName(serviceType))
    ))
    if (matchingService) return matchingService.id

    if (selectedServiceId) return selectedServiceId
    if (services[0]) return services[0].id

    const categoryId = uuidPattern.test(category.id)
      ? category.id
      : categorySource?.find((item) => item.code === category.code)?.id
    if (!categoryId) {
      throw new Error('Nails category is not available for this salon.')
    }

    const service = await glamhourApi.createService({
      categoryId,
      name: serviceType || 'Nails service',
      description: 'Created from nails booking flow.',
      durationMinutes: 60,
      priceMinor: 0,
      isPubliclyBookable: true,
    })
    onServiceCreated?.(service)
    return service.id
  }

  const continueNailsFlow = async (requestedDetails = details) => {
    if (continuing) return
    const nextDetails = requestedDetails
    const nextMissingItems = getNailsDetailsMissingItems(nextDetails)
    if (nextMissingItems.length > 0) {
      setContinueError(`To continue, complete: ${nextMissingItems.join(' · ')}`)
      return
    }

    setContinuing(true)
    setContinueError('')
    try {
      const serviceId = await ensureSelectedService()
      onNext({ serviceId, details: nextDetails })
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : 'Could not continue.')
    } finally {
      setContinuing(false)
    }
  }

  return (
    <RegistrationFlowShell activeCategory="nails" onBack={onBack}>
        <BookingSectionTitle>Type of service</BookingSectionTitle>
        <div className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-4">
            {serviceTypeOptions.map((option) => (
              <ServiceTypeCard
                active={selectedType === option.label}
                imageSrc={option.imageSrc}
                key={option.label}
                label={option.label}
                onClick={() => requestServiceTypeChange(option.label)}
                variant={option.variant}
              />
            ))}
          </div>
        </div>

        <BookingSectionTitle>Type of nails</BookingSectionTitle>
        <div className="flex w-full min-w-0 flex-col gap-3">
          {nailTypeRows.map((row) => (
            <div className="grid w-full min-w-0 grid-cols-2 gap-3" key={row.map((item) => item.label).join('-')}>
              {row.map((item) => (
                <NailTypeCard
                  active={selectedNailType === item.label}
                  className={item.className}
                  imageSrc={item.imageSrc}
                  key={item.label}
                  label={item.label}
                  onClick={() => requestNailTypeChange(item.label)}
                  variant={item.variant}
                />
              ))}
            </div>
          ))}
        </div>

        <BookingSectionTitle>Materials</BookingSectionTitle>
        {materialsLoading && (
          <p className="text-[12px] leading-[1.44] text-[#475467]">Loading materials…</p>
        )}
        {materialsError && (
          <p className="text-[12px] leading-[1.44] text-[#b42318]">
            Materials could not be loaded. Using salon defaults.
          </p>
        )}
        <div className="grid w-full min-w-0 grid-cols-2 gap-3">
          {materialSpecs.map((spec) => {
            const active = selectedMaterialIds.has(spec.id) || selectedMaterialLabels.has(spec.label)
            const colClass = spec.col === 1 ? 'col-start-1' : 'col-start-2'
            const rowClass = spec.row === 1 ? 'row-start-1' : spec.row === 2 ? 'row-start-2' : 'row-start-3'
            return (
              <MaterialCard
                active={active}
                className={cn(
                  colClass,
                  rowClass,
                  spec.label === 'Other' ? 'col-span-2' : 'justify-self-stretch',
                )}
                imageCrop={spec.imageCrop}
                imageFrame={spec.imageFrame}
                imageSrc={spec.imageSrc}
                key={spec.id}
                label={spec.label}
                onClick={() => {
                  setDetails((current) => {
                    const currentIds = new Set((current.materialIds as string[] | undefined) ?? [])
                    const currentLabels = new Set((current.materialLabels as string[] | undefined) ?? (current.materials as string[] | undefined) ?? [])
                    const selected = currentIds.has(spec.id) || currentLabels.has(spec.label)

                    if (selected) {
                      currentIds.delete(spec.id)
                      currentLabels.delete(spec.label)
                    } else {
                      currentIds.add(spec.id)
                      currentLabels.add(spec.label)
                    }

                    return {
                      ...current,
                      materialIds: [...currentIds],
                      materialLabels: [...currentLabels],
                      materials: [...currentLabels],
                      otherMaterialName: currentLabels.has('Other') ? current.otherMaterialName : '',
                    }
                  })
                }}
              />
            )
          })}
        </div>
        {otherMaterialSelected && (
          <label className="grid w-full min-w-0 gap-2 text-[13px] font-medium text-[#101828]">
            Other product used
            <input
              className="min-h-[48px] rounded-[12px] border border-[#d0d5dd] bg-white px-3 text-[15px] text-[#101828] outline-none placeholder:text-[#98a2b3]"
              placeholder="Write product name"
              value={String(details.otherMaterialName ?? '')}
              onChange={(event) => setDetails({ ...details, otherMaterialName: event.target.value })}
            />
          </label>
        )}

        <HandEditor details={details} onChange={setDetails} />

        <RegistrationContinueSection
          canContinue={canContinue}
          disabledMessage={continueError || (missingItems.length ? `To continue, complete: ${missingItems.join(' · ')}` : undefined)}
          label={continuing ? 'Continuing...' : 'Continue'}
          onContinue={continueNailsFlow}
        />

        <UpdateServiceSelectionModal
          onApply={() => {
            if (!pendingSelection) return
            if (pendingSelection.kind === 'service') applyServiceType(pendingSelection.label)
            else setDetails({ ...details, nailType: pendingSelection.label })
            setPendingSelection(null)
          }}
          onKeep={() => setPendingSelection(null)}
          open={Boolean(pendingSelection)}
        />
    </RegistrationFlowShell>
  )
}
