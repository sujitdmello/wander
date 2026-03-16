# Wander

Wander is a local desktop web UI for maintaining a private neighborhood house list and exporting Google My Maps artifacts.

The app is built for a simple workflow:

1. Open or create a JSON file that stores your house records.
2. Edit names, addresses, street names, notes, and optional coordinates.
3. Export one combined CSV for house markers.
4. Optionally export a boundary KML for orientation.
5. Import both into Google My Maps on desktop, then open that map in Google Maps on your phone.

The editor now includes a small preview map for the selected house and can auto-fill blank coordinates from the address.

## Run the app

```bash
npm install
npm run dev
```

Build for production with:

```bash
npm run build
```

## JSON schema

The app expects a JSON document with this shape:

```json
{
  "config": {
    "neighborhoodName": "Oak Terrace",
    "houseLayerName": "Oak Terrace Houses",
    "boundaryLayerName": "Oak Terrace Boundary",
    "locality": "Springfield",
    "region": "PA",
    "postalCode": "19064",
    "exportNotes": "Imported from Wander",
    "boundaryPoints": [
      { "lat": "40.1234", "lng": "-75.1234" },
      { "lat": "40.1235", "lng": "-75.1229" },
      { "lat": "40.1230", "lng": "-75.1227" }
    ]
  },
  "houses": [
    {
      "id": "house-001",
      "displayName": "Jordan Family",
      "address": "101 Oak Terrace",
      "street": "Oak Terrace",
      "latitude": "40.123456",
      "longitude": "-75.123456",
      "note": "Blue shutters, corner lot",
      "tag": "Wave first",
      "active": true
    }
  ]
}
```

Notes:

- `displayName` becomes the marker title in My Maps.
- `address` can now just hold the street address or house number line.
- `locality`, `region`, and `postalCode` in map configuration are appended automatically for geocoding and CSV export.
- `address` and `note` are combined into the description field.
- Coordinates can be auto-filled from the address when they are blank, and explicit latitude and longitude produce more reliable house placement.
- Inactive houses remain in the JSON file but are excluded from exports.

## My Maps workflow

1. In the app, export the combined CSV.
2. Open Google My Maps on desktop and create a new map.
3. Import the CSV as the main house layer.
4. When My Maps asks how to place features, choose latitude and longitude if present, or the address column if not.
5. Choose the `Name` column for marker titles.
6. Optionally import the boundary KML as a second layer.
7. Open Google Maps on your phone, then go to Saved and Maps to access the My Map.

## Browser notes

On Chromium-based browsers such as Edge or Chrome, the app can open a JSON file and save changes back to the same file using the File System Access API.

If that API is unavailable, you can still:

1. Import a JSON file through the fallback picker.
2. Edit the data in the app.
3. Download a fresh JSON snapshot when you want to save changes.

## Map preview and geocoding

- The preview panel uses an embedded OpenStreetMap view for the currently selected coordinates.
- Address lookup tries the U.S. Census geocoder first when street, city, state, and ZIP are available, then falls back to OpenStreetMap Nominatim.
- The app now tries several address candidates in order, starting with the exact Address field before adding any extra context.
- The full postal address used for lookup is shown in the editor so you can verify the shared town, state, and ZIP settings.
- If a house already has coordinates, the app will leave them alone until you click `Refresh From Address`.
- Because the lookup is network-based, expect it to fail when offline or when the address is too incomplete.

## Current scope

Included:

- Local single-user editing
- Combined My Maps CSV export
- Optional neighborhood boundary KML export
- Validation for common data issues

Not included:

- Live nearby-only reveal logic inside Google Maps
- Automated White Pages scraping
- Parcel-accurate polygons

