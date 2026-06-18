import { Platform } from "react-native";
import { syncWidgets } from "./widgetSync";

/**
 * Refresh every widget: fetch fresh data for the active selection into the store
 * (newest-wins) and repaint. The native providers re-read their row on the
 * APPWIDGET_UPDATE broadcast. Called when the app backgrounds and by the
 * background price-alert task.
 */
export async function refreshOffPeakWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  await syncWidgets(undefined, true).catch(() => {});
}
