import { useId } from "react";
import { axisTicks, buildLineChart, formatTime } from "@/lib";
import type { PricingPoint } from "@/lib";
import { useElementSize } from "../hooks/useElementSize";

interface Threshold {
  value: number;
  color: string;
}

interface Props {
  data: PricingPoint[];
  lineColor: string;
  thresholds?: Threshold[];
}

/** 5-minute price line: smooth line, gradient fill, threshold guides, axes. */
export function PriceChart({ data, lineColor, thresholds = [] }: Props) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const gradientId = useId();

  return (
    <div className="chart-wrap" ref={ref}>
      {data.length === 0 ? (
        <div className="chart-empty">No pricing data in this window</div>
      ) : width > 20 && height > 20 ? (
        (() => {
          const values = data.map((d) => d.price);
          const chart = buildLineChart(values, width, height);
          const { box } = chart;
          const ticks = axisTicks(chart.min, chart.max, 4);
          const last = chart.points[chart.points.length - 1];
          const first = chart.points[0];
          const area = `${chart.smoothPath} L${last.x.toFixed(2)},${box.bottom} L${first.x.toFixed(2)},${box.bottom} Z`;

          const labelCount = Math.min(5, data.length);
          const xLabels = Array.from({ length: labelCount }, (_, i) => {
            const idx = Math.round((i / (labelCount - 1 || 1)) * (data.length - 1));
            return { x: chart.xOf(idx), text: formatTime(data[idx].dateTime) };
          });

          return (
            <svg className="chart" width={width} height={height}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal gridlines + y labels */}
              {ticks.map((t, i) => {
                const y = chart.yOf(t);
                return (
                  <g key={i}>
                    <line
                      className="chart-grid"
                      x1={box.left}
                      y1={y}
                      x2={box.right}
                      y2={y}
                      strokeWidth={1}
                    />
                    <text
                      className="chart-label"
                      x={box.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={11}
                    >
                      {t.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Threshold guides */}
              {thresholds
                .filter((t) => t.value >= chart.min && t.value <= chart.max)
                .map((t, i) => {
                  const y = chart.yOf(t.value);
                  return (
                    <line
                      key={`th-${i}`}
                      x1={box.left}
                      y1={y}
                      x2={box.right}
                      y2={y}
                      stroke={t.color}
                      strokeWidth={1}
                      strokeDasharray="4 5"
                      opacity={0.7}
                    />
                  );
                })}

              <path d={area} fill={`url(#${gradientId})`} />
              <path
                d={chart.smoothPath}
                fill="none"
                stroke={lineColor}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
              <circle cx={last.x} cy={last.y} r={8} fill={lineColor} opacity={0.18} />

              {/* X labels */}
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
