import { useState } from 'react'
import { glamhourApi } from '../../../../services/glamhour-api'
import type { TreatmentMediaItem } from '../types'

const MAX_BYTES = 2 * 1024 * 1024

export function useTreatmentPhotoUpload(category: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<TreatmentMediaItem | null> => {
    if (file.size > MAX_BYTES) {
      setError('Please upload an image smaller than 2MB.')
      return null
    }
    setUploading(true)
    setError(null)
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result ?? '')
          const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Could not read the selected file.'))
        reader.readAsDataURL(file)
      })
      const saved = await glamhourApi.uploadTreatmentMedia({
        dataBase64,
        mimeType: file.type || 'image/jpeg',
        originalFilename: file.name,
        mediaType: 'reference',
        category,
      })
      return {
        storageKey: saved.storageKey,
        url: saved.url,
        mimeType: saved.mimeType,
        mediaType: 'reference',
        originalFilename: file.name,
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error, setError }
}
