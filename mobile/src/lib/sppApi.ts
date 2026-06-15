// SPP client. SPP's Marketplace publishes per-interval / daily CSVs, so we go
// through our server (/spp/*), which maintains a rolling real-time series and
// parses the day-ahead file, returning clean JSON (¢/kWh).

import type { HourlyPrice, PricingPoint } from "./pricing";

let SPP_BASE = "";

export function setSppBaseUrl(base: string): void {
  SPP_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SPP_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`SPP: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min LMP at a hub (default SPP North). */
export async function sppFiveMinuteFeed(zone = "SPPNORTH_HUB"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/spp/rt?zone=${encodeURIComponent(zone)}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (5-min → last 12 intervals). */
export async function sppCurrentHourAverage(zone = "SPPNORTH_HUB"): Promise<PricingPoint | null> {
  const feed = await sppFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly LMP for the given date (SPP DA, hours are Central). */
export async function sppDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/spp/dam?zone=${encodeURIComponent(zone)}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
