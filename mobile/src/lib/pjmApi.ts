// PJM client. PJM's Data Miner 2 needs a subscription-key header (and the
// browser can't reach it cross-origin), so we go through our server (/pjm/*),
// which holds the key, queries by pnode_id, and returns clean JSON (¢/kWh).

import type { HourlyPrice, PricingPoint } from "./pricing";

let PJM_BASE = "";

export function setPjmBaseUrl(base: string): void {
  PJM_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${PJM_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`PJM: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min LMP at a pricing node (default ComEd zone, 33092371). */
export async function pjmFiveMinuteFeed(zone = "33092371"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/pjm/rt?zone=${encodeURIComponent(zone)}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (5-min → last 12 intervals). */
export async function pjmCurrentHourAverage(zone = "33092371"): Promise<PricingPoint | null> {
  const feed = await pjmFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly LMP for the given (Eastern) date. */
export async function pjmDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/pjm/dam?zone=${encodeURIComponent(zone)}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
