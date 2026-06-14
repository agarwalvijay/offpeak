// Price-alert evaluation — port of legacy/price_alerts.py. Pure and testable;
// shared by the web Settings (to describe alerts) and the mobile background task
// (to decide when to fire a local notification). Reuses AlertSettings thresholds.

import type { AlertSettings } from "./pricing";

export type AlertKind = "high" | "cheap" | "negative";

export interface AlertPrefs {
  enabled: boolean;
  high: boolean;
  cheap: boolean;
  negative: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  enabled: false,
  high: true,
  cheap: true,
  negative: true,
};

/** Last notification we fired — persisted so we don't spam every poll. */
export interface AlertState {
  type: AlertKind | null;
  at: number; // epoch ms
}

export const DEFAULT_ALERT_STATE: AlertState = { type: null, at: 0 };

export interface AlertNotification {
  type: AlertKind;
  title: string;
  body: string;
}

export interface AlertResult {
  /** Non-null when a notification should be shown now. */
  notification: AlertNotification | null;
  /** Always persist this — tracks state so re-entry/cooldown work. */
  next: AlertState;
}

/** Re-notify for a still-active state only after this long. */
export const ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h

/** Which enabled alert state the price is in right now (negative > high > cheap). */
function currentKind(
  price: number,
  t: AlertSettings,
  prefs: AlertPrefs,
): AlertKind | null {
  if (prefs.negative && price < 0) return "negative";
  if (prefs.high && price >= t.high) return "high";
  if (prefs.cheap && price <= t.low) return "cheap";
  return null;
}

const COPY: Record<AlertKind, (priceStr: string) => { title: string; body: string }> = {
  high: (p) => ({
    title: `⚠️ High price — ${p}`,
    body: "Prices are high. Consider reducing electricity usage.",
  }),
  cheap: (p) => ({
    title: `💡 Low price — ${p}`,
    body: "Great time to use electricity — run the dishwasher, laundry, or charge the EV.",
  }),
  negative: (p) => ({
    title: `🎉 Negative pricing — ${p}`,
    body: "You're being paid to use electricity. Run major appliances now.",
  }),
};

/**
 * Decide whether to fire a price notification. Fires when the price enters an
 * enabled alert state, or stays in it past the cooldown. Always returns the
 * next AlertState to persist (cleared when the price is in no alert state, so a
 * later re-entry notifies immediately). Mutates nothing.
 */
export function evaluatePriceAlert(
  price: number,
  thresholds: AlertSettings,
  prefs: AlertPrefs,
  last: AlertState,
  now: number = Date.now(),
): AlertResult {
  if (!prefs.enabled) return { notification: null, next: last };

  const kind = currentKind(price, thresholds, prefs);
  if (!kind) {
    // Not in any alert state — clear so re-entry counts as new.
    return { notification: null, next: { type: null, at: last.at } };
  }

  const isNewState = last.type !== kind;
  const cooldownElapsed = now - last.at >= ALERT_COOLDOWN_MS;
  if (!isNewState && !cooldownElapsed) {
    return { notification: null, next: last };
  }

  const { title, body } = COPY[kind](`${price.toFixed(2)}¢`);
  return {
    notification: { type: kind, title, body },
    next: { type: kind, at: now },
  };
}
