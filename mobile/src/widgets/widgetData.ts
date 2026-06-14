// Headless data fetch for the home-screen widget. Reuses the shared ComEd
// client + pricing logic — native has no CORS restriction, so it hits ComEd
// directly (the default base URL).
// Specific module imports (not the @/lib barrel) to keep react-query/zustand
// out of the native bundle.
import { getCurrentHourAverage, getFiveMinuteFeed } from "@/lib/comedApi";
import { ALERT_LEVEL_META, DEFAULT_ALERT_SETTINGS, getAlertLevel } from "@/lib/pricing";

export interface WidgetPrice {
  price: string;
  level: string;
  color: string;
  hourAvg: string;
  updated: string;
}

export async function fetchWidgetPrice(): Promise<WidgetPrice | null> {
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
    // best-effort; leave placeholder
  }

  return {
    price: `${latest.price.toFixed(2)}¢`,
    level: meta.label,
    color: meta.color,
    hourAvg,
    updated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}
