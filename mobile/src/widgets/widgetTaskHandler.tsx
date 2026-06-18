import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { fetchWidgetPrice, readLastSnapshot } from "./widgetData";
import { OffPeakWidget } from "./OffPeakWidget";

/**
 * Called by the OS for widget lifecycle events (added, periodic update,
 * resized, clicked).
 *
 * CRITICAL: render IMMEDIATELY with whatever we already have (last snapshot, or
 * the placeholder if none) so the widget is never blank — THEN fetch fresh under
 * a hard timeout and re-render only on success. Awaiting an un-timed network
 * chain before the first render means a hung headless fetch (on boot / after the
 * snapshot expires) never calls renderWidget, leaving the widget invisible until
 * the app is opened.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const render = async (preferSnapshot: boolean) => {
    // 1) Always paint something right away (never blank).
    props.renderWidget(<OffPeakWidget data={await readLastSnapshot().catch(() => null)} />);
    // 2) Refresh under a hard timeout; re-render only if we got data.
    const fresh = await fetchWidgetPrice(preferSnapshot, 12000).catch(() => null);
    if (fresh) props.renderWidget(<OffPeakWidget data={fresh} />);
  };

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await render(true);
      break;
    case "WIDGET_CLICK":
      // Manual refresh forces a live fetch (bypasses the snapshot fast-path).
      if (props.clickAction === "REFRESH") await render(false);
      break;
    default:
      break;
  }
}
