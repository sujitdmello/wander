# Wander — watchOS app

A native SwiftUI Apple Watch app that rides along with the Wander web project.
It loads your house list from a bundled JSON file, tracks your location while
you walk, and shows you the houses nearest you — closest first, swipe left/right
for the next one.

> There is no app in the App Store - you must compile the code in this repo with your custom house JSON file and deploy it to your Apple Watch (see below for instructions). This is possible with a free Apple Developer account.

## Features

- Pure watchOS app (no paired iPhone app required).
- Loads the same `houses.sample.json` shape produced by the Wander web app.
- Sorts active houses by distance from your current location, recomputed live as
  you walk.
- Swipe-paged detail cards with name, address, note, optional tag, and live
  distance.
- Manual stop with confirmation, plus automatic stop after **30 minutes of no
  significant movement** (default ≥10 m to count as moving).
- `WKBackgroundModes = location` so location updates continue while your wrist
  is down during a walk.

## App Screens
![Home Screen](/images/wander-watch-home.png)
![While Walking](/images/wander-watch-main.png)
![Stop Walking](/images/wander-watch-end.png)
## Project layout

```
watchos/
├── project.yml                       # XcodeGen spec (regenerates the .xcodeproj)
├── WanderWatch.xcodeproj             # Generated; not committed
└── WanderWatch Watch App/
    ├── Info.plist
    ├── Assets.xcassets/
    ├── Resources/
    │   └── houses.json               # Bundled house data (same schema as the web app)
    ├── WanderWatchApp.swift          # @main entry, environment wiring
    ├── Models.swift                  # House, MapConfig, AppData, RankedHouse
    ├── HouseStore.swift              # Loads bundled JSON
    ├── LocationManager.swift         # CLLocationManager wrapper (ObservableObject)
    ├── WalkSession.swift             # Sorting, inactivity timeout, lifecycle
    └── Views/
        ├── RootView.swift
        ├── StartView.swift
        ├── WalkView.swift
        └── HouseCardView.swift
```

## Updating the bundled house list

The watch app reads `WanderWatch Watch App/Resources/houses.json` at launch.
That file is a copy of `data/houses.sample.json` from the parent web project —
replace it with your own export from the Wander editor before building:

```bash
cp ../data/houses.sample.json "WanderWatch Watch App/Resources/houses.json"
```

The schema is identical to the web app. Inactive houses (`"active": false`) and
houses without valid `latitude`/`longitude` are ignored.

## Build & run

### Prerequisites

- macOS with Xcode 16 or later (Xcode 26 verified). Includes the watchOS SDK
  and at least one Apple Watch simulator.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) for regenerating the Xcode
  project from `project.yml`:
  ```bash
  brew install xcodegen
  ```

### Generate the Xcode project

```bash
cd watchos
xcodegen generate
open WanderWatch.xcodeproj
```

Then in Xcode:
1. Pick an Apple Watch simulator (e.g. *Apple Watch Series 11 (46mm)*).
2. Press ⌘R.
3. The first time you run on a real device, set your **Team** under
   *Signing & Capabilities* and pick a unique bundle id.

### Build from the command line

```bash
cd watchos
xcodegen generate
xcodebuild \
  -project WanderWatch.xcodeproj \
  -scheme WanderWatch \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 11 (46mm)' \
  -configuration Debug \
  build CODE_SIGNING_ALLOWED=NO
```

## Using the app

1. Launch **Wander** on the watch.
2. Tap **Start Walk**. Grant location permission when prompted.
3. Look at your wrist while walking — the closest house is shown first.
4. Swipe left/right to step through houses in order of distance.
5. Either tap **Stop → End Walk**, or do nothing for 30 minutes; the app stops
   tracking automatically.

## Tuning behavior

Constants live near the top of `WalkSession.swift`:

```swift
let inactivityTimeout: TimeInterval = 30 * 60   // auto-stop after 30 minutes
let movementThreshold: CLLocationDistance = 10  // meters that count as moving
```

Location accuracy and minimum reporting distance are set in `LocationManager.swift`:

```swift
manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
manager.distanceFilter = 5
manager.activityType = .fitness
```

## Notes

- The app is watch-only (`WKWatchOnly = true`). No iOS companion target is
  required, which keeps the project minimal.
- The bundle id is `com.example.wander.watchapp`. Change it in `project.yml`
  before signing for a real device.
- `allowsBackgroundLocationUpdates` is left `false` by default — the
  `WKBackgroundModes = location` Info.plist key plus foreground updates is
  enough for wrist-up usage during a walk. If you want the app to keep getting
  location while completely backgrounded, set it to `true` in `LocationManager.swift`
  and use `requestAlwaysAuthorization()`.
