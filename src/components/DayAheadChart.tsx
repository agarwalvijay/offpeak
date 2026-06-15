import { useId, useState } from "react";
import { axisTicks, formatHour, formatPrice, smoothPath } from "@/lib";
import type { HourlyPrice } from "@/lib";
import { useElementSize } from "../hooks/useElementSize";
import { Crosshair } from "./PriceChart";

interface Props {
  forecast: HourlyPrice[];
  actuals: HourlyPrice[];
}

const FORECAST_COLOR = "#60a5fa";
const ACTUAL_COLOR = "#34d399";
const PAD = { top: 10, right: 14, bottom: 22, left: 40 };

/** Day-ahead hourly forecast with today's realized hourly actuals overlaid,
 *  plus a touch/hover crosshair tooltip. */
export function DayAheadChart({ forecast, actuals }: Props) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const ready = forecast.length > 0 && width > 20 && height > 20;

  // Geometry (computed up front so the pointer handler can hit-test).
  let geo: {
    box: { left: number; top: number; right: number; bottom: number };
    xOf: (i: number) => number;
    yOf: (v: number) => number;
    fPoints: { x: number; y: number }[];
    aPoints: { x: number; y: number }[];
    min: number;
    max: number;
  } | null = null;

  if (ready) {
    const all = [...forecast.map((f) => f.price), ...actuals.map((a) => a.price)];
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    min -= span * 0.08;
    max += span * 0.08;

    const box = {
      left: PAD.left,
      top: PAD.top,
      right: width - PAD.right,
      bottom: height - PAD.bottom,
    };
    const w = Math.max(1, box.right - box.left);
    const h = Math.max(1, box.bottom - box.top);
    const yOf = (v: number) => box.bottom - ((v - min) / (max - min)) * h;
    const xOf = (i: number) =>
      forecast.length <= 1 ? box.left + w / 2 : box.left + (i / (forecast.length - 1)) * w;

    const fPoints = forecast.map((f, i) => ({ x: xOf(i), y: yOf(f.price) }));
    const hourToIndex = new Map(forecast.map((f, i) => [f.hour, i]));
    const aPoints = actuals
      .filter((a) => hourToIndex.has(a.hour))
      .map((a) => ({ x: xOf(hourToIndex.get(a.hour)!), y: yOf(a.price) }));

    geo = { box, xOf, yOf, fPoints, aPoints, min, max };
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const wInner = Math.max(1, geo.box.right - geo.box.left);
    const i = Math.round(((x - geo.box.left) / wInner) * (forecast.length - 1));
    setHover(Math.max(0, Math.min(forecast.length - 1, i)));
  }

  return (
    <div className="chart-wrap" ref={ref}>
      {!ready ? (
        <div className="chart-empty">Day-ahead pricing not published yet</div>
      ) : (
        (() => {
          const g = geo!;
          const { box } = g;
          const fPath = smoothPath(g.fPoints);
          const last = g.fPoints[g.fPoints.length - 1];
          const first = g.fPoints[0];
          const area = `${fPath} L${last.x.toFixed(2)},${box.bottom} L${first.x.toFixed(2)},${box.bottom} Z`;
          const aPath = g.aPoints
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(" ");

          const ticks = axisTicks(g.min, g.max, 4);
          const labelCount = Math.min(7, forecast.length);
          const xLabels = Array.from({ length: labelCount }, (_, i) => {
            const idx = Math.round((i / (labelCount - 1 || 1)) * (forecast.length - 1));
            return { x: g.xOf(idx), text: formatHour(forecast[idx].hour) };
          });

          const hp = hover != null ? g.fPoints[hover] : null;

          return (
            <svg
              className="chart"
              width={width}
              height={height}
              style={{ touchAction: "pan-y" }}
              onPointerDown={onMove}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onPointerUp={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FORECAST_COLOR} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={FORECAST_COLOR} stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((t, i) => {
                const y = g.yOf(t);
                return (
                  <g key={i}>
                    <line className="chart-grid" x1={box.left} y1={y} x2={box.right} y2={y} strokeWidth={1} />
                    <text className="chart-label" x={box.left - 8} y={y + 4} textAnchor="end" fontSize={11}>
                      {t.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              <path d={area} fill={`url(#${gradientId})`} />
              <path
                d={fPath}
                fill="none"
                stroke={FORECAST_COLOR}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {g.aPoints.length > 0 && (
                <path
                  d={aPath}
                  fill="none"
                  stroke={ACTUAL_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {xLabels.map((l, i) => (
                <text
                  key={`xl-${i}`}
                  className="chart-label"
                  x={l.x}
                  y={height - 6}
                  textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
                  fontSize={11}
                >
                  {l.text}
                </text>
              ))}

              {hp && hover != null && (
                <Crosshair
                  x={hp.x}
                  y={hp.y}
                  top={box.top}
                  bottom={box.bottom}
                  color={FORECAST_COLOR}
                  width={width}
                  lines={[formatPrice(forecast[hover].price), formatHour(forecast[hover].hour)]}
                />
              )}
            </svg>
          );
        })()
      )}
    </div>
  );
}
