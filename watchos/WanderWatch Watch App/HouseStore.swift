import Foundation

/// Loads the bundled `houses.json` once at app start.
@MainActor
final class HouseStore: ObservableObject {
    @Published private(set) var data: AppData?
    @Published private(set) var loadError: String?

    var houses: [House] { data?.houses ?? [] }
    var activeHouses: [House] { houses.filter { $0.active && $0.coordinate != nil } }
    var neighborhoodName: String { data?.config.neighborhoodName ?? "Wander" }

    init() {
        load()
    }

    func load() {
        guard let url = Bundle.main.url(forResource: "houses", withExtension: "json") else {
            loadError = "houses.json not found in bundle"
            return
        }
        do {
            let raw = try Data(contentsOf: url)
            data = try JSONDecoder().decode(AppData.self, from: raw)
            loadError = nil
        } catch {
            loadError = "Failed to read houses.json: \(error.localizedDescription)"
        }
    }
}
