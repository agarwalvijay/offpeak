import AsyncStorage from "@react-native-async-storage/async-storage";
import { writeNativeStore } from "./widgetBridge";

/**
 * The widget data plane — ONE source of truth, read by the native provider
 * (BaseOffPeakWidget.java) and written only through here.
 *
 * The PRODUCER publishes a catalog keyed by utility(+zone) and is blind to which
 * widget consumes what. Each CONSUMER (a widget instance) subscribes by key via
 * `bindings`. The native render half is a pure lookup: bindings[id] -> key ->
 * places[key].data.
 *
 *   {
 *     active:   "<key>" | null,            // the app's current utility+zone
 *     places:   { "<key>": { at, data } }, // newest-wins per key
 *     bindings: { "<widgetId>": "<key>" | "active" }
 *   }
 *
 * Held in AsyncStorage for easy read-modify-write, and mirrored to the
 * native-readable file (widget_store.json) on every write. `at` is epoch ms;
 * writes are newest-wins so a slow background fetch can't clobber a fresher
 * value for the same key.
 */

const STORE_KEY = "offpeak.widgetStore";

export interface WidgetData {
  price: string; // "2.45¢"
  level: string; // "Low"
  color: string; // "#16A34A"
  hourAvg: string; // "2.60¢" or "—"
  updated: string; // "6:32 PM"
  title: string; // utility name, e.g. "ComEd" / "CAISO"
  sub: string; // zone label / "real-time"
  points?: number[]; // recent 5-min prices (¢) for the banner trend bars
}

interface PlaceRecord {
  at: number;
  data: WidgetData;
}

interface WidgetStore {
  active: string | null;
  places: Record<string, PlaceRecord>;
  bindings: Record<string, string>;
}

async function read(): Promise<WidgetStore> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return { active: s?.active ?? null, places: s?.places ?? {}, bindings: s?.bindings ?? {} };
  } catch {
    return { active: null, places: {}, bindings: {} };
  }
}

async function write(s: WidgetStore): Promise<void> {
  const json = JSON.stringify(s);
  await AsyncStorage.setItem(STORE_KEY, json);
  writeNativeStore(json); // mirror to the file the native provider reads
}

/** Publish data for a key. Newest-wins; optionally mark it the active row. */
export async function putPlace(
  key: string,
  data: WidgetData,
  at: number = Date.now(),
  active = false,
): Promise<void> {
  const s = await read();
  const existing = s.places[key];
  if (!existing || existing.at <= at) s.places[key] = { at, data };
  if (active) s.active = key;
  await write(s);
}

/** Record a widget's subscription: a key, or "active" to follow the app. */
export async function setBinding(widgetId: number, target: string): Promise<void> {
  const s = await read();
  s.bindings[String(widgetId)] = target;
  await write(s);
}

/** Fresh data for a specific key, or null past `ttlMs`. */
export async function freshForKey(key: string, ttlMs: number): Promise<WidgetData | null> {
  const rec = (await read()).places[key];
  return rec && Date.now() - rec.at < ttlMs ? rec.data : null;
}
