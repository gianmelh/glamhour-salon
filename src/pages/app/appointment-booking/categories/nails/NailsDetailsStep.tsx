import { useMemo } from 'react'
import { Button } from '../../../../../components'
import { cn } from '../../../../../lib/cn'
import { useNailsServiceMaterials } from '../../../../../hooks/useServiceMaterials'
import { nailsBookingAssets } from '../../../nails-booking/assets'
import { normalizeServiceName } from '../../constants'
import {
  BookingSectionTitle,
  CategoryTab,
  MaterialCard,
  NailTypeCard,
  NailsStepHeader,
  ServiceTypeCard,
} from '../../components/shared'
import type { CategoryStepProps } from '../../types'
import { HandEditor } from './HandEditor'
import { getNailsDetailsMissingItems } from './nailsFingerOptions'
import {
  buildMaterialSpecs,
  materialGridLayout,
  nailTypeRows,
  nailsDetailsLayout,
  serviceTypeOptions,
} from './nailsDetailsSpec'

export function NailsDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]
  const materialsQuery = useNailsServiceMaterials(selectedService?.id, selectedService?.category_id)
  const materialSpecs = useMemo(
    () => buildMaterialSpecs(materialsQuery.data),
    [materialsQuery.data],
  )

  const setDetails = (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => {
    onChange({ details: next })
  }

  const chooseService = (label: string) => {
    const match = services.find((service) => normalizeServiceName(service.name).includes(normalizeServiceName(label)))
      ?? services.find((service) => service.is_active)
    onChange({
      serviceId: match?.id ?? selectedServiceId,
      details: { ...details, nailServiceType: label },
    })
  }

  const selectedType = String(details.nailServiceType ?? '')
  const selectedNailType = String(details.nailType ?? '')
  const selectedMaterialIds = new Set((details.materialIds as string[] | undefined) ?? [])
  const selectedMaterialLabels = new Set((details.materialLabels as string[] | undefined) ?? (details.materials as string[] | undefined) ?? [])
  const missingItems = getNailsDetailsMissingItems(details)
  const canContinue = missingItems.length === 0 && Boolean(selectedServiceId || services[0])

  return (
    <div
      className="mx-auto w-full bg-[#f2f5ff]"
      style={{ maxWidth: nailsDetailsLayout.pageMaxWidth }}
    >
      <div
        className="flex flex-col pb-28"
        style={{
          gap: nailsDetailsLayout.sectionGap,
          paddingInline: nailsDetailsLayout.paddingX,
          paddingTop: nailsDetailsLayout.paddingTop,
        }}
      >
        <NailsStepHeader onBack={onBack} title="Details of service">
          <div className="flex gap-[16px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryTab active icon={nailsBookingAssets.categories.nails}>Nails</CategoryTab>
            <CategoryTab icon={nailsBookingAssets.categories.lashes}>Lashes</CategoryTab>
            <CategoryTab icon={nailsBookingAssets.categories.cosmetology}>cosmetology</CategoryTab>
            <CategoryTab icon={nailsBookingAssets.categories.micropigmentation}>Micropigmentation</CategoryTab>
          </div>
        </NailsStepHeader>

        <BookingSectionTitle>Type of service</BookingSectionTitle>
        <div className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-[16px]">
            {serviceTypeOptions.map((option) => (
              <ServiceTypeCard
                active={selectedType === option.label}
                imageSrc={option.imageSrc}
                key={option.label}
                label={option.label}
                onClick={() => chooseService(option.label)}
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
                  onClick={() => setDetails({ ...details, nailType: item.label })}
                  variant={item.variant}
                />
              ))}
            </div>
          ))}
        </div>

        <BookingSectionTitle>Materials</BookingSectionTitle>
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

        <HandEditor details={details} onChange={setDetails} />

        <div className="flex flex-col items-center py-[32px]">
          {!canContinue && missingItems.length > 0 && (
            <p className="mb-3 px-2 text-center text-[12px] leading-[1.44] text-[#475467]">
              To continue, complete: {missingItems.join(' · ')}
            </p>
          )}
          <Button
            className={cn(
              'min-h-0 rounded-[16px] p-[16px] text-[18px] font-medium leading-[28px]',
              'drop-shadow-[0px_16px_8px_rgba(0,0,0,0.09),0px_4px_4.5px_rgba(0,0,0,0.1)]',
              !canContinue && 'bg-[#dcdcdc] text-[#475467] shadow-none hover:brightness-100',
            )}
            disabled={!canContinue}
            fullWidth
            onClick={() => {
              if (!selectedServiceId && services[0]) onChange({ serviceId: services[0].id, details })
              onNext()
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
