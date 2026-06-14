// Background price-alert task. The OS runs this periodically (~15 min, best
// effort); it fetches the latest ComEd price and fires a local notification when
// the price enters an enabled alert state. Config comes from the web app via the
// WebView bridge (stored in AsyncStorage). Mirrors Skyfield's alertTask.ts.

import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import from specific lib modules (not the @/lib barrel) so the native bundle
// never pulls in the web-only deps the barrel re-exports (react-query/zustand).
import { getFiveMinuteFeed } from "@/lib/comedApi";
import { DEFAULT_ALERT_SETTINGS, type AlertSettings } from "@/lib/pricing";
import {
  DEFAULT_ALERT_PREFS,
  DEFAULT_ALERT_STATE,
  evaluatePriceAlert,
  type AlertPrefs,
  type AlertState,
} from "@/lib/priceAlerts";
import { refreshOffPeakWidget } from "@/widgets/refreshWidgets";

export const PRICE_ALERT_TASK = "offpeak-price-alert";
const CONFIG_KEY = "offpeak.alertConfig";
const STATE_KEY = "offpeak.alertState";

interface StoredConfig {
  thresholds: AlertSettings;
  prefs: AlertPrefs;
}

/** Called by the WebView bridge when the web app's alert settings change. */
export async function storeAlertConfig(config: StoredConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

async function readConfig(): Promise<StoredConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as StoredConfig;
  } catch {
    // fall through to defaults
  }
  return { thresholds: DEFAULT_ALERT_SETTINGS, prefs: DEFAULT_ALERT_PREFS };
}

async function readState(): Promise<AlertState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as AlertState;
  } catch {
    // fall through
  }
  return DEFAULT_ALERT_STATE;
}

TaskManager.defineTask(PRICE_ALERT_TASK, async () => {
  try {
    // Android's updatePeriodMillis is unreliable; refresh the widget here too.
    await refreshOffPeakWidget();

    const { thresholds, prefs } = await readConfig();
    if (!prefs.enabled) return BackgroundTask.BackgroundTaskResult.Success;

    const feed = await getFiveMinuteFeed();
    if (feed.length === 0) return BackgroundTask.BackgroundTaskResult.Success;
    const price = feed[feed.length - 1].price;

    const last = await readState();
    const { notification, next } = evaluatePriceAlert(price, thresholds, prefs, last);
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));

    if (notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          sound: "default",
        },
        trigger: null, // immediate
      });
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let registered = false;

/** Register the periodic background check (idempotent). */
export async function registerPriceAlertTask(): Promise<void> {
  if (registered) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available) {
      await BackgroundTask.registerTaskAsync(PRICE_ALERT_TASK, {
        minimumInterval: 15, // minutes; OS decides actual cadence
      });
      registered = true;
    }
  } catch {
    // non-fatal
  }
}
