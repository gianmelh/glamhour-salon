import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../../../lib/cn'
import type { ServiceCategory } from '../../../../../types/api'
import { glamhourApi } from '../../../../../services/glamhour-api'
import { cosmetologyBookingAssets } from '../../assets'
import {
  BookingSectionTitle,
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import type { CategoryStepProps } from '../../types'
import { formatBirthDateInput } from '../../dateMask'
import {
  cosmetologyAlcoholOptions,
  cosmetologyAlterationGroups,
  cosmetologyDermapenNeedles,
  cosmetologyFinalMaskOptions,
  cosmetologyHealthHistoryGroups,
  cosmetologyHighFrequencyModes,
  cosmetologyLedColors,
  cosmetologyOzoneSteamModes,
  cosmetologyPhototypes,
  cosmetologyRadiofrequencyModes,
  cosmetologyReactionOptions,
  cosmetologyRecommendationBlocks,
  cosmetologyServiceDisplayName,
  cosmetologyServiceMatchError,
  cosmetologyServiceSlug,
  cosmetologyServiceTypes,
  cosmetologySkinTypes,
  cosmetologyUltrasonicModes,
  getCosmetologyDetailsMissingItems,
  matchCosmetologyService,
  normalizeCosmetologyHistoryLabel,
  resolveCosmetologyServiceId,
  yesNoOptions,
} from './cosmetologyDetailsSpec'
import { FaceMapEditor } from './FaceMapEditor'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function optionalUuid(value: string) {
  return uuidPattern.test(value) ? value : undefined
}

function FormCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-[20px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-6">
      {title && <BookingSectionTitle>{title}</BookingSectionTitle>}
      {children}
    </section>
  )
}

function FormSubtitle({ children }: { children: ReactNode }) {
  return <p className="text-[16px] font-normal leading-6 text-black">{children}</p>
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <p className="text-[21px] font-bold leading-[31.5px] tracking-[-0.42px] text-[#0a0a0a]">{children}</p>
}

function TextField({
  label,
  onChange,
  placeholder,
  suffix,
  type = 'text',
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  suffix?: string
  type?: string
  value: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[16px] leading-[1.4] text-black">{label}</span>
      <span className="flex min-h-12 items-center gap-2 rounded-[16px] border border-[#d0d5dd] bg-white px-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-[#101828] outline-none placeholder:text-[#667085]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {suffix && <span className="shrink-0 text-[16px] text-black">{suffix}</span>}
      </span>
    </label>
  )
}

function TextAreaField({
  label,
  onChange,
  placeholder,
  value,
  minHeightClass = 'min-h-[139px]',
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
  minHeightClass?: string
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] tracking-[-0.28px] text-[#666]">{label}</span>
      <textarea
        className={cn(
          'rounded-[12px] border border-[#d0d5dd] bg-[#fcfcfd] p-[14px] text-[15px] leading-[22.5px] tracking-[-0.3px] text-[#101828] outline-none placeholder:text-[#999]',
          minHeightClass,
        )}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

function RadioRow({
  label,
  onChange,
  options,
  value,
  vertical,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
  value: string
  vertical?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] text-[#666]">{label}</span>
      <div className={cn(vertical ? 'flex flex-col gap-4' : 'flex flex-wrap gap-4')}>
        {options.map((option) => (
          <button
            className="inline-flex items-center gap-2 text-left"
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border border-[#7a48db]',
                value === option ? 'bg-[#7a48db]/10' : 'bg-transparent',
              )}
            >
              {value === option && <span className="size-2 rounded-full bg-[#7a48db]" />}
            </span>
            <span className="text-[16px] font-medium leading-6 text-[#0a0a0a]">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckboxGroup({
  label,
  options,
  value,
  onChange,
}: {
  label?: string
  options: readonly string[]
  value?: string[]
  onChange: (value: string[]) => void
}) {
  const selected = new Set((value ?? []).map(normalizeCosmetologyHistoryLabel))
  return (
    <div className="space-y-2">
      {label && <FormSubtitle>{label}</FormSubtitle>}
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const checked = selected.has(option)
          return (
            <label className="flex min-h-[28px] cursor-pointer items-center gap-2" key={option}>
              <input
                checked={checked}
                className="size-4 shrink-0 rounded border-[#d0d5dd] accent-[#7344cd]"
                onChange={() => {
                  const next = new Set(selected)
                  if (next.has(option)) next.delete(option)
                  else next.add(option)
                  onChange([...next])
                }}
                type="checkbox"
              />
              <span className="text-[12px] leading-[1.4] tracking-[0.24px] text-[#0a0a0a]">{option}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function PhototypeRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] text-[#666]">Skin phototype</span>
      <div className="flex items-start justify-between gap-1">
        {cosmetologyPhototypes.map((option) => {
          const image = cosmetologyBookingAssets.phototypeSwatches[option.value]
          const active = value === option.value
          return (
            <button
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full border border-[#7a48db]',
                  active ? 'bg-[#7a48db]/10' : 'bg-transparent',
                )}
              >
                {active && <span className="size-2 rounded-full bg-[#7a48db]" />}
              </span>
              <img alt="" className="size-6 object-contain" src={image} />
              <span className="text-center text-[12px] leading-[1.4] tracking-[0.24px] text-[#0c111d]">
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FaceMapPreview({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] text-[#666]">Mark what is detected</span>
      <button
        className="flex min-h-[73px] w-full items-center justify-between gap-3 rounded-[16px] border-[1.35px] border-[#d0d5dd] bg-[#fcfcfd] px-[17px] text-left"
        onClick={onClick}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <img
            alt=""
            className="h-12 w-10 shrink-0 object-contain"
            src={cosmetologyBookingAssets.faceDiagram}
          />
          <span className="min-w-0">
            <span className="block truncate text-[16px] leading-6 tracking-[-0.32px] text-[#101828]">
              Face mapping preview
            </span>
            <span className="block text-[11px] leading-[16.5px] tracking-[-0.32px] text-[#667085]">
              {count
                ? `${count} mark${count === 1 ? '' : 's'} added`
                : 'Mark the client alterations in a visual way'}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[#98a2b3]" />
      </button>
    </div>
  )
}

function ServiceTypeCards({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[28px] font-bold leading-[1.2] text-black">Service type</p>
      <p className="text-[21px] font-bold leading-[1.2] text-black">Face</p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cosmetologyServiceTypes.map((option) => (
          <button
            className={cn(
              'flex h-[82px] w-[110px] shrink-0 items-center justify-center rounded-[16px] border px-4 text-center text-[16px] leading-[1.44] tracking-[-0.32px] text-black',
              value === option ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
            )}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function EquipmentBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-4">
      <FormSubtitle>{title}</FormSubtitle>
      {children}
    </div>
  )
}

export function CosmetologyDetailsStep({
  services,
  selectedServiceId,
  details,
  onChange,
  onBack,
  onNext,
  onServiceCreated,
  category,
}: CategoryStepProps & { category: ServiceCategory }) {
  const [stage, setStage] = useState<'form' | 'face-map' | 'treatment'>('form')
  const [serviceError, setServiceError] = useState('')
  const [serviceCreating, setServiceCreating] = useState(false)
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })
  const missingItems = getCosmetologyDetailsMissingItems(details)
  const selectedHealthHistory = ((details.healthHistory as string[] | undefined) ?? [])
    .map(normalizeCosmetologyHistoryLabel)
  const selectedAlterations = ((details.alterations as string[] | undefined) ?? [])
    .map(normalizeCosmetologyHistoryLabel)
  const faceAnnotationCount = ((details.faceAnnotations as unknown[] | undefined) ?? []).length
  const serviceType = normalizeCosmetologyHistoryLabel(String(details.serviceType ?? ''))
  const canContinue = Boolean(serviceType) && missingItems.length === 0 && !serviceCreating

  const selectServiceType = (nextType: string) => {
    const normalizedType = normalizeCosmetologyHistoryLabel(nextType)
    const matched = matchCosmetologyService(services, normalizedType)
    const bookableId = matched && matched.is_active !== false ? matched.id : ''

    // Exact type→active service only. Missing matches are created when the form is submitted.
    if (bookableId) {
      setServiceError('')
      onChange({
        serviceId: bookableId,
        details: { ...details, serviceType: normalizedType },
      })
      return
    }

    setServiceError('')
    onChange({
      serviceId: '',
      details: { ...details, serviceType: normalizedType },
    })
  }

  const resolveOrCreateServiceId = async () => {
    if (!serviceType) return ''
    const serviceId = resolveCosmetologyServiceId(services, serviceType, selectedServiceId)
    if (serviceId) return serviceId

    setServiceCreating(true)
    try {
      const service = await glamhourApi.ensureService({
        categoryId: optionalUuid(category.id),
        categoryCode: 'cosmetology',
        slug: cosmetologyServiceSlug(serviceType),
        name: cosmetologyServiceDisplayName(serviceType),
        description: `${serviceType} cosmetology service created from booking flow.`,
        durationMinutes: 60,
        priceMinor: 0,
        assignToActiveProviders: true,
      })
      onServiceCreated?.(service)
      setServiceError('')
      return service.id
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : cosmetologyServiceMatchError(serviceType)
      setServiceError(message)
      return ''
    } finally {
      setServiceCreating(false)
    }
  }

  const finishWithResolvedService = async () => {
    if (!serviceType) return
    const serviceId = await resolveOrCreateServiceId()
    if (!serviceId) return
    setServiceError('')
    onNext({ serviceId, details: { ...details, serviceType } })
  }

  if (stage === 'face-map') {
    return (
      <RegistrationFlowShell
        activeCategory="cosmetology"
        maxWidth={393}
        onBack={() => setStage('form')}
        title="Mark what is detected"
      >
        <div className="mx-auto w-full max-w-[393px]">
          <FaceMapEditor
            details={details}
            onChange={(next) => onChange({ details: next })}
            onSave={() => setStage('treatment')}
          />
        </div>
      </RegistrationFlowShell>
    )
  }

  if (stage === 'treatment') {
    return (
      <RegistrationFlowShell
        activeCategory="cosmetology"
        maxWidth={393}
        onBack={() => setStage('form')}
        title="Treatment and equipment"
      >
        <div className="mx-auto flex w-full max-w-[393px] flex-col gap-5">
          <p className="text-[16px] leading-[1.4] text-[#475467]">
            To be completed by the professional during or after the session for progress tracking
          </p>

          <FormCard title="Hygiene and preparation equipment">
            <EquipmentBlock title="Ozone Steam">
              <TextField
                label="Time"
                onChange={(value) => set('ozoneSteamTime', value)}
                placeholder="e.g. 5"
                suffix="min"
                value={String(details.ozoneSteamTime ?? '')}
              />
              <CheckboxGroup
                onChange={(value) => set('ozoneSteamModes', value)}
                options={[...cosmetologyOzoneSteamModes]}
                value={(details.ozoneSteamModes as string[] | undefined)?.map(normalizeCosmetologyHistoryLabel)}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Ultrasonic Peeling, Spatula">
              <CheckboxGroup
                onChange={(value) => set('ultrasonicPeelingModes', value)}
                options={[...cosmetologyUltrasonicModes]}
                value={details.ultrasonicPeelingModes as string[] | undefined}
              />
              <TextField
                label="Level"
                onChange={(value) => set('ultrasonicLevel', value)}
                placeholder="e.g. 2"
                value={String(details.ultrasonicLevel ?? '')}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Microdermabrasion, Diamond Tip">
              <TextField
                label="Head/grit"
                onChange={(value) => set('microdermHeadGrit', value)}
                placeholder="e.g. 80 grit"
                value={String(details.microdermHeadGrit ?? '')}
              />
              <TextField
                label="Suction"
                onChange={(value) => set('microdermSuction', value)}
                placeholder="e.g. level 3"
                value={String(details.microdermSuction ?? '')}
              />
            </EquipmentBlock>
          </FormCard>

          <FormCard title="Treatment and stimulation equipment">
            <EquipmentBlock title="High Frequency">
              <TextField
                label="Time"
                onChange={(value) => set('highFrequencyTime', value)}
                placeholder="e.g. 5"
                suffix="min"
                value={String(details.highFrequencyTime ?? '')}
              />
              <CheckboxGroup
                onChange={(value) => set('highFrequencyModes', value)}
                options={[...cosmetologyHighFrequencyModes]}
                value={(details.highFrequencyModes as string[] | undefined)?.map(normalizeCosmetologyHistoryLabel)}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Radiofrequency">
              <CheckboxGroup
                onChange={(value) => set('radiofrequencyModes', value)}
                options={[...cosmetologyRadiofrequencyModes]}
                value={(details.radiofrequencyModes as string[] | undefined)?.map(normalizeCosmetologyHistoryLabel)}
              />
              <TextField
                label="Temp"
                onChange={(value) => set('radiofrequencyMaxTemp', value)}
                placeholder="e.g. 30 degrees"
                suffix="C°"
                value={String(details.radiofrequencyMaxTemp ?? '')}
              />
              <TextField
                label="Level"
                onChange={(value) => set('radiofrequencyLevel', value)}
                placeholder="e.g. 2"
                value={String(details.radiofrequencyLevel ?? '')}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Ultrasound / Ultracavitation">
              <CheckboxGroup
                label="Skin type"
                onChange={(value) => set('ultrasoundSkinTypes', value)}
                options={['1MHz', '3MHz']}
                value={details.ultrasoundSkinTypes as string[] | undefined}
              />
              <TextField
                label="Power"
                onChange={(value) => set('ultrasoundPower', value)}
                placeholder="e.g. 80"
                suffix="%"
                value={String(details.ultrasoundPower ?? '')}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Dermapen">
              <CheckboxGroup
                label="Needle"
                onChange={(value) => set('dermapenNeedle', value[value.length - 1] ?? '')}
                options={[...cosmetologyDermapenNeedles]}
                value={details.dermapenNeedle ? [String(details.dermapenNeedle)] : []}
              />
              <TextField
                label="Depth"
                onChange={(value) => set('dermapenDepth', value)}
                placeholder="e.g. 2"
                suffix="mm"
                value={String(details.dermapenDepth ?? '')}
              />
              <TextField
                label="Speed"
                onChange={(value) => set('dermapenSpeed', value)}
                placeholder="e.g. 5"
                value={String(details.dermapenSpeed ?? '')}
              />
            </EquipmentBlock>

            <EquipmentBlock title="Electroporation, Virtual Mesotherapy">
              <TextField
                label="Product"
                onChange={(value) => set('electroporationProduct', value)}
                placeholder="e.g. hyaluronic acid serum"
                value={String(details.electroporationProduct ?? '')}
              />
              <TextField
                label="Intensity"
                onChange={(value) => set('electroporationIntensity', value)}
                placeholder="e.g. level 3"
                value={String(details.electroporationIntensity ?? '')}
              />
            </EquipmentBlock>

            <EquipmentBlock title="LED Mask / Phototherapy">
              <CheckboxGroup
                onChange={(value) => set('ledMaskColors', value)}
                options={[...cosmetologyLedColors]}
                value={details.ledMaskColors as string[] | undefined}
              />
              <TextField
                label="Time"
                onChange={(value) => set('ledMaskTime', value)}
                placeholder="e.g. 10"
                suffix="min"
                value={String(details.ledMaskTime ?? '')}
              />
            </EquipmentBlock>
          </FormCard>

          <FormCard title="Chemicals, exfoliation and active ingredients">
            <EquipmentBlock title="Chemical peel">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Acid (s)"
                  onChange={(value) => set('chemicalPeelAcid', value)}
                  placeholder="e.g. glycolic acid"
                  value={String(details.chemicalPeelAcid ?? '')}
                />
                <TextField
                  label="%"
                  onChange={(value) => set('chemicalPeelPercent', value)}
                  placeholder="e.g. 30"
                  value={String(details.chemicalPeelPercent ?? '')}
                />
              </div>
              <TextField
                label="Layers"
                onChange={(value) => set('chemicalPeelLayers', value)}
                placeholder="e.g. 2"
                value={String(details.chemicalPeelLayers ?? '')}
              />
              <TextField
                label="Exposure Time"
                onChange={(value) => set('chemicalPeelExposureTime', value)}
                placeholder="e.g. 2"
                suffix="min"
                value={String(details.chemicalPeelExposureTime ?? '')}
              />
              <TextField
                label="Neutralized with"
                onChange={(value) => set('chemicalPeelNeutralizer', value)}
                placeholder="e.g. sodium bicarbonate solution"
                value={String(details.chemicalPeelNeutralizer ?? '')}
              />
            </EquipmentBlock>

            <TextAreaField
              label="Active Ingredients / Serums / Ampoules"
              onChange={(value) => set('activeIngredients', value)}
              placeholder="e.g. vitamin C ampoule, niacinamide serum"
              value={String(details.activeIngredients ?? '')}
            />

            <EquipmentBlock title="Final Mask">
              <CheckboxGroup
                onChange={(value) => set('finalMask', value)}
                options={[...cosmetologyFinalMaskOptions]}
                value={details.finalMask as string[] | undefined}
              />
              <TextField
                label="Time"
                onChange={(value) => set('finalMaskTime', value)}
                placeholder="e.g. 2 minutes"
                suffix="min"
                value={String(details.finalMaskTime ?? '')}
              />
            </EquipmentBlock>
          </FormCard>

          <FormCard title="Professional control data">
            <TextField
              label="Cosmetic Brand / Line Used"
              onChange={(value) => set('cosmeticBrandLine', value)}
              placeholder="e.g. Mesoestetic, IMAGE Skincare"
              value={String(details.cosmeticBrandLine ?? '')}
            />
            <CheckboxGroup
              label="Immediate Reaction"
              onChange={(value) => set('immediateReaction', value)}
              options={[...cosmetologyReactionOptions]}
              value={(details.immediateReaction as string[] | undefined)?.map(normalizeCosmetologyHistoryLabel)}
            />
            <TextAreaField
              label="Additional note"
              onChange={(value) => set('professionalControlNotes', value)}
              placeholder="e.g., mild resistance during extractions on the nose, client reported sensitivity on left cheek, recommend reducing pressure in next session"
              value={String(details.professionalControlNotes ?? '')}
            />
          </FormCard>

          {cosmetologyRecommendationBlocks.map((block) => (
            <FormCard key={block.title} title={block.title}>
              {block.subtitle && (
                <p className="text-[14px] leading-5 text-[#475467]">{block.subtitle}</p>
              )}
              <ul className="flex flex-col gap-3">
                {block.items.map((item) => (
                  <li className="text-[14px] leading-[1.45] text-[#101828]" key={item.label}>
                    <span className="font-bold tracking-[0.24px]">{item.label}</span>{' '}
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </FormCard>
          ))}

          {serviceError && (
            <p className="text-center text-[12px] leading-[1.44] text-[#b42318]">{serviceError}</p>
          )}
          <RegistrationContinueSection
            canContinue={canContinue}
            disabledMessage={
              !serviceType
                ? 'Select a service type to continue'
                : missingItems.length
                    ? `To continue, complete: ${missingItems.join(' · ')}`
                    : serviceCreating
                      ? `Creating ${cosmetologyServiceDisplayName(serviceType)}...`
                    : undefined
            }
            label={serviceCreating ? 'Creating service...' : 'Mark service as complete'}
            onContinue={() => void finishWithResolvedService()}
          />
          <button
            className="pb-4 text-center text-[16px] font-medium text-[#475467]"
            onClick={() => setStage('form')}
            type="button"
          >
            Go back
          </button>
        </div>
      </RegistrationFlowShell>
    )
  }

  return (
    <RegistrationFlowShell
      activeCategory="cosmetology"
      maxWidth={393}
      onBack={onBack}
      title="Aesthetic treatment clinical form"
    >
      <div className="mx-auto flex w-full max-w-[393px] flex-col gap-5">
        <FormCard title="General Information">
          <TextField
            label="Full name"
            onChange={(value) => set('generalFullName', value)}
            placeholder="e.g. John Doe"
            value={String(details.generalFullName ?? '')}
          />
          <TextField
            label="Phone number"
            onChange={(value) => set('generalPhone', value)}
            placeholder="e.g. 111 222 333"
            type="tel"
            value={String(details.generalPhone ?? '')}
          />
          <TextField
            label="Date of birth"
            onChange={(value) => set('generalDateOfBirth', formatBirthDateInput(value))}
            placeholder="MM/DD/YYYY"
            type="text"
            value={String(details.generalDateOfBirth ?? '')}
          />
          <TextField
            label="Email"
            onChange={(value) => set('generalEmail', value)}
            placeholder="e.g. jane@glamhour.com"
            type="email"
            value={String(details.generalEmail ?? '')}
          />
          <RadioRow
            label="Is this your first time?"
            onChange={(value) => set('isFirstTime', value)}
            options={yesNoOptions}
            value={String(details.isFirstTime ?? '')}
          />
        </FormCard>

        <ServiceTypeCards onChange={selectServiceType} value={serviceType} />
        {serviceError && (
          <p className="text-[12px] leading-[1.44] text-[#b42318]">{serviceError}</p>
        )}

        <FormCard title="Health history">
          <FormSubtitle>
            Do you currently have or have you ever had any of the following conditions?
          </FormSubtitle>
          {cosmetologyHealthHistoryGroups.map((group) => (
            <CheckboxGroup
              key={group.key}
              label={group.title}
              onChange={(value) => {
                const groupOptions = group.options as readonly string[]
                const otherOptions = selectedHealthHistory.filter((item) => !groupOptions.includes(item))
                set('healthHistory', [...otherOptions, ...value])
              }}
              options={group.options}
              value={selectedHealthHistory.filter((item) => (group.options as readonly string[]).includes(item))}
            />
          ))}
          <TextAreaField
            label="Specify your allergy, and reaction"
            onChange={(value) => set('allergyReactionNotes', value)}
            placeholder="Swelling or itching"
            value={String(details.allergyReactionNotes ?? '')}
          />

          <SectionHeading>Patient safety</SectionHeading>
          <RadioRow
            label="Have you ever had a negative experience or unusual reaction after a facial or body treatment in the past?"
            onChange={(value) => set('negativeExperience', value)}
            options={yesNoOptions}
            value={String(details.negativeExperience ?? '')}
          />
          <TextAreaField
            label="Ask the client about the reaction: what the treatment consisted of, what product was applied (if known), and how long it lasted."
            onChange={(value) => set('negativeExperienceDetails', value)}
            placeholder="e.g., chemical peel with glycolic acid, lasted 2 days"
            value={String(details.negativeExperienceDetails ?? '')}
          />

          <SectionHeading>Lifestyle and medication</SectionHeading>
          <TextAreaField
            label="Current medications"
            onChange={(value) => set('currentMedications', value)}
            placeholder="List any medications you're currently taking (e.g., ibuprofen, metformin)"
            value={String(details.currentMedications ?? '')}
          />
          <FormSubtitle>Consumption habits:</FormSubtitle>
          <RadioRow
            label="Smoking"
            onChange={(value) => set('smoking', value)}
            options={yesNoOptions}
            value={String(details.smoking ?? '')}
          />
          <TextAreaField
            label="Frequency"
            minHeightClass="min-h-[71px]"
            onChange={(value) => set('smokingFrequency', value)}
            placeholder="e.g. 2–3 cigarettes a day"
            value={String(details.smokingFrequency ?? '')}
          />
          <RadioRow
            label="Alcohol"
            onChange={(value) => set('alcohol', value)}
            options={cosmetologyAlcoholOptions}
            value={String(details.alcohol ?? '')}
            vertical
          />
          <RadioRow
            label="Previous negative experience with aesthetic treatments?"
            onChange={(value) => set('previousNegativeAestheticExperience', value)}
            options={yesNoOptions}
            value={String(details.previousNegativeAestheticExperience ?? '')}
          />
        </FormCard>

        <FormCard title="Skin diagnosis">
          <RadioRow
            label="Skin type"
            onChange={(value) => set('skin_type', value)}
            options={cosmetologySkinTypes}
            value={String(details.skin_type ?? '')}
            vertical
          />
          <PhototypeRow onChange={(value) => set('phototype', value)} value={String(details.phototype ?? '')} />
        </FormCard>

        <FormCard title="Alterations and conditions">
          {cosmetologyAlterationGroups.map((group) => (
            <CheckboxGroup
              key={group.key}
              label={group.title}
              onChange={(value) => {
                const groupOptions = group.options as readonly string[]
                const otherOptions = selectedAlterations.filter((item) => !groupOptions.includes(item))
                set('alterations', [...otherOptions, ...value])
              }}
              options={group.options}
              value={selectedAlterations.filter((item) => (group.options as readonly string[]).includes(item))}
            />
          ))}
          <FaceMapPreview
            count={faceAnnotationCount}
            onClick={() => setStage('face-map')}
          />
          <TextAreaField
            label="Treatment notes"
            onChange={(value) => set('treatmentNotes', value)}
            placeholder="e.g., redness concentrated on cheeks, dry patches near the jawline, no open lesions observed"
            value={String(details.treatmentNotes ?? details.skinAlterationNotes ?? '')}
          />
        </FormCard>

        <FormCard>
          <div className="rounded-[12px] bg-[#f2f5ff] p-4">
            <TextField
              label="Professional signature"
              onChange={(value) => set('professionalSignature', value)}
              placeholder="e.g. John Doe"
              value={String(details.professionalSignature ?? '')}
            />
            <div className="mt-4">
              <TextField
                label="Date"
                onChange={(value) => set('consentDate', value)}
                type="date"
                value={String(details.consentDate ?? '')}
              />
            </div>
          </div>
        </FormCard>

        <RegistrationContinueSection
          canContinue={canContinue}
          disabledMessage={
            !serviceType
              ? 'Select a service type to continue'
              : missingItems.length
                  ? `To continue, complete: ${missingItems.join(' · ')}`
                  : serviceCreating
                    ? `Creating ${cosmetologyServiceDisplayName(serviceType)}...`
                  : undefined
          }
          label={serviceCreating ? 'Creating service...' : 'Confirm and Submit'}
          onContinue={() => {
            void (async () => {
              const nextServiceId = await resolveOrCreateServiceId()
              if (!nextServiceId) {
                setServiceError(cosmetologyServiceMatchError(serviceType))
                return
              }
              if (nextServiceId !== selectedServiceId) {
                onChange({
                  serviceId: nextServiceId,
                  details: { ...details, serviceType },
                })
              }
              setServiceError('')
              setStage('face-map')
            })()
          }}
        />
        <button
          className="pb-4 text-center text-[16px] font-medium text-[#475467]"
          onClick={onBack}
          type="button"
        >
          Go back
        </button>
      </div>
    </RegistrationFlowShell>
  )
}
