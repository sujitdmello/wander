import { sampleData } from '../sampleData'
import type { AppData, BoundaryPoint, HouseRecord, MapConfig } from '../types'

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeBoundaryPoint(value: unknown): BoundaryPoint {
  if (!isRecord(value)) {
    return { lat: '', lng: '' }
  }

  return {
    lat: asString(value.lat),
    lng: asString(value.lng),
  }
}

function normalizeConfig(value: unknown): MapConfig {
  if (!isRecord(value)) {
    return sampleData.config
  }

  return {
    neighborhoodName: asString(value.neighborhoodName) || sampleData.config.neighborhoodName,
    houseLayerName: asString(value.houseLayerName) || sampleData.config.houseLayerName,
    boundaryLayerName: asString(value.boundaryLayerName) || sampleData.config.boundaryLayerName,
    locality: asString(value.locality),
    region: asString(value.region),
    postalCode: asString(value.postalCode),
    exportNotes: asString(value.exportNotes),
    boundaryPoints: Array.isArray(value.boundaryPoints)
      ? value.boundaryPoints.map(normalizeBoundaryPoint)
      : sampleData.config.boundaryPoints,
  }
}

function normalizeHouse(value: unknown, index: number): HouseRecord {
  if (!isRecord(value)) {
    return createEmptyHouse(index)
  }

  return {
    id: asString(value.id) || `house-${String(index + 1).padStart(3, '0')}`,
    displayName: asString(value.displayName),
    address: asString(value.address),
    street: asString(value.street),
    latitude: asString(value.latitude),
    longitude: asString(value.longitude),
    note: asString(value.note),
    tag: asString(value.tag),
    active: asBoolean(value.active),
  }
}

export function createEmptyHouse(index: number): HouseRecord {
  return {
    id: `house-${String(index + 1).padStart(3, '0')}-${crypto.randomUUID().slice(0, 6)}`,
    displayName: '',
    address: '',
    street: '',
    latitude: '',
    longitude: '',
    note: '',
    tag: '',
    active: true,
  }
}

export function parseImportedData(value: unknown): AppData {
  if (Array.isArray(value)) {
    return {
      config: sampleData.config,
      houses: value.map(normalizeHouse),
    }
  }

  if (!isRecord(value)) {
    throw new Error('Invalid JSON root')
  }

  const houses = Array.isArray(value.houses)
    ? value.houses.map(normalizeHouse)
    : sampleData.houses

  return {
    config: normalizeConfig(value.config),
    houses,
  }
}

export function serializeAppData(data: AppData) {
  return JSON.stringify(data, null, 2)
}

export type { AppData, HouseRecord }