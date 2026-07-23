import { Camera, ChevronRight, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { lashesBookingAssets } from '../assets'
import { lashVariantOptions, lashesDetailsLayout } from '../lashesDetailsSpec'
import {
  LashCurlPicker,
  LashEyeShapePicker,
  LashLengthPicker,
  LashStylePicker,
  LashThicknessPicker,
  LashVolumePicker,
} from './LashOptionPickers'
import { LashMapEditor } from './LashMapEditor'
import { LashesPrimaryButton, LashesSecondaryButton } from './LashesFlowButtons'
import {
  LashCategoryGrid,
  LashSection,
  LashesCategoryTab,
  LashesStepHeader,
  lashesSelectionShell,
} from './lashesUi'

export function LashesWizardShell({ children, gap = 28 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="flex w-full min-w-0 flex-col" style={{ gap }}>
      {children}
    </div>
  )
}

export function WizardHeader({ title, onBack, subtitle }: { title: string; onBack: () => void; subtitle?: string }) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button aria-label="Back" className="text-black" onClick={onBack} type="button">
          <svg aria-hidden className="h-9 w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[28px] font-extrabold leading-[1.2] text-[#101828]">{title}</h1>
      </div>
      {subtitle && <p className="text-[14px] leading-[22px] text-[#667085]">{subtitle}</p>}
    </header>
  )
}

export function LashesDetailsCategoryHeader({ onBack }: { onBack: () => void }) {
  return (
    <LashesStepHeader onBack={onBack} title="Details of service">
      <LashCategoryGrid gap={lashesDetailsLayout.categoryTabGap}>
        <LashesCategoryTab active icon={lashesBookingAssets.categories.lashes}>Lashes</LashesCategoryTab>
        <LashesCategoryTab icon={lashesBookingAssets.categories.nails}>Nails</LashesCategoryTab>
        <LashesCategoryTab icon={lashesBookingAssets.categories.cosmetology}>cosmetology</LashesCategoryTab>
        <LashesCategoryTab icon={lashesBookingAssets.categories.micropigmentation}>Micropigmentation</LashesCategoryTab>
      </LashCategoryGrid>
    </LashesStepHeader>
  )
}

export function LashesDetailsCoreScreen({
  details,
  onBack,
  onChange,
  onContinue,
  onOpenStylePreview,
  canContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onChange: (patch: Record<string, unknown>) => void
  onContinue: () => void
  onOpenStylePreview: () => void
  canContinue: boolean
}) {
  const style = String(details.style ?? '')

  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />

      <LashSection title="Lash style">
        <LashStylePicker onChange={(value) => onChange({ style: value })} value={style} />
      </LashSection>

      {style && (
        <button
          className="flex w-full items-center justify-between rounded-[16px] border border-[#7344cd] bg-[#fcfcfd] px-4 py-4 text-left"
          onClick={onOpenStylePreview}
          type="button"
        >
          <div>
            <p className="text-[16px] font-normal leading-6 text-black">Preview</p>
            <p className="text-[12px] leading-[17px] text-[#667085]">{style} · Apply the style to your photo</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-[#667085]" />
        </button>
      )}

      <LashSection title="Eye shape">
        <LashEyeShapePicker onChange={(value) => onChange({ eyeShape: value })} value={String(details.eyeShape ?? '')} />
      </LashSection>
      <LashSection title="Volume">
        <LashVolumePicker onChange={(value) => onChange({ volume: value })} value={String(details.volume ?? '')} />
      </LashSection>
      <LashSection title="Lash curl">
        <LashCurlPicker onChange={(value) => onChange({ curl: value })} value={String(details.curl ?? '')} />
      </LashSection>

      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>
          Continue
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesStylePreviewScreen({
  details,
  onBack,
  onContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onContinue: () => void
}) {
  const style = String(details.style ?? '')

  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Preview" />
      <p className="text-[16px] font-medium text-[#667085]">Selected style</p>
      <div className="rounded-[16px] border border-[#7344cd] bg-[#fcfcfd] px-4 py-4">
        <p className="text-[18px] font-bold text-black">{style}</p>
      </div>
      <div className="rounded-[20px] bg-[#f8f9ff] p-6 text-center">
        <img alt="" className="mx-auto h-40 w-full rounded-[16px] object-contain" src={lashesBookingAssets.photoPlaceholder} />
        <p className="mt-4 text-sm text-[#667085]">Open the selected lash style preview before choosing a variant.</p>
      </div>
      <div className="flex flex-col gap-3 py-8">
        <LashesPrimaryButton disabled={!style} onClick={onContinue}>Continue</LashesPrimaryButton>
        <LashesSecondaryButton onClick={onBack}>Back to styles</LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesSelectVariantScreen({
  details,
  onBack,
  onBackToStyles,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onBackToStyles: () => void
  onChange: (patch: Record<string, unknown>) => void
  onContinue: () => void
  canContinue: boolean
}) {
  const style = String(details.style ?? '')
  const variant = String(details.variant ?? '')

  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Select variant" />
      <p className="text-[16px] font-medium text-[#667085]">Selected style</p>
      <div className="rounded-[16px] border border-[#7344cd] bg-[#fcfcfd] px-4 py-4">
        <p className="text-[18px] font-bold text-black">{style}</p>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-[16px] font-medium text-[#667085]">Preview variant</p>
        {lashVariantOptions.map((option) => (
          <button
            className={cn(
              'flex w-full items-start gap-4 rounded-[16px] border px-4 py-4 text-left',
              variant === option.key ? 'border-[#7344cd] bg-[#ebe7ff]' : 'border-[#d0d5dd] bg-[#fcfcfd]',
            )}
            key={option.key}
            onClick={() => onChange({ variant: option.key })}
            type="button"
          >
            <span className="mt-1 inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f2f5ff] text-xs font-bold text-[#7444cf]">
              {option.title.slice(0, 1)}
            </span>
            <span>
              <span className="block text-[16px] font-bold text-black">{option.title}</span>
              <span className="mt-1 block text-[14px] leading-[20px] text-[#667085]">{option.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>Continue</LashesPrimaryButton>
        <LashesSecondaryButton onClick={onBackToStyles}>Back to styles</LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  )
}

function StyleBadges({ details }: { details: Record<string, unknown> }) {
  const style = String(details.style ?? '')
  const variant = String(details.variant ?? '')
  if (!style && !variant) return null
  return (
    <div className="flex flex-wrap gap-2">
      {style && (
        <span className="rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] font-semibold text-[#7444cf]">{style}</span>
      )}
      {variant && (
        <span className="rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] font-semibold text-[#7444cf]">{variant}</span>
      )}
    </div>
  )
}

export function LashesPhotoMethodScreen({
  details,
  onBack,
  onTakePhoto,
  onAllowCamera,
  onUploadPhoto,
  showPermissionAlert,
  onDismissPermissionAlert,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onTakePhoto: () => void
  onAllowCamera: () => void
  onUploadPhoto: (file: File) => void
  showPermissionAlert?: boolean
  onDismissPermissionAlert?: () => void
}) {
  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Add photo" />
      <StyleBadges details={details} />
      <div className="rounded-[16px] bg-[#fcfcfd] p-4">
        <p className="text-[16px] font-bold text-black">What is the photo for?</p>
        <p className="mt-2 text-[14px] leading-[20px] text-[#667085]">
          The photo is used only to position the lash style on the client&apos;s face for preview and mapping.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-[18px] font-bold text-black">Select an option</p>
        <button
          className="flex w-full items-center gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-5 text-left"
          onClick={onTakePhoto}
          type="button"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#ebe7ff] text-[#7444cf]">
            <Camera className="size-5" />
          </span>
          <span>
            <span className="block text-[16px] font-bold text-black">Take a photo</span>
            <span className="block text-[14px] text-[#667085]">Use your device&apos;s camera</span>
          </span>
        </button>
        <label className="flex w-full cursor-pointer items-center gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-5 text-left">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#ebe7ff] text-[#7444cf]">
            <Upload className="size-5" />
          </span>
          <span>
            <span className="block text-[16px] font-bold text-black">Upload a photo</span>
            <span className="block text-[14px] text-[#667085]">Select from your gallery</span>
          </span>
          <input
            accept="image/*"
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUploadPhoto(file)
            }}
          />
        </label>
      </div>
      {showPermissionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center">
            <p className="text-[18px] font-bold text-black">Camera permission required</p>
            <p className="mt-2 text-sm text-[#667085]">Allow camera access to take a client photo for lash preview.</p>
            <div className="mt-6 flex flex-col gap-3">
              <LashesPrimaryButton onClick={onAllowCamera}>Allow camera</LashesPrimaryButton>
              <LashesSecondaryButton onClick={() => onDismissPermissionAlert?.()}>Not now</LashesSecondaryButton>
            </div>
          </div>
        </div>
      )}
    </LashesWizardShell>
  )
}

export function LashesPhotoCaptureScreen({
  onBack,
  onCapture,
}: {
  onBack: () => void
  onCapture: () => void
}) {
  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-[20px] bg-black text-white">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4">
        <button aria-label="Back" className="rounded-full bg-black/40 p-2" onClick={onBack} type="button">
          <svg aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold">Front camera</span>
        <span className="w-9" />
      </div>
      <div className="flex min-h-[640px] flex-col items-center justify-center px-6">
        <div className="rounded-[24px] border-2 border-dashed border-white/70 px-8 py-16 text-center">
          <p className="text-sm font-semibold">Center your face here</p>
        </div>
        <p className="mt-6 rounded-full bg-black/50 px-4 py-2 text-xs">Keep both eyes visible</p>
      </div>
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <button
          aria-label="Capture photo"
          className="size-[72px] rounded-full border-4 border-white bg-white/20"
          onClick={onCapture}
          type="button"
        />
      </div>
    </div>
  )
}

export function LashesPhotoConfirmScreen({
  details,
  onBack,
  onConfirm,
  onReplace,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onConfirm: () => void
  onReplace: () => void
}) {
  const previewUrl = String(details.photoPreviewUrl ?? lashesBookingAssets.photoPlaceholder)

  return (
    <LashesWizardShell>
      <WizardHeader
        onBack={onBack}
        subtitle="Confirm the photo is clear and both eyes are visible."
        title="Confirm photo"
      />
      <img alt="Client reference" className="h-[431px] w-full rounded-[16px] object-cover" src={previewUrl} />
      <div className="flex flex-col gap-3 py-4">
        <LashesPrimaryButton disabled={!details.photoPreviewUrl} onClick={onConfirm}>Use photo</LashesPrimaryButton>
        <LashesSecondaryButton onClick={onReplace}>Replace photo</LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesPhotoPreviewScreen({
  details,
  onBack,
  onContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onContinue: () => void
}) {
  const previewUrl = String(details.photoPreviewUrl ?? lashesBookingAssets.photoPlaceholder)
  const style = String(details.style ?? '')
  const variant = String(details.variant ?? '')

  return (
    <LashesWizardShell>
      <WizardHeader
        onBack={onBack}
        subtitle="Confirm the photo is clear and both eyes are visible."
        title="Preview"
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#667085]">Styles</p>
            <div className="flex flex-wrap gap-2">
              {style && <span className={badgeClass}>{style}</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#667085]">Variant</p>
            <div className="flex flex-wrap gap-2">
              {variant && <span className={badgeClass}>{variant}</span>}
            </div>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 self-start rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] text-[#0c111d]" type="button">
          <img alt="" className="size-6" src={lashesBookingAssets.swap} />
          Swap sides
        </button>
      </div>
      <img alt="Lash style preview" className="h-[431px] w-full rounded-[16px] object-cover" src={previewUrl} />
      <div className="flex flex-col gap-3 py-4">
        <LashesPrimaryButton onClick={onContinue}>Continue</LashesPrimaryButton>
        <LashesSecondaryButton onClick={onBack}>Back</LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  )
}

const badgeClass = 'rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] font-semibold text-[#7444cf]'

export function LashesLashMapScreen({
  details,
  onBack,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onChange: (next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) => void
  onContinue: () => void
  canContinue: boolean
}) {
  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashMapEditor details={details} onChange={onChange} />
      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>Continue</LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesThicknessScreen({
  details,
  onBack,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onChange: (patch: Record<string, unknown>) => void
  onContinue: () => void
  canContinue: boolean
}) {
  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashSection title="Thickness">
        <LashThicknessPicker
          onChange={(value) => onChange({ thickness: value })}
          value={String(details.thickness ?? '')}
        />
      </LashSection>
      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>Continue</LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesLengthScreen({
  details,
  onBack,
  onChange,
  onComplete,
  canComplete,
}: {
  details: Record<string, unknown>
  onBack: () => void
  onChange: (patch: Record<string, unknown>) => void
  onComplete: () => void
  canComplete: boolean
}) {
  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashSection title="Length (mm)">
        <LashLengthPicker
          onChange={(value) => onChange({ defaultLength: value, lashMapLength: Number(value) || undefined })}
          value={String(details.defaultLength ?? details.lashMapLength ?? '')}
        />
      </LashSection>
      <div className="py-8">
        <LashesPrimaryButton disabled={!canComplete} onClick={onComplete}>
          Mark service as complete
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  )
}

export function LashesOptionChip({
  label,
  active,
  onClick,
  trailing,
}: {
  label: string
  active: boolean
  onClick: () => void
  trailing?: ReactNode
}) {
  return (
    <button
      className={cn(
        lashesSelectionShell(active, 'flex h-[82px] min-w-0 items-center rounded-[16px] px-6 text-left'),
        'w-full',
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-[24px] font-normal leading-[30px] text-black">{label}</span>
      {trailing}
    </button>
  )
}
