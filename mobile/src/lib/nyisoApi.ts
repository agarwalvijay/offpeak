// NYISO client. NYISO publishes public CSVs (no auth), but the browser can't
// fetch them cross-origin and they need parsing, so we go through our server
// (/nyiso/*), which fetches the CSVs, parses, and returns clean JSON (¢/kWh).

import type { HourlyPrice, PricingPoint } from "./pricing";

let NYISO_BASE = "";

export function setNyisoBaseUrl(base: string): void {
  NYISO_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${NYISO_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NYISO: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min zonal LBMP (default New York City). */
export async function nyisoFiveMinuteFeed(zone = "N.Y.C."): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/nyiso/rt?zone=${encodeURIComponent(zone)}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (5-min → last 12 intervals). */
export async function nyisoCurrentHourAverage(zone = "N.Y.C."): Promise<PricingPoint | null> {
  const feed = await nyisoFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly zonal LBMP for the given (Eastern) date. */
export async function nyisoDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/nyiso/dam?zone=${encodeURIComponent(zone)}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
