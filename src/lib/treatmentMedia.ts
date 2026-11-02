type TreatmentMediaSource = {
  url?: string | null
  storageKey?: string | null
  storage_key?: string | null
}

const defaultApiBase = import.meta.env?.VITE_API_URL ?? 'http://127.0.0.1:3001/api'

/** Resolve stored photos against the API serving the current application. */
export function resolveTreatmentMediaUrl(media: TreatmentMediaSource, apiBase = defaultApiBase): string {
  const base = apiBase.replace(/\/+$/, '')
  const url = media.url?.trim() ?? ''
  const storageKey = media.storageKey || media.storage_key
  const fromStorage = storageKey ? `${base}/media/${storageKey.replace(/^\/+/, '')}` : ''
  if (!url) return fromStorage
  if (/^(data:image\/|blob:)/i.test(url)) return url
  if (url.startsWith('//')) return url

  if (/^https?:\/\//i.test(url)) {
    let saved: URL
    try { saved = new URL(url) } catch { return fromStorage }
    // Older uploads persisted the server's localhost URL (or a previous API
    // host). The same storage key remains available from the current API.
    const mediaPath = saved.pathname.match(/^\/api\/media\/(.+)$/)
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(saved.hostname)
    if (mediaPath && (storageKey || localHost)) return fromStorage || `${base}/media/${mediaPath[1]}`
    return url
  }
  if (url.startsWith('/api/media/')) return fromStorage || `${base}/media/${url.slice('/api/media/'.length)}`
  if (url.startsWith('/media/')) return fromStorage || `${base}${url}`
  // Ordinary root-relative images belong to the page (for example local
  // preview assets), not to a separately hosted API.
  if (url.startsWith('/')) return url
  return fromStorage || url
}

export function resolveTreatmentPhotoUrl(details: Record<string, unknown>): string {
  const mediaItems = Array.isArray(details.mediaItems) ? details.mediaItems : []
  const reference = mediaItems.find((item): item is TreatmentMediaSource & { mediaType?: string; media_type?: string } => (
    item !== null && typeof item === 'object' && (item.mediaType === 'reference' || item.media_type === 'reference')
  ))
  const photoUrl = typeof details.photoPreviewUrl === 'string' && details.photoPreviewUrl
    ? details.photoPreviewUrl
    : typeof details.photoPreview === 'string' ? details.photoPreview : reference?.url
  return resolveTreatmentMediaUrl({
    url: photoUrl || reference?.url,
    storageKey: typeof details.photoStorageKey === 'string' && details.photoStorageKey
      ? details.photoStorageKey : reference?.storageKey || reference?.storage_key,
  })
}
