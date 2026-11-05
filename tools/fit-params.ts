// Fit the rating model and the FSRS weights to the learner's own event log:
//
//   npm run fit -- <progress.json>            report only (default)
//   npm run fit -- <progress.json> --write    also write src/learning/fitted-params.ts
//
// Honest by construction: parameters are fitted on the first 70% of the log (by time) and judged
// on the last 30%, with every prediction made before the attempt it predicts (replay). A model is
// written only if it beats the defaults on that held-out 30% by at least MIN_GAIN; the written
// values are then refitted on the whole log. PLAN §8 items 1 and 3.
//
// A better-predicting rating model is not automatically a better tutor: read the pacing line
// (straight solves needed to reach each level) before writing. On 2026-11-04 the fit predicted 3%
// better by learning more slowly, which would have taken 22 straight solves to reach level 3
// instead of 9; it was not written.

import { readFileSync, writeFileSync } from 'node:fs';
import { createEmptyCard, default_w, Rating, type Card } from 'ts-fsrs';
import { DEFAULT_MODEL, pCorrect, TARGET_P, updateRating, type RatingModel } from '../src/learning/mastery';
import { gradeFor, makeScheduler } from '../src/learning/scheduler';
import { sortEvents, type AttemptEvent, type LearningEvent } from '../src/storage/events';
import { dateKey } from '../src/storage/progress';

/** Relative held-out improvement a fit needs before it may be written (below this it's noise). */
const MIN_GAIN = 0.01;

const path = process.argv[2];
const write = process.argv.includes('--write');
if (!path) {
  console.error('Usage: npm run fit -- <progress.json> [--write]');
  process.exit(1);
}
const events: LearningEvent[] = sortEvents(JSON.parse(readFileSync(path, 'utf8')).events ?? []);
const attempts = events.filter((e): e is AttemptEvent => e.type === 'attempt');
const solo = attempts.filter((e) => e.help === 'none');
const split = solo[Math.floor(solo.length * 0.7)].ts;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const f4 = (x: number) => x.toFixed(4);
const f2 = (x: number) => x.toFixed(2);

/** Coordinate descent: try ±step on each coordinate, keep improvements, halve the step when stuck. */
function minimize(x0: number[], loss: (x: number[]) => number, step: number[], rounds = 60): number[] {
  let x = [...x0];
  let best = loss(x);
  const s = [...step];
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (let i = 0; i < x.length; i++) {
      for (const dir of [1, -1]) {
        const y = [...x];
        y[i] += dir * s[i];
        const l = loss(y);
        if (l < best - 1e-9) {
          best = l;
          x = y;
          moved = true;
          break;
        }
      }
    }
    if (!moved) {
      for (let i = 0; i < s.length; i++) s[i] /= 2;
      if (Math.max(...s.map((v, i) => v / step[i])) < 1e-3) break;
    }
  }
  return x;
}

// ---------- 1. rating model ----------

interface Pred {
  ts: number;
  p: number;
  y: number;
}

function ratingPreds(m: RatingModel): Pred[] {
  const st: Record<string, { r: number; n: number }> = {};
  const out: Pred[] = [];
  for (const e of attempts) {
    const s = (st[e.skillId] ??= { r: m.initial, n: 0 });
    if (e.help === 'none') out.push({ ts: e.ts, p: pCorrect(s.r, e.level, m), y: e.correct ? 1 : 0 });
    s.r = updateRating(s.r, s.n, e.level, e.correct, e.help, m);
    s.n += 1;
  }
  return out;
}

const brier = (ps: Pred[]) => mean(ps.map((q) => (q.p - q.y) ** 2));

// x = [b1, initial, kMax, kMin, kScale]. The spacing stays one logit per level: fitting it too
// (tried 2026-11-04) squeezed levels 2-5 to 0.25 apart on data with almost no level 4-5 items, an
// extrapolation that would serve level 5 as if it were level 3, and it didn't survive a refit.
function toModel(x: number[]): RatingModel | null {
  const [b1, initial, kMax, kMin, kScale] = x;
  if (kMin < 0.05 || kMax < kMin || kScale < 1) return null;
  return { levels: [b1, b1 + 1, b1 + 2, b1 + 3, b1 + 4], initial, kMax, kMin, kScale };
}
const fromModel = (m: RatingModel) => [m.levels[0], m.initial, m.kMax, m.kMin, m.kScale];

function fitRating(until: number): RatingModel {
  const loss = (x: number[]) => {
    const m = toModel(x);
    return m ? brier(ratingPreds(m).filter((q) => q.ts < until)) : 1e9;
  };
  return toModel(minimize(fromModel(DEFAULT_MODEL), loss, [0.5, 0.5, 0.5, 0.1, 4]))!;
}

function calibration(ps: Pred[]): string[] {
  const out: string[] = [];
  for (let lo = 0; lo < 1; lo += 0.1) {
    const b = ps.filter((q) => q.p >= lo && q.p < lo + 0.1);
    if (b.length >= 5) out.push(`    ${f2(lo)}–${f2(lo + 0.1)}  ${f2(mean(b.map((q) => q.p)))} → ${f2(mean(b.map((q) => q.y)))}   n ${b.length}`);
  }
  return out;
}

const showModel = (m: RatingModel) =>
  `levels ${m.levels.map(f2).join(' / ')}, start ${f2(m.initial)}, k = max(${f2(m.kMin)}, ${f2(m.kMax)} / (1 + n/${f2(m.kScale)}))`;

console.log(`# Model fit: ${path}`);
console.log(`Fit on events before ${new Date(split).toISOString().slice(0, 10)}, judged on the ${solo.filter((e) => e.ts >= split).length} solo attempts after.\n`);
console.log('## 1. Rating model (Brier on held-out attempts; lower is better)\n');
const trainMean = mean(solo.filter((e) => e.ts < split).map((e) => (e.correct ? 1 : 0)));
const heldOut = (ps: Pred[]) => ps.filter((q) => q.ts >= split);
const defTest = heldOut(ratingPreds(DEFAULT_MODEL));
const fitTrain = fitRating(split);
const fitTest = heldOut(ratingPreds(fitTrain));
const constTest = brier(defTest.map((q) => ({ ...q, p: trainMean })));
console.log(`  constant ${f2(trainMean)}:   ${f4(constTest)}`);
console.log(`  default model:   ${f4(brier(defTest))}   (${showModel(DEFAULT_MODEL)})`);
console.log(`  fitted model:    ${f4(brier(fitTest))}   (${showModel(fitTrain)})`);
console.log('  held-out calibration, default → fitted:');
console.log(['  default', ...calibration(defTest), '  fitted', ...calibration(fitTest)].join('\n'));
/** Straight unassisted solves a brand-new skill needs to reach levels 2..5 (the climb speed). */
function pacing(m: RatingModel): number[] {
  const level = (r: number) => ([1, 2, 3, 4, 5] as const).filter((l) => pCorrect(r, l, m) >= TARGET_P).pop() ?? 1;
  let r = m.initial;
  const reach: number[] = [];
  for (let n = 0; n < 200 && reach.length < 4; n++) {
    r = updateRating(r, n, level(r), true, 'none', m);
    while (reach.length < level(r) - 1) reach.push(n + 1);
  }
  return reach;
}

const ratingGain = 1 - brier(fitTest) / brier(defTest);
const ratingAllCandidate = ratingGain >= MIN_GAIN ? fitRating(Infinity) : null;
const slower = ratingAllCandidate ? pacing(ratingAllCandidate)[1] > 1.5 * pacing(DEFAULT_MODEL)[1] : false;
const allowSlower = process.argv.includes('--allow-slower');
console.log(`\n  held-out gain ${(100 * ratingGain).toFixed(1)}% (needs ≥ ${100 * MIN_GAIN}%)`);
if (ratingAllCandidate) {
  console.log(`  refitted on the whole log: ${showModel(ratingAllCandidate)}`);
  console.log(`  pacing, straight solves to reach L2..L5: default ${pacing(DEFAULT_MODEL).join(', ')}; fitted ${pacing(ratingAllCandidate).join(', ')}`);
  if (slower && !allowSlower) console.log('  the fit climbs to level 3 over 1.5× slower than the default: not written (pass --allow-slower to accept)');
} else console.log('  not enough gain: keeping the default');
const ratingAll = ratingAllCandidate && (!slower || allowSlower) ? ratingAllCandidate : null;

// ---------- 2. FSRS ----------
//
// A first-of-day success needs two things: remembering the skill (FSRS recall R) and solving
// this particular item (the rating model's p for its level). Scoring R alone blames FSRS for
// every slip on a stretch item, so it learns to forget too fast; on the 2026-11-04 export R alone
// scored worse than a constant. The fit maximises the likelihood of R·p instead.

const itemModel = ratingAll ?? DEFAULT_MODEL;

interface Review {
  skill: string;
  ts: number;
  grade: ReturnType<typeof gradeFor>;
  solo: boolean;
  y: number;
  /** The rating model's chance of solving this item, given the skill is remembered. */
  p: number;
}
const reviews: Review[] = [];
{
  const seen = new Set<string>();
  const st: Record<string, { r: number; n: number }> = {};
  for (const e of attempts) {
    const s = (st[e.skillId] ??= { r: itemModel.initial, n: 0 });
    const key = `${dateKey(new Date(e.ts))}|${e.skillId}`;
    if (!seen.has(key)) {
      seen.add(key);
      const grade = gradeFor(e.correct, e.help);
      reviews.push({ skill: e.skillId, ts: e.ts, grade, solo: e.help === 'none', y: grade === Rating.Again ? 0 : 1, p: pCorrect(s.r, e.level, itemModel) });
    }
    s.r = updateRating(s.r, s.n, e.level, e.correct, e.help, itemModel);
    s.n += 1;
  }
}

interface RPred {
  ts: number;
  r: number;
  p: number;
  y: number;
  solo: boolean;
}
function fsrsPreds(w: number[]): RPred[] {
  const f = makeScheduler(w);
  const cards: Record<string, Card> = {};
  const out: RPred[] = [];
  for (const rv of reviews) {
    const now = new Date(rv.ts);
    const c = cards[rv.skill];
    if (c) out.push({ ts: rv.ts, r: f.get_retrievability(c, now, false), p: rv.p, y: rv.y, solo: rv.solo });
    cards[rv.skill] = f.next(c ?? createEmptyCard(now), now, rv.grade).card;
  }
  return out;
}
const ll = (prob: number, y: number) => -(y * Math.log(Math.max(prob, 1e-6)) + (1 - y) * Math.log(Math.max(1 - prob, 1e-6)));
const logloss = (ps: RPred[], f: (q: RPred) => number) => mean(ps.map((q) => ll(f(q), q.y)));
const joint = (q: RPred) => q.r * q.p;

// The weights with enough evidence in a few dozen day-granular reviews: first stabilities
// (Again, Good), growth after a success, stability after a lapse, and the curve's decay.
const FREE = [0, 2, 8, 9, 10, 11, 12, 13, 14, 20];
const BOUNDS: Record<number, [number, number]> = {
  0: [0.01, 100], 2: [0.01, 100], 8: [0, 4.5], 9: [0, 0.8], 10: [0.001, 3.5], 11: [0.001, 5], 12: [0.001, 0.25], 13: [0.001, 0.9], 14: [0, 4], 20: [0.1, 0.8],
};
/** Prior strength: a few dozen reviews shouldn't run away with a weight (10 was best held out, scanned 0.5–40). */
const PRIOR = 10;
function fitFsrs(until: number): number[] {
  const n = reviews.filter((r) => r.ts < until).length;
  const loss = (x: number[]) => {
    const w = [...default_w];
    for (let i = 0; i < FREE.length; i++) {
      const [lo, hi] = BOUNDS[FREE[i]];
      if (x[i] < lo || x[i] > hi) return 1e9;
      w[FREE[i]] = x[i];
    }
    const prior = FREE.reduce((a, j, i) => a + ((x[i] - default_w[j]) / (BOUNDS[j][1] - BOUNDS[j][0])) ** 2, 0);
    return logloss(fsrsPreds(w).filter((q) => q.ts < until), joint) + (2 * PRIOR * prior) / Math.max(n, 1);
  };
  const x = minimize(FREE.map((j) => default_w[j]), loss, FREE.map((j) => (BOUNDS[j][1] - BOUNDS[j][0]) / 20));
  const w = [...default_w];
  FREE.forEach((j, i) => (w[j] = x[i]));
  return w;
}

console.log('\n## 2. FSRS (first-of-day reviews, held out; log loss, lower is better)\n');
const defR = fsrsPreds([...default_w]).filter((q) => q.ts >= split);
const wTrain = fitFsrs(split);
const fitR = fsrsPreds(wTrain).filter((q) => q.ts >= split);
const yTrain = mean(reviews.filter((r) => r.ts < split).map((r) => r.y));
const show = (ps: RPred[]) => {
  const s = ps.filter((q) => q.solo);
  return `R·p ${f4(logloss(ps, joint))}   R alone ${f4(logloss(ps, (q) => q.r))}   mean R ${f2(mean(s.map((q) => q.r)))}, R·p ${f2(mean(s.map(joint)))} → actual ${f2(mean(s.map((q) => q.y)))} (solo, n ${s.length})`;
};
console.log(`  reviews: ${reviews.length} (${reviews.filter((r) => r.ts < split).length} to fit, ${defR.length} held out)`);
console.log(`  constant ${f2(yTrain)}:  ${f4(logloss(defR, () => yTrain))}`);
console.log(`  item p alone:   ${f4(logloss(defR, (q) => q.p))}   (no memory model at all)`);
console.log(`  default weights: ${show(defR)}`);
console.log(`  fitted weights:  ${show(fitR)}`);
const fsrsGain = 1 - logloss(fitR, joint) / logloss(defR, joint);
console.log(`  held-out gain ${(100 * fsrsGain).toFixed(1)}% (needs ≥ ${100 * MIN_GAIN}%)`);
const fsrsWins = fsrsGain >= MIN_GAIN;
const wAll = fsrsWins ? fitFsrs(Infinity) : null;
if (wAll) {
  console.log(`  changed weights (whole-log refit): ${FREE.map((j) => `w${j} ${f2(default_w[j])}→${f2(wAll[j])}`).join(', ')}`);
} else console.log('  not enough gain: keeping the default weights');
{
  // What the weights mean for scheduling: days until a skill falls to 90% recall.
  const days = (w: number[], grades: ReturnType<typeof gradeFor>[]) => {
    const f = makeScheduler(w);
    let c = createEmptyCard(new Date(2026, 0, 1));
    let t = new Date(2026, 0, 1);
    const out: number[] = [];
    for (const g of grades) {
      c = f.next(c, t, g).card;
      out.push(c.scheduled_days);
      t = c.due;
    }
    return out.join(', ');
  };
  const goods = [Rating.Good, Rating.Good, Rating.Good, Rating.Good] as ReturnType<typeof gradeFor>[];
  console.log(`  intervals after 4 straight Good reviews (days): default ${days([...default_w], goods)}${wAll ? `; fitted ${days(wAll, goods)}` : ''}`);
}

// ---------- write ----------

if (write) {
  const round = (x: number) => Math.round(x * 1e4) / 1e4;
  const rating = ratingAll ? JSON.stringify({ ...ratingAll, levels: ratingAll.levels.map(round), initial: round(ratingAll.initial), kMax: round(ratingAll.kMax), kMin: round(ratingAll.kMin), kScale: round(ratingAll.kScale) }) : 'null';
  const fsrsW = wAll ? JSON.stringify(wAll.map(round)) : 'null';
  writeFileSync(
    new URL('../src/learning/fitted-params.ts', import.meta.url),
    `// Model parameters fitted to this learner's event log by \`npm run fit -- <progress.json>\`
// (tools/fit-params.ts). Generated: edit by re-running the fit, not by hand. \`null\` means
// "use the defaults in mastery.ts / scheduler.ts".
// Source: ${path.replace(/\\/g, '/')} (${attempts.length} attempts, ${reviews.length} first-of-day reviews).

export const FITTED = {
  fittedAt: ${JSON.stringify(new Date().toISOString().slice(0, 10))} as string | null,
  rating: ${rating} as null | { levels: [number, number, number, number, number]; initial: number; kMax: number; kMin: number; kScale: number },
  fsrsW: ${fsrsW} as number[] | null,
};
`,
  );
  console.log('\nWrote src/learning/fitted-params.ts');
} else console.log('\n(dry run: add --write to save the fitted parameters)');
