import SwiftUI

struct HouseCardView: View {
    let ranked: RankedHouse

    private var house: House { ranked.house }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(formattedDistance(ranked.distanceMeters))
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .foregroundStyle(.green)
                    Spacer()
                    if !house.tag.isEmpty {
                        Text(house.tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.25), in: Capsule())
                    }
                }

                Text(house.displayName.isEmpty ? "(no name)" : house.displayName)
                    .font(.headline)
                    .lineLimit(2)

                Text(house.address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if !house.note.isEmpty {
                    Text(house.note)
                        .font(.footnote)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func formattedDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return "\(Int(meters.rounded())) m"
        }
        let km = meters / 1000
        return String(format: "%.1f km", km)
    }
}

#Preview {
    HouseCardView(
        ranked: RankedHouse(
            house: House(
                id: "1",
                displayName: "Jordan Family",
                address: "101 Oak Terrace",
                street: "Oak Terrace",
                latitude: "40.123",
                longitude: "-75.123",
                note: "Blue shutters and a wide front porch.",
                tag: "Wave first",
                active: true
            ),
            distanceMeters: 42
        )
    )
}
