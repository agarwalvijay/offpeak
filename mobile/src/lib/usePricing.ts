// Shared data-fetching hook (React Query). Fetches the three feeds in parallel
// for the selected utility and auto-refreshes every 5 minutes when enabled.
// Settings live in a separate store; the caller passes what this hook needs so
// the lib stays platform-agnostic.

import { useQuery } from "@tanstack/react-query";
import { pricingClient, type Utility } from "./provider";
import type { DayAheadDay, HourlyPrice, PricingPoint } from "./pricing";

const FIVE_MIN_MS = 5 * 60_000;

export interface UsePricingOptions {
  utility: Utility;
  zone?: string;
  autoRefresh: boolean;
  dayAheadDay: DayAheadDay;
}

export interface UsePricingResult {
  fiveMinuteData: PricingPoint[];
  currentHourAverage: PricingPoint | null;
  dayAheadData: HourlyPrice[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  lastUpdate: Date | null;
  refetch: () => void;
}

export function usePricing(opts: UsePricingOptions): UsePricingResult {
  const refetchInterval = opts.autoRefresh ? FIVE_MIN_MS : false;
  const client = pricingClient(opts.utility, opts.zone);
  // Include utility+zone in the keys so switching providers refetches cleanly.
  const scope = [opts.utility, opts.zone ?? ""];

  const fiveMin = useQuery({
    queryKey: ["fiveMinuteFeed", ...scope],
    queryFn: client.getFiveMinuteFeed,
    refetchInterval,
  });

  const currentHour = useQuery({
    queryKey: ["currentHourAverage", ...scope],
    queryFn: client.getCurrentHourAverage,
    refetchInterval,
  });

  const dayAhead = useQuery({
    queryKey: ["dayAhead", opts.dayAheadDay, ...scope],
    queryFn: () => {
      const date = new Date();
      if (opts.dayAheadDay === "tomorrow") date.setDate(date.getDate() + 1);
      return client.getDayAheadPricing(date);
    },
    refetchInterval,
  });

  return {
    fiveMinuteData: fiveMin.data ?? [],
    currentHourAverage: currentHour.data ?? null,
    dayAheadData: dayAhead.data ?? [],
    isLoading: fiveMin.isLoading || currentHour.isLoading || dayAhead.isLoading,
    isFetching:
      fiveMin.isFetching || currentHour.isFetching || dayAhead.isFetching,
    error: (fiveMin.error ?? currentHour.error ?? dayAhead.error) as Error | null,
    lastUpdate: fiveMin.dataUpdatedAt ? new Date(fiveMin.dataUpdatedAt) : null,
    refetch: () => {
      fiveMin.refetch();
      currentHour.refetch();
      dayAhead.refetch();
    },
  };
}
