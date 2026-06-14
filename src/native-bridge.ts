// Bridge between the web app and the native Expo WebView shell. The shell sets
// window.__OFFPEAK_NATIVE__ and exposes window.ReactNativeWebView; in a plain
// browser these are absent and every call here is a no-op, so the web app is
// unaffected.
import type { AlertPrefs, AlertSettings } from "@/lib";

interface RNWebView {
  postMessage: (msg: string) => void;
}
declare global {
  interface Window {
    __OFFPEAK_NATIVE__?: boolean;
    ReactNativeWebView?: RNWebView;
  }
}

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && window.__OFFPEAK_NATIVE__ === true;
}

function post(payload: unknown): void {
  if (!isNativeShell() || !window.ReactNativeWebView) return;
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  } catch {
    // ignore — native side will retry on next change
  }
}

/** Push alert config (thresholds + prefs) to native for the background task. */
export function postAlertConfig(
  thresholds: AlertSettings,
  prefs: AlertPrefs,
): void {
  post({ type: "alertConfig", thresholds, prefs });
}

/** Ask native to request OS notification permission + register the task. */
export function requestNotifPermission(): void {
  post({ type: "requestNotifPermission" });
}
