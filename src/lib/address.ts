import type { HouseRecord, MapConfig } from '../types'

export type StructuredAddress = {
  street: string
  city: string
  state: string
  zip: string
}

function uniqueParts(parts: string[]) {
  const seen = new Set<string>()

  return parts.filter((part) => {
    const normalized = part.trim().toLowerCase()

    if (!normalized || seen.has(normalized)) {
      return false
    }

    seen.add(normalized)
    return true
  })
}

export function buildPostalAddress(house: HouseRecord, config: MapConfig) {
  const cityStatePostal = [config.locality.trim(), [config.region.trim(), config.postalCode.trim()].filter(Boolean).join(' ') ]
    .filter(Boolean)
    .join(', ')

  return uniqueParts([house.address.trim(), cityStatePostal]).join(', ')
}

export function getStreetName(house: HouseRecord) {
  const explicitStreet = house.street.trim()

  if (explicitStreet) {
    return explicitStreet
  }

  const firstLine = house.address.trim().split(',')[0]?.trim() ?? ''
  const inferredStreet = firstLine.replace(/^\d+[A-Za-z0-9/-]*\s+/, '').trim()

  return inferredStreet
}

export function buildAddressCandidates(house: HouseRecord, config: MapConfig) {
  const address = house.address.trim()
  const postalAddress = buildPostalAddress(house, config)
  const candidates: string[] = []

  function addCandidate(value: string) {
    const candidate = value.trim()

    if (!candidate) {
      return
    }

    if (!candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  addCandidate(address)
  addCandidate(postalAddress)

  return candidates
}

export function buildStructuredAddress(house: HouseRecord, config: MapConfig): StructuredAddress {
  return {
    street: house.address.trim(),
    city: config.locality.trim(),
    state: config.region.trim(),
    zip: config.postalCode.trim(),
  }
}