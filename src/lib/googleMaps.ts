type GoogleMapsWindow = Window &
  typeof globalThis & {
    __glamhourGoogleMapsReady?: () => void
    gm_authFailure?: () => void
    google?: {
      maps?: {
        importLibrary?: (libraryName: 'places') => Promise<{
          PlaceAutocompleteElement: new (options?: Record<string, unknown>) => GooglePlaceAutocompleteElement
        }>
        places?: object
      }
    }
  }

type GooglePlace = {
  displayName?: string
  formattedAddress?: string
  id?: string
  fetchFields: (options: { fields: string[] }) => Promise<void>
}

type GooglePlaceSelectEvent = Event & {
  placePrediction?: {
    toPlace: () => GooglePlace
  }
}

type GooglePlaceAutocompleteElement = HTMLElement & {
  placeholder: string
  disabled: boolean
  value?: string
  addEventListener: (
    type: 'gmp-select' | 'gmp-error' | 'input',
    listener: ((event: GooglePlaceSelectEvent) => void) | ((event: Event) => void),
    options?: boolean | AddEventListenerOptions,
  ) => void
  removeEventListener: (
    type: 'gmp-select' | 'gmp-error' | 'input',
    listener: ((event: GooglePlaceSelectEvent) => void) | ((event: Event) => void),
    options?: boolean | EventListenerOptions,
  ) => void
}

export type GoogleSelectedPlace = {
  formattedAddress: string
  placeId: string
}

let googleMapsPromise: Promise<void> | null = null
let googleMapsAuthError: Error | null = null
let authFailureHandlerInstalled = false
const authFailureListeners = new Set<(error: Error) => void>()

function installAuthFailureHandler() {
  if (authFailureHandlerInstalled) return
  authFailureHandlerInstalled = true
  const googleWindow = window as GoogleMapsWindow
  const previousHandler = googleWindow.gm_authFailure
  googleWindow.gm_authFailure = () => {
    googleMapsAuthError = new Error('Google Maps rejected this API key. Check billing, enabled APIs, and website restrictions.')
    // Authentication can fail after the script's ready callback has resolved.
    for (const listener of [...authFailureListeners]) listener(googleMapsAuthError)
    previousHandler?.()
  }
}

export function loadGoogleMapsPlaces(apiKey: string) {
  installAuthFailureHandler()
  if (googleMapsAuthError) return Promise.reject(googleMapsAuthError)

  if ((window as GoogleMapsWindow).google?.maps?.importLibrary) {
    return Promise.resolve()
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-places]')
    const script = existingScript ?? document.createElement('script')
    const googleWindow = window as GoogleMapsWindow
    const cleanup = () => {
      script.removeEventListener('error', handleError)
      authFailureListeners.delete(fail)
    }
    const fail = (error: Error) => {
      cleanup()
      // A later visit must not wait for load/error events on an already failed script.
      script.remove()
      reject(error)
    }
    const handleError = () => fail(new Error('Google Maps could not load.'))
    const handleLoad = () => {
      if (googleWindow.google?.maps?.importLibrary) {
        cleanup()
        resolve()
        return
      }
      fail(new Error('Google Maps loaded without library support. Enable Maps JavaScript API for this key.'))
    }

    googleWindow.__glamhourGoogleMapsReady = handleLoad
    authFailureListeners.add(fail)
    script.addEventListener('error', handleError, { once: true })
    if (existingScript) return

    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: '__glamhourGoogleMapsReady',
    })

    script.async = true
    script.defer = true
    script.dataset.googleMapsPlaces = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    document.head.append(script)
  }).catch((error: unknown) => {
    googleMapsPromise = null
    throw error
  })

  return googleMapsPromise
}

export async function attachGooglePlaceAutocomplete({
  apiKey,
  container,
  onError,
  onQueryChange,
  onPlaceSelect,
  placeholder,
  signal,
}: {
  apiKey: string
  container: HTMLElement
  onError?: (error: unknown) => void
  onQueryChange?: (value: string) => void
  onPlaceSelect: (place: GoogleSelectedPlace) => void
  placeholder: string
  signal?: AbortSignal
}) {
  await loadGoogleMapsPlaces(apiKey)

  const mapsWindow = window as GoogleMapsWindow
  const placesLibrary = await mapsWindow.google?.maps?.importLibrary?.('places')
  const PlaceAutocompleteElement = placesLibrary?.PlaceAutocompleteElement

  // An older, cancelled effect must not replace a newer widget in this container.
  if (signal?.aborted) {
    return () => {}
  }
  if (googleMapsAuthError) throw googleMapsAuthError

  if (!PlaceAutocompleteElement) {
    throw new Error('Google Places could not initialize. Enable Places API (New) for this key.')
  }

  const autocomplete = new PlaceAutocompleteElement()
  autocomplete.placeholder = placeholder
  autocomplete.className = 'google-place-autocomplete'
  let isActive = true

  const handleInput = (event: Event) => {
    if (!isActive) return
    const input = event.composedPath().find((item): item is HTMLInputElement => item instanceof HTMLInputElement)
    onQueryChange?.(input?.value ?? autocomplete.value ?? '')
  }

  const handlePlaceSelect = async (event: GooglePlaceSelectEvent) => {
    if (!isActive) return
    try {
      const place = event.placePrediction?.toPlace()
      if (!place) {
        return
      }

      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'id'] })
      const formattedAddress = place.formattedAddress ?? place.displayName ?? ''

      if (isActive && formattedAddress) {
        onPlaceSelect({
          formattedAddress,
          placeId: place.id ?? '',
        })
      }
    } catch (error) {
      fail(error)
    }
  }

  const handleError = () => {
    fail(new Error('Google Places search is unavailable.'))
  }

  const cleanup = () => {
    isActive = false
    autocomplete.disabled = true
    authFailureListeners.delete(fail)
    signal?.removeEventListener('abort', cleanup)
    autocomplete.removeEventListener('input', handleInput)
    autocomplete.removeEventListener('gmp-select', handlePlaceSelect)
    autocomplete.removeEventListener('gmp-error', handleError)
    autocomplete.remove()
  }
  const fail = (error: unknown) => {
    if (!isActive) return
    cleanup()
    onError?.(error)
  }

  autocomplete.addEventListener('input', handleInput)
  autocomplete.addEventListener('gmp-select', handlePlaceSelect)
  autocomplete.addEventListener('gmp-error', handleError)
  authFailureListeners.add(fail)
  signal?.addEventListener('abort', cleanup, { once: true })
  container.replaceChildren(autocomplete)

  return cleanup
}
