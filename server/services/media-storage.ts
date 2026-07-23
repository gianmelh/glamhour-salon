import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { ApiError } from '../errors.js'

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function extensionForMime(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    default: return 'bin'
  }
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
}

export function mediaPublicUrl(storageKey: string) {
  return `${config.MEDIA_PUBLIC_BASE}/media/${storageKey}`
}

export async function saveSalonMedia(input: {
  salonId: string
  dataBase64: string
  mimeType: string
  originalFilename?: string
  category?: string
}) {
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new ApiError(400, 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.')
  }

  const buffer = Buffer.from(input.dataBase64, 'base64')
  if (!buffer.length) {
    throw new ApiError(400, 'The uploaded file is empty.')
  }
  if (buffer.length > config.MAX_UPLOAD_BYTES) {
    throw new ApiError(413, 'The uploaded photo is too large. Please choose an image under 2MB.')
  }

  const ext = extensionForMime(input.mimeType)
  const baseName = input.originalFilename
    ? safeFilename(input.originalFilename.replace(/\.[^.]+$/, ''))
    : randomUUID()
  const filename = `${randomUUID()}${baseName ? `-${baseName}` : ''}.${ext}`
  const storageKey = `salons/${input.salonId}/treatment-media/${input.category ?? 'general'}/${filename}`
  const absolutePath = path.join(config.UPLOAD_DIR, storageKey)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)

  return {
    storageKey,
    url: mediaPublicUrl(storageKey),
    mimeType: input.mimeType,
    size: buffer.length,
  }
}
