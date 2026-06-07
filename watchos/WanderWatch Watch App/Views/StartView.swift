import SwiftUI
import CoreLocation

struct StartView: View {
    @EnvironmentObject private var store: HouseStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var session: WalkSession

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(spacing: 4) {
                    Text(store.neighborhoodName)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    Text("\(store.activeHouses.count) houses loaded")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)

                Button(action: start) {
                    Label("Start Walk", systemImage: "figure.walk")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(store.activeHouses.isEmpty)

                if locationManager.authorizationStatus == .denied || locationManager.authorizationStatus == .restricted {
                    Text("Location access is off. Enable it in Settings → Privacy → Location.")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal)
        }
        .onAppear { locationManager.requestAuthorization() }
    }

    private func start() {
        session.start()
    }
}
