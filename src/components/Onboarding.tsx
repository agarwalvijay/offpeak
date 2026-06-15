import { useState } from "react";
import { UTILITIES, UTILITY_LIST, type Utility } from "@/lib";
import { useSettings } from "../store";
import { BoltIcon } from "./icons";

const REGION: Record<Utility, string> = {
  comed: "Northern Illinois · Commonwealth Edison",
  caiso: "California · CAISO grid",
  ercot: "Texas · ERCOT grid",
  nyiso: "New York · NYISO grid",
  isone: "New England · ISO-NE grid",
  pjm: "Mid-Atlantic / Midwest · PJM grid",
};

/** First-run screen: pick a utility before seeing the dashboard. */
export function Onboarding() {
  const { setUtility, setZone, setOnboarded } = useSettings();
  const [sel, setSel] = useState<Utility>("comed");
  const [selZone, setSelZone] = useState<string | undefined>(undefined);

  const zones = UTILITIES[sel].zones;
  const curZone = selZone ?? UTILITIES[sel].defaultZone;

  function pick(u: Utility) {
    setSel(u);
    setSelZone(UTILITIES[u].defaultZone);
  }

  function start() {
    setUtility(sel);
    if (zones && curZone) setZone(sel, curZone);
    setOnboarded(true);
  }

  return (
    <div className="onboard">
      <div className="onboard__card">
        <div className="onboard__brand">
          <div className="header__logo">
            <BoltIcon />
          </div>
          <div>
            <div className="onboard__title">OffPeak</div>
            <div className="onboard__tag">Real-time electricity pricing</div>
          </div>
        </div>

        <h2 className="onboard__h">Choose your utility</h2>
        <p className="onboard__sub">You can change this anytime in Settings.</p>

        <div className="onboard__opts">
          {UTILITY_LIST.map((u) => (
            <button
              key={u}
              className={`onboard__opt ${sel === u ? "is-sel" : ""}`}
              onClick={() => pick(u)}
            >
              <span className="onboard__opt-name">{UTILITIES[u].name}</span>
              <span className="onboard__opt-region">{REGION[u]}</span>
            </button>
          ))}
        </div>

        {zones && (
          <div className="onboard__zones">
            <div className="onboard__zlabel">Pricing zone</div>
            <div className="chips">
              {zones.map((z) => (
                <button
                  key={z.id}
                  className={`chip ${curZone === z.id ? "chip--active" : ""}`}
                  onClick={() => setSelZone(z.id)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn onboard__cta" onClick={start}>
          Get started
        </button>
      </div>
    </div>
  );
}
