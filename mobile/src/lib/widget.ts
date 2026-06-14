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
}
