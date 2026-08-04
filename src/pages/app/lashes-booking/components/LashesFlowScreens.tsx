import { Camera, ChevronRight, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../../lib/cn";
import { lashesBookingAssets } from "../assets";
import { lashMapZoneNumbers, lashVariantOptions, lashesDetailsLayout } from "../lashesDetailsSpec";
import {
  LashCurlPicker,
  LashEyeShapePicker,
  LashLengthPicker,
  LashStylePicker,
  LashThicknessPicker,
  LashVolumePicker,
} from "./LashOptionPickers";
import { LashMapEditor } from "./LashMapEditor";
import {
  LashesPrimaryButton,
  LashesSecondaryButton,
} from "./LashesFlowButtons";
import {
  LashCategoryGrid,
  LashSection,
  LashesCategoryTab,
  LashesStepHeader,
  lashesSelectionShell,
} from "./lashesUi";

export function LashesWizardShell({
  children,
  gap = 28,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col" style={{ gap }}>
      {children}
    </div>
  );
}

export function WizardHeader({
  title,
  onBack,
  subtitle,
}: {
  title: string;
  onBack: () => void;
  subtitle?: string;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          aria-label="Back"
          className="text-black"
          onClick={onBack}
          type="button"
        >
          <svg
            aria-hidden
            className="h-9 w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-[28px] font-extrabold leading-[1.2] text-[#101828]">
          {title}
        </h1>
      </div>
      {subtitle && (
        <p className="text-[14px] leading-[22px] text-[#667085]">{subtitle}</p>
      )}
    </header>
  );
}

export function LashesDetailsCategoryHeader({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <LashesStepHeader onBack={onBack} title="Details of service">
      <LashCategoryGrid gap={lashesDetailsLayout.categoryTabGap}>
        <LashesCategoryTab active icon={lashesBookingAssets.categories.lashes}>
          Lashes
        </LashesCategoryTab>
        <LashesCategoryTab icon={lashesBookingAssets.categories.nails}>
          Nails
        </LashesCategoryTab>
        <LashesCategoryTab icon={lashesBookingAssets.categories.cosmetology}>
          cosmetology
        </LashesCategoryTab>
        <LashesCategoryTab
          icon={lashesBookingAssets.categories.micropigmentation}
        >
          Micropigmentation
        </LashesCategoryTab>
      </LashCategoryGrid>
    </LashesStepHeader>
  );
}

export function LashesDetailsCoreScreen({
  details,
  onBack,
  onChange,
  onContinue,
  onOpenStylePreview,
  canContinue,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onContinue: () => void;
  onOpenStylePreview: () => void;
  canContinue: boolean;
}) {
  const style = String(details.style ?? "");

  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />

      <LashSection title="Lash style">
        <LashStylePicker
          onChange={(value) => onChange({ style: value })}
          value={style}
        />
      </LashSection>

      {style && (
        <button
          className="flex w-full items-center justify-between rounded-[16px] border border-[#7344cd] bg-[#fcfcfd] px-4 py-4 text-left"
          onClick={onOpenStylePreview}
          type="button"
        >
          <div>
            <p className="text-[16px] font-normal leading-6 text-black">
              Preview
            </p>
            <p className="text-[12px] leading-[17px] text-[#667085]">
              {style} · Apply the style to your photo
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-[#667085]" />
        </button>
      )}

      <LashSection title="Eye shape">
        <LashEyeShapePicker
          onChange={(value) => onChange({ eyeShape: value })}
          value={String(details.eyeShape ?? "")}
        />
      </LashSection>
      <LashSection title="Volume">
        <LashVolumePicker
          onChange={(value) => onChange({ volume: value })}
          value={String(details.volume ?? "")}
        />
      </LashSection>
      <LashSection title="Lash curl">
        <LashCurlPicker
          onChange={(value) => onChange({ curl: value })}
          value={String(details.curl ?? "")}
        />
      </LashSection>
      <LashSection title="Thickness">
        <LashThicknessPicker
          onChange={(value) => onChange({ thickness: value })}
          value={String(details.thickness ?? "")}
        />
      </LashSection>
      <LashSection title="Length (mm)">
        <LashLengthPicker
          onChange={(value) =>
            onChange({
              defaultLength: value,
              lashMapLength: Number(value) || undefined,
            })
          }
          value={String(details.defaultLength ?? details.lashMapLength ?? "")}
        />
      </LashSection>

      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>
          Continue
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesStylePreviewScreen({
  details,
  onBack,
  onContinue,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const style = String(details.style ?? "");

  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Preview" />
      <p className="text-[16px] font-medium text-[#667085]">Selected style</p>
      <div className="rounded-[16px] border border-[#7344cd] bg-[#fcfcfd] px-4 py-4">
        <p className="text-[18px] font-bold text-black">{style}</p>
      </div>
      <div className="rounded-[20px] bg-[#f8f9ff] p-6 text-center">
        <img
          alt=""
          className="mx-auto h-40 w-full rounded-[16px] object-contain"
          src={lashesBookingAssets.photoPlaceholder}
        />
        <p className="mt-4 text-sm text-[#667085]">
          Open the selected lash style preview before choosing a variant.
        </p>
      </div>
      <div className="flex flex-col gap-3 py-8">
        <LashesPrimaryButton disabled={!style} onClick={onContinue}>
          Continue
        </LashesPrimaryButton>
        <LashesSecondaryButton onClick={onBack}>
          Back to styles
        </LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesSelectVariantScreen({
  details,
  onBack,
  onBackToStyles,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onBackToStyles: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const style = String(details.style ?? "");
  const variant = String(details.variant ?? "");

  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Select variant" />
      <p className="text-[16px] font-medium text-[#667085]">Selected style</p>
      <div className="flex h-[54px] items-center rounded-[16px] border border-[#7344cd] bg-[#ebe7ff] px-4">
        <p className="text-[16px] font-normal leading-[1.44] tracking-[-0.32px] text-black">
          {style}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-[16px] font-medium text-[#667085]">
          Preview variant
        </p>
        {lashVariantOptions.map((option) => (
          <button
            className={cn(
              "flex min-h-[82px] w-full items-center gap-4 rounded-[16px] border px-4 py-3 text-left",
              variant === option.key
                ? "border-[#7344cd] bg-[#ebe7ff]"
                : "border-[#d0d5dd] bg-[#fcfcfd]"
            )}
            key={option.key}
            onClick={() => onChange({ variant: option.key })}
            type="button"
          >
            <span className="inline-flex h-14 w-[74px] shrink-0 items-center justify-center rounded-[12px] bg-[#f2f5ff] px-2">
              <img
                alt=""
                className="max-h-10 w-full object-contain"
                src={lashesBookingAssets.variants[option.key]}
              />
            </span>
            <span>
              <span className="block text-[16px] font-bold text-black">
                {option.title}
              </span>
              <span className="mt-1 block text-[14px] leading-[20px] text-[#667085]">
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>
          Continue
        </LashesPrimaryButton>
        <LashesSecondaryButton onClick={onBackToStyles}>
          Back to styles
        </LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  );
}

function StyleBadges({ details }: { details: Record<string, unknown> }) {
  const style = String(details.style ?? "");
  const variant = String(details.variant ?? "");
  if (!style && !variant) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {style && (
        <span className="rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] font-semibold text-[#7444cf]">
          {style}
        </span>
      )}
      {variant && (
        <span className="rounded-full bg-[#ebe7ff] px-3 py-1.5 text-[12px] font-semibold text-[#7444cf]">
          {variant}
        </span>
      )}
    </div>
  );
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
  details: Record<string, unknown>;
  onBack: () => void;
  onTakePhoto: () => void;
  onAllowCamera: () => void;
  onUploadPhoto: (file: File) => void;
  showPermissionAlert?: boolean;
  onDismissPermissionAlert?: () => void;
}) {
  return (
    <LashesWizardShell>
      <WizardHeader onBack={onBack} title="Add photo" />
      <StyleBadges details={details} />
      <div className="rounded-[16px] bg-[#fcfcfd] p-4">
        <p className="text-[16px] font-bold text-black">
          What is the photo for?
        </p>
        <p className="mt-2 text-[14px] leading-[20px] text-[#667085]">
          The photo is used only to position the eyelash style and see how it
          approximately looks. It is not saved or processed.
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
            <span className="block text-[16px] font-bold text-black">
              Take a photo
            </span>
            <span className="block text-[14px] text-[#667085]">
              Use your device&apos;s camera
            </span>
          </span>
        </button>
        <label className="flex w-full cursor-pointer items-center gap-4 rounded-[16px] border border-[#d0d5dd] bg-[#fcfcfd] px-5 py-5 text-left">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#ebe7ff] text-[#7444cf]">
            <Upload className="size-5" />
          </span>
          <span>
            <span className="block text-[16px] font-bold text-black">
              Upload a photo
            </span>
            <span className="block text-[14px] text-[#667085]">
              Select from your gallery
            </span>
          </span>
          <input
            accept="image/*"
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUploadPhoto(file);
            }}
          />
        </label>
        <div className="flex items-start gap-2 rounded-[8px] border border-[#fedf89] bg-[#fffaeb] px-3 py-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#f79009]" />
          <p className="text-[11px] font-normal leading-[16px] text-[#b54708]">
            The preview is approximate and for visual purposes only. Actual
            results may vary.
          </p>
        </div>
      </div>
      {showPermissionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center">
            <p className="text-[18px] font-bold text-black">
              Camera permission required
            </p>
            <p className="mt-2 text-sm text-[#667085]">
              Allow camera access to take a client photo for lash preview.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <LashesPrimaryButton onClick={onAllowCamera}>
                Allow camera
              </LashesPrimaryButton>
              <LashesSecondaryButton
                onClick={() => onDismissPermissionAlert?.()}
              >
                Not now
              </LashesSecondaryButton>
            </div>
          </div>
        </div>
      )}
    </LashesWizardShell>
  );
}

export function LashesPhotoCaptureScreen({
  onBack,
  onCapture,
  capturing,
  error,
}: {
  onBack: () => void;
  onCapture: (file: File) => void;
  capturing?: boolean;
  error?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user" },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(
          "Camera access was denied or is unavailable. Upload a photo instead."
        );
      }
    }
    void startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) return;
    onCapture(
      new File([blob], `lashes-capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      })
    );
  };

  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-[20px] bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <button
          aria-label="Back"
          className="rounded-full bg-black/40 p-2"
          onClick={onBack}
          type="button"
        >
          <svg
            aria-hidden
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-sm font-semibold">Front camera</span>
        <span className="w-9" />
      </div>
      <video
        autoPlay
        className="absolute inset-0 size-full object-cover"
        muted
        playsInline
        ref={videoRef}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <div className="rounded-[24px] border-2 border-dashed border-white/70 px-8 py-16 text-center">
          <p className="text-sm font-semibold">Center your face here</p>
        </div>
        <p className="mt-6 rounded-full bg-black/50 px-4 py-2 text-xs">
          Keep both eyes visible
        </p>
        {(cameraError || error) && (
          <p className="mt-4 max-w-xs rounded-xl bg-[#fef3f2] px-3 py-2 text-center text-[12px] text-[#b42318]">
            {cameraError || error}
          </p>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <button
          aria-label="Capture photo"
          className="size-[72px] rounded-full border-4 border-white bg-white/20 disabled:opacity-50"
          disabled={Boolean(cameraError) || capturing}
          onClick={() => void captureFrame()}
          type="button"
        />
      </div>
    </div>
  );
}

export function LashesPhotoConfirmScreen({
  details,
  onBack,
  onConfirm,
  onReplace,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onConfirm: () => void;
  onReplace: () => void;
}) {
  const previewUrl = String(
    details.photoPreviewUrl ?? lashesBookingAssets.photoPlaceholder
  );
  const canUse = Boolean(details.photoPreviewUrl && details.photoStorageKey);

  return (
    <LashesWizardShell>
      <WizardHeader
        onBack={onBack}
        subtitle="Confirm the photo is clear and both eyes are visible."
        title="Confirm photo"
      />
      <img
        alt="Client reference"
        className="h-[431px] w-full rounded-[16px] object-cover"
        src={previewUrl}
      />
      {Boolean(!details.photoStorageKey && details.photoPreviewUrl) && (
        <p className="mt-2 text-[12px] text-[#b42318]">
          Upload the photo before continuing (camera capture must finish
          uploading).
        </p>
      )}
      <div className="flex flex-col gap-3 py-4">
        <LashesPrimaryButton disabled={!canUse} onClick={onConfirm}>
          Use this photo
        </LashesPrimaryButton>
        <LashesSecondaryButton onClick={onReplace}>
          Retake
        </LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesPhotoPreviewScreen({
  details,
  onBack,
  onChange,
  onContinue,
  onRetake,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onContinue: () => void;
  onRetake: () => void;
}) {
  const previewUrl = String(
    details.photoPreviewUrl ?? lashesBookingAssets.photoPlaceholder
  );
  const style = String(details.style ?? "");
  const variant = String(details.variant ?? "");
  const styleOptions = [
    { label: "Cat eye", value: "Cat eye" },
    { label: "Fox eye", value: "Fox" },
  ];

  return (
    <LashesWizardShell>
      <WizardHeader
        onBack={onBack}
        subtitle="Drag and drop styles onto your photo to instantly preview your look."
        title="Preview"
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-[12px] font-normal text-[#0c111d]">
              Styles
            </p>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map((option) => (
                <button
                  className={previewChipClass(style === option.value)}
                  key={option.value}
                  onClick={() => onChange({ style: option.value })}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-normal text-[#0c111d]">
              Variant
            </p>
            <div className="flex flex-wrap gap-2">
              {lashVariantOptions.map((option) => (
                <button
                  className={previewChipClass(variant === option.key)}
                  key={option.key}
                  onClick={() => onChange({ variant: option.key })}
                  type="button"
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 self-start rounded-full bg-[#ebe7ff] px-4 py-2 text-[12px] font-medium text-[#0c111d]"
          type="button"
        >
          <img alt="" className="size-6" src={lashesBookingAssets.swap} />
          Swap sides
        </button>
      </div>
      <img
        alt="Lash style preview"
        className="h-[431px] w-full rounded-[16px] object-cover"
        src={previewUrl}
      />
      <div className="flex flex-col gap-3 py-4">
        <LashesPrimaryButton onClick={onContinue}>
          Use this combination
        </LashesPrimaryButton>
        <LashesSecondaryButton onClick={onRetake}>
          Take a different photo
        </LashesSecondaryButton>
      </div>
    </LashesWizardShell>
  );
}

const previewChipClass = (active: boolean) =>
  cn(
    "rounded-full px-3 py-2 text-[12px] font-normal leading-none transition",
    active ? "bg-[#ebe7ff] text-[#0c111d]" : "bg-white text-[#475467]"
  );

export function LashesLashMapScreen({
  details,
  onBack,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onChange: (
    next:
      | Record<string, unknown>
      | ((current: Record<string, unknown>) => Record<string, unknown>)
  ) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const activeEye = String(details.activeLashEye ?? "rightEye");
  const lashMap = details.lashMap as
    | Partial<Record<"rightEye" | "leftEye", Array<{ position: number; length: number }>>>
    | undefined;
  const completedForEye = (eye: "rightEye" | "leftEye") => {
    const positions = new Set((lashMap?.[eye] ?? []).map((entry) => entry.position));
    return lashMapZoneNumbers.every((zone) => positions.has(zone));
  };
  const allEyesComplete = completedForEye("rightEye") && completedForEye("leftEye");
  const buttonLabel = allEyesComplete
    ? "Mark service as complete"
    : activeEye === "rightEye"
      ? "Continue to left eye"
      : "Continue to right eye";

  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashSection title="Lash style">
        <LashStylePicker
          onChange={(value) => onChange({ style: value })}
          value={String(details.style ?? "")}
        />
      </LashSection>
      <LashMapEditor details={details} onChange={onChange} />
      <LashSection title="Eye shape">
        <LashEyeShapePicker
          onChange={(value) => onChange({ eyeShape: value })}
          value={String(details.eyeShape ?? "")}
        />
      </LashSection>
      <LashSection title="Volume">
        <LashVolumePicker
          onChange={(value) => onChange({ volume: value })}
          value={String(details.volume ?? "")}
        />
      </LashSection>
      <LashSection title="Lash curl">
        <LashCurlPicker
          onChange={(value) => onChange({ curl: value })}
          value={String(details.curl ?? "")}
        />
      </LashSection>
      <LashSection title="Thickness">
        <LashThicknessPicker
          onChange={(value) => onChange({ thickness: value })}
          value={String(details.thickness ?? "")}
        />
      </LashSection>
      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>
          {buttonLabel}
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesThicknessScreen({
  details,
  onBack,
  onChange,
  onContinue,
  canContinue,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashSection title="Thickness">
        <LashThicknessPicker
          onChange={(value) => onChange({ thickness: value })}
          value={String(details.thickness ?? "")}
        />
      </LashSection>
      <div className="py-8">
        <LashesPrimaryButton disabled={!canContinue} onClick={onContinue}>
          Continue
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesLengthScreen({
  details,
  onBack,
  onChange,
  onComplete,
  canComplete,
}: {
  details: Record<string, unknown>;
  onBack: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onComplete: () => void;
  canComplete: boolean;
}) {
  return (
    <LashesWizardShell gap={lashesDetailsLayout.sectionGap}>
      <LashesDetailsCategoryHeader onBack={onBack} />
      <LashSection title="Length (mm)">
        <LashLengthPicker
          onChange={(value) =>
            onChange({
              defaultLength: value,
              lashMapLength: Number(value) || undefined,
            })
          }
          value={String(details.defaultLength ?? details.lashMapLength ?? "")}
        />
      </LashSection>
      <div className="py-8">
        <LashesPrimaryButton disabled={!canComplete} onClick={onComplete}>
          Mark service as complete
        </LashesPrimaryButton>
      </div>
    </LashesWizardShell>
  );
}

export function LashesOptionChip({
  label,
  active,
  onClick,
  trailing,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      className={cn(
        lashesSelectionShell(
          active,
          "flex h-[82px] min-w-0 items-center rounded-[16px] px-6 text-left"
        ),
        "w-full"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-[24px] font-normal leading-[30px] text-black">
        {label}
      </span>
      {trailing}
    </button>
  );
}
