// Widget data plane. Fetches through the SAME shared provider abstraction the
// app uses (pricingClient → all 8 ISOs), so there is zero per-utility code here
// and no divergence. Publishes into the catalog (widgetStore) that the native
// provider reads. Specific submodule imports (not the @/lib barrel) keep
// react-query/zustand out of the headless bundle.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { pricingClient, UTILITIES, type Utility } from "@/lib/provider";
import { ALERT_LEVEL_META, DEFAULT_ALERT_SETTINGS, getAlertLevel } from "@/lib/pricing";
import { setComedBaseUrl } from "@/lib/comedApi";
import { setCaisoBaseUrl } from "@/lib/caisoApi";
import { setErcotBaseUrl } from "@/lib/ercotApi";
import { setNyisoBaseUrl } from "@/lib/nyisoApi";
import { setIsoneBaseUrl } from "@/lib/isoneApi";
import { setPjmBaseUrl } from "@/lib/pjmApi";
import { setMisoBaseUrl } from "@/lib/misoApi";
import { setSppBaseUrl } from "@/lib/sppApi";
import { putPlace, setBinding, freshForKey, type WidgetData } from "./widgetStore";
import { requestWidgetRepaint } from "./widgetBridge";

// In the WebView the clients are same-origin; the headless RN runtime has no
// origin, so point every provider at our deployed server (which proxies ComEd
// and serves the other ISOs). Idempotent.
const SERVER = "https://offpeak.atsumilabs.com";
let baseUrlsSet = false;
export function ensureWidgetBaseUrls(): void {
  if (baseUrlsSet) return;
  baseUrlsSet = true;
  setComedBaseUrl(`${SERVER}/comed`);
  setCaisoBaseUrl(SERVER);
  setErcotBaseUrl(SERVER);
  setNyisoBaseUrl(SERVER);
  setIsoneBaseUrl(SERVER);
  setPjmBaseUrl(SERVER);
  setMisoBaseUrl(SERVER);
  setSppBaseUrl(SERVER);
}

const ACTIVE_KEY = "offpeak.widgetActive"; // { utility, zone } the app last showed
const FRESH_TTL_MS = 20 * 60 * 1000;

interface ActiveSel {
  utility: Utility;
  zone?: string;
}

/** Snapshot the app posts over the WebView bridge (pre-rendered + routing). */
export interface AppWidgetSnapshot extends WidgetData {
  utility: Utility;
  zone?: string;
}

function widgetKey(utility: string, zone?: string): string {
  return zone ? `${utility}:${zone}` : utility;
}

function zoneLabel(utility: Utility, zone?: string): string {
  if (!zone) return "real-time";
  return UTILITIES[utility]?.zones?.find((z) => z.id === zone)?.label ?? "real-time";
}

/** The utility+zone a widget should display. For now every widget follows the
 *  app's active selection (cached when the app publishes a snapshot). */
async function resolveSelection(): Promise<ActiveSel> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s?.utility && UTILITIES[s.utility as Utility]) {
      return { utility: s.utility, zone: s.zone };
    }
  } catch {
    // fall through
  }
  return { utility: "comed" };
}

// How many recent 5-min points the banner trend bars show.
const TREND_POINTS = 24;

function build(
  utility: Utility,
  zone: string | undefined,
  price: number,
  hourAvg: string,
  points: number[],
): WidgetData {
  const level = getAlertLevel(price, DEFAULT_ALERT_SETTINGS);
  const meta = ALERT_LEVEL_META[level];
  return {
    price: `${price.toFixed(2)}¢`,
    level: meta.label,
    color: meta.color,
    hourAvg,
    updated: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    title: UTILITIES[utility]?.name ?? "OffPeak",
    sub: zoneLabel(utility, zone),
    points: points.slice(-TREND_POINTS),
  };
}

/** Headless fetch via the shared provider, published into the store. force=true
 *  (explicit ⟳) skips the cached row. Records the widget's binding so the
 *  native render half can find its row. */
export async function fetchWidgetPrice(widgetId: number, force = false): Promise<WidgetData | null> {
  ensureWidgetBaseUrls();
  const { utility, zone } = await resolveSelection();
  const key = widgetKey(utility, zone);
  await setBinding(widgetId, "active").catch(() => {});

  if (!force) {
    const cached = await freshForKey(key, FRESH_TTL_MS);
    if (cached) return cached;
  }

  const client = pricingClient(utility, zone);
  const feed = await client.getFiveMinuteFeed();
  if (!feed.length) return null;
  const latest = feed[feed.length - 1];

  let hourAvg = "—";
  try {
    const ch = await client.getCurrentHourAverage();
    if (ch) hourAvg = `${ch.price.toFixed(2)}¢`;
  } catch {
    // best-effort
  }

  const points = feed.map((p) => p.price);
  const data = build(utility, zone, latest.price, hourAvg, points);
  await putPlace(key, data, Date.now(), true).catch(() => {});
  return data;
}

/** App-open path: the app already rendered the price, so publish it directly
 *  (no fetch) and remember the active utility+zone for headless refreshes. */
export async function storeAppSnapshot(snap: AppWidgetSnapshot): Promise<void> {
  const { utility, zone, ...data } = snap;
  const key = widgetKey(utility, zone);
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify({ utility, zone })).catch(() => {});
  await putPlace(key, data, Date.now(), true).catch(() => {});
  requestWidgetRepaint();
}
