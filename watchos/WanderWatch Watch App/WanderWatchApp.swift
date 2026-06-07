import SwiftUI

@main
struct WanderWatchApp: App {
    @StateObject private var store = HouseStore()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var session: WalkSession

    init() {
        let store = HouseStore()
        let location = LocationManager()
        _store = StateObject(wrappedValue: store)
        _locationManager = StateObject(wrappedValue: location)
        _session = StateObject(wrappedValue: WalkSession(store: store, locationManager: location))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(locationManager)
                .environmentObject(session)
        }
    }
}
