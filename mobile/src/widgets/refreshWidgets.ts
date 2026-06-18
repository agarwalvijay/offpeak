import React from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { fetchWidgetPrice, readLastSnapshot } from "./widgetData";
import { OffPeakWidget } from "./OffPeakWidget";

/**
 * Re-fetch and re-render any placed OffPeak widget. Called when the app goes to
 * the background (Android's updatePeriodMillis alone is unreliable). Uses a
 * timed fetch + last-snapshot fallback so it can never hang or render blank.
 */
export async function refreshOffPeakWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  await requestWidgetUpdate({
    widgetName: "OffPeakPrice",
    renderWidget: async () => {
      const data =
        (await fetchWidgetPrice(true, 12000).catch(() => null)) ??
        (await readLastSnapshot().catch(() => null));
      return React.createElement(OffPeakWidget, { data });
    },
    widgetNotFound: () => {},
  }).catch(() => {});
}
