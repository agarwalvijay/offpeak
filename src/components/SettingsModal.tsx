import { useState } from "react";
import { UTILITIES, UTILITY_LIST } from "@/lib";
import { useSettings } from "../store";
import { requestNotifPermission } from "../native-bridge";
import { CloseIcon } from "./icons";

const ALERT_KINDS = [
  ["high", "High price"],
  ["cheap", "Cheap price"],
  ["negative", "Negative pricing"],
] as const;

const THRESHOLDS = [
  { key: "low" as const, label: "Low", helper: "At or below — cheap-price alert", color: "#16a34a" },
  { key: "medium" as const, label: "Medium", helper: "At or above turns orange", color: "#ea580c" },
  { key: "high" as const, label: "High", helper: "At or above turns red", color: "#dc2626" },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    alertSettings,
    autoRefresh,
    theme,
    alertPrefs,
    utility,
    zoneByUtility,
    setAlertSettings,
    setAutoRefresh,
    setTheme,
    setAlertPrefs,
    setUtility,
    setZone,
  } = useSettings();
  const zones = UTILITIES[utility].zones;
  const currentZone = zoneByUtility[utility] ?? UTILITIES[utility].defaultZone;
  const [vals, setVals] = useState({
    low: String(alertSettings.low),
    medium: String(alertSettings.medium),
    high: String(alertSettings.high),
  });
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }

  function save() {
    const low = parseFloat(vals.low);
    const medium = parseFloat(vals.medium);
    const high = parseFloat(vals.high);
    if ([low, medium, high].some((n) => Number.isNaN(n))) {
      flash("Enter valid numbers for all thresholds");
      return;
    }
    if (!(low < medium && medium < high)) {
      flash("Thresholds must be Low < Medium < High");
      return;
    }
    setAlertSettings({ low, medium, high });
    flash("Saved");
    window.setTimeout(onClose, 550);
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__head">
          <h2>Settings</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="section-label">Utility</div>
        <div className="switch-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Provider</div>
            <div className="meta">Which grid's real-time prices to show</div>
          </div>
          <div className="segmented">
            {UTILITY_LIST.map((u) => (
              <button
                key={u}
                className={utility === u ? "is-on" : ""}
                onClick={() => setUtility(u)}
              >
                {UTILITIES[u].name}
              </button>
            ))}
          </div>
        </div>
        {zones && (
          <div className="field" style={{ marginTop: 8 }}>
            <label>Zone</label>
            <div className="chips">
              {zones.map((z) => (
                <button
                  key={z.id}
                  className={`chip ${currentZone === z.id ? "chip--active" : ""}`}
                  onClick={() => setZone(utility, z.id)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="section-label" style={{ marginTop: 18 }}>
          Data
        </div>
        <div className="switch-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Auto-refresh</div>
            <div className="meta">ComEd publishes new readings every 5 minutes</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="track" />
          </label>
        </div>

        <div className="section-label">Appearance</div>
        <div className="switch-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Theme</div>
            <div className="meta">Follow your device, or force light/dark</div>
          </div>
          <div className="segmented">
            {(["system", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                className={theme === t ? "is-on" : ""}
                onClick={() => setTheme(t)}
                style={{ textTransform: "capitalize" }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="section-label">Price alerts</div>
        <div className="switch-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Notify me</div>
            <div className="meta">
              Background checks send a local notification (mobile app only)
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={alertPrefs.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setAlertPrefs({ ...alertPrefs, enabled });
                if (enabled) requestNotifPermission();
              }}
            />
            <span className="track" />
          </label>
        </div>
        {alertPrefs.enabled && (
          <div className="chips" style={{ marginTop: 2, marginBottom: 4 }}>
            {ALERT_KINDS.map(([k, label]) => (
              <button
                key={k}
                className={`chip ${alertPrefs[k] ? "chip--active" : ""}`}
                onClick={() => setAlertPrefs({ ...alertPrefs, [k]: !alertPrefs[k] })}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="section-label">Color thresholds (¢/kWh)</div>
        <p className="helper" style={{ marginTop: -4, marginBottom: 12 }}>
          Used to color-code the current price and the chart guide lines.
        </p>
        {THRESHOLDS.map((t) => (
          <div className="field" key={t.key}>
            <label>
              <span className="swatch" style={{ background: t.color }} />
              {t.label}
            </label>
            <input
              inputMode="decimal"
              value={vals[t.key]}
              onChange={(e) => setVals((v) => ({ ...v, [t.key]: e.target.value }))}
            />
            <div className="helper">{t.helper}</div>
          </div>
        ))}

        <div className="section-label">About</div>
        <div className="about-row">
          <span>Data source</span>
          <span>ComEd Hourly Pricing API</span>
        </div>
        <div className="about-row">
          <span>Cadence</span>
          <span>5-minute readings</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn--ghost btn" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={save}>
            Save
          </button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
