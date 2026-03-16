export type HouseRecord = {
  id: string
  displayName: string
  address: string
  street: string
  latitude: string
  longitude: string
  note: string
  tag: string
  active: boolean
}

export type BoundaryPoint = {
  lat: string
  lng: string
}

export type MapConfig = {
  neighborhoodName: string
  houseLayerName: string
  boundaryLayerName: string
  locality: string
  region: string
  postalCode: string
  exportNotes: string
  boundaryPoints: BoundaryPoint[]
}

export type AppData = {
  config: MapConfig
  houses: HouseRecord[]
}

export type ValidationIssue = {
  severity: 'error' | 'warning'
  message: string
  houseId?: string
}