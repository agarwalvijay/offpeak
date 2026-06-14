// Domain types + pure pricing logic. Direct port of the Flutter app's
// lib/models/pricing_data.dart and the derived getters in
// lib/providers/pricing_provider.dart. No platform or UI dependencies, so this
// file is shared verbatim by the web and mobile apps.

export interface PricingPoint {
  /** Device-local time of the reading (millisUTC converted to local). */
  dateTime: Date;
  /** Price in ¢/kWh. */
  price: number;
}

export interface HourlyPrice {
  hour: number;
  price: number;
  dateTime: Date;
}

export interface PricingStatistics {
  average: number;
  minimum: number;
  maximum: number;
  median: number;
  dataPoints: number;
}

/** Stats over a set of points (avg/min/max/median). Empty → all zeros. */
export function computeStatistics(data: PricingPoint[]): PricingStatistics {
  if (data.length === 0) {
    return { average: 0, minimum: 0, maximum: 0, median: 0, dataPoints: 0 };
  }
  const prices = data.map((p) => p.price).sort((a, b) => a - b);
  const n = prices.length;
  const sum = prices.reduce((a, b) => a + b, 0);
  const median =
    n % 2 === 0 ? (prices[n / 2 - 1] + prices[n / 2]) / 2 : prices[(n - 1) / 2];
  return {
    average: sum / n,
    minimum: prices[0],
    maximum: prices[n - 1],
    median,
    dataPoints: data.length,
  };
}

// --- Alert levels / thresholds -------------------------------------------------

export type AlertLevel = "low" | "normal" | "medium" | "high";

export interface AlertSettings {
  low: number;
  medium: number;
  high: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { low: 3, medium: 6, high: 10 };

/** Mirrors AlertSettings.getAlertLevel in the Flutter app. */
export function getAlertLevel(price: number, s: AlertSettings): AlertLevel {
  if (price >= s.high) return "high";
  if (price >= s.medium) return "medium";
  if (price <= s.low) return "low";
  return "normal";
}

export const ALERT_LEVEL_META: Record<
  AlertLevel,
  { label: string; description: string; color: string }
> = {
  low: { label: "Low", description: "Great time to use electricity", color: "#16A34A" },
  normal: { label: "Normal", description: "Standard pricing", color: "#2563EB" },
  medium: { label: "Elevated", description: "Consider reducing usage", color: "#EA580C" },
  high: { label: "High", description: "Avoid high-energy activities", color: "#DC2626" },
};

// --- Look-back windows ---------------------------------------------------------

export type TimePeriod = "30m" | "1h" | "3h" | "6h" | "24h";

export const TIME_PERIODS: TimePeriod[] = ["30m", "1h", "3h", "6h", "24h"];

export const TIME_PERIOD_META: Record<
  TimePeriod,
  { label: string; longLabel: string; ms: number }
> = {
  "30m": { label: "30m", longLabel: "Last 30 minutes", ms: 30 * 60_000 },
  "1h": { label: "1h", longLabel: "Last hour", ms: 60 * 60_000 },
  "3h": { label: "3h", longLabel: "Last 3 hours", ms: 3 * 60 * 60_000 },
  "6h": { label: "6h", longLabel: "Last 6 hours", ms: 6 * 60 * 60_000 },
  "24h": { label: "24h", longLabel: "Last 24 hours", ms: 24 * 60 * 60_000 },
};

/**
 * Subset of 5-min data within the look-back window, measured back from the
 * newest point (matches PricingProvider.filteredFiveMinuteData).
 */
export function filterByPeriod(
  data: PricingPoint[],
  period: TimePeriod,
): PricingPoint[] {
  if (data.length === 0) return [];
  const newest = data[data.length - 1].dateTime.getTime();
  const cutoff = newest - TIME_PERIOD_META[period].ms;
  return data.filter((p) => p.dateTime.getTime() >= cutoff);
}

export type DayAheadDay = "today" | "tomorrow";

/**
 * Hourly averages of today's readings, derived from the 5-minute feed — used to
 * overlay actuals on the day-ahead forecast (PricingProvider.todayActualHourly).
 */
export function todayActualHourly(data: PricingPoint[]): HourlyPrice[] {
  if (data.length === 0) return [];
  const now = new Date();
  const groups = new Map<number, number[]>();
  for (const p of data) {
    if (
      p.dateTime.getFullYear() === now.getFullYear() &&
      p.dateTime.getMonth() === now.getMonth() &&
      p.dateTime.getDate() === now.getDate()
    ) {
      const h = p.dateTime.getHours();
      const bucket = groups.get(h);
      if (bucket) bucket.push(p.price);
      else groups.set(h, [p.price]);
    }
  }
  const out: HourlyPrice[] = [];
  for (const [hour, prices] of groups) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    out.push({
      hour,
      price: avg,
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour),
    });
  }
  return out.sort((a, b) => a.hour - b.hour);
}
