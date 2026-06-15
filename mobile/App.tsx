import { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
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

/** One expanding/fading ring of the splash mark. */
function PulseRing({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 2200,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1.4,
        borderColor: "#ffffff",
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2] }) }],
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      }}
    />
  );
}

/** Short branded launch animation shown over the WebView until it loads. */
function SplashOverlay({ visible }: { visible: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.timing(bar, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [bar, enter, fade]);

  useEffect(() => {
    if (!visible) {
      Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, fade]);

  if (!mounted) return null;
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-52, 150] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
      <LinearGradient colors={["#16223c", "#0b1220"]} style={StyleSheet.absoluteFill} />
      <View style={styles.splashCenter}>
        <Animated.View style={{ alignItems: "center", opacity: enter, transform: [{ scale }] }}>
          <View style={styles.markBox}>
            <PulseRing delay={0} />
            <PulseRing delay={733} />
            <PulseRing delay={1466} />
            <View style={styles.markGlow}>
              <Image
                source={require("./assets/icon.png")}
                style={styles.mark}
                resizeMode="cover"
              />
            </View>
          </View>
          <Text style={styles.wordmark}>OffPeak</Text>
          <View style={styles.accent} />
          <Text style={styles.tagline}>REAL-TIME · 5-MINUTE PRICING</Text>
        </Animated.View>
      </View>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barSeg, { transform: [{ translateX: barX }] }]}>
          <LinearGradient
            colors={["#ea580c", "#ffb95e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const [error, setError] = useState(false);
  const [webLoaded, setWebLoaded] = useState(false);
  const [minPassed, setMinPassed] = useState(false);

  // Refresh the home-screen widget when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") refreshOffPeakWidget();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    configureNotifications();
  }, []);

  // Keep the splash up for a minimum beat, and never longer than ~5s.
  useEffect(() => {
    const min = setTimeout(() => setMinPassed(true), 1800);
    const max = setTimeout(() => setWebLoaded(true), 6000);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);

  const onMessage = async (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "alertConfig") {
        await storeAlertConfig({ thresholds: msg.thresholds, prefs: msg.prefs });
        if (msg.prefs?.enabled) {
          // Alerts are on by default — make sure we have permission + the task
          // registered (requestPermissions is a no-op once already decided).
          await requestNotificationPermission();
          await registerPriceAlertTask();
        }
      } else if (msg.type === "requestNotifPermission") {
        await requestNotificationPermission();
        await registerPriceAlertTask();
      } else if (msg.type === "priceSnapshot") {
        await storeWidgetSnapshot(msg.snapshot);
        refreshOffPeakWidget();
      }
    } catch {
      // ignore malformed messages
    }
  };

  const splashDone = (webLoaded && minPassed) || error;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {error ? (
          <SafeAreaView style={styles.center} edges={["top", "bottom"]}>
            <Text style={styles.errTitle}>Can't reach OffPeak</Text>
            <Text style={styles.errBody}>Check your connection and try again.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                setError(false);
                setWebLoaded(false);
                webRef.current?.reload();
              }}
            >
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
            <WebView
              ref={webRef}
              source={{ uri: APP_URL }}
              style={styles.web}
              injectedJavaScriptBeforeContentLoaded={"window.__OFFPEAK_NATIVE__ = true; true;"}
              onMessage={onMessage}
              onLoadEnd={() => setWebLoaded(true)}
              onError={() => {
                setError(true);
                setWebLoaded(true);
              }}
              onHttpError={() => {
                setError(true);
                setWebLoaded(true);
              }}
              pullToRefreshEnabled
              allowsBackForwardNavigationGestures
            />
          </SafeAreaView>
        )}
        <SplashOverlay visible={!splashDone} />
      </View>
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
    backgroundColor: "#0b1220",
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

  // Splash
  splashCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  markBox: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  markGlow: {
    borderRadius: 58,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  mark: { width: 116, height: 116, borderRadius: 58 },
  wordmark: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 34,
  },
  accent: { width: 28, height: 2, borderRadius: 2, backgroundColor: "#ea580c", marginTop: 12 },
  tagline: {
    color: "rgba(243,246,252,0.72)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.2,
    marginTop: 12,
  },
  barTrack: {
    position: "absolute",
    bottom: 56,
    alignSelf: "center",
    width: 150,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  barSeg: { position: "absolute", top: 0, bottom: 0, width: 52, borderRadius: 2 },
});
