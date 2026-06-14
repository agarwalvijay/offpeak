// Data for the home-screen widget. Prefers a snapshot the app posted (so the
// widget matches what the app last showed — no "app says 5¢, widget says 3¢"),
// falls back to a live ComEd fetch, and finally to the last stored snapshot so
// the widget never goes blank. Mirrors Skyfield's app-snapshot pattern.

import AsyncStorage from "@react-native-async-storage/async-storage";
// Specific module imports (not the @/lib barrel) to keep react-query/zustand
// out of the native bundle.
import { getCurrentHourAverage, getFiveMinuteFeed } from "@/lib/comedApi";
import { ALERT_LEVEL_META, DEFAULT_ALERT_SETTINGS, getAlertLevel } from "@/lib/pricing";
import type { WidgetSnapshot } from "@/lib/widget";

export type WidgetPrice = WidgetSnapshot;

const SNAP_KEY = "offpeak.widgetSnapshot";
// Prefer a recent snapshot (e.g. just posted by the app) over a fresh fetch so
// the widget tracks the app; after this it fetches live again.
const SNAP_FRESH_MS = 20 * 60 * 1000;

interface StoredSnap {
  data: WidgetSnapshot;
  at: number;
}

/** Persist the latest snapshot (called by the app via the bridge, and after a
 *  successful live fetch). */
export async function storeWidgetSnapshot(data: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(SNAP_KEY, JSON.stringify({ data, at: Date.now() }));
}

async function readSnap(): Promise<StoredSnap | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAP_KEY);
    if (raw) return JSON.parse(raw) as StoredSnap;
  } catch {
    // ignore
  }
  return null;
}

async function liveFetch(): Promise<WidgetSnapshot | null> {
  const feed = await getFiveMinuteFeed();
  if (feed.length === 0) return null;
  const latest = feed[feed.length - 1];
  const level = getAlertLevel(latest.price, DEFAULT_ALERT_SETTINGS);
  const meta = ALERT_LEVEL_META[level];

  let hourAvg = "—";
  try {
    const ch = await getCurrentHourAverage();
    if (ch) hourAvg = `${ch.price.toFixed(2)}¢`;
  } catch {
    // best-effort
  }

  return {
    price: `${latest.price.toFixed(2)}¢`,
    level: meta.label,
    color: meta.color,
    hourAvg,
    updated: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

/**
 * What the widget should display.
 * - `preferSnapshot` (periodic/added): use a recent app snapshot if present, so
 *   the widget mirrors the app; otherwise fetch live.
 * - manual refresh passes `false` to force a live fetch.
 * On any failure, returns the last stored snapshot (even if stale) rather than
 * going blank.
 */
export async function fetchWidgetPrice(preferSnapshot = true): Promise<WidgetSnapshot | null> {
  const snap = await readSnap();
  if (preferSnapshot && snap && Date.now() - snap.at < SNAP_FRESH_MS) {
    return snap.data;
  }
  try {
    const live = await liveFetch();
    if (live) {
      await storeWidgetSnapshot(live);
      return live;
    }
  } catch {
    // fall through to stale snapshot
  }
  return snap?.data ?? null;
}
