type NominatimResult = {
  lat: string
  lon: string
  display_name: string
}

type CensusAddressMatch = {
  matchedAddress: string
  coordinates: {
    x: number
    y: number
  }
}

type CensusResponse = {
  result?: {
    addressMatches?: CensusAddressMatch[]
  }
}

type GeocodeResult = {
  latitude: string
  longitude: string
  label: string
  query: string
  provider: 'census' | 'nominatim'
}

type StructuredAddress = {
  street: string
  city: string
  state: string
  zip: string
}

type JsonpWindow = Window & typeof globalThis & Record<string, unknown>

function requestJsonp<T>(url: string) {
  return new Promise<T>((resolve, reject) => {
    const jsonpWindow = window as unknown as JsonpWindow
    const callbackName = `wanderJsonp_${crypto.randomUUID().replaceAll('-', '')}`
    const script = document.createElement('script')
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('The Census geocoder timed out.'))
    }, 10000)

    function cleanup() {
      window.clearTimeout(timeoutId)
      delete jsonpWindow[callbackName]
      script.remove()
    }

    jsonpWindow[callbackName] = (payload: T) => {
      cleanup()
      resolve(payload)
    }

    script.onerror = () => {
      cleanup()
      reject(new Error('The Census geocoder could not be reached.'))
    }

    script.src = `${url}&format=jsonp&callback=${callbackName}`
    document.body.appendChild(script)
  })
}

async function requestCensusAddress(address: StructuredAddress) {
  const params = new URLSearchParams({
    street: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
    benchmark: 'Public_AR_Current',
  })

  return requestJsonp<CensusResponse>(
    `https://geocoding.geo.census.gov/geocoder/locations/address?${params.toString()}`,
  )
}

async function requestNominatim(query: string) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '0',
    q: query,
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('The geocoding service did not respond successfully.')
  }

  return (await response.json()) as NominatimResult[]
}

function buildStructuredQuery(address: StructuredAddress) {
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ')
}

async function requestBestUsAddress(address: StructuredAddress): Promise<GeocodeResult | null> {
  if (!address.street || (!address.zip && (!address.city || !address.state))) {
    return null
  }

  const response = await requestCensusAddress(address)
  const match = response.result?.addressMatches?.[0]

  if (!match) {
    return null
  }

  return {
    latitude: Number(match.coordinates.y).toFixed(6),
    longitude: Number(match.coordinates.x).toFixed(6),
    label: match.matchedAddress,
    query: buildStructuredQuery(address),
    provider: 'census',
  }
}

export async function lookupCoordinates(
  queries: string | string[],
  structuredAddress?: StructuredAddress,
) {
  const candidates = Array.isArray(queries) ? queries : [queries]
  let lastNetworkError: Error | null = null

  if (structuredAddress) {
    try {
      const censusResult = await requestBestUsAddress(structuredAddress)

      if (censusResult) {
        return censusResult
      }
    } catch (error) {
      if (error instanceof Error) {
        lastNetworkError = error
      }
    }
  }

  for (const query of candidates) {
    try {
      const results = await requestNominatim(query)
      const match = results[0]

      if (!match) {
        continue
      }

      return {
        latitude: Number(match.lat).toFixed(6),
        longitude: Number(match.lon).toFixed(6),
        label: match.display_name,
        query,
        provider: 'nominatim',
      }
    } catch (error) {
      if (error instanceof Error) {
        lastNetworkError = error
      }
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError
  }

  throw new Error('No coordinate match was found. Try putting the full postal address in the Address field and keep Street only for your own grouping.')
}