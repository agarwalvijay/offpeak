// Utility provider registry. Each supported ISO maps to the common pricing
// shape (PricingPoint[] / HourlyPrice[]). Adding a new ISO (e.g. ERCOT) means
// adding a client + an entry here — the rest of the app is provider-agnostic.

import type { HourlyPrice, PricingPoint } from "./pricing";
import {
  getCurrentHourAverage,
  getDayAheadPricing,
  getFiveMinuteFeed,
} from "./comedApi";
import {
  caisoCurrentHourAverage,
  caisoDayAheadPricing,
  caisoFiveMinuteFeed,
} from "./caisoApi";

export type Utility = "comed" | "caiso";

export interface UtilityZone {
  id: string;
  label: string;
}

export interface UtilityMeta {
  id: Utility;
  name: string;
  /** Header subtitle, e.g. "ComEd real-time hourly pricing". */
  subtitle: (zone?: string) => string;
  /** Data-source label for the status card. */
  source: string;
  /** Selectable pricing zones/hubs, if any. */
  zones?: UtilityZone[];
  defaultZone?: string;
}

export const UTILITIES: Record<Utility, UtilityMeta> = {
  comed: {
    id: "comed",
    name: "ComEd",
    subtitle: () => "ComEd real-time hourly pricing",
    source: "ComEd Hourly Pricing",
  },
  caiso: {
    id: "caiso",
    name: "CAISO",
    subtitle: (zone) => `CAISO · ${zone ?? "NP15"} real-time pricing`,
    source: "CAISO OASIS (real-time LMP)",
    zones: [
      { id: "NP15", label: "NP15 — North" },
      { id: "SP15", label: "SP15 — South" },
      { id: "ZP26", label: "ZP26 — Central" },
    ],
    defaultZone: "NP15",
  },
};

export const UTILITY_LIST: Utility[] = ["comed", "caiso"];

export interface PricingClient {
  getFiveMinuteFeed: () => Promise<PricingPoint[]>;
  getCurrentHourAverage: () => Promise<PricingPoint | null>;
  getDayAheadPricing: (date: Date) => Promise<HourlyPrice[]>;
}

/** Pricing client for the selected utility (+ zone for ISOs that need one). */
export function pricingClient(utility: Utility, zone?: string): PricingClient {
  if (utility === "caiso") {
    const z = zone ?? UTILITIES.caiso.defaultZone ?? "NP15";
    return {
      getFiveMinuteFeed: () => caisoFiveMinuteFeed(z),
      getCurrentHourAverage: () => caisoCurrentHourAverage(z),
      getDayAheadPricing: (date) => caisoDayAheadPricing(z, date),
    };
  }
  return { getFiveMinuteFeed, getCurrentHourAverage, getDayAheadPricing };
}
