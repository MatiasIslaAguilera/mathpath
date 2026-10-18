// Figure builders for generators (mainly GRE geometry and data questions). Output is a Figure
// (engine/types.ts): SVG strings built here from numbers and short plain-text labels only, so a
// figure can never carry markup from anywhere else. Strokes and text use currentColor, so
// figures follow light/dark mode. Like the GRE, figures are not necessarily drawn to scale
// unless a generator says so in the prompt.

import type { Figure } from './types';

type Pt = [number, number];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n: number) => (Math.round(n * 10) / 10).toString();

const W = 260;
const H = 200;
const PAD = 28;

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, sans-serif" font-size="13" fill="none" stroke="currentColor" stroke-width="1.6">${body}</svg>`;
}
const text = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle') =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" dominant-baseline="middle" fill="currentColor" stroke="none">${esc(s)}</text>`;

/** Fit points into the drawing box (y up in input, y down in SVG). Keeps the aspect ratio. */
function fit(points: Pt[], width = W, height = H): Pt[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((width - 2 * PAD) / (x1 - x0 || 1), (height - 2 * PAD) / (y1 - y0 || 1));
  const ox = (width - (x1 - x0) * s) / 2;
  const oy = (height - (y1 - y0) * s) / 2;
  return points.map(([x, y]) => [ox + (x - x0) * s, height - (oy + (y - y0) * s)]);
}

const away = (p: Pt, from: Pt, d: number): Pt => {
  const dx = p[0] - from[0];
  const dy = p[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [p[0] + (dx / len) * d, p[1] + (dy / len) * d];
};

export interface TriangleOptions {
  /** Vertex coordinates (any units; they're fitted to the box). */
  points: [Pt, Pt, Pt];
  vertexLabels?: [string, string, string];
  /** Labels for the sides 0–1, 1–2 and 2–0, in that order. Empty string = no label. */
  sideLabels?: [string, string, string];
  /** Angle labels at each vertex (e.g. "40°", "x°"). */
  angleLabels?: [string, string, string];
  /** Index of a vertex to mark with a right-angle square. */
  rightAngleAt?: 0 | 1 | 2;
  alt: string;
}

export function triangleFigure(o: TriangleOptions): Figure {
  const P = fit(o.points);
  const c: Pt = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
  let body = `<polygon points="${P.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}"/>`;
  o.vertexLabels?.forEach((l, i) => {
    if (l) body += text(...away(P[i], c, 14), l);
  });
  o.sideLabels?.forEach((l, i) => {
    if (!l) return;
    const a = P[i];
    const b = P[(i + 1) % 3];
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    body += text(...away(mid, c, 14), l);
  });
  o.angleLabels?.forEach((l, i) => {
    if (l) body += text(...away(P[i], c, -26), l);
  });
  if (o.rightAngleAt !== undefined) {
    const v = P[o.rightAngleAt];
    const u = away(v, P[(o.rightAngleAt + 1) % 3], -10);
    const w = away(v, P[(o.rightAngleAt + 2) % 3], -10);
    const corner: Pt = [u[0] + w[0] - v[0], u[1] + w[1] - v[1]];
    body += `<polyline points="${f(u[0])},${f(u[1])} ${f(corner[0])},${f(corner[1])} ${f(w[0])},${f(w[1])}"/>`;
  }
  return { kind: 'svg', svg: svg(W, H, body), alt: o.alt };
}

export interface CircleOptions {
  /** Draw a radius line labeled with this text. */
  radiusLabel?: string;
  centerLabel?: string;
  /** Shade a sector of this many degrees (starting at 3 o'clock), with an optional angle label. */
  sectorDegrees?: number;
  sectorLabel?: string;
  alt: string;
}

export function circleFigure(o: CircleOptions): Figure {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - PAD;
  let body = `<circle cx="${cx}" cy="${cy}" r="${f(r)}"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="currentColor"/>`;
  if (o.centerLabel) body += text(cx - 10, cy + 12, o.centerLabel);
  if (o.sectorDegrees) {
    const t = (o.sectorDegrees * Math.PI) / 180;
    const ex = cx + r * Math.cos(-t);
    const ey = cy + r * Math.sin(-t);
    const large = o.sectorDegrees > 180 ? 1 : 0;
    body += `<path d="M ${cx} ${cy} L ${f(cx + r)} ${cy} A ${f(r)} ${f(r)} 0 ${large} 0 ${f(ex)} ${f(ey)} Z" fill="currentColor" fill-opacity="0.12"/>`;
    if (o.sectorLabel) body += text(cx + 28 * Math.cos(-t / 2), cy + 28 * Math.sin(-t / 2), o.sectorLabel);
  } else if (o.radiusLabel) {
    body += `<line x1="${cx}" y1="${cy}" x2="${f(cx + r)}" y2="${cy}"/>`;
  }
  if (o.radiusLabel) body += text(cx + r / 2, cy - 10, o.radiusLabel);
  return { kind: 'svg', svg: svg(W, H, body), alt: o.alt };
}

export interface PlaneOptions {
  /** Axis range shown on both axes, e.g. 6 → −6..6. */
  range: number;
  points?: { at: Pt; label?: string }[];
  /** Lines y = m x + b, drawn across the visible range. */
  lines?: { m: number; b: number; label?: string }[];
  alt: string;
}

export function planeFigure(o: PlaneOptions): Figure {
  const size = 220;
  const s = (size - 2 * PAD) / (2 * o.range);
  const X = (x: number) => size / 2 + x * s;
  const Y = (y: number) => size / 2 - y * s;
  let body = `<g stroke-opacity="0.18">`;
  for (let i = -o.range; i <= o.range; i++) {
    body += `<line x1="${f(X(i))}" y1="${f(Y(-o.range))}" x2="${f(X(i))}" y2="${f(Y(o.range))}"/><line x1="${f(X(-o.range))}" y1="${f(Y(i))}" x2="${f(X(o.range))}" y2="${f(Y(i))}"/>`;
  }
  body += `</g><line x1="${f(X(-o.range))}" y1="${f(Y(0))}" x2="${f(X(o.range))}" y2="${f(Y(0))}"/><line x1="${f(X(0))}" y1="${f(Y(-o.range))}" x2="${f(X(0))}" y2="${f(Y(o.range))}"/>`;
  body += text(X(o.range) - 4, Y(0) - 10, 'x', 'end') + text(X(0) + 10, Y(o.range) + 4, 'y', 'start');
  for (const l of o.lines ?? []) {
    const x0 = -o.range;
    const x1 = o.range;
    body += `<line x1="${f(X(x0))}" y1="${f(Y(l.m * x0 + l.b))}" x2="${f(X(x1))}" y2="${f(Y(l.m * x1 + l.b))}" stroke-width="2"/>`;
    if (l.label) body += text(X(x1 * 0.7), Y(l.m * x1 * 0.7 + l.b) - 12, l.label);
  }
  for (const p of o.points ?? []) {
    body += `<circle cx="${f(X(p.at[0]))}" cy="${f(Y(p.at[1]))}" r="3.5" fill="currentColor"/>`;
    if (p.label) body += text(X(p.at[0]) + 8, Y(p.at[1]) - 10, p.label, 'start');
  }
  // Clip anything drawn outside the plane.
  return { kind: 'svg', svg: svg(size, size, `<clipPath id="plane"><rect x="0" y="0" width="${size}" height="${size}"/></clipPath><g clip-path="url(#plane)">${body}</g>`), alt: o.alt };
}

export interface BarChartOptions {
  title: string;
  categories: string[];
  values: number[];
  /** Unit shown after each value label, e.g. "%". */
  unit?: string;
  alt: string;
}

export function barChartFigure(o: BarChartOptions): Figure {
  const width = Math.max(W, 60 * o.categories.length + 2 * PAD);
  const height = 220;
  const top = 48; // room for the title (y=14) above the tallest bar's value label
  const bottom = height - 30;
  const max = Math.max(...o.values, 0) || 1;
  const bw = (width - 2 * PAD) / o.categories.length;
  let body = text(width / 2, 14, o.title);
  body += `<line x1="${PAD}" y1="${bottom}" x2="${width - PAD}" y2="${bottom}"/>`;
  o.values.forEach((v, i) => {
    const h = ((bottom - top) * Math.max(0, v)) / max;
    const x = PAD + i * bw + bw * 0.18;
    body += `<rect x="${f(x)}" y="${f(bottom - h)}" width="${f(bw * 0.64)}" height="${f(h)}" fill="currentColor" fill-opacity="0.22"/>`;
    body += text(x + bw * 0.32, bottom - h - 10, `${v}${o.unit ?? ''}`);
    body += text(x + bw * 0.32, bottom + 14, o.categories[i]);
  });
  return { kind: 'svg', svg: svg(width, height, body), alt: o.alt };
}

/** A data table (rendered as real HTML, so it stays readable and accessible). */
export function tableFigure(caption: string, headers: string[], rows: (string | number)[][]): Figure {
  return { kind: 'table', caption, headers, rows: rows.map((r) => r.map(String)) };
}
