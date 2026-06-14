import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { refreshOffPeakWidget } from "./src/widgets/refreshWidgets";
import { configureNotifications, requestNotificationPermission } from "./src/notifications";
import { registerPriceAlertTask, storeAlertConfig } from "./src/tasks/priceAlertTask";
import { storeWidgetSnapshot } from "./src/widgets/widgetData";

// The mobile app presents the same full-screen OffPeak web dashboard. Loading
// the deployed URL (not a local bundle) is intentional: the /comed CORS proxy
// only exists server-side, so the WebView gets the working day-ahead feed.
const APP_URL = "https://offpeak.atsumilabs.com";

export default function App() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Refresh the home-screen widget when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") refreshOffPeakWidget();
    });
    return () => sub.remove();
  }, []);

  // Set up the notification handler/channel up front (permission is requested
  // only when the user enables alerts in the web Settings).
  useEffect(() => {
    configureNotifications();
  }, []);

  // Messages from the web app (alert config + permission requests).
  const onMessage = async (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "alertConfig") {
        await storeAlertConfig({ thresholds: msg.thresholds, prefs: msg.prefs });
        if (msg.prefs?.enabled) await registerPriceAlertTask();
      } else if (msg.type === "requestNotifPermission") {
        await requestNotificationPermission();
        await registerPriceAlertTask();
      } else if (msg.type === "priceSnapshot") {
        // The app shared its current price — store it and update the widget so
        // it matches what the app shows.
        await storeWidgetSnapshot(msg.snapshot);
        refreshOffPeakWidget();
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errTitle}>Can't reach OffPeak</Text>
            <Text style={styles.errBody}>Check your connection and try again.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                setError(false);
                setLoading(true);
                webRef.current?.reload();
              }}
            >
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.root}>
            <WebView
              ref={webRef}
              source={{ uri: APP_URL }}
              style={styles.web}
              injectedJavaScriptBeforeContentLoaded={"window.__OFFPEAK_NATIVE__ = true; true;"}
              onMessage={onMessage}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setError(true);
                setLoading(false);
              }}
              onHttpError={() => {
                setError(true);
                setLoading(false);
              }}
              pullToRefreshEnabled
              allowsBackForwardNavigationGestures
            />
            {loading && (
              <View style={styles.loaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  web: { flex: 1, backgroundColor: "#0b1220" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  errTitle: { color: "#e8edf6", fontSize: 18, fontWeight: "700" },
  errBody: { color: "#93a0b8", fontSize: 14, textAlign: "center" },
  btn: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },
});
