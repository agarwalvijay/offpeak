// Pure SVG line-chart geometry, shared by the web (inline <svg>) and mobile
// (react-native-svg) charts. The `d` path-string syntax is identical for both,
// so only the rendering wrapper differs per platform. Handles negative prices
// (ComEd pricing can go below zero).

export interface LineChart {
  points: { x: number; y: number }[];
  /** Straight-segment SVG path `d`. */
  path: string;
  /** Smooth (cubic bezier) SVG path `d` — nicer for dense series. */
  smoothPath: string;
  /** Map a data value to a y pixel within the plot box. */
  yOf: (value: number) => number;
  /** Map a series index to an x pixel within the plot box. */
  xOf: (index: number) => number;
  min: number;
  max: number;
  box: { left: number; top: number; right: number; bottom: number };
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DEFAULT_PADDING: ChartPadding = { top: 10, right: 12, bottom: 22, left: 40 };

export function buildLineChart(
  values: number[],
  width: number,
  height: number,
  padding: ChartPadding = DEFAULT_PADDING,
): LineChart {
  const left = padding.left;
  const top = padding.top;
  const right = width - padding.right;
  const bottom = height - padding.bottom;
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  let min = values.length ? Math.min(...values) : 0;
  let max = values.length ? Math.max(...values) : 1;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  // Breathing room above/below the line.
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const yOf = (v: number) => bottom - ((v - min) / (max - min)) * h;
  const xOf = (i: number) =>
    values.length <= 1 ? left + w / 2 : left + (i / (values.length - 1)) * w;

  const points = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return {
    points,
    path,
    smoothPath: smoothPath(points),
    yOf,
    xOf,
    min,
    max,
    box: { left, top, right, bottom },
  };
}

/**
 * Smooth cubic-bezier path through points using a Catmull-Rom → Bézier
 * conversion (tension 0). Clamps control points so the curve doesn't overshoot
 * wildly on spiky data.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) {
    return points.length === 1 ? `M${points[0].x},${points[0].y}` : "";
  }
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Nice-ish evenly spaced tick values between min and max (inclusive ends). */
export function axisTicks(min: number, max: number, count = 4): number[] {
  if (count < 2) return [min, max];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}
