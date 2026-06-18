/**
 * Pre-formatted current-price summary shared between the app (which posts it via
 * the WebView bridge) and the home-screen widget (which displays it). Keeping the
 * shape in one place means the widget mirrors exactly what the app last showed.
 */
export interface WidgetSnapshot {
  price: string; // "2.10¢"
  level: string; // "Low"
  color: string; // "#16A34A"
  hourAvg: string; // "1.40¢" or "—"
  updated: string; // "5:39 PM"
  // Routing + labels so the multi-utility widget shows the selected provider
  // and the headless refresh knows what to re-fetch.
  utility: string; // "comed" | "caiso" | ...
  zone?: string; // zone id, if the utility has zones
  title: string; // utility name, e.g. "ComEd" / "CAISO"
  sub: string; // zone label / "real-time"
}
