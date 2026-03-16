import type { AppData, ValidationIssue } from '../types'

function parseCoordinate(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function validateAppData(data: AppData) {
  const issues: ValidationIssue[] = []
  const addressMap = new Map<string, string>()
  const coordinateMap = new Map<string, string>()

  if (!data.config.neighborhoodName.trim()) {
    issues.push({
      severity: 'warning',
      message: 'Neighborhood name is empty. The export files will use a generic filename.',
    })
  }

  data.houses.forEach((house) => {
    if (!house.displayName.trim()) {
      issues.push({
        severity: 'error',
        houseId: house.id,
        message: `A house on ${house.address || 'an unnamed address'} is missing its display name.`,
      })
    }

    if (!house.address.trim()) {
      issues.push({
        severity: 'error',
        houseId: house.id,
        message: `${house.displayName || 'A house'} is missing its address.`,
      })
    }

    if (!house.street.trim()) {
      issues.push({
        severity: 'warning',
        houseId: house.id,
        message: `${house.displayName || 'A house'} has no street name, which makes search and grouping harder later.`,
      })
    }

    const addressKey = `${house.address.trim().toLowerCase()}|${house.street.trim().toLowerCase()}`
    if (house.address.trim()) {
      if (addressMap.has(addressKey)) {
        issues.push({
          severity: 'warning',
          houseId: house.id,
          message: `${house.displayName || house.address} shares the same address as ${addressMap.get(addressKey)}.`,
        })
      } else {
        addressMap.set(addressKey, house.displayName || house.address)
      }
    }

    const latitude = parseCoordinate(house.latitude)
    const longitude = parseCoordinate(house.longitude)

    if ((house.latitude.trim() && Number.isNaN(latitude)) || (house.longitude.trim() && Number.isNaN(longitude))) {
      issues.push({
        severity: 'error',
        houseId: house.id,
        message: `${house.displayName || house.address} has a malformed latitude or longitude value.`,
      })
      return
    }

    if ((house.latitude.trim() && !house.longitude.trim()) || (!house.latitude.trim() && house.longitude.trim())) {
      issues.push({
        severity: 'warning',
        houseId: house.id,
        message: `${house.displayName || house.address} has only one coordinate. Add both latitude and longitude or leave both empty.`,
      })
    }

    if (latitude !== null && longitude !== null && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        issues.push({
          severity: 'error',
          houseId: house.id,
          message: `${house.displayName || house.address} has coordinates outside normal latitude or longitude bounds.`,
        })
      }

      const coordinateKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`
      if (coordinateMap.has(coordinateKey)) {
        issues.push({
          severity: 'warning',
          houseId: house.id,
          message: `${house.displayName || house.address} shares coordinates with ${coordinateMap.get(coordinateKey)}.`,
        })
      } else {
        coordinateMap.set(coordinateKey, house.displayName || house.address)
      }
    }
  })

  const validBoundaryPoints = data.config.boundaryPoints.filter((point) => {
    const lat = parseCoordinate(point.lat)
    const lng = parseCoordinate(point.lng)
    return lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)
  })

  if (data.config.boundaryPoints.length > 0 && validBoundaryPoints.length < 3) {
    issues.push({
      severity: 'warning',
      message: 'Boundary export needs at least three valid boundary points before KML can be generated.',
    })
  }

  return { issues }
}