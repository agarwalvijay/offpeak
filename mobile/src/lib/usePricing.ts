// Shared data-fetching hook (React Query). Mirrors PricingProvider.refreshData
// in the Flutter app: the three feeds are fetched in parallel and auto-refresh
// every 5 minutes when enabled. Settings live in a separate store; the caller
// passes the values this hook needs so the lib stays platform-agnostic.

import { useQuery } from "@tanstack/react-query";
import {
  getCurrentHourAverage,
  getDayAheadPricing,
  getFiveMinuteFeed,
} from "./comedApi";
import type { DayAheadDay, HourlyPrice, PricingPoint } from "./pricing";

const FIVE_MIN_MS = 5 * 60_000;

export interface UsePricingOptions {
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

  const fiveMin = useQuery({
    queryKey: ["fiveMinuteFeed"],
    queryFn: getFiveMinuteFeed,
    refetchInterval,
  });

  const currentHour = useQuery({
    queryKey: ["currentHourAverage"],
    queryFn: getCurrentHourAverage,
    refetchInterval,
  });

  const dayAhead = useQuery({
    queryKey: ["dayAhead", opts.dayAheadDay],
    queryFn: () => {
      const date = new Date();
      if (opts.dayAheadDay === "tomorrow") date.setDate(date.getDate() + 1);
      return getDayAheadPricing(date);
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
