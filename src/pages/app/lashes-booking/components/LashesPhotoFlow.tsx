import { Camera } from 'lucide-react'
import { Button } from '../../../../components'
import { useTreatmentPhotoUpload } from '../../appointment-booking/hooks/useTreatmentPhotoUpload'
import type { TreatmentMediaItem } from '../../appointment-booking/types'
import { lashesBookingAssets } from '../assets'

export function LashesPhotoFlow({ details, onChange }: {
  details: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  const { upload, uploading, error } = useTreatmentPhotoUpload('lashes')
  const previewUrl = String(details.photoPreviewUrl ?? '')
  const mediaItems = (details.mediaItems as TreatmentMediaItem[] | undefined) ?? []

  const handleFile = async (file: File) => {
    const saved = await upload(file)
    if (!saved) return
    onChange({
      ...details,
      photoPreviewUrl: saved.url,
      photoStorageKey: saved.storageKey,
      photoConsent: details.photoConsent ?? false,
      mediaItems: [...mediaItems.filter((item) => item.mediaType !== 'reference'), saved],
    })
  }

  return (
    <div className="rounded-[20px] bg-[#f8f9ff] p-4 text-center">
      {previewUrl ? (
        <img alt="Client lash reference" className="mx-auto h-44 w-full rounded-[18px] object-cover" src={previewUrl} />
      ) : (
        <img alt="" className="mx-auto h-44 w-full rounded-[18px] object-contain" src={lashesBookingAssets.photoPlaceholder} />
      )}
      <p className="mt-3 text-sm font-bold">Client reference photo</p>
      <p className="mx-auto mt-1 max-w-[260px] text-xs text-[#68738b]">
        Upload a reference photo for lash mapping. Stored securely on the salon server.
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[#d8deec] bg-white px-4 py-2 text-sm font-bold text-[#111827]">
        <Camera className="size-4" />
        {uploading ? 'Uploading...' : previewUrl ? 'Replace photo' : 'Upload photo'}
        <input
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={uploading}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
      </label>
      {previewUrl && (
        <Button
          className="mt-2"
          onClick={() => onChange({ ...details, photoPreviewUrl: '', photoStorageKey: '', mediaItems: mediaItems.filter((item) => item.mediaType !== 'reference') })}
          type="button"
          variant="outline"
        >
          Remove photo
        </Button>
      )}
      <label className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#111827]">
        <input
          checked={Boolean(details.photoConsent)}
          type="checkbox"
          onChange={(event) => onChange({ ...details, photoConsent: event.target.checked })}
        />
        Client authorizes lash photo storage for this appointment
      </label>
    </div>
  )
}
