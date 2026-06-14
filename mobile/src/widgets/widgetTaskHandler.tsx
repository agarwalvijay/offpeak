import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { fetchWidgetPrice } from "./widgetData";
import { OffPeakWidget } from "./OffPeakWidget";

/**
 * Called by the OS for widget lifecycle events (added, periodic update,
 * resized, clicked). Fetches the latest ComEd price and re-renders the widget.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const render = async (preferSnapshot: boolean) => {
    let data: Awaited<ReturnType<typeof fetchWidgetPrice>> = null;
    try {
      data = await fetchWidgetPrice(preferSnapshot);
    } catch {
      // fetchWidgetPrice already falls back to the last snapshot.
    }
    props.renderWidget(<OffPeakWidget data={data} />);
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
