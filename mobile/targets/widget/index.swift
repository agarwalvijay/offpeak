import WidgetKit
import SwiftUI

// MARK: - Shared data

private let appGroup = "group.com.atsumilabs.offpeak"
private let dataKey = "widgetData"

/// Mirrors the RN `WidgetData` snapshot written via ExtensionStorage.
struct PriceData: Decodable {
    var price: String
    var level: String
    var color: String
    var hourAvg: String
    var updated: String
    var title: String
    var sub: String
    var points: [Double]?
}

private func loadData() -> PriceData? {
    guard
        let defaults = UserDefaults(suiteName: appGroup),
        let raw = defaults.string(forKey: dataKey),
        let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(PriceData.self, from: data)
}

// MARK: - Theme

private let bg = Color(red: 0.165, green: 0.251, blue: 0.408) // #2A4068
private let fg = Color(red: 0.953, green: 0.965, blue: 0.988)
private let dim = Color(red: 0.659, green: 0.753, blue: 0.878)
private let fallback = Color(red: 1.0, green: 0.819, blue: 0.40)

private func hexColor(_ hex: String?) -> Color {
    guard var h = hex, h.hasPrefix("#") else { return fallback }
    h.removeFirst()
    if h.count == 8 { h = String(h.suffix(6)) }
    var int: UInt64 = 0
    Scanner(string: h).scanHexInt64(&int)
    return Color(
        red: Double((int >> 16) & 0xFF) / 255,
        green: Double((int >> 8) & 0xFF) / 255,
        blue: Double(int & 0xFF) / 255
    )
}

// MARK: - Trend bars (last-hour 5-min prices)

private struct TrendBars: View {
    let points: [Double]
    let color: Color
    var body: some View {
        GeometryReader { geo in
            let pts = points.suffix(24)
            let mn = pts.min() ?? 0
            let mx = pts.max() ?? 1
            let rng = max(mx - mn, 0.0001)
            let n = max(pts.count - 1, 1)
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(Array(pts.enumerated()), id: \.offset) { i, v in
                    let t = (v - mn) / rng
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color.opacity(0.45 + 0.55 * Double(i) / Double(n)))
                        .frame(height: max(geo.size.height * (0.14 + 0.86 * t), 3))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
    }
}

// MARK: - Timeline

struct PriceEntry: TimelineEntry {
    let date: Date
    let data: PriceData?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PriceEntry {
        PriceEntry(date: Date(), data: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (PriceEntry) -> Void) {
        completion(PriceEntry(date: Date(), data: loadData()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PriceEntry>) -> Void) {
        let entry = PriceEntry(date: Date(), data: loadData())
        // Re-read in 30 min; the app also reloads the timeline on data changes.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Views

struct SmallView: View {
    let d: PriceData?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let d {
                Text(d.title).font(.system(size: 13, weight: .bold)).foregroundColor(fg).lineLimit(1)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(d.price).font(.system(size: 34, weight: .heavy)).foregroundColor(hexColor(d.color))
                    Text(d.level).font(.system(size: 13, weight: .bold)).foregroundColor(hexColor(d.color))
                }
                TrendBars(points: Array((d.points ?? []).suffix(12)), color: hexColor(d.color))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Text(d.updated).font(.system(size: 10)).foregroundColor(dim)
            } else {
                Text("OffPeak").font(.system(size: 14, weight: .bold)).foregroundColor(fg)
                Text("Open the app to load").font(.system(size: 11)).foregroundColor(dim)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
    }
}

struct MediumView: View {
    let d: PriceData?
    var body: some View {
        if let d {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(d.price).font(.system(size: 34, weight: .heavy)).foregroundColor(hexColor(d.color))
                    Text(d.level).font(.system(size: 13, weight: .bold)).foregroundColor(hexColor(d.color))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(d.sub == "real-time" ? d.title : "\(d.title) · \(d.sub)")
                        .font(.system(size: 13, weight: .bold)).foregroundColor(fg).lineLimit(1)
                    TrendBars(points: d.points ?? [], color: hexColor(d.color))
                        .frame(height: 34)
                }
                VStack(alignment: .trailing, spacing: 4) {
                    if !d.hourAvg.isEmpty { Text("avg \(d.hourAvg)").font(.system(size: 11)).foregroundColor(dim) }
                    Text(d.updated).font(.system(size: 10)).foregroundColor(dim)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 16).padding(.vertical, 10)
        } else {
            Text("Open OffPeak to load").font(.system(size: 13)).foregroundColor(dim)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct OffPeakWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry
    var body: some View {
        Group {
            if family == .systemSmall {
                SmallView(d: entry.data)
            } else {
                MediumView(d: entry.data)
            }
        }
        .widgetURL(URL(string: "offpeak://"))
        .containerBackground(for: .widget) { bg }
    }
}

@main
struct OffPeakWidget: Widget {
    let kind = "OffPeakWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            OffPeakWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("OffPeak")
        .description("Real-time price + level with a last-hour trend.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
