import Foundation
import CoreLocation

/// Mirrors the JSON record produced by the Wander web app.
struct House: Codable, Identifiable, Hashable {
    let id: String
    let displayName: String
    let address: String
    let street: String
    let latitude: String
    let longitude: String
    let note: String
    let tag: String
    let active: Bool

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = Double(latitude), let lon = Double(longitude) else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

struct MapConfig: Codable, Hashable {
    let neighborhoodName: String
    let locality: String
    let region: String
    let postalCode: String

    enum CodingKeys: String, CodingKey {
        case neighborhoodName, locality, region, postalCode
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        neighborhoodName = (try? c.decode(String.self, forKey: .neighborhoodName)) ?? "Neighborhood"
        locality = (try? c.decode(String.self, forKey: .locality)) ?? ""
        region = (try? c.decode(String.self, forKey: .region)) ?? ""
        postalCode = (try? c.decode(String.self, forKey: .postalCode)) ?? ""
    }
}

struct AppData: Codable {
    let config: MapConfig
    let houses: [House]
}

/// A house annotated with its current distance from the user, in meters.
struct RankedHouse: Identifiable, Hashable {
    let house: House
    let distanceMeters: CLLocationDistance

    var id: String { house.id }
}
