import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../../../../lib/cn'
import { formatMoney } from '../../../../../lib/format'
import type { Service } from '../../../../../types/api'
import {
  BookingSectionTitle,
  RegistrationContinueSection,
  RegistrationFlowShell,
} from '../../components/RegistrationFlowShell'
import { ChipGroup } from '../../components/shared'
import { TreatmentPhotoFlow } from '../../components/TreatmentPhotoFlow'
import type { CategoryStepProps } from '../../types'
import {
  cosmetologyAlterationGroups,
  cosmetologyEquipmentOptions,
  cosmetologyFinalMaskOptions,
  cosmetologyHealthHistoryGroups,
  cosmetologyPhototypes,
  cosmetologyReactionOptions,
  cosmetologyServiceTypes,
  cosmetologySkinTypes,
  getCosmetologyDetailsMissingItems,
  yesNoOptions,
} from './cosmetologyDetailsSpec'
import { FaceMapEditor } from './FaceMapEditor'

function RegistrationServiceCard({
  active,
  onClick,
  service,
}: {
  active: boolean
  onClick: () => void
  service: Service
}) {
  return (
    <button className="w-full text-left" onClick={onClick} type="button">
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-[16px] border px-4 py-4',
        active ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
      )}>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">{service.name}</p>
          <p className="mt-1 text-[12px] leading-[1.44] text-[#475467]">
            {service.duration_minutes} min · {formatMoney(service.price_minor, service.currency_code)}
          </p>
        </div>
        {active && <Check className="size-5 shrink-0 text-[#7344cd]" />}
      </div>
    </button>
  )
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] p-4">
      <BookingSectionTitle>{title}</BookingSectionTitle>
      {children}
    </section>
  )
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
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-[13px] font-semibold leading-tight text-[#344054]">{label}</span>
      <span className="flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[#d0d5dd] bg-white px-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[#101828] outline-none placeholder:text-[#98a2b3]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {suffix && <span className="shrink-0 text-xs font-semibold text-[#667085]">{suffix}</span>}
      </span>
    </label>
  )
}

function TextAreaField({ label, onChange, placeholder, value }: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold leading-tight text-[#344054]">{label}</span>
      <textarea
        className="min-h-[96px] rounded-[12px] border border-[#d0d5dd] bg-white p-[14px] text-[15px] leading-[22.5px] text-[#101828] outline-none placeholder:text-[#98a2b3]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

function CheckboxGroup({ label, options, value, onChange }: {
  label?: string
  options: readonly string[]
  value?: string[]
  onChange: (value: string[]) => void
}) {
  const selected = new Set(value ?? [])
  return (
    <div className="space-y-2">
      {label && <p className="text-[13px] font-bold text-[#101828]">{label}</p>}
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {options.map((option) => (
          <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-[#e4e7ec] bg-white px-3 py-2 text-[13px] text-[#344054]" key={option}>
            <input
              checked={selected.has(option)}
              className="size-4 accent-[#7344cd]"
              onChange={() => {
                const next = new Set(selected)
                if (next.has(option)) next.delete(option)
                else next.add(option)
                onChange([...next])
              }}
              type="checkbox"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function CosmetologyDetailsStep({ services, selectedServiceId, details, onChange, onBack, onNext }: CategoryStepProps) {
  const set = (key: string, value: unknown) => onChange({ details: { ...details, [key]: value } })
  const missingItems = getCosmetologyDetailsMissingItems(details)
  const canContinue = Boolean(selectedServiceId) && missingItems.length === 0
  const selectedHealthHistory = (details.healthHistory as string[] | undefined) ?? []
  const selectedAlterations = (details.alterations as string[] | undefined) ?? []

  return (
    <RegistrationFlowShell activeCategory="cosmetology" onBack={onBack}>
      <section className="flex flex-col gap-4">
        <BookingSectionTitle>Service</BookingSectionTitle>
        <div className="flex flex-col gap-2">
          {services.map((service) => (
            <RegistrationServiceCard
              active={selectedServiceId === service.id}
              key={service.id}
              onClick={() => onChange({ serviceId: service.id, details })}
              service={service}
            />
          ))}
        </div>
      </section>

      <FormCard title="Aesthetic treatment clinical form">
        <ChipGroup
          label="Service type"
          onChange={(value) => set('serviceType', value)}
          options={[...cosmetologyServiceTypes]}
          value={String(details.serviceType ?? '')}
        />
        <ChipGroup
          label="Skin type"
          onChange={(value) => set('skin_type', value)}
          options={[...cosmetologySkinTypes]}
          value={String(details.skin_type ?? '')}
        />
        <ChipGroup
          label="Skin phototype"
          onChange={(value) => set('phototype', value)}
          options={[...cosmetologyPhototypes]}
          value={String(details.phototype ?? '')}
        />
      </FormCard>

      <FaceMapEditor details={details} onChange={(next) => onChange({ details: next })} />

      <FormCard title="Health history">
        {cosmetologyHealthHistoryGroups.map((group) => (
          <CheckboxGroup
            key={group.key}
            label={group.title}
            onChange={(value) => {
              const otherOptions = selectedHealthHistory.filter((item) => !group.options.includes(item as never))
              set('healthHistory', [...otherOptions, ...value])
            }}
            options={group.options}
            value={selectedHealthHistory.filter((item) => group.options.includes(item as never))}
          />
        ))}
        <TextAreaField
          label="Specify allergies, adverse reactions or important notes"
          onChange={(value) => set('allergyReactionNotes', value)}
          placeholder="Swelling, itching, product reaction, medication notes..."
          value={String(details.allergyReactionNotes ?? '')}
        />
        <ChipGroup
          label="Negative or unusual experience with aesthetic treatment?"
          onChange={(value) => set('negativeExperience', value)}
          options={[...yesNoOptions]}
          value={String(details.negativeExperience ?? '')}
        />
        <ChipGroup
          label="Reaction with radiofrequency, ultrasound or body treatment?"
          onChange={(value) => set('radioBodyTreatmentIssue', value)}
          options={[...yesNoOptions]}
          value={String(details.radioBodyTreatmentIssue ?? '')}
        />
      </FormCard>

      <FormCard title="Alterations and conditions">
        {cosmetologyAlterationGroups.map((group) => (
          <CheckboxGroup
            key={group.key}
            label={group.title}
            onChange={(value) => {
              const otherOptions = selectedAlterations.filter((item) => !group.options.includes(item as never))
              set('alterations', [...otherOptions, ...value])
            }}
            options={group.options}
            value={selectedAlterations.filter((item) => group.options.includes(item as never))}
          />
        ))}
      </FormCard>

      <FormCard title="Treatment and equipment">
        <ChipGroup
          label="Equipment used"
          multiple
          onChange={(value) => set('equipment', value)}
          options={[...cosmetologyEquipmentOptions]}
          value={details.equipment as string[] | undefined}
        />
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <TextField label="Ozone steam" onChange={(value) => set('ozoneSteamTime', value)} placeholder="eg. 5" suffix="min" value={String(details.ozoneSteamTime ?? '')} />
          <TextField label="Ultrasonic level" onChange={(value) => set('ultrasonicLevel', value)} placeholder="eg. 2" value={String(details.ultrasonicLevel ?? '')} />
          <TextField label="Microderm head/grit" onChange={(value) => set('microdermHeadGrit', value)} placeholder="eg. 80 grit" value={String(details.microdermHeadGrit ?? '')} />
          <TextField label="Suction" onChange={(value) => set('microdermSuction', value)} placeholder="eg. level 3" value={String(details.microdermSuction ?? '')} />
          <TextField label="High frequency" onChange={(value) => set('highFrequencyTime', value)} placeholder="eg. 5" suffix="min" value={String(details.highFrequencyTime ?? '')} />
          <TextField label="Radiofrequency max temp" onChange={(value) => set('radiofrequencyMaxTemp', value)} placeholder="eg. 30" suffix="C" value={String(details.radiofrequencyMaxTemp ?? '')} />
          <TextField label="Radiofrequency level" onChange={(value) => set('radiofrequencyLevel', value)} placeholder="eg. 2" value={String(details.radiofrequencyLevel ?? '')} />
          <TextField label="Ultrasound power" onChange={(value) => set('ultrasoundPower', value)} placeholder="eg. 80" suffix="%" value={String(details.ultrasoundPower ?? '')} />
          <TextField label="Dermapen depth" onChange={(value) => set('dermapenDepth', value)} placeholder="eg. 2" suffix="mm" value={String(details.dermapenDepth ?? '')} />
          <TextField label="Dermapen speed" onChange={(value) => set('dermapenSpeed', value)} placeholder="eg. 5" value={String(details.dermapenSpeed ?? '')} />
          <TextField label="Electroporation product" onChange={(value) => set('electroporationProduct', value)} placeholder="eg. hyaluronic acid serum" value={String(details.electroporationProduct ?? '')} />
          <TextField label="Electroporation intensity" onChange={(value) => set('electroporationIntensity', value)} placeholder="eg. level 5" value={String(details.electroporationIntensity ?? '')} />
        </div>
        <CheckboxGroup label="Ozone steam mode" onChange={(value) => set('ozoneSteamModes', value)} options={['With ozone', 'Steam only']} value={details.ozoneSteamModes as string[] | undefined} />
        <CheckboxGroup label="Ultrasonic peeling / spatula" onChange={(value) => set('ultrasonicPeelingModes', value)} options={['Hygiene', 'Sonophoresis']} value={details.ultrasonicPeelingModes as string[] | undefined} />
        <CheckboxGroup label="High frequency mode" onChange={(value) => set('highFrequencyModes', value)} options={['Sparkling', 'Effluvium', 'Cautery']} value={details.highFrequencyModes as string[] | undefined} />
        <CheckboxGroup label="Radiofrequency" onChange={(value) => set('radiofrequencyModes', value)} options={['Monopolar', 'Bipolar / Max']} value={details.radiofrequencyModes as string[] | undefined} />
        <CheckboxGroup label="Ultrasound / ultracavitation skin type" onChange={(value) => set('ultrasoundSkinTypes', value)} options={['1MHz', '3MHz']} value={details.ultrasoundSkinTypes as string[] | undefined} />
        <CheckboxGroup label="Dermapen needle" onChange={(value) => set('dermapenNeedle', value[0] ?? '')} options={['Nano', '12', '36']} value={details.dermapenNeedle ? [String(details.dermapenNeedle)] : []} />
        <CheckboxGroup label="LED mask / phototherapy" onChange={(value) => set('ledMaskColors', value)} options={['Red', 'Blue', 'Green', 'Yellow']} value={details.ledMaskColors as string[] | undefined} />
        <TextField label="LED mask time" onChange={(value) => set('ledMaskTime', value)} placeholder="eg. 10" suffix="min" value={String(details.ledMaskTime ?? '')} />
      </FormCard>

      <FormCard title="Chemicals, exfoliation and active ingredients">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <TextField label="Chemical peel acid" onChange={(value) => set('chemicalPeelAcid', value)} placeholder="eg. glycolic acid" value={String(details.chemicalPeelAcid ?? '')} />
          <TextField label="Acid" onChange={(value) => set('chemicalPeelPercent', value)} placeholder="eg. 30" suffix="%" value={String(details.chemicalPeelPercent ?? '')} />
          <TextField label="Layers" onChange={(value) => set('chemicalPeelLayers', value)} placeholder="eg. 2" value={String(details.chemicalPeelLayers ?? '')} />
          <TextField label="Exposure time" onChange={(value) => set('chemicalPeelExposureTime', value)} placeholder="eg. 2" suffix="min" value={String(details.chemicalPeelExposureTime ?? '')} />
        </div>
        <TextField label="Neutralized with" onChange={(value) => set('chemicalPeelNeutralizer', value)} placeholder="eg. sodium bicarbonate solution" value={String(details.chemicalPeelNeutralizer ?? '')} />
        <TextAreaField
          label="Active ingredients / serums / ampoules"
          onChange={(value) => set('activeIngredients', value)}
          placeholder="eg. vitamin C ampoule, niacinamide serum"
          value={String(details.activeIngredients ?? '')}
        />
        <CheckboxGroup label="Final mask" onChange={(value) => set('finalMask', value)} options={[...cosmetologyFinalMaskOptions]} value={details.finalMask as string[] | undefined} />
        <TextField label="Final mask time" onChange={(value) => set('finalMaskTime', value)} placeholder="eg. 10" suffix="min" value={String(details.finalMaskTime ?? '')} />
      </FormCard>

      <FormCard title="Professional control data">
        <TextField label="Cosmetic brand / line used" onChange={(value) => set('cosmeticBrandLine', value)} placeholder="eg. Mesoesthetic, Image Skincare" value={String(details.cosmeticBrandLine ?? '')} />
        <CheckboxGroup label="Immediate reaction" onChange={(value) => set('immediateReaction', value)} options={[...cosmetologyReactionOptions]} value={details.immediateReaction as string[] | undefined} />
        <TextAreaField
          label="Additional note"
          onChange={(value) => set('professionalControlNotes', value)}
          placeholder="Mild resistance during extractions on the nose, client reported sensitivity on left cheek..."
          value={String(details.professionalControlNotes ?? '')}
        />
      </FormCard>

      <FormCard title="Recommendations">
        <TextAreaField
          label="Cosmetology and dermo-aesthetics"
          onChange={(value) => set('recommendations', value)}
          placeholder="Facial cleansing, diamond tip, mild peeling, hydration..."
          value={String(details.recommendations ?? '')}
        />
        <TextAreaField
          label="Aftercare recommendations"
          onChange={(value) => set('aftercare', value)}
          placeholder="Avoid sun exposure, sunscreen, hydration, products to avoid..."
          value={String(details.aftercare ?? '')}
        />
        <TextAreaField
          label="Products / chemicals used"
          onChange={(value) => set('products', value)}
          placeholder="List products or chemicals used during treatment"
          value={String(details.products ?? '')}
        />
      </FormCard>

      <FormCard title="Professional signature">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <TextField label="Professional" onChange={(value) => set('professionalSignature', value)} placeholder="eg. John Doe" value={String(details.professionalSignature ?? '')} />
          <TextField
            label="Date"
            onChange={(value) => set('consentDate', value)}
            type="date"
            value={String(details.consentDate ?? '')}
          />
        </div>
      </FormCard>

      <TreatmentPhotoFlow
        category="cosmetology"
        details={details}
        onChange={(next) => onChange({ details: next })}
        title="Before treatment photo"
      />

      <RegistrationContinueSection
        canContinue={canContinue}
        disabledMessage={missingItems.length ? `To continue, complete: ${missingItems.join(' · ')}` : undefined}
        onContinue={onNext}
      />
    </RegistrationFlowShell>
  )
}
