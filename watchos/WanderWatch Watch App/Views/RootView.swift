import SwiftUI

/// Top-level switcher between the start screen and the active walk view.
struct RootView: View {
    @EnvironmentObject private var session: WalkSession
    @EnvironmentObject private var store: HouseStore

    var body: some View {
        Group {
            if let error = store.loadError {
                ErrorView(message: error)
            } else if session.isActive {
                WalkView()
            } else {
                StartView()
            }
        }
    }
}

private struct ErrorView: View {
    let message: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Could not load houses")
                    .font(.headline)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
