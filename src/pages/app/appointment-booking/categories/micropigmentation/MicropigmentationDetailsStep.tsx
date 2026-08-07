import { useState, type ReactNode } from 'react'
import { cn } from '../../../../../lib/cn'
import { localDateString } from '../../../../../lib/date'
import type { ServiceCategory } from '../../../../../types/api'
import { glamhourApi } from '../../../../../services/glamhour-api'
import { cosmetologyBookingAssets } from '../../assets'
import {
  BookingSectionTitle,
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import { mergeSignature } from '../../components/signatureHelpers'
import { SignatureBox } from '../../components/SignatureBox'
import type { CategoryStepProps } from '../../types'
import {
  getMicropigmentationDetailsMissingItems,
  getMicropigmentationFieldErrors,
  matchMicropigmentationService,
  micropigmentationAlcoholOptions,
  micropigmentationAllergyOptions,
  micropigmentationHealthHistoryGroups,
  micropigmentationPhototypes,
  micropigmentationProcedureGroups,
  micropigmentationRecommendationBlocks,
  micropigmentationServiceDefaults,
  micropigmentationServiceDisplayName,
  micropigmentationServiceMatchError,
  normalizeMicropigmentationHistoryLabel,
  procedureAreaFor,
  resolveMicropigmentationServiceId,
  yesNoOptions,
} from './micropigmentationDetailsSpec'

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[12px] leading-[1.44] text-[#b42318]">{message}</p>
}

function TextField({
  label,
  onChange,
  placeholder,
  suffix,
  type = 'text',
  value,
  error,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  suffix?: string
  type?: string
  value: string
  error?: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[16px] leading-[1.4] text-black">{label}</span>
      <span className={cn(
        'flex min-h-12 items-center gap-2 rounded-[16px] border bg-white px-3',
        error ? 'border-[#f04438]' : 'border-[#d0d5dd]',
      )}>
        <input
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-[#101828] outline-none placeholder:text-[#667085]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {suffix && <span className="shrink-0 text-[16px] text-black">{suffix}</span>}
      </span>
      <FieldError message={error} />
    </label>
  )
}

function TextAreaField({
  label,
  onChange,
  placeholder,
  value,
  minHeightClass = 'min-h-[139px]',
  error,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
  minHeightClass?: string
  error?: string
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] tracking-[-0.28px] text-[#666]">{label}</span>
      <textarea
        className={cn(
          'rounded-[12px] border bg-[#fcfcfd] p-[14px] text-[15px] leading-[22.5px] tracking-[-0.3px] text-[#101828] outline-none placeholder:text-[#999]',
          minHeightClass,
          error ? 'border-[#f04438]' : 'border-[#d0d5dd]',
        )}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <FieldError message={error} />
    </label>
  )
}

function RadioRow({
  label,
  onChange,
  options,
  value,
  vertical,
  error,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
  value: string
  vertical?: boolean
  error?: string
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
      <FieldError message={error} />
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
  const selected = new Set((value ?? []).map(normalizeMicropigmentationHistoryLabel))
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

function PhototypeRow({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] text-[#666]">Skin phototype</span>
      <div className="flex items-start justify-between gap-1">
        {micropigmentationPhototypes.map((option) => {
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
      <FieldError message={error} />
    </div>
  )
}

function ServiceTypeGroups({
  selectedProcedures,
  onSelect,
  error,
}: {
  selectedProcedures: string[]
  onSelect: (area: string, procedure: string) => void
  error?: string
}) {
  const selected = new Set(selectedProcedures)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[28px] font-bold leading-[1.2] text-black">Service type</p>
      {Object.entries(micropigmentationProcedureGroups).map(([groupArea, procedures]) => (
        <div className="flex flex-col gap-3" key={groupArea}>
          <p className="text-[21px] font-bold leading-[1.2] text-black">{groupArea}</p>
          <div className="flex gap-5 overflow-x-auto pb-1">
            {procedures.map((option) => {
              const active = selected.has(option)
              return (
                <button
                  className={cn(
                    'min-h-20 min-w-[150px] max-w-[150px] whitespace-normal break-words rounded-[16px] border px-3 py-3 text-center text-[15px] leading-[1.25] tracking-[-0.3px] text-black',
                    active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
                  )}
                  key={option}
                  onClick={() => onSelect(groupArea, option)}
                  type="button"
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <FieldError message={error} />
    </div>
  )
}

export function MicropigmentationDetailsStep({
  services,
  selectedServiceId,
  details,
  onChange,
  onBack,
  onNext,
  onServiceCreated,
  category,
}: CategoryStepProps & { category: ServiceCategory }) {
  const [serviceError, setServiceError] = useState('')
  const [serviceCreating, setServiceCreating] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })
  const skipHealth = details.usedExistingHealthProfile === true
  const fieldErrors = getMicropigmentationFieldErrors(details)
  const missingItems = getMicropigmentationDetailsMissingItems(details)
  const procedure = normalizeMicropigmentationHistoryLabel(String(details.procedure ?? ''))
  const area = String(details.area ?? procedureAreaFor(procedure))
  const selectedProcedures = (
    Array.isArray(details.procedures) && details.procedures.length
      ? details.procedures
      : procedure
        ? [procedure]
        : []
  ).map((item) => normalizeMicropigmentationHistoryLabel(String(item)))
    .filter((item, index, list) => item && list.indexOf(item) === index)
  const selectedHealthHistory = ((details.healthHistory as string[] | undefined) ?? [])
    .map(normalizeMicropigmentationHistoryLabel)
  const selectedAllergies = ((details.allergies as string[] | undefined) ?? [])
    .map(normalizeMicropigmentationHistoryLabel)
  const canContinue = selectedProcedures.length > 0 && !serviceCreating

  const selectProcedure = (nextArea: string, nextProcedure: string) => {
    const normalized = normalizeMicropigmentationHistoryLabel(nextProcedure)
    const exists = selectedProcedures.includes(normalized)
    const nextProcedures = exists
      ? selectedProcedures.filter((item) => item !== normalized)
      : [...selectedProcedures, normalized]
    const primaryProcedure = nextProcedures[0] ?? ''
    const matched = primaryProcedure ? matchMicropigmentationService(services, primaryProcedure) : undefined
    const bookableId = matched && matched.is_active !== false ? matched.id : ''
    const procedureAreas = {
      ...(typeof details.procedureAreas === 'object' && details.procedureAreas ? details.procedureAreas : {}),
      [normalized]: nextArea,
    }
    setServiceError('')
    onChange({
      serviceId: bookableId,
      details: {
        ...details,
        area: primaryProcedure ? procedureAreaFor(primaryProcedure) : '',
        procedure: primaryProcedure,
        procedures: nextProcedures,
        procedureAreas,
      },
    })
  }

  const resolveOrCreateServiceIds = async () => {
    if (!selectedProcedures.length) return []
    const serviceIds: string[] = []

    setServiceCreating(true)
    try {
      for (const selectedProcedure of selectedProcedures) {
        const matchedId = resolveMicropigmentationServiceId(
          services,
          selectedProcedure,
          selectedProcedure === procedure ? selectedServiceId : undefined,
        )
        if (matchedId) {
          serviceIds.push(matchedId)
          continue
        }

        const defaults = micropigmentationServiceDefaults(selectedProcedure)
        const service = await glamhourApi.ensureService({
          categoryId: optionalUuid(category.id),
          categoryCode: 'micropigmentation',
          slug: defaults.slug,
          name: defaults.name,
          description: `${defaults.name} created from micropigmentation booking flow.`,
          durationMinutes: defaults.durationMinutes,
          priceMinor: defaults.priceMinor,
          assignToActiveProviders: true,
        })
        onServiceCreated?.(service)
        serviceIds.push(service.id)
      }
      setServiceError('')
      return serviceIds.filter((item, index, list) => list.indexOf(item) === index)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : micropigmentationServiceMatchError(selectedProcedures[0] ?? '')
      setServiceError(message)
      return []
    } finally {
      setServiceCreating(false)
    }
  }

  const submit = async () => {
    setShowErrors(true)
    if (missingItems.length || !selectedProcedures.length) return
    const serviceIds = await resolveOrCreateServiceIds()
    if (!serviceIds.length) {
      setServiceError(micropigmentationServiceMatchError(selectedProcedures[0] ?? 'selected'))
      return
    }
    const primaryProcedure = selectedProcedures[0]
    setServiceError('')
    onNext({
      serviceId: serviceIds[0],
      details: {
        ...details,
        area: area || procedureAreaFor(primaryProcedure),
        procedure: primaryProcedure,
        procedures: selectedProcedures,
        micropigmentationServiceIds: serviceIds,
        pigment_brand: details.pigment_brand ?? details.pigmentBrand,
        needle: details.needle ?? details.needleType,
        color_mix: details.color_mix ?? details.colorMix,
        aftercare: micropigmentationRecommendationBlocks[0].intro,
      },
    })
  }

  return (
    <RegistrationFlowShell
      activeCategory="micropigmentation"
      maxWidth={393}
      onBack={onBack}
      title="Aesthetic treatment clinical form"
    >
      <div className="mx-auto flex w-full max-w-[393px] flex-col gap-5">
        {!skipHealth && (
          <FormCard title="General Information">
            <TextField
              error={showErrors ? fieldErrors.generalFullName : undefined}
              label="Full name"
              onChange={(value) => set('generalFullName', value)}
              placeholder="e.g. John Doe"
              value={String(details.generalFullName ?? '')}
            />
            <TextField
              error={showErrors ? fieldErrors.generalPhone : undefined}
              label="Phone number"
              onChange={(value) => set('generalPhone', value)}
              placeholder="e.g. +1 (555) 000"
              type="tel"
              value={String(details.generalPhone ?? '')}
            />
            <TextField
              error={showErrors ? fieldErrors.generalDateOfBirth : undefined}
              label="Date of birth"
              onChange={(value) => set('generalDateOfBirth', value)}
              type="date"
              value={String(details.generalDateOfBirth ?? '')}
            />
            <TextField
              error={showErrors ? fieldErrors.generalEmail : undefined}
              label="Email"
              onChange={(value) => set('generalEmail', value)}
              placeholder="e.g. j.doe@example.com"
              type="email"
              value={String(details.generalEmail ?? '')}
            />
            <RadioRow
              error={showErrors ? fieldErrors.isFirstTime : undefined}
              label="Is this your first time?"
              onChange={(value) => set('isFirstTime', value)}
              options={yesNoOptions}
              value={String(details.isFirstTime ?? '')}
            />
          </FormCard>
        )}

        <ServiceTypeGroups
          error={showErrors ? fieldErrors.procedure : undefined}
          onSelect={selectProcedure}
          selectedProcedures={selectedProcedures}
        />
        {serviceError && (
          <p className="text-[12px] leading-[1.44] text-[#b42318]">{serviceError}</p>
        )}

        {!skipHealth && (
          <FormCard title="Health history">
            <FormSubtitle>
              Do you currently have or have you ever had any of the following conditions?
            </FormSubtitle>
            {micropigmentationHealthHistoryGroups.map((group) => (
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

            <FormSubtitle>Allergies and adverse reactions</FormSubtitle>
            <CheckboxGroup
              onChange={(value) => set('allergies', value)}
              options={[...micropigmentationAllergyOptions]}
              value={selectedAllergies}
            />
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
              error={showErrors ? fieldErrors.negativeExperienceDetails : undefined}
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
              options={micropigmentationAlcoholOptions}
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
        )}

        <FormCard title="Procedure Notes">
          <PhototypeRow
            error={showErrors ? fieldErrors.phototype : undefined}
            onChange={(value) => set('phototype', value)}
            value={String(details.phototype ?? '')}
          />
          <RadioRow
            error={showErrors ? fieldErrors.herpesSimplex : undefined}
            label="Do you suffer from Herpes Simplex?"
            onChange={(value) => set('herpesSimplex', value)}
            options={yesNoOptions}
            value={String(details.herpesSimplex ?? '')}
          />
          <TextAreaField
            label="Previous treatments / Removal?"
            onChange={(value) => set('previousTreatmentsRemoval', value)}
            placeholder="e.g., laser removal 6 months ago, 3 sessions of saline removal"
            value={String(details.previousTreatmentsRemoval ?? '')}
          />
        </FormCard>

        <FormCard title="Procedure details">
          <FormSubtitle>Anesthesia</FormSubtitle>
          <TextField
            label="Brand"
            onChange={(value) => set('anesthesiaBrand', value)}
            placeholder="e.g., EMLA, BLT"
            value={String(details.anesthesiaBrand ?? '')}
          />
          <TextField
            label="Exposure time"
            onChange={(value) => set('anesthesiaExposureTime', value)}
            placeholder="e.g. 45"
            suffix="min"
            value={String(details.anesthesiaExposureTime ?? '')}
          />

          <FormSubtitle>Tools</FormSubtitle>
          <TextField
            error={showErrors ? fieldErrors.needleType : undefined}
            label="Needle type"
            onChange={(value) => {
              onChange({ details: { ...details, needleType: value, needle: value } })
            }}
            placeholder="e.g., nano Blade, round shader"
            value={String(details.needleType ?? details.needle ?? '')}
          />
          <TextField
            label="Size/number"
            onChange={(value) => set('needleSize', value)}
            placeholder="e.g., 0.18mm, 7-pin"
            value={String(details.needleSize ?? '')}
          />

          <FormSubtitle>Pigmentology</FormSubtitle>
          <TextField
            error={showErrors ? fieldErrors.pigment_brand : undefined}
            label="Brand"
            onChange={(value) => {
              onChange({ details: { ...details, pigment_brand: value, pigmentBrand: value } })
            }}
            placeholder="e.g., Perma Blend, Tina Davies"
            value={String(details.pigment_brand ?? details.pigmentBrand ?? '')}
          />
          <TextField
            label="Color/mix"
            onChange={(value) => {
              onChange({ details: { ...details, color_mix: value, colorMix: value } })
            }}
            placeholder="e.g., cool ash Brown, 80% espresso + 2..."
            value={String(details.color_mix ?? details.colorMix ?? '')}
          />
        </FormCard>

        <FormCard title="Control">
          <TextField
            label="First session date"
            onChange={(value) => set('firstSessionDate', value)}
            type="date"
            value={String(details.firstSessionDate ?? '')}
          />
          <TextField
            label="Touch-up appointment"
            onChange={(value) => {
              onChange({
                details: {
                  ...details,
                  touchUpAppointment: value,
                  touch_up_date: value,
                },
              })
            }}
            type="date"
            value={String(details.touchUpAppointment ?? details.touch_up_date ?? '')}
          />
          <SignatureBox
            label="Design approved by the client, signature"
            onChange={(value) => onChange({
              details: {
                ...details,
                clientDesignSignature: value,
                signatures: mergeSignature(
                  details.signatures as Parameters<typeof mergeSignature>[0],
                  { type: 'design_approval', signerName: String(details.generalFullName ?? details.healthFullName ?? 'Client'), data: value },
                ),
              },
            })}
            value={String(details.clientDesignSignature ?? '')}
          />
          {showErrors && fieldErrors.clientDesignSignature && (
            <FieldError message={fieldErrors.clientDesignSignature} />
          )}
          <TextAreaField
            label="Observations/notes"
            onChange={(value) => set('procedure_notes', value)}
            placeholder="e.g., redness concentrated on cheeks, dry patches near the jawline, no open lesions observed"
            value={String(details.procedure_notes ?? '')}
          />
        </FormCard>

        {micropigmentationRecommendationBlocks.map((block) => (
          <FormCard key={block.title} title={block.title}>
            {block.subtitle && (
              <p className="text-[16px] font-bold leading-6 text-black">{block.subtitle}</p>
            )}
            {block.intro && (
              <p className="text-[14px] leading-5 text-[#475467]">{block.intro}</p>
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

        <FormCard>
          <div className="rounded-[12px] bg-[#f2f5ff] p-4">
            <TextField
              error={showErrors ? fieldErrors.professionalSignature : undefined}
              label="Professional signature"
              onChange={(value) => set('professionalSignature', value)}
              placeholder="e.g. John Doe"
              value={String(details.professionalSignature ?? '')}
            />
            <div className="mt-4">
              <TextField
                error={showErrors ? fieldErrors.consentDate : undefined}
                label="Date"
                onChange={(value) => set('consentDate', value)}
                type="date"
                value={String(details.consentDate ?? localDateString())}
              />
            </div>
          </div>
        </FormCard>

        <RegistrationContinueSection
          canContinue={canContinue}
          disabledMessage={
            !selectedProcedures.length
              ? 'Select a service type to continue'
              : showErrors && missingItems.length
                ? `To continue, complete: ${missingItems.slice(0, 3).join(' · ')}`
                : serviceCreating
                  ? `Creating ${micropigmentationServiceDisplayName(selectedProcedures[0] ?? procedure)}...`
                  : undefined
          }
          label={serviceCreating ? 'Creating service...' : 'Confirm and Submit'}
          onContinue={() => void submit()}
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
