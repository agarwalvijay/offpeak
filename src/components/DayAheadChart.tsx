import { useId } from "react";
import { axisTicks, formatHour, smoothPath } from "@/lib";
import type { HourlyPrice } from "@/lib";
import { useElementSize } from "../hooks/useElementSize";

interface Props {
  forecast: HourlyPrice[];
  actuals: HourlyPrice[];
}

const FORECAST_COLOR = "#60a5fa";
const ACTUAL_COLOR = "#34d399";

/** Day-ahead hourly forecast with today's realized hourly actuals overlaid. */
export function DayAheadChart({ forecast, actuals }: Props) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const gradientId = useId();

  return (
    <div className="chart-wrap" ref={ref}>
      {forecast.length === 0 ? (
        <div className="chart-empty">Day-ahead pricing not published yet</div>
      ) : width > 20 && height > 20 ? (
        (() => {
          const fVals = forecast.map((f) => f.price);
          const aVals = actuals.map((a) => a.price);
          const all = [...fVals, ...aVals];
          let min = Math.min(...all);
          let max = Math.max(...all);
          if (min === max) {
            min -= 1;
            max += 1;
          }
          const span = max - min;
          min -= span * 0.08;
          max += span * 0.08;

          const pad = { top: 10, right: 14, bottom: 22, left: 40 };
          const box = {
            left: pad.left,
            top: pad.top,
            right: width - pad.right,
            bottom: height - pad.bottom,
          };
          const w = Math.max(1, box.right - box.left);
          const h = Math.max(1, box.bottom - box.top);
          const yOf = (v: number) => box.bottom - ((v - min) / (max - min)) * h;
          const xOf = (i: number) =>
            forecast.length <= 1
              ? box.left + w / 2
              : box.left + (i / (forecast.length - 1)) * w;

          const fPoints = forecast.map((f, i) => ({ x: xOf(i), y: yOf(f.price) }));
          const fPath = smoothPath(fPoints);
          const last = fPoints[fPoints.length - 1];
          const first = fPoints[0];
          const area = `${fPath} L${last.x.toFixed(2)},${box.bottom} L${first.x.toFixed(2)},${box.bottom} Z`;

          const hourToIndex = new Map(forecast.map((f, i) => [f.hour, i]));
          const aPoints = actuals
            .filter((a) => hourToIndex.has(a.hour))
            .map((a) => ({ x: xOf(hourToIndex.get(a.hour)!), y: yOf(a.price) }));
          const aPath = aPoints
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(" ");

          const ticks = axisTicks(min, max, 4);
          const labelCount = Math.min(7, forecast.length);
          const xLabels = Array.from({ length: labelCount }, (_, i) => {
            const idx = Math.round((i / (labelCount - 1 || 1)) * (forecast.length - 1));
            return { x: xOf(idx), text: formatHour(forecast[idx].hour) };
          });

          return (
            <svg className="chart" width={width} height={height}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FORECAST_COLOR} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={FORECAST_COLOR} stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((t, i) => {
                const y = yOf(t);
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
              {aPoints.length > 0 && (
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
            </svg>
          );
        })()
      ) : null}
    </div>
  );
}
