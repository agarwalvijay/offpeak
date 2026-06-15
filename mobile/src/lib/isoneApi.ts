// ISO-NE client. ISO-NE's web services need HTTP Basic auth, so we go through
// our server (/isone/*), which holds the credentials and returns clean JSON.

import type { HourlyPrice, PricingPoint } from "./pricing";

let ISONE_BASE = "";

export function setIsoneBaseUrl(base: string): void {
  ISONE_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ISONE_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ISO-NE: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time 5-min LMP at a location (default Internal Hub, 4000). */
export async function isoneFiveMinuteFeed(zone = "4000"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/isone/rt?zone=${zone}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (5-min → last 12 intervals). */
export async function isoneCurrentHourAverage(zone = "4000"): Promise<PricingPoint | null> {
  const feed = await isoneFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-12);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly LMP for the given (Eastern) date. */
export async function isoneDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/isone/dam?zone=${zone}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
