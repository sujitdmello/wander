import type { AppData } from '../types'
import { buildPostalAddress } from './address'

function quoteCsv(value: string) {
  const escaped = value.replaceAll('"', '""')
  return `"${escaped}"`
}

function formatDescription(address: string, note: string, exportNotes: string) {
  return [address.trim(), note.trim(), exportNotes.trim()].filter(Boolean).join('\n\n')
}

function parseCoordinate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function exportHousesCsv(data: AppData) {
  const header = ['Name', 'Description', 'Address', 'Street', 'Latitude', 'Longitude', 'Tag', 'Active']

  const rows = data.houses
    .filter((house) => house.active)
    .map((house) => {
      const postalAddress = buildPostalAddress(house, data.config)

      return [
        house.displayName,
        formatDescription(postalAddress, house.note, data.config.exportNotes),
        postalAddress,
        house.street,
        house.latitude,
        house.longitude,
        house.tag,
        house.active ? 'TRUE' : 'FALSE',
      ]
        .map((value) => quoteCsv(value))
        .join(',')
    })

  return [header.map((value) => quoteCsv(value)).join(','), ...rows].join('\n')
}

export function exportBoundaryKml(data: AppData) {
  const validPoints = data.config.boundaryPoints
    .map((point) => {
      const lat = parseCoordinate(point.lat)
      const lng = parseCoordinate(point.lng)

      if (lat === null || lng === null) {
        return null
      }

      return { lat, lng }
    })
    .filter((point): point is { lat: number; lng: number } => point !== null)

  if (validPoints.length < 3) {
    return null
  }

  const firstPoint = validPoints[0]
  const closedPoints = [...validPoints, firstPoint]
  const coordinates = closedPoints.map((point) => `${point.lng},${point.lat},0`).join(' ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${data.config.boundaryLayerName}</name>
    <Placemark>
      <name>${data.config.boundaryLayerName}</name>
      <Style>
        <LineStyle>
          <color>ff33a0ff</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>3333a0ff</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordinates}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`
}

export function getExportSummary(data: AppData) {
  const activeHouseCount = data.houses.filter((house) => house.active).length
  const streetCount = new Set(
    data.houses
      .filter((house) => house.active)
      .map((house) => house.street.trim())
      .filter(Boolean),
  ).size

  return {
    activeHouseCount,
    streetCount,
  }
}