// ERCOT client. ERCOT's API needs OAuth (id_token) + a subscription key, so we
// go through our own server (/ercot/*), which holds the credentials, mints the
// token, fetches the SPP reports, and returns clean JSON (¢/kWh). Same base
// convention as CAISO.

import type { HourlyPrice, PricingPoint } from "./pricing";

let ERCOT_BASE = "";

export function setErcotBaseUrl(base: string): void {
  ERCOT_BASE = base.replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ERCOT_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ERCOT: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Real-time Settlement Point Prices (15-min) at a hub (default Houston). */
export async function ercotFiveMinuteFeed(zone = "HB_HOUSTON"): Promise<PricingPoint[]> {
  const data = await getJson<{ millisUTC: number; price: number }[]>(
    `/ercot/rt?zone=${zone}`,
  );
  return data.map((d) => ({ dateTime: new Date(d.millisUTC), price: d.price }));
}

/** Trailing-hour average (ERCOT RT SPP is 15-min → last 4 intervals). */
export async function ercotCurrentHourAverage(zone = "HB_HOUSTON"): Promise<PricingPoint | null> {
  const feed = await ercotFiveMinuteFeed(zone);
  if (feed.length === 0) return null;
  const last = feed.slice(-4);
  const avg = last.reduce((s, p) => s + p.price, 0) / last.length;
  return { dateTime: feed[feed.length - 1].dateTime, price: avg };
}

/** Day-ahead hourly Settlement Point Prices for the given (Central) date. */
export async function ercotDayAheadPricing(
  zone: string,
  date: Date,
): Promise<HourlyPrice[]> {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const data = await getJson<{ hour: number; price: number }[]>(
    `/ercot/dam?zone=${zone}&date=${ymd}`,
  );
  return data.map((d) => ({
    hour: d.hour,
    price: d.price,
    dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.hour),
  }));
}
