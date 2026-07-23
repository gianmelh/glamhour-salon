import { useEffect, useRef, useState } from 'react'
import type { CategoryStepProps } from '../../appointment-booking/types'
import { useTreatmentPhotoUpload } from '../../appointment-booking/hooks/useTreatmentPhotoUpload'
import type { TreatmentMediaItem } from '../../appointment-booking/types'
import { lashesBookingAssets } from '../assets'
import { lashesDetailsLayout } from '../lashesDetailsSpec'
import {
  canAdvanceLashesStep,
  getNextLashesRegistrationStep,
  getPreviousLashesRegistrationStep,
  LASHES_REGISTRATION_STEP_KEY,
  readLashesRegistrationStep,
  type LashesRegistrationStep,
} from '../lashesRegistrationFlow'
import {
  LashesDetailsCoreScreen,
  LashesLashMapScreen,
  LashesLengthScreen,
  LashesPhotoCaptureScreen,
  LashesPhotoConfirmScreen,
  LashesPhotoMethodScreen,
  LashesPhotoPreviewScreen,
  LashesSelectVariantScreen,
  LashesStylePreviewScreen,
  LashesThicknessScreen,
} from './LashesFlowScreens'

export function LashesRegistrationFlow({
  services,
  selectedServiceId,
  details,
  onChange,
  onBack,
  onNext,
}: CategoryStepProps) {
  const step = readLashesRegistrationStep(details)
  const [showPermissionAlert, setShowPermissionAlert] = useState(false)
  const completingRef = useRef(false)
  const { upload, uploading } = useTreatmentPhotoUpload('lashes')

  useEffect(() => {
    if (!selectedServiceId && services[0]) {
      onChange({ serviceId: services[0].id })
    }
  }, [onChange, selectedServiceId, services])

  const setStep = (nextStep: LashesRegistrationStep) => {
    onChange({ details: { [LASHES_REGISTRATION_STEP_KEY]: nextStep } })
  }

  const setDetails = (
    patch: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    onChange({ details: patch })
  }

  const updateDetails = (patch: Record<string, unknown>) => {
    setDetails((current) => ({ ...current, ...patch }))
  }

  const goBack = () => {
    const previous = getPreviousLashesRegistrationStep(step, details)
    if (previous === 'exit') {
      onBack()
      return
    }
    setStep(previous)
  }

  const goNext = (options?: { skipCapture?: boolean }) => {
    const next = getNextLashesRegistrationStep(step, details, options)
    if (next) {
      setStep(next)
      return
    }
    completeService()
  }

  const completeService = () => {
    if (completingRef.current) return
    completingRef.current = true

    const resolvedServiceId = services.find((service) => service.id === selectedServiceId)?.id
      ?? services.find((service) => service.is_active)?.id
      ?? services[0]?.id
      ?? ''

    onChange({ serviceId: resolvedServiceId })
    onNext()
  }

  const handleUploadPhoto = async (file: File) => {
    const saved = await upload(file)
    if (!saved) return
    const mediaItems = (details.mediaItems as TreatmentMediaItem[] | undefined) ?? []
    setDetails((current) => ({
      ...current,
      photoPreviewUrl: saved.url,
      photoStorageKey: saved.storageKey,
      photoCapturePending: false,
      mediaItems: [...mediaItems.filter((item) => item.mediaType !== 'reference'), saved],
    }))
    setStep('photo-confirm')
  }

  const handleCapturePhoto = () => {
    setShowPermissionAlert(true)
  }

  const handleAllowCamera = () => {
    setShowPermissionAlert(false)
    updateDetails({ photoCapturePending: true })
    setStep('photo-capture')
  }

  const handleSimulatedCapture = () => {
    updateDetails({
      photoPreviewUrl: lashesBookingAssets.photoPlaceholder,
      photoCapturePending: true,
    })
    setStep('photo-confirm')
  }

  const canContinue = canAdvanceLashesStep(step, details)

  return (
    <div
      className="mx-auto w-full min-w-0 bg-[#f2f5ff]"
      style={{ maxWidth: lashesDetailsLayout.frameWidth }}
    >
      <div
        className="flex min-w-0 flex-col"
        style={{
          paddingInline: lashesDetailsLayout.paddingX,
          paddingTop: lashesDetailsLayout.paddingTop,
          paddingBottom: 32,
        }}
      >
        {step === 'details' && (
          <LashesDetailsCoreScreen
            canContinue={canContinue}
            details={details}
            onBack={goBack}
            onChange={updateDetails}
            onContinue={() => goNext()}
            onOpenStylePreview={() => setStep('style-preview')}
          />
        )}

        {step === 'style-preview' && (
          <LashesStylePreviewScreen
            details={details}
            onBack={() => setStep('details')}
            onContinue={() => setStep('select-variant')}
          />
        )}

        {step === 'select-variant' && (
          <LashesSelectVariantScreen
            canContinue={canContinue}
            details={details}
            onBack={goBack}
            onBackToStyles={() => setStep('details')}
            onChange={updateDetails}
            onContinue={() => goNext()}
          />
        )}

        {step === 'photo-method' && (
          <LashesPhotoMethodScreen
            details={details}
            onBack={goBack}
            onDismissPermissionAlert={() => setShowPermissionAlert(false)}
            onAllowCamera={handleAllowCamera}
            onTakePhoto={handleCapturePhoto}
            onUploadPhoto={(file) => void handleUploadPhoto(file)}
            showPermissionAlert={showPermissionAlert}
          />
        )}

        {step === 'photo-capture' && (
          <LashesPhotoCaptureScreen onBack={goBack} onCapture={() => void handleSimulatedCapture()} />
        )}

        {step === 'photo-confirm' && (
          <LashesPhotoConfirmScreen
            details={details}
            onBack={goBack}
            onConfirm={() => setStep('photo-preview')}
            onReplace={() => setStep('photo-method')}
          />
        )}

        {step === 'photo-preview' && (
          <LashesPhotoPreviewScreen
            details={details}
            onBack={goBack}
            onContinue={() => setStep('lash-map')}
          />
        )}

        {step === 'lash-map' && (
          <LashesLashMapScreen
            canContinue={canContinue}
            details={details}
            onBack={goBack}
            onChange={setDetails}
            onContinue={() => goNext()}
          />
        )}

        {step === 'thickness' && (
          <LashesThicknessScreen
            canContinue={canContinue}
            details={details}
            onBack={goBack}
            onChange={updateDetails}
            onContinue={() => goNext()}
          />
        )}

        {step === 'length' && (
          <LashesLengthScreen
            canComplete={canContinue}
            details={details}
            onBack={goBack}
            onChange={updateDetails}
            onComplete={completeService}
          />
        )}

        {uploading && step === 'photo-method' && (
          <p className="mt-4 text-center text-sm font-semibold text-[#7444cf]">Uploading photo...</p>
        )}
      </div>
    </div>
  )
}
