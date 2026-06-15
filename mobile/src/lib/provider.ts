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
import {
  nyisoCurrentHourAverage,
  nyisoDayAheadPricing,
  nyisoFiveMinuteFeed,
} from "./nyisoApi";
import {
  isoneCurrentHourAverage,
  isoneDayAheadPricing,
  isoneFiveMinuteFeed,
} from "./isoneApi";

export type Utility = "comed" | "caiso" | "ercot" | "nyiso" | "isone";

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
  nyiso: {
    id: "nyiso",
    name: "NYISO",
    subtitle: (zone) => `NYISO · ${zone ?? "N.Y.C."} real-time pricing`,
    source: "NYISO Zonal LBMP",
    zones: [
      { id: "N.Y.C.", label: "New York City" },
      { id: "LONGIL", label: "Long Island" },
      { id: "HUD VL", label: "Hudson Valley" },
      { id: "MILLWD", label: "Millwood" },
      { id: "DUNWOD", label: "Dunwoodie" },
      { id: "CAPITL", label: "Capital" },
      { id: "CENTRL", label: "Central" },
      { id: "WEST", label: "West" },
      { id: "GENESE", label: "Genesee" },
      { id: "MHK VL", label: "Mohawk Valley" },
      { id: "NORTH", label: "North" },
    ],
    defaultZone: "N.Y.C.",
  },
  isone: {
    id: "isone",
    name: "ISO-NE",
    subtitle: () => "ISO-NE real-time pricing",
    source: "ISO-NE Web Services LMP",
    zones: [
      { id: "4000", label: "Hub" },
      { id: "4004", label: "Connecticut" },
      { id: "4008", label: "NE Mass / Boston" },
      { id: "4006", label: "SE Mass" },
      { id: "4007", label: "WC Mass" },
      { id: "4005", label: "Rhode Island" },
      { id: "4001", label: "Maine" },
      { id: "4002", label: "New Hampshire" },
      { id: "4003", label: "Vermont" },
    ],
    defaultZone: "4000",
  },
};

export const UTILITY_LIST: Utility[] = ["comed", "caiso", "ercot", "nyiso", "isone"];

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
  if (utility === "nyiso") {
    const z = zone ?? UTILITIES.nyiso.defaultZone ?? "N.Y.C.";
    return {
      getFiveMinuteFeed: () => nyisoFiveMinuteFeed(z),
      getCurrentHourAverage: () => nyisoCurrentHourAverage(z),
      getDayAheadPricing: (date) => nyisoDayAheadPricing(z, date),
    };
  }
  if (utility === "isone") {
    const z = zone ?? UTILITIES.isone.defaultZone ?? "4000";
    return {
      getFiveMinuteFeed: () => isoneFiveMinuteFeed(z),
      getCurrentHourAverage: () => isoneCurrentHourAverage(z),
      getDayAheadPricing: (date) => isoneDayAheadPricing(z, date),
    };
  }
  return { getFiveMinuteFeed, getCurrentHourAverage, getDayAheadPricing };
}
