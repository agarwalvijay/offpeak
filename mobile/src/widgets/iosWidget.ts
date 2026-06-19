import { Platform } from "react-native";
import type { WidgetData } from "./widgetStore";

const APP_GROUP = "group.com.atsumilabs.offpeak";

/**
 * Push the active row to the iOS WidgetKit extension via the shared App Group
 * (read in Swift from UserDefaults(suiteName:)), then reload its timeline.
 * No-op off iOS / if the extension isn't present (e.g. Expo Go).
 */
export async function writeIosWidget(data: WidgetData): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set("widgetData", JSON.stringify(data));
    ExtensionStorage.reloadWidget();
  } catch {
    // extension not present — ignore
  }
}
