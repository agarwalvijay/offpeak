import { useId, useState } from "react";
import { axisTicks, buildLineChart, formatPrice, formatTime } from "@/lib";
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

/** 5-minute price line: smooth line, gradient fill, threshold guides, axes,
 *  and a touch/hover crosshair tooltip. */
export function PriceChart({ data, lineColor, thresholds = [] }: Props) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const ready = data.length > 0 && width > 20 && height > 20;
  const values = data.map((d) => d.price);
  const chart = ready ? buildLineChart(values, width, height) : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { left, right } = chart.box;
    const w = Math.max(1, right - left);
    const i = Math.round(((x - left) / w) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  return (
    <div className="chart-wrap" ref={ref}>
      {!ready ? (
        <div className="chart-empty">No pricing data in this window</div>
      ) : (
        (() => {
          const c = chart!;
          const { box } = c;
          const ticks = axisTicks(c.min, c.max, 4);
          const last = c.points[c.points.length - 1];
          const first = c.points[0];
          const area = `${c.smoothPath} L${last.x.toFixed(2)},${box.bottom} L${first.x.toFixed(2)},${box.bottom} Z`;

          const labelCount = Math.min(5, data.length);
          const xLabels = Array.from({ length: labelCount }, (_, i) => {
            const idx = Math.round((i / (labelCount - 1 || 1)) * (data.length - 1));
            return { x: c.xOf(idx), text: formatTime(data[idx].dateTime) };
          });

          const hp = hover != null ? c.points[hover] : null;

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
                  <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((t, i) => {
                const y = c.yOf(t);
                return (
                  <g key={i}>
                    <line className="chart-grid" x1={box.left} y1={y} x2={box.right} y2={y} strokeWidth={1} />
                    <text className="chart-label" x={box.left - 8} y={y + 4} textAnchor="end" fontSize={11}>
                      {t.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {thresholds
                .filter((t) => t.value >= c.min && t.value <= c.max)
                .map((t, i) => {
                  const y = c.yOf(t.value);
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
                d={c.smoothPath}
                fill="none"
                stroke={lineColor}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
              <circle cx={last.x} cy={last.y} r={8} fill={lineColor} opacity={0.18} />

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
                  color={lineColor}
                  width={width}
                  lines={[formatPrice(data[hover].price), formatTime(data[hover].dateTime)]}
                />
              )}
            </svg>
          );
        })()
      )}
    </div>
  );
}

/** Shared crosshair line + dot + tooltip card (SVG). */
export function Crosshair({
  x,
  y,
  top,
  bottom,
  color,
  width,
  lines,
}: {
  x: number;
  y: number;
  top: number;
  bottom: number;
  color: string;
  width: number;
  lines: string[];
}) {
  const boxW = 78;
  const boxH = 38;
  const tx = Math.max(2, Math.min(width - boxW - 2, x - boxW / 2));
  const ty = top + 2;
  return (
    <g pointerEvents="none">
      <line className="chart-crosshair" x1={x} y1={top} x2={x} y2={bottom} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={x} cy={y} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      <rect className="chart-tip-bg" x={tx} y={ty} width={boxW} height={boxH} rx={8} strokeWidth={1} />
      <text className="chart-tip-text" x={tx + boxW / 2} y={ty + 16} textAnchor="middle" fontSize={14} fontWeight={700}>
        {lines[0]}
      </text>
      <text className="chart-tip-dim" x={tx + boxW / 2} y={ty + 30} textAnchor="middle" fontSize={11}>
        {lines[1]}
      </text>
    </g>
  );
}
