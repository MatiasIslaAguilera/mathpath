// Home's two small charts (inline SVG, one series each, so the title names it and there is no
// legend). Tap or hover a mark for its value; a visually hidden table carries the same data.

import { useState } from 'react';
import type { DayActivity, WeekAccuracy } from '../../learning/stats';
import { shortDate } from '../shortDate';

const W = 340;
const PAD = { l: 26, r: 30, t: 14, b: 22 };

function Tip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 6.4 + 16;
  const tx = Math.min(Math.max(x - w / 2, 0), W - w);
  return (
    <g className="chart-tip" pointerEvents="none">
      <rect x={tx} y={y - 28} width={w} height={22} rx={6} />
      <text x={tx + w / 2} y={y - 13} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function ActivityChart({ days, goal }: { days: DayActivity[]; goal: number }) {
  const [active, setActive] = useState<number | null>(null);
  const H = 120;
  const max = Math.max(goal, ...days.map((d) => d.problems));
  const top = Math.ceil(max / 5) * 5;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  const band = (W - PAD.l - PAD.r) / days.length;
  const bw = Math.min(16, band - 4);
  const base = y(0);
  const last = days.length - 1;
  return (
    <figure className="chart" data-testid="activity-chart">
      <figcaption>
        <strong>Problems per day</strong>
        <span className="fine">last {days.length} days</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Problems per day over the last ${days.length} days, goal ${goal}`} onMouseLeave={() => setActive(null)}>
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="chart-axis" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} className="chart-ref" />
        <text x={W - PAD.r + 4} y={y(goal) + 4} className="chart-label">
          goal
        </text>
        <text x={PAD.l - 6} y={base + 4} textAnchor="end" className="chart-label">
          0
        </text>
        <text x={PAD.l - 6} y={y(top) + 4} textAnchor="end" className="chart-label">
          {top}
        </text>
        {days.map((d, i) => {
          const cx = PAD.l + band * i + band / 2;
          const h = base - y(d.problems);
          const r = Math.min(4, h);
          const x0 = cx - bw / 2;
          return (
            <g key={d.date} onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)}>
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={H - PAD.t} className="chart-hit" />
              {d.problems > 0 && (
                <path
                  className={i === last ? 'chart-bar now' : active === i ? 'chart-bar hot' : 'chart-bar'}
                  d={`M${x0} ${base} V${base - h + r} Q${x0} ${base - h} ${x0 + r} ${base - h} H${x0 + bw - r} Q${x0 + bw} ${base - h} ${x0 + bw} ${base - h + r} V${base} Z`}
                />
              )}
            </g>
          );
        })}
        {[0, last].map((i) => (
          <text key={i} x={PAD.l + band * i + band / 2} y={H - 6} textAnchor="middle" className="chart-label">
            {i === last ? 'today' : shortDate(days[i].date)}
          </text>
        ))}
        {active !== null && (
          <Tip x={PAD.l + band * active + band / 2} y={y(days[active].problems)} text={`${active === last ? 'Today' : shortDate(days[active].date)}: ${plural(days[active].problems, 'problem')}`} />
        )}
      </svg>
      <table className="sr-only">
        <caption>Problems per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
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
  const [active, setActive] = useState<number | null>(null);
  const H = 120;
  const lo = 0.5;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (Math.max(v, lo) - lo) / (1 - lo));
  const step = (W - PAD.l - PAD.r) / (weeks.length - 1);
  const x = (i: number) => PAD.l + step * i;
  const pts = weeks.map((w, i) => (w.accuracy === undefined ? null : { i, x: x(i), y: y(w.accuracy), v: w.accuracy }));
  const known = pts.filter((pt): pt is NonNullable<typeof pt> => pt !== null);
  const path = known.map((pt, k) => `${k ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');
  const end = known[known.length - 1];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <figure className="chart" data-testid="accuracy-chart">
      <figcaption>
        <strong>Solo accuracy</strong>
        <span className="fine">per week · shaded: the 75–85% sweet spot</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of problems solved without help, per week, over the last 8 weeks" onMouseLeave={() => setActive(null)}>
        <rect x={PAD.l} y={y(BAND[1])} width={W - PAD.l - PAD.r} height={y(BAND[0]) - y(BAND[1])} className="chart-band" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(lo)} y2={y(lo)} className="chart-axis" />
        {[0.5, 1].map((v) => (
          <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
            {pct(v)}
          </text>
        ))}
        {known.length > 0 ? (
          <>
            <path d={path} className="chart-line" />
            {known.map((pt) => (
              <g key={pt.i} onMouseEnter={() => setActive(pt.i)} onClick={() => setActive(active === pt.i ? null : pt.i)}>
                <rect x={pt.x - step / 2} y={PAD.t} width={step} height={H - PAD.t} className="chart-hit" />
                {(pt === end || active === pt.i) && <circle cx={pt.x} cy={pt.y} r={4} className="chart-dot" />}
              </g>
            ))}
            {end && (
              <text x={end.x + 8} y={end.y + 4} className="chart-label strong">
                {pct(end.v)}
              </text>
            )}
          </>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="chart-label">
            No attempts yet
          </text>
        )}
        <text x={x(0)} y={H - 6} textAnchor="start" className="chart-label">
          {weeks.length - 1} weeks ago
        </text>
        <text x={x(weeks.length - 1)} y={H - 6} textAnchor="end" className="chart-label">
          this week
        </text>
        {active !== null && weeks[active].accuracy !== undefined && (
          <Tip x={x(active)} y={y(weeks[active].accuracy!)} text={`Week of ${shortDate(weeks[active].weekOf)}: ${pct(weeks[active].accuracy!)} of ${weeks[active].attempts}`} />
        )}
      </svg>
      <table className="sr-only">
        <caption>Solo accuracy per week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekOf}>
              <th scope="row">{w.weekOf}</th>
              <td>{w.accuracy === undefined ? 'no attempts' : `${pct(w.accuracy)} of ${w.attempts}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
