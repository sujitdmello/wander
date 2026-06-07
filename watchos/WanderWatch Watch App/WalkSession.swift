import Foundation
import CoreLocation
import Combine

/// Coordinates a "walk" — turns location updates into a distance-sorted list
/// of houses, and auto-stops after a configurable inactivity window.
@MainActor
final class WalkSession: ObservableObject {
    @Published private(set) var isActive = false
    @Published private(set) var rankedHouses: [RankedHouse] = []
    @Published private(set) var currentLocation: CLLocation?
    @Published private(set) var lastMovementAt: Date?

    /// Auto-stop after this many seconds with no significant movement.
    let inactivityTimeout: TimeInterval = 30 * 60
    /// Distance, in meters, that counts as "moving" for the inactivity timer.
    let movementThreshold: CLLocationDistance = 10

    private let store: HouseStore
    private let locationManager: LocationManager
    private var cancellables = Set<AnyCancellable>()
    private var inactivityTimer: Timer?
    private var anchorLocation: CLLocation?

    init(store: HouseStore, locationManager: LocationManager) {
        self.store = store
        self.locationManager = locationManager
    }

    func start() {
        guard !isActive else { return }
        isActive = true
        anchorLocation = nil
        lastMovementAt = Date()
        rankedHouses = []

        locationManager.$location
            .compactMap { $0 }
            .sink { [weak self] loc in
                self?.handle(location: loc)
            }
            .store(in: &cancellables)

        locationManager.start()

        let timer = Timer(timeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.checkInactivity() }
        }
        RunLoop.main.add(timer, forMode: .common)
        inactivityTimer = timer
    }

    func stop() {
        guard isActive else { return }
        isActive = false
        cancellables.removeAll()
        inactivityTimer?.invalidate()
        inactivityTimer = nil
        locationManager.stop()
    }

    private func handle(location: CLLocation) {
        currentLocation = location

        if let anchor = anchorLocation {
            if location.distance(from: anchor) >= movementThreshold {
                anchorLocation = location
                lastMovementAt = Date()
            }
        } else {
            anchorLocation = location
            lastMovementAt = Date()
        }

        rankedHouses = store.activeHouses
            .compactMap { house -> RankedHouse? in
                guard let coord = house.coordinate else { return nil }
                let target = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
                return RankedHouse(house: house, distanceMeters: location.distance(from: target))
            }
            .sorted { $0.distanceMeters < $1.distanceMeters }
    }

    private func checkInactivity() {
        guard let last = lastMovementAt else { return }
        if Date().timeIntervalSince(last) >= inactivityTimeout {
            stop()
        }
    }
}
