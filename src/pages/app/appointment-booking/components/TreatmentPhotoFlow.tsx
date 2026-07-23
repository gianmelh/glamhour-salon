import { Camera } from 'lucide-react'
import { Button } from '../../../../components'
import { lashesBookingAssets } from '../assets'
import { useTreatmentPhotoUpload } from '../hooks/useTreatmentPhotoUpload'
import type { TreatmentMediaItem } from '../types'

const photoCopy: Record<string, { subtitle: string; title: string }> = {
  nails: {
    title: 'Client reference photo',
    subtitle: 'Upload a reference photo for nail shape, length, or art. Stored securely on the salon server.',
  },
  lashes: {
    title: 'Client reference photo',
    subtitle: 'Upload a reference photo for lash mapping. Stored securely on the salon server.',
  },
  cosmetology: {
    title: 'Client reference photo',
    subtitle: 'Upload a before or reference photo for this facial treatment. Stored securely on the salon server.',
  },
  micropigmentation: {
    title: 'Client reference photo',
    subtitle: 'Upload a reference photo for brow, lip, or liner design. Stored securely on the salon server.',
  },
}

export function TreatmentPhotoFlow({ category, title, details, onChange }: {
  category: string
  title?: string
  details: Record<string, unknown>
  onChange: (details: Record<string, unknown>) => void
}) {
  const { upload, uploading, error } = useTreatmentPhotoUpload(category)
  const copy = photoCopy[category] ?? photoCopy.lashes
  const resolvedTitle = title ?? copy.title
  const previewUrl = String(details.photoPreviewUrl ?? details.photoPreview ?? '')
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
        <img alt="Client preview" className="mx-auto h-44 w-full rounded-[18px] object-cover" src={previewUrl} />
      ) : (
        <img alt="" className="mx-auto h-44 w-full rounded-[18px] object-contain" src={lashesBookingAssets.photoPlaceholder} />
      )}
      <p className="mt-3 text-sm font-bold">{resolvedTitle}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-xs text-[#68738b]">{copy.subtitle}</p>
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
        <Button className="mt-2" onClick={() => onChange({ ...details, photoPreviewUrl: '', photoStorageKey: '', mediaItems: mediaItems.filter((item) => item.mediaType !== 'reference') })} type="button" variant="outline">
          Remove photo
        </Button>
      )}
      <label className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#111827]">
        <input
          checked={Boolean(details.photoConsent)}
          type="checkbox"
          onChange={(event) => onChange({ ...details, photoConsent: event.target.checked })}
        />
        Client authorizes photo storage for this appointment
      </label>
    </div>
  )
}
