import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { ChevronUp } from 'lucide-react'
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
import { isHandComplete } from './nailsFingerOptions'
import {
  buildMaterialSpecs,
  nailTypeRows,
  serviceTypeOptions,
} from './nailsDetailsSpec'

type PendingSelection =
  | { kind: 'service'; label: string }
  | { kind: 'nailType'; label: string }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeNailChoice(value: string) {
  return normalizeServiceName(value).replace(/[^a-z0-9]/g, '')
}

function requiresHandMap(serviceType: string) {
  const normalized = normalizeNailChoice(serviceType)
  return normalized === 'dualsystem' || normalized === 'presson'
}

export function NailsDetailsStep({ category, categorySource, services, selectedServiceId, details, onChange, onBack, onNext, onServiceCreated }: CategoryStepProps & { category: ServiceCategory }) {
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]
  const materialsQuery = useNailsServiceMaterials(selectedService?.id, selectedService?.category_id)
  const materialSpecs = useMemo(
    () => buildMaterialSpecs(materialsQuery.data),
    [materialsQuery.data],
  )
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [nailTypesExpanded, setNailTypesExpanded] = useState(true)
  const [materialsExpanded, setMaterialsExpanded] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState('')
  const serviceScrollerRef = useRef<HTMLDivElement | null>(null)
  const serviceDragRef = useRef({ dragging: false, moved: false, captured: false, startX: 0, scrollLeft: 0 })

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
    setDetails({
      ...details,
      nailType: label,
      customNailTypeName: label === 'Custom' ? '' : undefined,
    })
  }

  const updateCustomNailTypeName = (name: string) => {
    setDetails({
      ...details,
      nailType: 'Custom',
      customNailTypeName: name,
    })
  }

  const updateOtherMaterialName = (name: string) => {
    setDetails((current) => {
      const currentIds = new Set((current.materialIds as string[] | undefined) ?? [])
      const currentLabels = new Set((current.materialLabels as string[] | undefined) ?? (current.materials as string[] | undefined) ?? [])
      currentIds.add('other')
      currentLabels.add('Other')
      return {
        ...current,
        materialIds: [...currentIds],
        materialLabels: [...currentLabels],
        materials: [...currentLabels],
        otherMaterialName: name,
      }
    })
  }

  const selectedType = String(details.nailServiceType ?? '')
  const selectedNailType = String(details.nailType ?? '')
  const customNailTypeName = String(details.customNailTypeName ?? '').trim()
  const handMapRequired = requiresHandMap(selectedType)
  const handMapComplete = isHandComplete(details.rightHand as Record<string, Record<string, string>> | undefined)
    && isHandComplete(details.leftHand as Record<string, Record<string, string>> | undefined)
  const selectedMaterialIds = new Set((details.materialIds as string[] | undefined) ?? [])
  const selectedMaterialLabels = new Set((details.materialLabels as string[] | undefined) ?? (details.materials as string[] | undefined) ?? [])
  const materialsLoading = materialsQuery.loading
  const materialsError = materialsQuery.error

  const ensureSelectedService = async () => {
    if (selectedServiceId && services.some((service) => service.id === selectedServiceId)) return selectedServiceId
    if (services[0]) return services[0].id

    const categoryId = uuidPattern.test(category.id)
      ? category.id
      : categorySource?.find((item) => item.code === category.code)?.id
    const categoryCode = category.code || 'nails'
    if (!categoryId && !categoryCode) {
      throw new Error('Nails category is not available for this salon.')
    }

    const service = await glamhourApi.createService({
      categoryId,
      categoryCode,
      name: 'Nails service',
      description: 'Created from quick nails booking flow.',
      durationMinutes: 60,
      priceMinor: 0,
      isPubliclyBookable: true,
      assignToActiveProviders: true,
    })
    onServiceCreated?.(service)
    return service.id
  }

  const continueNailsFlow = async (requestedDetails = details) => {
    if (continuing) return
    const nextDetails = requestedDetails
    if (String(nextDetails.nailType ?? '') === 'Custom' && !String(nextDetails.customNailTypeName ?? '').trim()) {
      setContinueError('Add the custom nail type name.')
      return
    }
    if (requiresHandMap(String(nextDetails.nailServiceType ?? ''))) {
      const rightComplete = isHandComplete(nextDetails.rightHand as Record<string, Record<string, string>> | undefined)
      const leftComplete = isHandComplete(nextDetails.leftHand as Record<string, Record<string, string>> | undefined)
      if (!rightComplete || !leftComplete) {
        setContinueError('Complete hand sizes for Dual System or Press On before continuing.')
        return
      }
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

  const startServiceScrollDrag = (event: PointerEvent<HTMLDivElement>) => {
    const scroller = serviceScrollerRef.current
    if (!scroller) return
    serviceDragRef.current = {
      dragging: true,
      moved: false,
      captured: false,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
    }
  }

  const moveServiceScrollDrag = (event: PointerEvent<HTMLDivElement>) => {
    const scroller = serviceScrollerRef.current
    const drag = serviceDragRef.current
    if (!scroller || !drag.dragging) return
    const deltaX = event.clientX - drag.startX
    if (Math.abs(deltaX) > 10) {
      drag.moved = true
      if (!drag.captured) {
        scroller.setPointerCapture(event.pointerId)
        drag.captured = true
      }
    }
    if (!drag.moved) return
    scroller.scrollLeft = drag.scrollLeft - deltaX
  }

  const endServiceScrollDrag = (event: PointerEvent<HTMLDivElement>) => {
    const scroller = serviceScrollerRef.current
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId)
    }
    serviceDragRef.current.dragging = false
    window.setTimeout(() => {
      serviceDragRef.current.moved = false
      serviceDragRef.current.captured = false
    }, 0)
  }

  return (
    <RegistrationFlowShell activeCategory="nails" onBack={onBack}>
        <BookingSectionTitle>Type of service</BookingSectionTitle>
        <div
          className="-mx-4 min-w-0 max-w-[calc(100%+32px)] cursor-grab touch-pan-x select-none overflow-x-scroll overflow-y-hidden overscroll-x-contain px-4 pb-2 active:cursor-grabbing [-ms-overflow-style:auto] [scrollbar-width:thin]"
          onPointerCancel={endServiceScrollDrag}
          onPointerDown={startServiceScrollDrag}
          onPointerMove={moveServiceScrollDrag}
          onPointerUp={endServiceScrollDrag}
          ref={serviceScrollerRef}
        >
          <div className="flex w-max min-w-max gap-4">
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

        <button className="flex w-full items-center justify-between" onClick={() => setNailTypesExpanded((expanded) => !expanded)} type="button">
          <BookingSectionTitle>Type of nails</BookingSectionTitle>
          <ChevronUp className={cn('size-5 text-[#101828] transition-transform', !nailTypesExpanded && 'rotate-180')} />
        </button>
        {nailTypesExpanded && (
          <div className="flex w-full min-w-0 flex-col gap-3">
            {nailTypeRows.map((row) => (
              <div className="grid w-full min-w-0 grid-cols-2 gap-3" key={row.map((item) => item.label).join('-')}>
                {row.map((item) => (
                  item.label === 'Custom' && selectedNailType === 'Custom' ? (
                    <CustomNailTypeCard
                      imageSrc={item.imageSrc}
                      key={item.label}
                      onChange={updateCustomNailTypeName}
                      value={String(details.customNailTypeName ?? '')}
                    />
                  ) : (
                    <NailTypeCard
                      active={selectedNailType === item.label}
                      className={item.className}
                      imageSrc={item.imageSrc}
                      key={item.label}
                      label={item.label}
                      onClick={() => requestNailTypeChange(item.label)}
                      variant={item.variant}
                    />
                  )
                ))}
              </div>
            ))}
          </div>
        )}

        <button className="flex w-full items-center justify-between" onClick={() => setMaterialsExpanded((expanded) => !expanded)} type="button">
          <BookingSectionTitle>Materials</BookingSectionTitle>
          <ChevronUp className={cn('size-5 text-[#101828] transition-transform', !materialsExpanded && 'rotate-180')} />
        </button>
        {materialsExpanded && (
          <>
            {materialsLoading && (
              <p className="text-[12px] leading-[1.44] text-[#475467]">Loading materials...</p>
            )}
            {materialsError && (
              <p className="text-[12px] leading-[1.44] text-[#b42318]">
                Materials could not be loaded. Using salon defaults.
              </p>
            )}
            <div className="grid w-full min-w-0 grid-cols-2 gap-3">
              {materialSpecs.map((spec) => {
                const active = selectedMaterialIds.has(spec.id) || selectedMaterialLabels.has(spec.label)
                return (
                  spec.label === 'Other' && active ? (
                    <OtherMaterialCard
                      className={cn(spec.width, 'justify-self-stretch')}
                      key={spec.id}
                      onChange={updateOtherMaterialName}
                      value={String(details.otherMaterialName ?? '')}
                    />
                  ) : (
                    <MaterialCard
                      active={active}
                      className={cn(spec.width, 'justify-self-stretch')}
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
                )
              })}
            </div>
          </>
        )}

        {handMapRequired && <HandEditor details={details} onChange={setDetails} />}

        <RegistrationContinueSection
          canContinue={(!handMapRequired || handMapComplete) && (selectedNailType !== 'Custom' || Boolean(customNailTypeName))}
          disabledMessage={continueError
            || (selectedNailType === 'Custom' && !customNailTypeName ? 'Add the custom nail type name.' : undefined)
            || (handMapRequired && !handMapComplete ? 'Complete hand sizes for this service.' : undefined)}
          label={continuing ? 'Continuing...' : 'Continue'}
          onContinue={continueNailsFlow}
        />

        <UpdateServiceSelectionModal
          onApply={() => {
            if (!pendingSelection) return
            if (pendingSelection.kind === 'service') applyServiceType(pendingSelection.label)
            else setDetails({
              ...details,
              nailType: pendingSelection.label,
              customNailTypeName: pendingSelection.label === 'Custom' ? '' : undefined,
            })
            setPendingSelection(null)
          }}
          onKeep={() => setPendingSelection(null)}
          open={Boolean(pendingSelection)}
        />
    </RegistrationFlowShell>
  )
}

function CustomNailTypeCard({
  imageSrc,
  onChange,
  value,
}: {
  imageSrc: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="grid h-[64px] w-full min-w-0 grid-cols-[minmax(0,1fr)_86px] items-center gap-[8px] rounded-[10px] border border-solid border-[#7344cd] bg-[#ebe7ff] px-[12px] text-left">
      <input
        aria-label="Custom nail type"
        autoFocus
        className="min-w-0 bg-transparent text-[11px] font-normal leading-none tracking-normal text-black outline-none placeholder:text-[#667085]"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nail type"
        value={value}
      />
      <span className="flex h-[58px] w-[86px] shrink-0 items-center justify-center overflow-visible">
        <img alt="" className="h-[58px] w-[58px] object-contain object-center" src={imageSrc} />
      </span>
    </label>
  )
}

function OtherMaterialCard({
  className,
  onChange,
  value,
}: {
  className?: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className={cn(
      'flex h-[82px] min-h-[48px] shrink-0 items-center justify-center gap-[6px] rounded-[10px] border border-solid border-[#7344cd] bg-[#ebe7ff] px-[10px] py-[8px]',
      className,
    )}>
      <input
        aria-label="Other material name"
        autoFocus
        className="min-w-0 bg-transparent text-center text-[12px] font-normal leading-none tracking-normal text-black outline-none placeholder:text-[#667085]"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Other"
        value={value}
      />
    </label>
  )
}
