import { useEffect, useRef, useState } from 'react'
import type { ServiceCategory } from '../../../../types/api'
import { glamhourApi } from '../../../../services/glamhour-api'
import type { CategoryStepProps } from '../../appointment-booking/types'
import { useTreatmentPhotoUpload } from '../../appointment-booking/hooks/useTreatmentPhotoUpload'
import type { TreatmentMediaItem } from '../../appointment-booking/types'
import { lashesDetailsLayout } from '../lashesDetailsSpec'
import {
  canAdvanceLashesStep,
  getNextLashesRegistrationStep,
  getPreviousLashesRegistrationStep,
  isDetailsCoreComplete,
  LASHES_REGISTRATION_STEP_KEY,
  readLashesRegistrationStep,
  type LashesRegistrationStep,
} from '../lashesRegistrationFlow'
import { getLashEyeProgress, isLashMapComplete } from '../lashesDetailsValidation'
import type { LashEyeName, LashesDetails } from '../types'
import {
  LashesDetailsCoreScreen,
  LashesLashMapScreen,
  LashesPhotoCaptureScreen,
  LashesPhotoConfirmScreen,
  LashesPhotoMethodScreen,
  LashesPhotoPreviewScreen,
  LashesSelectVariantScreen,
  LashesStylePreviewScreen,
} from './LashesFlowScreens'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function LashesRegistrationFlow({
  category,
  categorySource,
  onServiceCreated,
  services,
  selectedServiceId,
  details,
  onChange,
  onBack,
  onNext,
}: CategoryStepProps & { category?: ServiceCategory }) {
  const step = readLashesRegistrationStep(details)
  const [showPermissionAlert, setShowPermissionAlert] = useState(false)
  const [continueError, setContinueError] = useState('')
  const completingRef = useRef(false)
  const { upload, uploading, error: uploadError } = useTreatmentPhotoUpload('lashes')

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

  const currentLashEyeIsComplete = () => {
    const activeEye = (details.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
    const progress = getLashEyeProgress((details as LashesDetails).lashMap)
    const currentEye = progress.find((item) => item.eye === activeEye)
    return Boolean(currentEye && currentEye.completed >= currentEye.total)
  }

  const completeVisibleLashMap = (data: LashesDetails) => {
    const activeEye = (details.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
    const otherEye = activeEye === 'rightEye' ? 'leftEye' : 'rightEye'
    const activeEntries = data.lashMap?.[activeEye] ?? []
    const nextDetails = {
      ...details,
      lashMap: {
        ...(data.lashMap ?? {}),
        [activeEye]: activeEntries,
        [otherEye]: data.lashMap?.[otherEye]?.length ? data.lashMap[otherEye] : activeEntries,
      },
    }
    void completeService(nextDetails)
  }

  const continueFromLashMap = () => {
    const data = details as LashesDetails
    if (!isDetailsCoreComplete(details)) return
    setContinueError('')
    if (isLashMapComplete(data.lashMap)) {
      goNext()
      return
    }

    const activeEye = (details.activeLashEye as LashEyeName | undefined) ?? 'rightEye'
    const progress = getLashEyeProgress(data.lashMap)
    const currentEye = progress.find((item) => item.eye === activeEye)
    const otherEye = activeEye === 'rightEye' ? 'leftEye' : 'rightEye'
    const otherProgress = progress.find((item) => item.eye === otherEye)

    if (
      currentEye
      && currentEye.completed >= currentEye.total
    ) {
      if (!otherProgress || otherProgress.completed < otherProgress.total) {
        completeVisibleLashMap(data)
        return
      }
      goNext()
    }
  }

  const ensureSelectedService = async () => {
    if (selectedServiceId && services.some((service) => service.id === selectedServiceId)) {
      return selectedServiceId
    }
    const activeService = services.find((service) => service.is_active) ?? services[0]
    if (activeService) return activeService.id

    const categoryId = category?.id && uuidPattern.test(category.id)
      ? category.id
      : categorySource?.find((item) => item.code === 'lashes' && uuidPattern.test(item.id))?.id

    const style = String(details.style ?? 'Lashes')
    const variant = String(details.variant ?? 'Service')
    const service = await glamhourApi.createService({
      ...(categoryId ? { categoryId } : { categoryCode: 'lashes' }),
      name: `${style} - ${variant}`,
      description: 'Created from lashes booking flow.',
      durationMinutes: 90,
      priceMinor: 0,
      isPubliclyBookable: true,
      assignToActiveProviders: true,
    })
    onServiceCreated?.(service)
    return service.id
  }

  const completeService = async (requestedDetails = details) => {
    if (completingRef.current) return
    completingRef.current = true

    try {
      const resolvedServiceId = await ensureSelectedService()
      onNext({
        serviceId: resolvedServiceId,
        details: requestedDetails,
      })
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : 'Could not continue to appointment details.')
      completingRef.current = false
    }
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

  const canContinue = canAdvanceLashesStep(step, details)
  const canContinueLashMap = canContinue || (
    step === 'lash-map'
    && isDetailsCoreComplete(details)
    && currentLashEyeIsComplete()
  )

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
          <LashesPhotoCaptureScreen
            capturing={uploading}
            error={uploadError}
            onBack={goBack}
            onCapture={(file) => void handleUploadPhoto(file)}
          />
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
            onChange={updateDetails}
            onContinue={() => setStep('lash-map')}
            onRetake={() => setStep('photo-method')}
          />
        )}

        {step === 'lash-map' && (
          <>
            <LashesLashMapScreen
              canContinue={canContinueLashMap}
              details={details}
              onBack={goBack}
              onChange={setDetails}
              onContinue={continueFromLashMap}
            />
            {continueError && (
              <p className="mt-4 rounded-[12px] bg-[#fef3f2] px-4 py-3 text-sm text-[#b42318]">
                {continueError}
              </p>
            )}
          </>
        )}

        {uploading && step === 'photo-method' && (
          <p className="mt-4 text-center text-sm font-semibold text-[#7444cf]">Uploading photo...</p>
        )}
      </div>
    </div>
  )
}
