import { NativeModules, Platform } from "react-native";

/**
 * Thin JS wrapper over the native WidgetBridge module (see
 * WidgetBridgeModule.java). The store lives as a JSON file the native provider
 * reads; JS owns the read-modify-write and persists through here. No-ops off
 * Android / if the module is unavailable.
 */

/** Persist the full store document to the native-readable file. */
export function writeNativeStore(json: string): void {
  if (Platform.OS !== "android") return;
  try {
    NativeModules.WidgetBridge?.writeStore?.(json);
  } catch {
    // non-fatal
  }
}

/** Ask the native provider to repaint from the store now (don't wait on the
 *  ~30-min updatePeriodMillis tick). Call after a store write. */
export function requestWidgetRepaint(): void {
  if (Platform.OS !== "android") return;
  try {
    NativeModules.WidgetBridge?.requestUpdate?.();
  } catch {
    // non-fatal
  }
}
