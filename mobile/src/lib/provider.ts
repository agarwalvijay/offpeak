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
import {
  ercotCurrentHourAverage,
  ercotDayAheadPricing,
  ercotFiveMinuteFeed,
} from "./ercotApi";

export type Utility = "comed" | "caiso" | "ercot";

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
  ercot: {
    id: "ercot",
    name: "ERCOT",
    subtitle: (zone) =>
      `ERCOT · ${(zone ?? "HB_HOUSTON").replace("HB_", "")} real-time pricing`,
    source: "ERCOT Settlement Point Prices",
    zones: [
      { id: "HB_HOUSTON", label: "Houston" },
      { id: "HB_NORTH", label: "North" },
      { id: "HB_SOUTH", label: "South" },
      { id: "HB_WEST", label: "West" },
      { id: "HB_HUBAVG", label: "Hub Avg" },
    ],
    defaultZone: "HB_HOUSTON",
  },
};

export const UTILITY_LIST: Utility[] = ["comed", "caiso", "ercot"];

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
  if (utility === "ercot") {
    const z = zone ?? UTILITIES.ercot.defaultZone ?? "HB_HOUSTON";
    return {
      getFiveMinuteFeed: () => ercotFiveMinuteFeed(z),
      getCurrentHourAverage: () => ercotCurrentHourAverage(z),
      getDayAheadPricing: (date) => ercotDayAheadPricing(z, date),
    };
  }
  return { getFiveMinuteFeed, getCurrentHourAverage, getDayAheadPricing };
}
