// CAISO client. CAISO's OASIS API returns rate-limited zipped XML, so we go
// through our own server (/caiso/*), which fetches OASIS, unzips, parses, caches,
// and returns clean JSON (¢/kWh). Default base is same-origin (the app is served
// by that same server, and the mobile WebView loads it); override for dev/native.

import type { HourlyPrice, PricingPoint } from "./pricing";

let CAISO_BASE = "";

/** Override the /caiso base (e.g. vite dev proxy or a native shell). */
export function setCaisoBaseUrl(base: string): void {
  CAISO_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${CAISO_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CAISO: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min LMP for the last 24h at a trading hub (default NP15). */
export async function caisoFiveMinuteFeed(zone = "NP15"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/caiso/rt?zone=${zone}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (CAISO has no current-hour endpoint; derive it). */
export async function caisoCurrentHourAverage(zone = "NP15"): Promise<PricingPoint | null> {
  const feed = await caisoFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12); // ~1 hour of 5-min intervals
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly LMP for the given (Pacific) date. */
export async function caisoDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/caiso/dam?zone=${zone}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
