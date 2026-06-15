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
import {
  pjmCurrentHourAverage,
  pjmDayAheadPricing,
  pjmFiveMinuteFeed,
} from "./pjmApi";

export type Utility = "comed" | "caiso" | "ercot" | "nyiso" | "isone" | "pjm";

// PJM zones are pricing-node IDs (the API filters on pnode_id); keep the
// human label alongside so the subtitle reads "PJM · ComEd", not the number.
// IDs verified live against pnode_name (see deploy-time /pjm/raw checks).
const PJM_ZONES: UtilityZone[] = [
  { id: "33092371", label: "ComEd" },
  { id: "1", label: "PJM-RTO (system)" },
  { id: "51288", label: "Western Hub" },
  { id: "51297", label: "PECO" },
  { id: "51301", label: "PSEG" },
  { id: "51292", label: "BGE" },
  { id: "51298", label: "Pepco" },
  { id: "51299", label: "PPL" },
  { id: "34964545", label: "Dominion" },
];
const pjmLabel = (id?: string) =>
  PJM_ZONES.find((z) => z.id === id)?.label ?? "ComEd";

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
  pjm: {
    id: "pjm",
    name: "PJM",
    subtitle: (zone) => `PJM · ${pjmLabel(zone)} real-time pricing`,
    source: "PJM Data Miner (LMP)",
    zones: PJM_ZONES,
    defaultZone: "33092371",
  },
};

export const UTILITY_LIST: Utility[] = [
  "comed",
  "caiso",
  "ercot",
  "nyiso",
  "isone",
  "pjm",
];

// Which markets the UI offers (launch picker + settings). Defaults to all;
// the web entry narrows this from the OFFPEAK_MARKETS build config. Kept as a
// runtime setter (not a direct env read) so the shared lib stays bundler-
// agnostic — only the web entry touches import.meta.env.
let enabledUtilities: Utility[] = [...UTILITY_LIST];

/** Parse a comma-separated markets string ("comed, pjm") into ids. */
export function parseMarkets(raw?: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Restrict the offered markets. Unknown ids are ignored; config order is
 *  preserved (so the first listed market is the launch default); an empty or
 *  all-invalid list falls back to every market (fail-open, never a blank UI). */
export function setEnabledUtilities(ids: string[]): void {
  const seen = new Set<Utility>();
  const out: Utility[] = [];
  for (const raw of ids) {
    if (raw in UTILITIES && !seen.has(raw as Utility)) {
      seen.add(raw as Utility);
      out.push(raw as Utility);
    }
  }
  enabledUtilities = out.length ? out : [...UTILITY_LIST];
}

/** The markets the UI should currently offer. */
export function getEnabledUtilities(): Utility[] {
  return enabledUtilities;
}

export function isUtilityEnabled(u: Utility): boolean {
  return enabledUtilities.includes(u);
}

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
  if (utility === "pjm") {
    const z = zone ?? UTILITIES.pjm.defaultZone ?? "33092371";
    return {
      getFiveMinuteFeed: () => pjmFiveMinuteFeed(z),
      getCurrentHourAverage: () => pjmCurrentHourAverage(z),
      getDayAheadPricing: (date) => pjmDayAheadPricing(z, date),
    };
  }
  return { getFiveMinuteFeed, getCurrentHourAverage, getDayAheadPricing };
}
