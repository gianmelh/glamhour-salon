type GoogleMapsWindow = Window &
  typeof globalThis & {
    __glamhourGoogleMapsReady?: () => void
    gm_authFailure?: () => void
    google?: {
      maps?: {
        importLibrary?: (libraryName: 'places') => Promise<{
          PlaceAutocompleteElement: new (options?: Record<string, unknown>) => GooglePlaceAutocompleteElement
        }>
        places?: {
        }
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
  addEventListener: (
    type: 'gmp-select',
    listener: (event: GooglePlaceSelectEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ) => void
  removeEventListener: (
    type: 'gmp-select',
    listener: (event: GooglePlaceSelectEvent) => void,
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
  onPlaceSelect,
  placeholder,
}: {
  apiKey: string
  container: HTMLElement
  onPlaceSelect: (place: GoogleSelectedPlace) => void
  placeholder: string
}) {
  await loadGoogleMapsPlaces(apiKey)

  const mapsWindow = window as GoogleMapsWindow
  const placesLibrary = await mapsWindow.google?.maps?.importLibrary?.('places')
  const PlaceAutocompleteElement = placesLibrary?.PlaceAutocompleteElement

  if (!PlaceAutocompleteElement) {
    throw new Error('Google Places could not initialize. Enable Places API (New) for this key.')
  }

  const autocomplete = new PlaceAutocompleteElement()
  autocomplete.placeholder = placeholder
  autocomplete.className = 'google-place-autocomplete'

  const handlePlaceSelect = async (event: GooglePlaceSelectEvent) => {
    const place = event.placePrediction?.toPlace()
    if (!place) {
      return
    }

    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'id'] })
    const formattedAddress = place.formattedAddress ?? place.displayName ?? ''

    if (formattedAddress) {
      onPlaceSelect({
        formattedAddress,
        placeId: place.id ?? '',
      })
    }
  }

  container.replaceChildren(autocomplete)
  autocomplete.addEventListener('gmp-select', handlePlaceSelect)

  return () => {
    autocomplete.removeEventListener('gmp-select', handlePlaceSelect)
    autocomplete.remove()
  }
}
