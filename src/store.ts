// Web settings store — the shared Zustand store backed by localStorage.
import type { StateStorage } from "zustand/middleware";
import { createSettingsStore } from "@/lib";

const webStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

export const useSettings = createSettingsStore(webStorage);
