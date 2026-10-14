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

export function loadGoogleMapsPlaces(apiKey: string) {
  if ((window as GoogleMapsWindow).google?.maps?.importLibrary) {
    return Promise.resolve()
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-places]')

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google Maps could not load.')), { once: true })
      return
    }

    const googleWindow = window as GoogleMapsWindow
    googleWindow.gm_authFailure = () => {
      reject(new Error('Google Maps rejected this API key. Check billing, enabled APIs, and website restrictions.'))
      googleMapsPromise = null
    }
    googleWindow.__glamhourGoogleMapsReady = () => {
      if (googleWindow.google?.maps?.importLibrary) {
        resolve()
        return
      }

      googleMapsPromise = null
      reject(new Error('Google Maps loaded without library support. Enable Maps JavaScript API for this key.'))
    }

    const script = document.createElement('script')
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
    script.addEventListener('error', () => {
      googleMapsPromise = null
      reject(new Error('Google Maps could not load.'))
    }, { once: true })
    document.head.append(script)
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

  if (!PlaceAutocompleteElement) {
    throw new Error('Google Places could not initialize. Enable Places API (New) for this key.')
  }

  const autocomplete = new PlaceAutocompleteElement()
  autocomplete.placeholder = placeholder
  autocomplete.className = 'google-place-autocomplete'
  let isActive = true

  const handleInput = (event: Event) => {
    const input = event.composedPath().find((item): item is HTMLInputElement => item instanceof HTMLInputElement)
    onQueryChange?.(input?.value ?? autocomplete.value ?? '')
  }

  const handlePlaceSelect = async (event: GooglePlaceSelectEvent) => {
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
      if (isActive) {
        onError?.(error)
      }
    }
  }

  const handleError = () => {
    onError?.(new Error('Google Places search is unavailable.'))
  }

  container.replaceChildren(autocomplete)
  autocomplete.addEventListener('input', handleInput)
  autocomplete.addEventListener('gmp-select', handlePlaceSelect)
  autocomplete.addEventListener('gmp-error', handleError)

  return () => {
    isActive = false
    autocomplete.removeEventListener('input', handleInput)
    autocomplete.removeEventListener('gmp-select', handlePlaceSelect)
    autocomplete.removeEventListener('gmp-error', handleError)
    autocomplete.remove()
  }
}
