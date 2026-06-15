// Persisted user settings (Zustand), replacing the Flutter SimpleSettings +
// PricingProvider persistence. A storage backend is injected per platform —
// localStorage on web, AsyncStorage on mobile — so this stays platform-agnostic.
// `dayAheadDay` is a transient view toggle and is intentionally not persisted
// (matching the Flutter app, where it lived only in provider memory).

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  DEFAULT_ALERT_SETTINGS,
  type AlertSettings,
  type DayAheadDay,
  type TimePeriod,
} from "./pricing";
import { DEFAULT_ALERT_PREFS, type AlertPrefs } from "./priceAlerts";
import type { Utility } from "./provider";

export type Theme = "system" | "light" | "dark";

export interface SettingsState {
  alertSettings: AlertSettings;
  autoRefresh: boolean;
  timePeriod: TimePeriod;
  dayAheadDay: DayAheadDay;
  theme: Theme;
  alertPrefs: AlertPrefs;
  utility: Utility;
  zoneByUtility: Record<string, string>;
  onboarded: boolean;
  setAlertSettings: (s: AlertSettings) => void;
  setAutoRefresh: (v: boolean) => void;
  setTimePeriod: (p: TimePeriod) => void;
  setDayAheadDay: (d: DayAheadDay) => void;
  setTheme: (t: Theme) => void;
  setAlertPrefs: (p: AlertPrefs) => void;
  setUtility: (u: Utility) => void;
  setZone: (u: Utility, z: string) => void;
  setOnboarded: (v: boolean) => void;
}

export type SettingsStore = UseBoundStore<StoreApi<SettingsState>>;

export function createSettingsStore(storage: StateStorage): SettingsStore {
  return create<SettingsState>()(
    persist(
      (set) => ({
        alertSettings: DEFAULT_ALERT_SETTINGS,
        autoRefresh: true,
        timePeriod: "1h",
        dayAheadDay: "today",
        theme: "system",
        alertPrefs: DEFAULT_ALERT_PREFS,
        utility: "comed",
        zoneByUtility: { caiso: "NP15", ercot: "HB_HOUSTON" },
        onboarded: false,
        setAlertSettings: (alertSettings) => set({ alertSettings }),
        setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
        setTimePeriod: (timePeriod) => set({ timePeriod }),
        setDayAheadDay: (dayAheadDay) => set({ dayAheadDay }),
        setTheme: (theme) => set({ theme }),
        setAlertPrefs: (alertPrefs) => set({ alertPrefs }),
        setUtility: (utility) => set({ utility }),
        setZone: (u, z) =>
          set((s) => ({ zoneByUtility: { ...s.zoneByUtility, [u]: z } })),
        setOnboarded: (onboarded) => set({ onboarded }),
      }),
      {
        name: "offpeak-settings",
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({
          alertSettings: s.alertSettings,
          autoRefresh: s.autoRefresh,
          timePeriod: s.timePeriod,
          theme: s.theme,
          alertPrefs: s.alertPrefs,
          utility: s.utility,
          zoneByUtility: s.zoneByUtility,
          onboarded: s.onboarded,
        }),
      },
    ),
  );
}
