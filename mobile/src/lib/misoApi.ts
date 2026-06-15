// MISO client. MISO's real-time feed is a large all-nodes payload and the
// day-ahead data is a market-report CSV, so we go through our server (/miso/*),
// which fetches, filters to the chosen hub, and returns clean JSON (¢/kWh).

import type { HourlyPrice, PricingPoint } from "./pricing";

let MISO_BASE = "";

export function setMisoBaseUrl(base: string): void {
  MISO_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MISO_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MISO: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min LMP at a hub (default Illinois Hub). */
export async function misoFiveMinuteFeed(zone = "ILLINOIS.HUB"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/miso/rt?zone=${encodeURIComponent(zone)}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (5-min → last 12 intervals). */
export async function misoCurrentHourAverage(zone = "ILLINOIS.HUB"): Promise<PricingPoint | null> {
  const feed = await misoFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly LMP for the given date (MISO ExAnte, hours are EST). */
export async function misoDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/miso/dam?zone=${encodeURIComponent(zone)}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
