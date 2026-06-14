// ComEd Hourly Pricing API client. Direct port of the Flutter app's
// lib/services/comed_api_service.dart. Uses `fetch`, which is available on both
// the web (browser) and React Native, so this file is shared by both apps.

import type { HourlyPrice, PricingPoint } from "./pricing";

// Default to ComEd's host directly (native apps have no CORS restriction). The
// web app overrides this to a same-origin proxy path via setComedBaseUrl(),
// because the /rrtp/ServletFeed endpoint sends no CORS headers.
let BASE_URL = "https://hourlypricing.comed.com";

/** Override the API base (web uses "/comed", proxied server-side). */
export function setComedBaseUrl(base: string): void {
  BASE_URL = base.replace(/\/$/, "");
}

const TIMEOUT_MS = 20_000;

interface RawPoint {
  millisUTC: string | number;
  price: string | number;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { Accept: accept },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parsePoint(raw: RawPoint): PricingPoint {
  const millis =
    typeof raw.millisUTC === "number"
      ? raw.millisUTC
      : parseInt(String(raw.millisUTC), 10);
  const price =
    typeof raw.price === "number" ? raw.price : parseFloat(String(raw.price));
  return { dateTime: new Date(millis), price };
}

/** 5-minute pricing feed for the last 24 hours, sorted ascending by time. */
export async function getFiveMinuteFeed(): Promise<PricingPoint[]> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/api?type=5minutefeed`,
    "application/json",
  );
  if (!res.ok) throw new Error(`5-min feed: HTTP ${res.status}`);
  const data = (await res.json()) as RawPoint[];
  return data
    .map(parsePoint)
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
}

/** Average price for the current hour, or null if unavailable. */
export async function getCurrentHourAverage(): Promise<PricingPoint | null> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/api?type=currenthouraverage`,
    "application/json",
  );
  if (!res.ok) return null;
  const data = (await res.json()) as RawPoint[];
  if (data.length === 0) return null;
  return parsePoint(data[0]);
}

/**
 * Day-ahead hourly pricing for the given date (Chicago local). Returns an empty
 * list if the endpoint hasn't published data for that date yet.
 */
export async function getDayAheadPricing(date: Date): Promise<HourlyPrice[]> {
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const ts = Date.now();
  const url = `${BASE_URL}/rrtp/ServletFeed?type=daynexttoday&date=${dateStr}&_=${ts}`;
  const res = await fetchWithTimeout(url, "text/plain");
  if (!res.ok) return [];
  return parseDayAhead(await res.text());
}

/**
 * Response is `[[Date.UTC(y,m,d,h,mm,ss), price], …]` where `m` is 0-based. The
 * values are already Chicago local time despite the `Date.UTC` wrapper, so we
 * treat them as wall-clock hours (JS Date months are 0-based too, so the regex
 * month group is used directly).
 */
function parseDayAhead(body: string): HourlyPrice[] {
  const re = /Date\.UTC\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\),\s*([\d.]+)/g;
  const out: HourlyPrice[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const year = Number(m[1]);
    const monthIndex = Number(m[2]); // already 0-based
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const price = parseFloat(m[7]);
    if (Number.isNaN(price)) continue;
    out.push({
      hour,
      price,
      dateTime: new Date(year, monthIndex, day, hour),
    });
  }
  return out.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
}
