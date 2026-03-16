import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import './App.css'
import { buildAddressCandidates, buildPostalAddress, buildStructuredAddress } from './lib/address'
import { exportBoundaryKml, exportHousesCsv, getExportSummary } from './lib/exporters'
import { lookupCoordinates } from './lib/geocoding'
import {
  createEmptyHouse,
  parseImportedData,
  serializeAppData,
  type AppData,
  type HouseRecord,
} from './lib/model'
import { sampleData } from './sampleData'
import { validateAppData } from './lib/validation'

const STORAGE_KEY = 'wander-draft-v1'

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
}

type GeocodeStatus = {
  state: 'idle' | 'loading' | 'resolved' | 'error'
  message: string
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function loadDraft(): AppData | null {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return parseImportedData(JSON.parse(raw))
  } catch {
    return null
  }
}

function buildDefaultJsonName(data: AppData) {
  const slug = data.config.neighborhoodName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'neighborhood'}-houses.json`
}

function parseCoordinate(value: string) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function buildPreviewUrl(latitude: string, longitude: string) {
  const lat = parseCoordinate(latitude)
  const lng = parseCoordinate(longitude)

  if (lat === null || lng === null) {
    return null
  }

  const latDelta = 0.0012
  const lngDelta = 0.0018
  const params = new URLSearchParams({
    bbox: `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`,
    layer: 'mapnik',
    marker: `${lat},${lng}`,
  })

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`
}

function buildExternalMapUrl(latitude: string, longitude: string) {
  const lat = parseCoordinate(latitude)
  const lng = parseCoordinate(longitude)

  if (lat === null || lng === null) {
    return null
  }

  const params = new URLSearchParams({
    api: '1',
    query: `${lat},${lng}`,
  })

  return `https://www.google.com/maps/search/?${params.toString()}`
}

function App() {
  const initialData = loadDraft() ?? sampleData
  const [data, setData] = useState<AppData>(initialData)
  const [selectedHouseId, setSelectedHouseId] = useState<string>(initialData.houses[0]?.id ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    'Loaded local draft. Open a JSON file when you are ready to work on your real map.',
  )
  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>({
    state: 'idle',
    message: 'Coordinates will auto-fill from the address when latitude and longitude are blank.',
  })
  const [sourceFileName, setSourceFileName] = useState<string>('')
  const [sourceFileHandle, setSourceFileHandle] = useState<FileSystemFileHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastGeocodeQueryRef = useRef<Record<string, string>>({})

  const deferredSearch = useDeferredValue(searchQuery)
  const validation = useMemo(() => validateAppData(data), [data])
  const exportSummary = useMemo(() => getExportSummary(data), [data])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeAppData(data))
  }, [data])

  useEffect(() => {
    if (!data.houses.some((house) => house.id === selectedHouseId)) {
      setSelectedHouseId(data.houses[0]?.id ?? '')
    }
  }, [data.houses, selectedHouseId])

  const selectedHouse = data.houses.find((house) => house.id === selectedHouseId) ?? null
  const selectedHouseQueries = useMemo(() => {
    if (!selectedHouse) {
      return []
    }

    return buildAddressCandidates(selectedHouse, data.config)
  }, [selectedHouse, data.config])

  const selectedHousePostalAddress = useMemo(() => {
    if (!selectedHouse) {
      return ''
    }

    return buildPostalAddress(selectedHouse, data.config)
  }, [selectedHouse, data.config])

  const previewUrl = useMemo(() => {
    if (!selectedHouse) {
      return null
    }

    return buildPreviewUrl(selectedHouse.latitude, selectedHouse.longitude)
  }, [selectedHouse])

  const externalMapUrl = useMemo(() => {
    if (!selectedHouse) {
      return null
    }

    return buildExternalMapUrl(selectedHouse.latitude, selectedHouse.longitude)
  }, [selectedHouse])

  const filteredHouses = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    if (!query) {
      return data.houses
    }

    return data.houses.filter((house) => {
      return [house.displayName, house.address, house.street, house.note, house.tag]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [data.houses, deferredSearch])

  function updateData(nextData: AppData, message?: string) {
    setData(nextData)

    if (message) {
      setStatusMessage(message)
    }
  }

  function updateHouseCoordinates(houseId: string, latitude: string, longitude: string) {
    setData((current) => ({
      ...current,
      houses: current.houses.map((house) =>
        house.id === houseId
          ? {
              ...house,
              latitude,
              longitude,
            }
          : house,
      ),
    }))
  }

  function updateSelectedHouse(field: keyof HouseRecord, value: string | boolean) {
    if (!selectedHouse) {
      return
    }

    const nextHouses = data.houses.map((house) => {
      if (house.id !== selectedHouse.id) {
        return house
      }

      return {
        ...house,
        [field]: value,
      }
    })

    updateData({
      ...data,
      houses: nextHouses,
    })
  }

  async function geocodeHouse(house: HouseRecord, force: boolean) {
    const queries = buildAddressCandidates(house, data.config)
    const querySignature = queries.join(' | ')

    if (queries.length === 0 || house.address.trim().length < 5) {
      setGeocodeStatus({
        state: 'idle',
        message: 'Enter a fuller street address before looking up coordinates.',
      })
      return
    }

    if (!force && lastGeocodeQueryRef.current[house.id] === querySignature) {
      return
    }

    setGeocodeStatus({
      state: 'loading',
      message: `Looking up coordinates for ${queries[0]}...`,
    })

    try {
      const result = await lookupCoordinates(queries, buildStructuredAddress(house, data.config))
      lastGeocodeQueryRef.current[house.id] = querySignature
      updateHouseCoordinates(house.id, result.latitude, result.longitude)
      setGeocodeStatus({
        state: 'resolved',
        message: `Found ${result.latitude}, ${result.longitude} from ${result.label} using ${result.provider} with ${result.query}.`,
      })
      setStatusMessage(`Updated coordinates for ${house.displayName || house.address}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Coordinate lookup failed.'
      setGeocodeStatus({
        state: 'error',
        message,
      })
    }
  }

  const requestAutoGeocode = useEffectEvent((house: HouseRecord) => {
    void geocodeHouse(house, false)
  })

  function updateBoundaryPoints(rawText: string) {
    const boundaryPoints = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [lat = '', lng = ''] = line.split(',').map((value) => value.trim())
        return { lat, lng }
      })

    updateData({
      ...data,
      config: {
        ...data.config,
        boundaryPoints,
      },
    })
  }

  async function openJsonFile() {
    const pickerWindow = window as PickerWindow

    if (typeof pickerWindow.showOpenFilePicker === 'function') {
      try {
        const [handle] = await pickerWindow.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: true,
          types: [
            {
              description: 'Neighborhood JSON',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
        })

        const file = await handle.getFile()
        const text = await file.text()
        const imported = parseImportedData(JSON.parse(text))

        startTransition(() => {
          setSourceFileHandle(handle)
          setSourceFileName(file.name)
          setSelectedHouseId(imported.houses[0]?.id ?? '')
          updateData(imported, `Opened ${file.name}.`)
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setStatusMessage('Could not open the JSON file. Check that it matches the expected schema.')
      }

      return
    }

    fileInputRef.current?.click()
  }

  async function saveToSourceFile() {
    if (!sourceFileHandle) {
      downloadJsonSnapshot()
      setStatusMessage(
        'File System Access API is unavailable or no source file is open. Downloaded a JSON snapshot instead.',
      )
      return
    }

    try {
      const writable = await sourceFileHandle.createWritable()
      await writable.write(serializeAppData(data))
      await writable.close()
      setStatusMessage(`Saved changes back to ${sourceFileName}.`)
    } catch {
      setStatusMessage('Could not write to the source file. Use Download JSON Snapshot if the browser denied access.')
    }
  }

  function downloadJsonSnapshot() {
    downloadTextFile(buildDefaultJsonName(data), serializeAppData(data), 'application/json')
  }

  function exportCsv() {
    const fileName = `${buildDefaultJsonName(data).replace(/\.json$/, '')}.csv`
    downloadTextFile(fileName, exportHousesCsv(data), 'text/csv;charset=utf-8')
    setStatusMessage(`Exported ${fileName}. Import it into My Maps as the main house layer.`)
  }

  function exportKml() {
    const kml = exportBoundaryKml(data)

    if (!kml) {
      setStatusMessage('Boundary KML was not generated. Enter at least three valid boundary points first.')
      return
    }

    const fileName = `${buildDefaultJsonName(data).replace(/\.json$/, '')}-boundary.kml`
    downloadTextFile(fileName, kml, 'application/vnd.google-earth.kml+xml')
    setStatusMessage(`Exported ${fileName}. Import it into My Maps as a separate boundary layer.`)
  }

  function addHouse() {
    const nextHouse = createEmptyHouse(data.houses.length)

    updateData(
      {
        ...data,
        houses: [...data.houses, nextHouse],
      },
      'Added a new house record.',
    )
    setSelectedHouseId(nextHouse.id)
  }

  function removeSelectedHouse() {
    if (!selectedHouse) {
      return
    }

    const nextHouses = data.houses.filter((house) => house.id !== selectedHouse.id)
    updateData(
      {
        ...data,
        houses: nextHouses,
      },
      `Removed ${selectedHouse.displayName || selectedHouse.address || 'the selected house'}.`,
    )
  }

  async function importFromFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const imported = parseImportedData(JSON.parse(text))
      setSourceFileHandle(null)
      setSourceFileName(file.name)
      setSelectedHouseId(imported.houses[0]?.id ?? '')
      updateData(
        imported,
        `Imported ${file.name}. Browser save-back is unavailable in this mode, so use Download JSON Snapshot after editing.`,
      )
    } catch {
      setStatusMessage('Could not import that JSON file. Check the format and try again.')
    } finally {
      event.target.value = ''
    }
  }

  useEffect(() => {
    if (!selectedHouse) {
      return
    }

    if (selectedHouse.latitude.trim() && selectedHouse.longitude.trim()) {
      if (selectedHouseQueries.length > 0) {
        setGeocodeStatus({
          state: 'idle',
          message: 'Coordinates are present. Use Refresh From Address if you want to replace them.',
        })
      }
      return
    }

    if (selectedHouseQueries.length === 0 || selectedHouse.address.trim().length < 5) {
      return
    }

    if (lastGeocodeQueryRef.current[selectedHouse.id] === selectedHouseQueries.join(' | ')) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      requestAutoGeocode(selectedHouse)
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [selectedHouse, selectedHouseQueries])

  const boundaryText = data.config.boundaryPoints.map((point) => `${point.lat}, ${point.lng}`).join('\n')
  const canExportBoundary = data.config.boundaryPoints.length >= 3
  const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length
  const warningCount = validation.issues.filter((issue) => issue.severity === 'warning').length

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={importFromFileInput}
      />

      <header className="hero-panel">
        <div>
          <p className="eyebrow">Neighborhood My Maps Pack</p>
          <h1>Build one house layer, then wander with Google Maps.</h1>
          <p className="hero-copy">
            Edit a private JSON file, validate the records, export one combined CSV for house markers,
            and optionally export a boundary KML for orientation.
          </p>
        </div>

        <div className="hero-actions">
          <button type="button" className="primary" onClick={openJsonFile}>
            Open JSON File
          </button>
          <button type="button" onClick={saveToSourceFile}>
            Save Back To Source
          </button>
          <button type="button" onClick={downloadJsonSnapshot}>
            Download JSON Snapshot
          </button>
          <button type="button" onClick={exportCsv}>
            Export Combined CSV
          </button>
          <button type="button" onClick={exportKml} disabled={!canExportBoundary}>
            Export Boundary KML
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="panel summary-panel">
          <h2>Project Summary</h2>
          <dl className="summary-grid">
            <div>
              <dt>Neighborhood</dt>
              <dd>{data.config.neighborhoodName || 'Untitled neighborhood'}</dd>
            </div>
            <div>
              <dt>Source file</dt>
              <dd>{sourceFileName || 'Unsaved local draft'}</dd>
            </div>
            <div>
              <dt>Active houses</dt>
              <dd>{exportSummary.activeHouseCount}</dd>
            </div>
            <div>
              <dt>Street count</dt>
              <dd>{exportSummary.streetCount}</dd>
            </div>
          </dl>

          <div className="status-strip">
            <strong>Status</strong>
            <p>{statusMessage}</p>
          </div>

          <div className="validation-box">
            <div className="validation-header">
              <h3>Validation</h3>
              <span>{errorCount} errors / {warningCount} warnings</span>
            </div>
            <ul className="issue-list">
              {validation.issues.length === 0 ? (
                <li className="issue-ok">No blocking issues detected. You can export now.</li>
              ) : (
                validation.issues.map((issue) => (
                  <li key={`${issue.severity}-${issue.message}-${issue.houseId ?? 'global'}`} className={`issue ${issue.severity}`}>
                    <strong>{issue.severity.toUpperCase()}</strong>
                    <span>{issue.message}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

        <div className="workspace-stack">
          <section className="panel config-panel">
            <div className="section-header">
              <div>
                <h2>Map Configuration</h2>
                <p>Set the map names and optional boundary points used for the export files.</p>
              </div>
            </div>

            <div className="form-grid two-up">
              <label>
                <span>Neighborhood name</span>
                <input
                  type="text"
                  value={data.config.neighborhoodName}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        neighborhoodName: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>Main house layer name</span>
                <input
                  type="text"
                  value={data.config.houseLayerName}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        houseLayerName: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>Boundary layer name</span>
                <input
                  type="text"
                  value={data.config.boundaryLayerName}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        boundaryLayerName: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>Town or city</span>
                <input
                  type="text"
                  value={data.config.locality}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        locality: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>State</span>
                <input
                  type="text"
                  value={data.config.region}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        region: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>ZIP code</span>
                <input
                  type="text"
                  value={data.config.postalCode}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        postalCode: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>Export notes</span>
                <textarea
                  rows={3}
                  value={data.config.exportNotes}
                  onChange={(event) =>
                    updateData({
                      ...data,
                      config: {
                        ...data.config,
                        exportNotes: event.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>

            <label className="boundary-field">
              <span>Boundary points</span>
              <textarea
                rows={5}
                value={boundaryText}
                onChange={(event) => updateBoundaryPoints(event.target.value)}
                placeholder="One point per line, formatted as latitude, longitude"
              />
            </label>
            <p className="hint">Boundary KML is optional. Enter at least three points if you want a lightweight neighborhood outline.</p>
          </section>

          <section className="panel list-panel">
            <div className="section-header compact">
              <div>
                <h2>Houses</h2>
                <p>Keep one combined house layer. Street names remain searchable after import.</p>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={addHouse}>Add House</button>
                <button type="button" className="danger" onClick={removeSelectedHouse} disabled={!selectedHouse}>
                  Remove
                </button>
              </div>
            </div>

            <label className="search-field">
              <span>Search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter by name, address, street, note, or tag"
              />
            </label>

            <div className="house-list" role="list">
              {filteredHouses.map((house) => (
                <button
                  type="button"
                  key={house.id}
                  className={`house-card${house.id === selectedHouseId ? ' selected' : ''}`}
                  onClick={() => setSelectedHouseId(house.id)}
                >
                  <strong>{house.displayName || 'Untitled house'}</strong>
                  <span>{house.address || 'No address yet'}</span>
                  <span>{house.street || 'No street assigned'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel editor-panel">
            <div className="section-header">
              <div>
                <h2>House Editor</h2>
                <p>Edit the selected record. The CSV export uses display name as the marker title.</p>
              </div>
            </div>

            {selectedHouse ? (
              <div className="form-grid three-up">
                <label>
                  <span>Display name</span>
                  <input
                    type="text"
                    value={selectedHouse.displayName}
                    onChange={(event) => updateSelectedHouse('displayName', event.target.value)}
                  />
                </label>
                <label>
                  <span>Street</span>
                  <input
                    type="text"
                    value={selectedHouse.street}
                    onChange={(event) => updateSelectedHouse('street', event.target.value)}
                  />
                </label>
                <label>
                  <span>Tag</span>
                  <input
                    type="text"
                    value={selectedHouse.tag}
                    onChange={(event) => updateSelectedHouse('tag', event.target.value)}
                  />
                </label>
                <label className="span-two">
                  <span>Street address</span>
                  <input
                    type="text"
                    value={selectedHouse.address}
                    onChange={(event) => updateSelectedHouse('address', event.target.value)}
                    placeholder="101 Oak Terrace"
                  />
                </label>
                <label>
                  <span>Latitude</span>
                  <input
                    type="text"
                    value={selectedHouse.latitude}
                    onChange={(event) => updateSelectedHouse('latitude', event.target.value)}
                    placeholder="40.123456"
                  />
                </label>
                <label>
                  <span>Longitude</span>
                  <input
                    type="text"
                    value={selectedHouse.longitude}
                    onChange={(event) => updateSelectedHouse('longitude', event.target.value)}
                    placeholder="-75.123456"
                  />
                </label>
                <div className="span-three geocode-panel">
                  <div className="geocode-toolbar">
                    <div>
                      <strong>Address lookup</strong>
                      <p>{geocodeStatus.message}</p>
                    </div>
                    <button type="button" onClick={() => void geocodeHouse(selectedHouse, true)}>
                      Refresh From Address
                    </button>
                  </div>
                  <p className="computed-address">Full lookup/export address: {selectedHousePostalAddress || 'Enter a street address and configure town, state, or ZIP.'}</p>
                </div>
                <label className="span-three">
                  <span>Notes</span>
                  <textarea
                    rows={5}
                    value={selectedHouse.note}
                    onChange={(event) => updateSelectedHouse('note', event.target.value)}
                    placeholder="Optional context for the My Maps description field"
                  />
                </label>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={selectedHouse.active}
                    onChange={(event) => updateSelectedHouse('active', event.target.checked)}
                  />
                  <span>Include this house in exports</span>
                </label>

                <div className="span-three map-preview-panel">
                  <div className="section-header compact">
                    <div>
                      <h3>Map Preview</h3>
                      <p>Quick placement check before exporting to My Maps.</p>
                    </div>
                    {externalMapUrl ? (
                      <a href={externalMapUrl} target="_blank" rel="noreferrer">
                        Open In Google Maps
                      </a>
                    ) : null}
                  </div>

                  {previewUrl ? (
                    <iframe
                      className="map-frame"
                      title="House location preview"
                      src={previewUrl}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="preview-empty-state">
                      <p>Add an address and wait for auto-fill, or click Refresh From Address to fetch coordinates.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No house selected. Add a record or pick one from the list.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}

export default App
