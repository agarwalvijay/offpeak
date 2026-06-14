import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;

/** Install the foreground handler + Android channel (idempotent). */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("price-alerts", {
      name: "Price alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Request OS notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  await configureNotifications();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
