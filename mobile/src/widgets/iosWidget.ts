import { Platform } from "react-native";
import type { WidgetData } from "./widgetStore";

const APP_GROUP = "group.com.atsumilabs.offpeak";
const SERVER = "https://offpeak.atsumilabs.com";

/** Our server's normalized real-time feed URL for a utility+zone. The iOS
 *  widget extension fetches THIS on its own timeline (iOS can't run our JS), so
 *  it updates even when the app is closed — the per-ISO logic stays server-side.
 *  All return `[{millisUTC, price¢}]`; ComEd's values are strings (handled). */
function rtUrl(utility: string, zone?: string): string {
  const z = encodeURIComponent(zone ?? "");
  switch (utility) {
    case "comed":
      return `${SERVER}/comed/api?type=5minutefeed`;
    case "caiso":
      return `${SERVER}/caiso/rt?zone=${z}`;
    case "ercot":
      return `${SERVER}/ercot/rt?zone=${z}`;
    case "nyiso":
      return `${SERVER}/nyiso/rt?zone=${z}`;
    case "isone":
      return `${SERVER}/isone/rt?zone=${z}`;
    case "pjm":
      return `${SERVER}/pjm/rt?zone=${z}`;
    case "miso":
      return `${SERVER}/miso/rt?zone=${z}`;
    case "spp":
      return `${SERVER}/spp/rt?zone=${z}`;
    default:
      return `${SERVER}/comed/api?type=5minutefeed`;
  }
}

/**
 * Push to the iOS WidgetKit extension via the shared App Group:
 *  - `widgetData`: the rendered snapshot (instant display / fallback)
 *  - `widgetConfig`: the rt URL + labels so the extension self-refreshes on its
 *    own timeline (the fix for "iOS widgets never update" — they can't run JS).
 * Then reload the timeline. No-op off iOS / if the extension isn't present.
 */
export async function writeIosWidget(
  data: WidgetData,
  utility: string,
  zone?: string,
): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set("widgetData", JSON.stringify(data));
    storage.set(
      "widgetConfig",
      JSON.stringify({ rtUrl: rtUrl(utility, zone), title: data.title, sub: data.sub }),
    );
    ExtensionStorage.reloadWidget();
  } catch {
    // extension not present — ignore
  }
}
