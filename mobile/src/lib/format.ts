// Formatting helpers — ports of the getters on PricingPoint/HourlyPrice in the
// Flutter app (lib/models/pricing_data.dart).

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** `12.34¢` */
export function formatPrice(price: number): string {
  return `${price.toFixed(2)}¢`;
}

/** `14:05` (device-local, matching the Flutter app's `toLocal()` handling). */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `Jun 14` */
export function formatDate(d: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** `09:00` for an integer hour of day. */
export function formatHour(hour: number): string {
  return `${pad(hour)}:00`;
}
