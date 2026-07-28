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
import type { CategoryStepProps, HandName } from '../../types'
import type { ServiceCategory } from '../../../../../types/api'
import { HandEditor } from './HandEditor'
import { getNailsDetailsMissingItems, hasHandMeasurement, isHandComplete } from './nailsFingerOptions'
import {
  buildMaterialSpecs,
  materialGridLayout,
  nailTypeRows,
  nailsDetailsLayout,
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
      ?? services.find((service) => service.is_active)
    onChange({
      serviceId: match?.id ?? selectedServiceId,
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
  const missingItems = getNailsDetailsMissingItems(details)
  const materialsLoading = materialsQuery.loading
  const materialsError = materialsQuery.error
  const canContinue = missingItems.length === 0

  const ensureSelectedService = async () => {
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
      name: selectedType || 'Nails service',
      description: 'Created from nails booking flow.',
      durationMinutes: 60,
      priceMinor: 0,
      isPubliclyBookable: true,
    })
    onServiceCreated?.(service)
    return service.id
  }

  const continueNailsFlow = async (nextDetails = details) => {
    if (continuing) return
    const nextMissingItems = getNailsDetailsMissingItems(nextDetails)
    const nextActiveHand = (nextDetails.activeHand as HandName | undefined) ?? 'rightHand'
    const nextRightHand = nextDetails.rightHand as Record<string, Record<string, string>> | undefined
    const nextLeftHand = nextDetails.leftHand as Record<string, Record<string, string>> | undefined
    const nextUsesFingerMode = nextDetails.handMode === 'finger'
    const nextRightHandComplete = isHandComplete(nextRightHand)
    const nextLeftHandStarted = hasHandMeasurement(nextLeftHand)

    if (nextUsesFingerMode && nextActiveHand === 'rightHand' && nextRightHandComplete && !nextLeftHandStarted) {
      setDetails((current) => ({ ...current, activeHand: 'leftHand', activeFinger: 'thumb', handMode: 'finger' }))
      queueMicrotask(() => document.querySelector('main')?.scrollTo({ top: 0 }))
      return
    }
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
          <div className="flex gap-[16px]">
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
        <div
          className="flex max-w-full flex-col gap-[16px]"
          style={{ width: nailsDetailsLayout.contentMaxWidth }}
        >
          {nailTypeRows.map((row) => (
            <div className="flex w-full gap-[16px]" key={row.map((item) => item.label).join('-')}>
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
        <div
          className="grid max-w-full grid-cols-2 grid-rows-2"
          style={{
            gap: `${materialGridLayout.gapY}px ${materialGridLayout.gapX}px`,
            height: materialGridLayout.height,
            width: materialGridLayout.width,
          }}
        >
          {materialSpecs.map((spec) => {
            const active = selectedMaterialIds.has(spec.id) || selectedMaterialLabels.has(spec.label)
            const colClass = spec.col === 1 ? 'col-start-1' : 'col-start-2'
            const rowClass = spec.row === 1 ? 'row-start-1' : 'row-start-2'
            return (
              <MaterialCard
                active={active}
                className={cn(
                  colClass,
                  rowClass,
                  spec.row === 1 ? 'justify-self-stretch' : spec.width,
                )}
                imageCrop={spec.imageCrop}
                imageFrame={spec.imageFrame}
                imageSrc={spec.imageSrc}
                key={spec.id}
                label={spec.label}
                onClick={() => {
                  const nextIds = new Set(selectedMaterialIds)
                  const nextLabels = new Set(selectedMaterialLabels)
                  if (nextIds.has(spec.id)) {
                    nextIds.delete(spec.id)
                    nextLabels.delete(spec.label)
                  } else {
                    nextIds.add(spec.id)
                    nextLabels.add(spec.label)
                  }
                  setDetails({
                    ...details,
                    materialIds: [...nextIds],
                    materialLabels: [...nextLabels],
                    materials: [...nextLabels],
                  })
                }}
              />
            )
          })}
        </div>

        <HandEditor details={details} onChange={setDetails} onComplete={continueNailsFlow} />

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
