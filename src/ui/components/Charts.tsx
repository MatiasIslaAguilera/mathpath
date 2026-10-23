// Home's two small charts (inline SVG, one series each, so the title names it and there is no
// legend). Tap anywhere on a chart, hover, or focus it and use ←/→ to read a value; a visually
// hidden table carries the same data, and a live region announces the selected value.

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MIN_SESSION } from '../../learning/streak';
import type { DayActivity, WeekAccuracy } from '../../learning/stats';
import { shortDate } from '../shortDate';

const W = 340;
const H = 124;
const PAD = { l: 30, r: 34, t: 14, b: 22 };
/** Fewer unassisted answers than this in a week: drawn hollow, it says little. */
const SMALL_N = 10;

function Tip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 6.2 + 16;
  const tx = Math.min(Math.max(x - w / 2, 0), W - w);
  const ty = Math.max(y - 30, 0);
  return (
    <g className="chart-tip" pointerEvents="none">
      <rect x={tx} y={ty} width={w} height={22} rx={6} />
      <text x={tx + w / 2} y={ty + 15} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

/** One selected mark per chart: pointer picks the nearest by x, keys step through, blur clears. */
function useSelection(count: number, xOf: (i: number) => number) {
  const [active, setActive] = useState<number | null>(null);
  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(xOf(i) - vx) < Math.abs(xOf(best) - vx)) best = i;
    return best;
  };
  return {
    active,
    handlers: {
      tabIndex: 0,
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => e.pointerType === 'mouse' && setActive(nearest(e)),
      onPointerLeave: (e: PointerEvent<SVGSVGElement>) => e.pointerType === 'mouse' && setActive(null),
      onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse') return;
        const i = nearest(e);
        setActive(active === i ? null : i);
      },
      onFocus: () => setActive((a) => a ?? count - 1),
      onBlur: () => setActive(null),
      onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (e.key === 'Home') setActive(0);
        else if (e.key === 'End') setActive(count - 1);
        else if (e.key === 'Escape') setActive(null);
        else if (step) setActive((a) => Math.min(count - 1, Math.max(0, (a ?? count - 1) + step)));
        else return;
        e.preventDefault();
      },
    },
  };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function ActivityChart({ days, goal }: { days: DayActivity[]; goal: number }) {
  const max = Math.max(goal, ...days.map((d) => d.problems));
  const top = Math.ceil(max / 5) * 5;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  const band = (W - PAD.l - PAD.r) / days.length;
  const xOf = (i: number) => PAD.l + band * i + band / 2;
  const bw = Math.min(16, band - 4);
  const base = y(0);
  const last = days.length - 1;
  const { active, handlers } = useSelection(days.length, xOf);
  const tip = active === null ? '' : `${active === last ? 'Today' : shortDate(days[active].date)}: ${plural(days[active].problems, 'problem')}`;
  return (
    <figure className="chart" data-testid="activity-chart">
      <figcaption>
        <h2 className="chart-title">Problems per day</h2>
        <span className="fine">last {days.length} days · solid: the day counted ({MIN_SESSION}+)</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Problems per day over the last ${days.length} days, goal ${goal}. Use the arrow keys to read each day.`} {...handlers}>
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="chart-axis" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} className="chart-ref" />
        <text x={W - PAD.r + 4} y={y(goal) + 4} className="chart-label">
          goal {goal}
        </text>
        <text x={PAD.l - 6} y={base + 4} textAnchor="end" className="chart-label">
          0
        </text>
        <text x={PAD.l - 6} y={y(top) + 4} textAnchor="end" className="chart-label">
          {top}
        </text>
        {days.map((d, i) => {
          if (!d.problems) return null;
          const h = base - y(d.problems);
          const r = Math.min(4, h);
          const x0 = xOf(i) - bw / 2;
          const cls = `chart-bar${d.problems < MIN_SESSION ? ' light' : ''}${active === i ? ' hot' : ''}`;
          return <path key={d.date} className={cls} d={`M${x0} ${base} V${base - h + r} Q${x0} ${base - h} ${x0 + r} ${base - h} H${x0 + bw - r} Q${x0 + bw} ${base - h} ${x0 + bw} ${base - h + r} V${base} Z`} />;
        })}
        {[0, last].map((i) => (
          <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" className="chart-label">
            {i === last ? 'today' : shortDate(days[i].date)}
          </text>
        ))}
        {active !== null && <Tip x={xOf(active)} y={y(days[active].problems)} text={tip} />}
      </svg>
      <p className="sr-only" aria-live="polite">
        {tip}
      </p>
      <table className="sr-only">
        <caption>Problems per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Problems</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{shortDate(d.date)}</th>
              <td>{d.problems}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** The desirable-difficulty band the session builder aims for (TARGET_P to BAND_TOP). */
const BAND = [0.75, 0.85] as const;

export function AccuracyChart({ weeks }: { weeks: WeekAccuracy[] }) {
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v);
  const step = (W - PAD.l - PAD.r) / (weeks.length - 1);
  const xOf = (i: number) => PAD.l + step * i;
  const { active, handlers } = useSelection(weeks.length, xOf);
  // Break the line at weeks with no unassisted answers rather than bridging them.
  const segments: string[] = [];
  let open = false;
  weeks.forEach((w, i) => {
    if (w.accuracy === undefined) return void (open = false);
    segments.push(`${open ? 'L' : 'M'}${xOf(i)} ${y(w.accuracy)}`);
    open = true;
  });
  const lastKnown = weeks.reduce((k, w, i) => (w.accuracy === undefined ? k : i), -1);
  const a = active === null ? undefined : weeks[active];
  const tip = !a ? '' : a.accuracy === undefined ? `Week of ${shortDate(a.weekOf)}: no solo answers` : `Week of ${shortDate(a.weekOf)}: ${pct(a.accuracy)} of ${a.attempts}`;
  return (
    <figure className="chart" data-testid="accuracy-chart">
      <figcaption>
        <h2 className="chart-title">Solo accuracy</h2>
        <span className="fine">answers without help, per week · band: the 75–85% target · hollow: under {SMALL_N} answers</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of problems solved without help, per week, over the last 8 weeks. Use the arrow keys to read each week." {...handlers}>
        <rect x={PAD.l} y={y(BAND[1])} width={W - PAD.l - PAD.r} height={y(BAND[0]) - y(BAND[1])} className="chart-band" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(BAND[1])} y2={y(BAND[1])} className="chart-band-edge" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(BAND[0])} y2={y(BAND[0])} className="chart-band-edge" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="chart-axis" />
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
            {pct(v)}
          </text>
        ))}
        {lastKnown < 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="chart-label">
            No solo answers yet
          </text>
        ) : (
          <>
            <path d={segments.join(' ')} className="chart-line" />
            {weeks.map((w, i) =>
              w.accuracy === undefined ? null : (
                <circle key={w.weekOf} cx={xOf(i)} cy={y(w.accuracy)} r={active === i ? 5 : 4} className={w.attempts < SMALL_N ? 'chart-dot small' : 'chart-dot'} />
              ),
            )}
            <text x={xOf(lastKnown) + 8} y={y(weeks[lastKnown].accuracy!) + 4} className="chart-label strong">
              {pct(weeks[lastKnown].accuracy!)}
            </text>
          </>
        )}
        <text x={xOf(0)} y={H - 6} textAnchor="start" className="chart-label">
          {weeks.length - 1} weeks ago
        </text>
        <text x={xOf(weeks.length - 1)} y={H - 6} textAnchor="end" className="chart-label">
          this week
        </text>
        {a && <Tip x={xOf(active!)} y={y(a.accuracy ?? 0.5)} text={tip} />}
      </svg>
      <p className="sr-only" aria-live="polite">
        {tip}
      </p>
      <table className="sr-only">
        <caption>Solo accuracy per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Solved without help</th>
            <th scope="col">Answers</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekOf}>
              <th scope="row">{shortDate(w.weekOf)}</th>
              <td>{w.accuracy === undefined ? 'none' : pct(w.accuracy)}</td>
              <td>{w.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
