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

export interface SettingsState {
  alertSettings: AlertSettings;
  autoRefresh: boolean;
  timePeriod: TimePeriod;
  dayAheadDay: DayAheadDay;
  setAlertSettings: (s: AlertSettings) => void;
  setAutoRefresh: (v: boolean) => void;
  setTimePeriod: (p: TimePeriod) => void;
  setDayAheadDay: (d: DayAheadDay) => void;
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
        setAlertSettings: (alertSettings) => set({ alertSettings }),
        setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
        setTimePeriod: (timePeriod) => set({ timePeriod }),
        setDayAheadDay: (dayAheadDay) => set({ dayAheadDay }),
      }),
      {
        name: "offpeak-settings",
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({
          alertSettings: s.alertSettings,
          autoRefresh: s.autoRefresh,
          timePeriod: s.timePeriod,
        }),
      },
    ),
  );
}
