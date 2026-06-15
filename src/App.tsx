import { useEffect, useMemo, useState } from "react";
import {
  ALERT_LEVEL_META,
  computeStatistics,
  filterByPeriod,
  formatPrice,
  formatTime,
  getAlertLevel,
  TIME_PERIODS,
  TIME_PERIOD_META,
  todayActualHourly,
  usePricing,
  UTILITIES,
} from "@/lib";
import { useSettings } from "./store";
import { postAlertConfig, postPriceSnapshot } from "./native-bridge";
import { PriceChart } from "./components/PriceChart";
import { DayAheadChart } from "./components/DayAheadChart";
import { SettingsModal } from "./components/SettingsModal";
import { BoltIcon, RefreshIcon, SettingsIcon } from "./components/icons";

export function App() {
  const {
    alertSettings,
    autoRefresh,
    timePeriod,
    dayAheadDay,
    theme,
    alertPrefs,
    utility,
    caisoZone,
    setTimePeriod,
    setDayAheadDay,
  } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const utilityMeta = UTILITIES[utility];

  // Keep the native shell's background task in sync with alert config.
  useEffect(() => {
    postAlertConfig(alertSettings, alertPrefs);
  }, [alertSettings, alertPrefs]);

  // Apply the chosen theme (and follow the OS when set to "system").
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      root.setAttribute("data-theme", resolved);
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const {
    fiveMinuteData,
    currentHourAverage,
    dayAheadData,
    isLoading,
    isFetching,
    error,
    lastUpdate,
    refetch,
  } = usePricing({
    utility,
    zone: utility === "caiso" ? caisoZone : undefined,
    autoRefresh,
    dayAheadDay,
  });

  const filtered = useMemo(
    () => filterByPeriod(fiveMinuteData, timePeriod),
    [fiveMinuteData, timePeriod],
  );
  const stats = useMemo(() => computeStatistics(filtered), [filtered]);
  const actuals = useMemo(() => todayActualHourly(fiveMinuteData), [fiveMinuteData]);

  const latest = fiveMinuteData.length ? fiveMinuteData[fiveMinuteData.length - 1] : null;
  const currentPrice = latest?.price ?? null;
  const level = currentPrice == null ? "low" : getAlertLevel(currentPrice, alertSettings);
  const meta = ALERT_LEVEL_META[level];

  // Share the current price with the home-screen widget so it mirrors the app.
  // Gated to ComEd for now — the native widget/alert background still uses ComEd
  // directly (CAISO support for those is a follow-up).
  useEffect(() => {
    if (currentPrice == null || utility !== "comed") return;
    postPriceSnapshot({
      price: formatPrice(currentPrice),
      level: meta.label,
      color: meta.color,
      hourAvg: currentHourAverage ? formatPrice(currentHourAverage.price) : "—",
      updated: (lastUpdate ?? new Date()).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }, [currentPrice, meta.label, meta.color, currentHourAverage, lastUpdate, utility]);

  const thresholds = [
    { value: alertSettings.low, color: "#16a34a" },
    { value: alertSettings.medium, color: "#ea580c" },
    { value: alertSettings.high, color: "#dc2626" },
  ];

  const initialLoading = isLoading && fiveMinuteData.length === 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <div className="header__logo">
            <BoltIcon />
          </div>
          <div className="header__title">
            <b>OffPeak</b>
            <span>{utilityMeta.subtitle(caisoZone)}</span>
          </div>
        </div>
        {lastUpdate && (
          <div className="header__status">
            <span className="live-dot" />
            {autoRefresh ? "Live" : "Paused"} · updated {formatTime(lastUpdate)}
          </div>
        )}
        <button
          className="iconbtn"
          onClick={refetch}
          disabled={isFetching}
          aria-label="Refresh"
          title="Refresh"
        >
          <span className={isFetching ? "spin" : ""} style={{ display: "inline-flex" }}>
            <RefreshIcon />
          </span>
        </button>
        <button
          className="iconbtn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </header>

      {initialLoading ? (
        <div className="center-state">
          <div className="loader" />
          <div>Loading pricing data…</div>
        </div>
      ) : error && fiveMinuteData.length === 0 ? (
        <div className="center-state">
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            Couldn't load pricing data
          </div>
          <div>{error.message}</div>
          <button className="btn" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : (
        <div className="dashboard">
          <div className="rail">
            <section className="card card--price">
              <div className="card__head">
                <h3 className="card__title">Current price</h3>
              </div>
              <div className="price">
                <span className="price__value" style={{ color: meta.color }}>
                  {currentPrice == null ? "—" : currentPrice.toFixed(2)}
                </span>
                <span className="price__unit">¢/kWh</span>
              </div>
              <span
                className="badge"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                <span className="badge__dot" style={{ background: meta.color }} />
                {meta.label}
              </span>
              <div className="price__desc">{meta.description}</div>
              <div className="price__meta">
                <span>
                  Current-hour avg{" "}
                  <b>
                    {currentHourAverage ? formatPrice(currentHourAverage.price) : "—"}
                  </b>
                </span>
                <span>
                  Latest <b>{latest ? formatTime(latest.dateTime) : "—"}</b>
                </span>
              </div>
            </section>

            <section className="card card--stats">
              <div className="card__head">
                <h3 className="card__title">
                  Statistics · {TIME_PERIOD_META[timePeriod].longLabel}
                </h3>
              </div>
              <div className="stats">
                <Stat label="Average" value={formatPrice(stats.average)} />
                <Stat label="Median" value={formatPrice(stats.median)} />
                <Stat label="Minimum" value={formatPrice(stats.minimum)} />
                <Stat label="Maximum" value={formatPrice(stats.maximum)} />
              </div>
            </section>

            <section className="card status-card">
              <div className="status-row">
                <span>Data source</span>
                <span>{utilityMeta.source}</span>
              </div>
              <div className="status-row">
                <span>Readings</span>
                <span>{stats.dataPoints} pts · 5-min</span>
              </div>
              {error && (
                <div className="inline-error" style={{ marginTop: 8 }}>
                  ⚠ {error.message}
                </div>
              )}
            </section>
          </div>

          <div className="charts">
            <section className="card card--fill card--trend">
              <div className="card__head">
                <h3 className="card__title">Price trend</h3>
                <div className="chips">
                  {TIME_PERIODS.map((p) => (
                    <button
                      key={p}
                      className={`chip ${p === timePeriod ? "chip--active" : ""}`}
                      onClick={() => setTimePeriod(p)}
                    >
                      {TIME_PERIOD_META[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card__body">
                <PriceChart data={filtered} lineColor={meta.color} thresholds={thresholds} />
              </div>
            </section>

            <section className="card card--fill card--dayahead">
              <div className="card__head">
                <h3 className="card__title">Day-ahead hourly</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="chart-legend">
                    <span>
                      <span className="legend-swatch" style={{ background: "#60a5fa" }} />
                      Forecast
                    </span>
                    <span>
                      <span
                        className="legend-swatch legend-swatch--dash"
                        style={{ color: "#34d399" }}
                      />
                      Today actual
                    </span>
                  </div>
                  <div className="segmented">
                    <button
                      className={dayAheadDay === "today" ? "is-on" : ""}
                      onClick={() => setDayAheadDay("today")}
                    >
                      Today
                    </button>
                    <button
                      className={dayAheadDay === "tomorrow" ? "is-on" : ""}
                      onClick={() => setDayAheadDay("tomorrow")}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>
              <div className="card__body">
                <DayAheadChart
                  forecast={dayAheadData}
                  actuals={dayAheadDay === "today" ? actuals : []}
                />
              </div>
            </section>
          </div>
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}
