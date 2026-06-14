import React from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { fetchWidgetPrice } from "./widgetData";
import { OffPeakWidget } from "./OffPeakWidget";

/**
 * Re-fetch and re-render any placed OffPeak widget. Called when the app goes to
 * the background (Android's updatePeriodMillis alone is unreliable).
 */
export async function refreshOffPeakWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  await requestWidgetUpdate({
    widgetName: "OffPeakPrice",
    renderWidget: async () =>
      React.createElement(OffPeakWidget, {
        data: await fetchWidgetPrice().catch(() => null),
      }),
    widgetNotFound: () => {},
  }).catch(() => {});
}
