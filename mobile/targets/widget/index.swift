import WidgetKit
import SwiftUI

// MARK: - Shared data (App Group)

private let appGroup = "group.com.atsumilabs.offpeak"
private let dataKey = "widgetData"     // last rendered snapshot (instant render / fallback)
private let configKey = "widgetConfig" // routing the app writes so the widget fetches itself

/// Pre-formatted snapshot the RN app writes + what we render.
struct PriceData: Codable {
    var price: String
    var level: String
    var color: String
    var hourAvg: String
    var updated: String
    var title: String
    var sub: String
    var points: [Double]?
}

/// Routing the RN app writes so the widget extension can refresh on its OWN
/// timeline (iOS can't run our JS) — the whole reason the old read-only widget
/// never updated. `rtUrl` is our server's normalized `[{millisUTC,price}]` feed
/// for the selected utility+zone, so there's no per-ISO logic in Swift.
struct WidgetConfig: Decodable {
    var rtUrl: String
    var title: String
    var sub: String
}

private func sharedDefaults() -> UserDefaults? { UserDefaults(suiteName: appGroup) }

private func loadData() -> PriceData? {
    guard let raw = sharedDefaults()?.string(forKey: dataKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(PriceData.self, from: data)
}

private func saveData(_ d: PriceData) {
    guard let data = try? JSONEncoder().encode(d),
          let str = String(data: data, encoding: .utf8) else { return }
    sharedDefaults()?.set(str, forKey: dataKey)
}

private func loadConfig() -> WidgetConfig? {
    guard let raw = sharedDefaults()?.string(forKey: configKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetConfig.self, from: data)
}

// MARK: - Self-fetch (server returns a normalized [{millisUTC,price}] feed)

/// `millisUTC`/`price` come back as numbers (most ISOs) or strings (ComEd) — decode either.
private struct RawPoint: Decodable {
    let millis: Double
    let price: Double
    enum Keys: String, CodingKey { case millisUTC, price }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        if let m = try? c.decode(Double.self, forKey: .millisUTC) { millis = m }
        else { millis = Double((try? c.decode(String.self, forKey: .millisUTC)) ?? "") ?? 0 }
        if let p = try? c.decode(Double.self, forKey: .price) { price = p }
        else { price = Double((try? c.decode(String.self, forKey: .price)) ?? "") ?? 0 }
    }
}

// Tier thresholds (¢/kWh) match DEFAULT_ALERT_SETTINGS / ALERT_LEVEL_META.
private func tier(_ price: Double) -> (color: String, level: String) {
    if price >= 10 { return ("#DC2626", "High") }
    if price >= 6 { return ("#EA580C", "Medium") }
    return ("#16A34A", "Low")
}

private func fmt(_ v: Double) -> String { String(format: "%.2f¢", v) }

private func timeString() -> String {
    let f = DateFormatter()
    f.dateFormat = "h:mm a"
    return f.string(from: Date())
}

private func fetchPrice(_ cfg: WidgetConfig) async -> PriceData? {
    guard let url = URL(string: cfg.rtUrl) else { return nil }
    var req = URLRequest(url: url)
    req.timeoutInterval = 15
    req.setValue("OffPeak/1.0", forHTTPHeaderField: "User-Agent")
    guard
        let (data, resp) = try? await URLSession.shared.data(for: req),
        let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode),
        let pts = try? JSONDecoder().decode([RawPoint].self, from: data), !pts.isEmpty
    else { return nil }

    let sorted = pts.sorted { $0.millis < $1.millis }
    let latest = sorted.last!.price
    let recent = sorted.suffix(24).map { $0.price }
    let last12 = sorted.suffix(12).map { $0.price }
    let avg = last12.isEmpty ? latest : last12.reduce(0, +) / Double(last12.count)
    let (color, level) = tier(latest)
    return PriceData(
        price: fmt(latest), level: level, color: color,
        hourAvg: fmt(avg), updated: timeString(),
        title: cfg.title, sub: cfg.sub, points: recent
    )
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

// MARK: - Trend bars

private struct TrendBars: View {
    let points: [Double]
    let color: Color
    var body: some View {
        GeometryReader { geo in
            let mn = points.min() ?? 0
            let mx = points.max() ?? 1
            let rng = max(mx - mn, 0.0001)
            let n = max(points.count - 1, 1)
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(Array(points.enumerated()), id: \.offset) { i, v in
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
        Task {
            var data = loadData()
            if let cfg = loadConfig(), let fresh = await fetchPrice(cfg) {
                saveData(fresh) // keep the freshest as the instant-render fallback
                data = fresh
            }
            let entry = PriceEntry(date: Date(), data: data)
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
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
                    TrendBars(points: d.points ?? [], color: hexColor(d.color)).frame(height: 34)
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
