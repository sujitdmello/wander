import SwiftUI
import CoreLocation

struct WalkView: View {
    @EnvironmentObject private var session: WalkSession
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedID: String?
    @State private var showStopConfirm = false
    @State private var showStopButton = false

    var body: some View {
        VStack(spacing: 0) {
            if session.rankedHouses.isEmpty {
                WaitingForFixView()
            } else {
                TabView(selection: $selectedID) {
                    ForEach(session.rankedHouses) { ranked in
                        HouseCardView(ranked: ranked)
                            .tag(Optional(ranked.id))
                    }
                }
                .tabViewStyle(.page)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 1) {
            withAnimation(.easeInOut(duration: 0.2)) {
                showStopButton.toggle()
            }
        }
        .overlay(alignment: .bottom) {
            if showStopButton {
                Button(role: .destructive) {
                    showStopConfirm = true
                } label: {
                    Label("Stop", systemImage: "stop.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(
                            Capsule().fill(Color.red)
                        )
                }
                .buttonStyle(.plain)
                .shadow(color: .black.opacity(0.35), radius: 2, x: 0, y: 1)
                .padding(.bottom, 4)
                .transition(.opacity)
            }
        }
        .onChange(of: session.rankedHouses) { _, newValue in
            // Keep the closest house selected by default, unless the user has
            // already swiped to a specific house.
            if selectedID == nil {
                selectedID = newValue.first?.id
            } else if newValue.contains(where: { $0.id == selectedID }) == false {
                selectedID = newValue.first?.id
            }
        }
        .confirmationDialog("End walk?", isPresented: $showStopConfirm, titleVisibility: .visible) {
            Button("End Walk", role: .destructive) { session.stop() }
            Button("Keep Walking", role: .cancel) { }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                // Force re-selection so rankedHouses onChange picks nearest.
                selectedID = nil
            }
        }
    }
}

private struct WaitingForFixView: View {
    @EnvironmentObject private var locationManager: LocationManager

    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Finding your location…")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let err = locationManager.lastError {
                Text(err)
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
