// GRE Data analysis: the 68-95-99.7 rule, z-scores, and percentiles/quartiles. No z-tables.
// Formats: numeric entry (L1-L3, L5), select-all (L2), multiple choice (L3), QC (L4).
// The rule percentages come from one table of cumulative areas below each whole number of SDs
// (2.5, 16, 50, 84, 97.5), so every answer is an exact multiple of 1/2.

import { choiceAnswer, multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, ChoiceOption, Level, MisconceptionInstance, SkillDefinition } from '../../engine/types';

const ID = 'gre-normal-distribution';
type Body = ReturnType<SkillDefinition['generate']>;

/** Percent of a normal distribution below mean + z·SD, for z = -2..2 (the 68-95-99.7 rule). */
const CDF: Record<number, Q> = { [-2]: new Q(5, 2), [-1]: new Q(16), 0: new Q(50), 1: new Q(84), 2: new Q(195, 2) };
const between = (a: number, b: number) => CDF[b].sub(CDF[a]);

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;
const pctLabel = (v: Q) => `${v.valueOf()}%`;
const orderBy = (a: Q, b: Q) => a.sub(b).sign();


// ---------- level 1: percent between two whole-SD points ----------

const L1_INTERVALS: [number, number][] = [[-1, 1], [-2, 2], [0, 1], [0, 2], [-1, 0], [-2, 0], [1, 2], [-2, -1]];

function level1(rng: Rng): Body {
  const [a, b] = rng.pick(L1_INTERVALS);
  const mean = rng.int(40, 100);
  const sd = rng.int(2, 15);
  const lo = mean + a * sd;
  const hi = mean + b * sd;
  const value = between(a, b);
  const answer = numberAnswer(value);
  const oneSided = (a === 0 || b === 0) && Math.abs(a + b) <= 2;
  const doubled = oneSided ? value.mul(2) : null;
  return {
    params: { mean, sd, a, b },
    prompt: `The scores on a test are approximately normally distributed with a mean of ${mean} and a standard deviation of ${sd}. Approximately what percent of the scores are between ${lo} and ${hi}? (Enter the percent as a number, e.g. 68 for 68%.)`,
    answer,
    steps: [
      { key: 'to-z-scores', instruction: `Express each endpoint as a number of SDs from the mean (${mean}, SD ${sd}).`, math: `${lo} = ${mean} ${a < 0 ? '-' : '+'} ${Math.abs(a)}(${sd}),\\qquad ${hi} = ${mean} ${b < 0 ? '-' : '+'} ${Math.abs(b)}(${sd})`, why: 'The 68-95-99.7 rule is stated in SDs from the mean, so convert first.', ask: { prompt: `How many SDs from the mean is ${hi}? (negative if below)`, answer: numberAnswer(b), verify: { type: 'evaluate', expr: `(${hi}-${mean})/${sd}` } } },
      { key: 'add-pieces', instruction: 'Add the standard slices: 34% from the mean to 1 SD, 13.5% from 1 to 2 SD, 2.5% beyond 2 SD, on each side.', math: `${a} \\text{ to } ${b} \\text{ SD} \\Rightarrow ${value.toLatex()}\\%`, why: 'Symmetry: the slice mean to +1 SD equals the slice mean to −1 SD, so each half of the 68% is 34%.', ask: { prompt: 'What percent lies in the interval?', answer, verify: { type: 'evaluate', expr: value.toString() } } },
    ],
    misconceptions: distinctMisconceptions(answer, [doubled ? wrongNumber('rule-half-forgotten', () => doubled) : null]),
    verify: { type: 'evaluate', expr: value.toString() },
  };
}

// ---------- level 2: value at mean ± k·SD, z-score, or "within 1 SD" select-all ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 2) {
    for (;;) {
      const mean = rng.int(50, 100);
      const sd = rng.int(4, 12);
      const xs: number[] = [];
      while (xs.length < 5) {
        const x = mean + rng.int(-Math.floor(2.5 * sd), Math.floor(2.5 * sd));
        if (!xs.includes(x) && Math.abs(x - mean) !== sd) xs.push(x);
      }
      const within = xs.map((x) => Math.abs(x - mean) < sd);
      const count = within.filter(Boolean).length;
      if (count < 1 || count > 4) continue;
      const order = rng.shuffle(xs.map((x, i) => ({ x, ok: within[i] })));
      const options: ChoiceOption[] = order.map((t, i) => ({ id: `o${i}`, label: String(t.x) }));
      const correct = options.filter((_, i) => order[i].ok).map((o) => o.id);
      const answer = multiAnswer(options, correct);
      const bigId = options.filter((_, i) => !order[i].ok && Math.abs(order[i].x - mean) < 2 * sd).map((o) => o.id);
      return {
        params: { form, mean, sd, k2: 0, x0: xs[0], x1: xs[1], x2: xs[2], x3: xs[3], x4: xs[4] },
        prompt: `Test scores are approximately normally distributed with a mean of ${mean} and a standard deviation of ${sd}. Which of the following scores are within 1 standard deviation of the mean? Select all that apply.`,
        answer,
        steps: [
          { key: 'band', instruction: `The band within 1 SD of the mean is ${mean - sd} to ${mean + sd}.`, math: `${mean} \\pm ${sd} \\;\\Rightarrow\\; (${mean - sd},\\, ${mean + sd})`, why: 'Compute the endpoints once, then test each option against them.', ask: { prompt: 'What is the upper end of the band?', answer: numberAnswer(mean + sd), verify: { type: 'evaluate', expr: `${mean}+${sd}` } } },
          { key: 'test-each', instruction: 'Keep the scores that lie inside the band.', math: order.map((t) => `${t.x}: ${t.ok ? '\\text{in}' : '\\text{out}'}`).join(',\\quad '), why: 'Select-all needs every correct option and no wrong ones.', ask: { prompt: 'Which scores are within 1 SD of the mean?', answer } },
        ],
        misconceptions: distinctMisconceptions(answer, bigId.length ? [{ id: 'within-two-for-one', wrong: multiAnswer(options, [...correct, ...bigId]) }] : []),
        verify: { type: 'choice', note: 'tests/skills/gre-normal-distribution.test.ts recomputes |x - mean| < sd for each option' },
      };
    }
  }
  for (;;) {
    const mean = rng.int(40, 100);
    const sd = rng.int(2, 15);
    const k2 = rng.pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
    if ((k2 * sd) % 2 !== 0) continue;
    const x = mean + (k2 * sd) / 2;
    if (form === 0) {
      const answer = numberAnswer(x);
      const k = new Q(k2, 2);
      return {
        params: { form, mean, sd, k2, x0: 0, x1: 0, x2: 0, x3: 0, x4: 0 },
        prompt: `Test scores are approximately normally distributed with a mean of ${mean} and a standard deviation of ${sd}. What score is ${k.abs().toString()} standard deviations ${k2 > 0 ? 'above' : 'below'} the mean?`,
        answer,
        steps: [
          { key: 'sd-distance', instruction: `Find the distance: ${k.abs().toString()} SDs.`, math: `${k.abs().toLatex()} \\times ${sd} = ${(Math.abs(k2) * sd) / 2}`, why: 'Distance from the mean = number of SDs × SD.', ask: { prompt: 'How far is the score from the mean?', answer: numberAnswer((Math.abs(k2) * sd) / 2), verify: { type: 'evaluate', expr: `${Math.abs(k2)}*${sd}/2` } } },
          { key: 'add-subtract', instruction: k2 > 0 ? 'Add it to the mean.' : 'Subtract it from the mean.', math: `${mean} ${k2 > 0 ? '+' : '-'} ${(Math.abs(k2) * sd) / 2} = ${x}`, why: 'Above the mean means add, below means subtract.', ask: { prompt: 'What is the score?', answer, verify: { type: 'evaluate', expr: `${mean}+(${k2})*${sd}/2` } } },
        ],
        misconceptions: [],
        verify: { type: 'evaluate', expr: `${mean}+(${k2})*${sd}/2` },
      };
    }
    const answer = numberAnswer(new Q(k2, 2));
    return {
      params: { form, mean, sd, k2, x0: 0, x1: 0, x2: 0, x3: 0, x4: 0 },
      prompt: `Test scores are approximately normally distributed with a mean of ${mean} and a standard deviation of ${sd}. A score of ${x} is how many standard deviations from the mean? (Enter a negative number if the score is below the mean.)`,
      answer,
      steps: [
        { key: 'deviation', instruction: `Subtract the mean: ${x} − ${mean}.`, math: `${x} - ${mean} = ${x - mean}`, why: 'The sign shows the side of the mean.', ask: { prompt: 'What is score minus mean?', answer: numberAnswer(x - mean), verify: { type: 'evaluate', expr: `${x}-${mean}` } } },
        { key: 'divide-sd', instruction: `Divide by the SD, ${sd}.`, math: `\\frac{${x - mean}}{${sd}} = ${new Q(k2, 2).toLatex()}`, why: 'z-score = (x − mean) ÷ SD.', ask: { prompt: 'How many SDs from the mean?', answer, verify: { type: 'evaluate', expr: `(${x}-${mean})/${sd}` } } },
      ],
      misconceptions: [],
      verify: { type: 'evaluate', expr: `(${x}-${mean})/${sd}` },
    };
  }
}

// ---------- level 3: tail percent, numeric or multiple choice ----------

function level3(rng: Rng): Body {
  const mean = rng.int(40, 100);
  const sd = rng.int(2, 15);
  const z = rng.pick([-2, -1, 1, 2]);
  const above = rng.chance(0.5);
  const fmt = rng.chance(0.4) ? 1 : 0;
  const cut = mean + z * sd;
  const value = above ? new Q(100).sub(CDF[z]) : CDF[z];
  const wrongV = CDF[z].sub(50).abs(); // area between the mean and the cutoff
  const prompt = `The scores on a test are approximately normally distributed with a mean of ${mean} and a standard deviation of ${sd}. Approximately what percent of the scores are ${above ? 'above' : 'below'} ${cut}?${fmt ? '' : ' (Enter the percent as a number, e.g. 16 for 16%.)'}`;
  let answer: AnswerSpec;
  const mis: MisconceptionInstance[] = [];
  if (fmt === 0) {
    answer = numberAnswer(value);
    mis.push({ id: 'above-mean-plus-sd-as-34', wrong: numberAnswer(wrongV) });
  } else {
    const pool = [new Q(5, 2), new Q(27, 2), new Q(16), new Q(34), new Q(95, 2), new Q(50), new Q(68), new Q(84), new Q(95), new Q(195, 2)];
    const set: Q[] = [value];
    if (!set.some((q) => q.eq(wrongV))) set.push(wrongV);
    for (const q of rng.shuffle(pool)) {
      if (set.length >= 5) break;
      if (!set.some((s) => s.eq(q))) set.push(q);
    }
    const sorted = set.sort(orderBy);
    const options: ChoiceOption[] = sorted.map((q, i) => ({ id: `o${i}`, label: pctLabel(q) }));
    const idOf = (q: Q) => options[sorted.findIndex((s) => s.eq(q))].id;
    answer = choiceAnswer(options, idOf(value));
    mis.push({ id: 'above-mean-plus-sd-as-34', wrong: choiceAnswer(options, idOf(wrongV)) });
  }
  return {
    params: { mean, sd, z, above: above ? 1 : 0, fmt },
    prompt,
    answer,
    steps: [
      { key: 'to-z-scores', instruction: `${cut} is ${Math.abs(z)} SD${Math.abs(z) > 1 ? 's' : ''} ${z > 0 ? 'above' : 'below'} the mean.`, math: `\\frac{${cut} - ${mean}}{${sd}} = ${z}`, why: 'Convert the cutoff to SDs from the mean first.', ask: { prompt: 'How many SDs from the mean is the cutoff? (negative if below)', answer: numberAnswer(z), verify: { type: 'evaluate', expr: `(${cut}-${mean})/${sd}` } } },
      { key: 'tail-area', instruction: `Use symmetry: 50% lies on each side of the mean, and the slice between the mean and the cutoff is ${CDF[z].sub(50).abs().toLatex()}%.`, math: above ? (z > 0 ? `50 - ${wrongV.toLatex()} = ${value.toLatex()}` : `50 + ${wrongV.toLatex()} = ${value.toLatex()}`) : z < 0 ? `50 - ${wrongV.toLatex()} = ${value.toLatex()}` : `50 + ${wrongV.toLatex()} = ${value.toLatex()}`, why: 'The tail is what is left of the half (50%) after removing the slice between the mean and the cutoff, or that half plus the slice if the cutoff is on the other side.', ask: { prompt: 'What percent?', answer, ...(fmt === 0 ? { verify: { type: 'evaluate' as const, expr: value.toString() } } : {}) } },
    ],
    misconceptions: distinctMisconceptions(answer, mis),
    verify: fmt === 0 ? { type: 'evaluate', expr: value.toString() } : { type: 'choice', note: 'tests/skills/gre-normal-distribution.test.ts recomputes the tail percent from z' },
  };
}

// ---------- level 4: QC comparing two distributions by z-scores ----------

function level4(rng: Rng): Body {
  for (;;) {
    const form = (rng.chance(0.1) ? 2 : rng.int(0, 1));
    const above = rng.chance(0.5);
    const m1 = rng.int(50, 100);
    const s1 = rng.int(2, 20);
    const m2 = rng.int(50, 100);
    let s2 = rng.int(2, 20);
    let x1: number;
    let x2: number;
    let smin = 0;
    let smax = 0;
    let z1: Q;
    let relation: QcRelation;
    // Quantity "percent above": larger z → smaller percent. "below": larger z → larger percent.
    const fromZ = (zA: Q, zB: Q): QcRelation => {
      const c = zA.sub(zB).sign();
      if (c === 0) return 'c';
      return (above ? c < 0 : c > 0) ? 'a' : 'b';
    };
    if (form === 0) {
      const z = rng.pick([-2, -1, 1, 2]);
      if (m1 === m2 && s1 === s2) continue;
      x1 = m1 + z * s1;
      x2 = m2 + z * s2;
      z1 = new Q(z);
      relation = 'c';
    } else if (form === 1) {
      x1 = m1 + rng.int(-2 * s1, 2 * s1);
      x2 = m2 + rng.int(-2 * s2, 2 * s2);
      z1 = new Q(x1 - m1, s1);
      const z2 = new Q(x2 - m2, s2);
      if (z1.eq(z2)) continue;
      relation = fromZ(z1, z2);
    } else {
      const d2 = rng.nonzero(-30, 30);
      if (Math.abs(d2) < 5) continue;
      x2 = m2 + d2;
      x1 = m1 + rng.int(-2 * s1, 2 * s1);
      smin = rng.int(3, 8);
      smax = smin + rng.int(4, 10);
      s2 = 0;
      z1 = new Q(x1 - m1, s1);
      const e1 = new Q(d2, smax);
      const e2 = new Q(d2, smin);
      const lo = orderBy(e1, e2) < 0 ? e1 : e2;
      const hi = orderBy(e1, e2) < 0 ? e2 : e1;
      if (orderBy(z1, lo) < 0) relation = fromZ(z1, lo);
      else if (orderBy(z1, hi) > 0) relation = fromZ(z1, hi);
      else relation = 'd';
    }
    const answer = qcAnswer(relation);
    const rawRel: QcRelation = x1 === x2 ? 'c' : (above ? x1 < x2 : x1 > x2) ? 'a' : 'b';
    const dirWord = above ? 'above' : 'below';
    const sdText2 = form === 2 ? `a standard deviation $s$ satisfying $${smin} \\le s \\le ${smax}$` : `a standard deviation of ${s2}`;
    const setup = `Test 1 scores are approximately normally distributed with a mean of ${m1} and a standard deviation of ${s1}. Test 2 scores are approximately normally distributed with a mean of ${m2} and ${sdText2}.`;
    // Forms 0-1 have no variables, so the harness evaluates the true normal CDF once (erf). Form 2 is
    // sampled 4000 times, so it uses the monotone equivalent (percent above falls as z rises; percent
    // below rises with z) to keep the harness fast. The skill test uses the erf CDF for all forms.
    const pct = (z: string) => (form === 2 ? (above ? `-(${z})` : `(${z})`) : above ? `(1 - erf((${z})/sqrt(2)))/2` : `(1 + erf((${z})/sqrt(2)))/2`);
    const z1Expr = `(${x1}-${m1})/${s1}`;
    const z2Expr = form === 2 ? `(${x2}-${m2})/s` : `(${x2}-${m2})/${s2}`;
    const zBStep = form === 2 ? new Q(x2 - m2, smax) : new Q(x2 - m2, s2);
    return {
      params: { form, above: above ? 1 : 0, m1, s1, x1, m2, s2, x2, smin, smax },
      prompt: QC_PROMPT(setup, `The percent of Test 1 scores ${dirWord} ${x1}`, `The percent of Test 2 scores ${dirWord} ${x2}`),
      answer,
      steps: [
        { key: 'z-score-a', instruction: 'Convert each cutoff to SDs from its own mean. Raw cutoffs cannot be compared across different distributions.', math: `z_A = \\frac{${x1} - ${m1}}{${s1}} = ${z1.toLatex()}`, why: 'The percent above or below a cutoff depends only on its z-score.', ask: { prompt: 'What is the z-score of the cutoff in Test 1?', answer: numberAnswer(z1), verify: { type: 'evaluate', expr: z1Expr } } },
        { key: 'z-score-b', instruction: form === 2 ? 'For Test 2 the SD is unknown, so the z-score is a range. Its extreme value uses the largest SD.' : 'Do the same for Test 2.', math: form === 2 ? `z_B = \\frac{${x2 - m2}}{s},\\quad s \\le ${smax} \\Rightarrow ${x2 - m2 > 0 ? 'z_B \\ge' : 'z_B \\le'}\\, ${zBStep.toLatex()}` : `z_B = \\frac{${x2} - ${m2}}{${s2}} = ${zBStep.toLatex()}`, why: 'A larger z-score puts the cutoff farther out, so a smaller percent lies above it.', ask: { prompt: form === 2 ? 'What is the z-score of the Test 2 cutoff if s takes its largest value?' : 'What is the z-score of the cutoff in Test 2?', answer: numberAnswer(zBStep), verify: { type: 'evaluate', expr: form === 2 ? `(${x2}-${m2})/${smax}` : `(${x2}-${m2})/${s2}` } } },
        { key: 'decide', instruction: relation === 'd' ? 'The z-score of Test 2 can fall on either side of Test 1\'s, so it cannot be determined.' : relation === 'c' ? 'Equal z-scores mean equal percents.' : 'Compare the z-scores: the cutoff with the smaller z-score (for "above") leaves the larger percent.', math: `z_A = ${z1.toLatex()}`, why: 'Compare z-scores, never raw scores.', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'compared-raw-scores', wrong: qcAnswer(rawRel) }]),
      verify: {
        type: 'qc',
        quantityA: pct(z1Expr),
        quantityB: pct(z2Expr),
        variables: form === 2 ? [{ name: 's', min: smin, max: smax }] : [],
        constraints: [],
      },
    };
  }
}

// ---------- level 5: quartiles and percent below, from a list ----------

const medOf = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const posMid = (xs: number[]): number => {
  // the "middle" taken by position WITHOUT sorting (the mistake)
  const h = xs.length >> 1;
  return xs.length % 2 ? xs[h] : (xs[h - 1] + xs[h]) / 2;
};
const halves = (xs: number[]): [number[], number[]] => {
  const h = xs.length >> 1;
  return [xs.slice(0, h), xs.slice(xs.length - h)];
};
const expr = (xs: number[]) => (xs.length % 2 ? `${xs[xs.length >> 1]}` : `(${xs[xs.length / 2 - 1]}+${xs[xs.length / 2]})/2`);

function level5(rng: Rng): Body {
  const form = rng.int(0, 3);
  const n = form === 3 ? rng.pick([8, 10]) : rng.int(8, 12);
  const vals: number[] = [];
  while (vals.length < n) {
    const v = rng.int(10, 99);
    if (!vals.includes(v)) vals.push(v);
  }
  const s = [...vals].sort((a, b) => a - b);
  const [lowS, highS] = halves(s);
  const [lowU, highU] = halves(vals);
  const q1 = medOf(lowS);
  const q3 = medOf(highS);
  const x = s[rng.int(1, n - 2)];
  const convention = 'Use this convention: sort the list; the median splits it into a lower half and an upper half (when the list has an odd number of values, the median itself belongs to neither half). Q1 is the median of the lower half and Q3 is the median of the upper half.';
  const list = vals.join(', ');
  const padded = [...vals, ...Array(12 - n).fill(0)];
  const params: Record<string, number> = { form, n, x: form === 3 ? x : 0, ...Object.fromEntries(padded.map((v, i) => [`v${i}`, v])) };
  let answerV: Q, wrongV: number, prompt: string, vexpr: string, steps: Body['steps'];
  if (form <= 2) {
    const name = ['the first quartile (Q1)', 'the third quartile (Q3)', 'the interquartile range (Q3 − Q1)'][form];
    const trueV = [q1, q3, q3 - q1][form];
    answerV = new Q(Math.round(trueV * 2), 2);
    wrongV = [posMid(lowU), posMid(highU), posMid(highU) - posMid(lowU)][form];
    vexpr = [expr(lowS), expr(highS), `${expr(highS)}-(${expr(lowS)})`][form];
    prompt = `The scores of ${n} students are ${list}. What is ${name}? ${convention}`;
    const answer = numberAnswer(answerV);
    steps = [
      { key: 'sort-list', instruction: 'Sort the list first.', math: s.join(',\\; '), why: 'Quartiles, like the median, only make sense on the sorted list.', ask: { prompt: 'How many scores are in each half?', answer: numberAnswer(n >> 1), verify: { type: 'evaluate', expr: `floor(${n}/2)` } } },
      { key: 'median-of-half', instruction: form === 0 ? `Q1 is the median of the lower half: ${lowS.join(', ')}.` : form === 1 ? `Q3 is the median of the upper half: ${highS.join(', ')}.` : `Q1 = ${q1} (lower half ${lowS.join(', ')}), Q3 = ${q3} (upper half ${highS.join(', ')}).`, math: form === 0 ? `Q_1 = ${q1}` : form === 1 ? `Q_3 = ${q3}` : `Q_3 - Q_1 = ${q3} - ${q1} = ${trueV}`, why: 'Each quartile is just a median of a half.', ask: { prompt: `What is ${name}?`, answer, verify: { type: 'evaluate', expr: vexpr } } },
    ];
  } else {
    const below = s.filter((v) => v < x).length;
    answerV = new Q(100 * below, n);
    wrongV = NaN;
    vexpr = `100*${below}/${n}`;
    prompt = `The scores of ${n} students are ${list}. A score of ${x} is higher than what percent of the ${n} scores? (Enter the percent as a number.)`;
    steps = [
      { key: 'sort-list', instruction: 'Sort the list and count how many scores are below the given one.', math: s.join(',\\; '), why: 'A percentile rank counts the scores strictly below, out of the whole group.', ask: { prompt: `How many scores are less than ${x}?`, answer: numberAnswer(below), verify: { type: 'evaluate', expr: `${below}` } } },
      { key: 'percent-below', instruction: `Divide by ${n} and convert to a percent.`, math: `\\frac{${below}}{${n}} \\times 100 = ${answerV.toLatex()}\\%`, why: 'Percent below = count below ÷ total × 100.', ask: { prompt: 'What percent?', answer: numberAnswer(answerV), verify: { type: 'evaluate', expr: vexpr } } },
    ];
  }
  const answer = numberAnswer(answerV);
  return {
    params,
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [Number.isNaN(wrongV) ? null : wrongNumber('quartile-unsorted', () => new Q(Math.round(wrongV * 2), 2))]),
    verify: { type: 'evaluate', expr: vexpr },
  };
}

export const greNormalDistribution: SkillDefinition = {
  id: ID,
  title: 'Normal distribution & percentiles',
  track: 'gre',
  unit: 'GRE · Data analysis',
  description: 'The 68-95-99.7 rule, z-scores, tail percents, comparing distributions, and quartiles.',
  prerequisites: ['gre-descriptive-stats'],
  maxDenominator: 2,
  levels: {
    1: { description: 'Percent between whole-SD points (68-95-99.7)', ranges: { mean: [40, 100], sd: [2, 15], a: [-2, 1], b: [-1, 2] } },
    2: { description: 'Values and z-scores; within 1 SD (select all)', ranges: { form: [0, 2], mean: [40, 100], sd: [2, 15], k2: [-6, 6], x0: [0, 160], x1: [0, 160], x2: [0, 160], x3: [0, 160], x4: [0, 160] } },
    3: { description: 'Tail percents (numeric or multiple choice)', ranges: { mean: [40, 100], sd: [2, 15], z: [-2, 2], above: [0, 1], fmt: [0, 1] } },
    4: { description: 'Compare two distributions by z-scores (QC)', ranges: { form: [0, 2], above: [0, 1], m1: [50, 100], s1: [2, 20], x1: [0, 160], m2: [50, 100], s2: [0, 20], x2: [0, 160], smin: [0, 8], smax: [0, 18] } },
    5: { description: 'Quartiles and percent below, from a list', ranges: { form: [0, 3], n: [8, 12], x: [0, 99], v0: [0, 99], v1: [0, 99], v2: [0, 99], v3: [0, 99], v4: [0, 99], v5: [0, 99], v6: [0, 99], v7: [0, 99], v8: [0, 99], v9: [0, 99], v10: [0, 99], v11: [0, 99] } },
  },
  misconceptions: {
    'rule-half-forgotten': { name: 'Forgot that the rule is symmetric: gave the two-sided percent', explanation: '68% covers BOTH sides (mean ± 1 SD). From the mean to +1 SD is half of that, 34%; likewise 95% becomes 47.5% for one side.' },
    'above-mean-plus-sd-as-34': { name: 'Gave the slice from the mean instead of the tail', explanation: 'The 34% is the slice BETWEEN the mean and +1 SD. "Above +1 SD" is the tail: 50 − 34 = 16%. Below −1 SD is also 16%; above −1 SD is 50 + 34 = 84%.' },
    'compared-raw-scores': { name: 'Compared raw cutoffs instead of z-scores', explanation: 'Different distributions have different means and SDs, so raw scores cannot be compared. Convert each cutoff to a z-score; the larger z-score has the smaller percent above it.' },
    'within-two-for-one': { name: 'Counted scores within 2 SD as within 1 SD', explanation: 'Within 1 SD means |score − mean| < SD. Compute the band mean ± SD first and test each score against its endpoints.' },
    'quartile-unsorted': { name: 'Took the middle of the unsorted list', explanation: 'Sort the list first. Q1 and Q3 are medians of the sorted lower and upper halves; reading positions off the original order gives nonsense.' },
  },
  stepLabels: {
    'to-z-scores': 'Convert to SDs from the mean',
    'add-pieces': 'Add the standard slices',
    'sd-distance': 'Find the distance in score units',
    'add-subtract': 'Add or subtract from the mean',
    deviation: 'Score minus mean',
    'divide-sd': 'Divide by the SD',
    band: 'Find the band mean ± SD',
    'test-each': 'Test each score',
    'tail-area': 'Use symmetry for the tail',
    'z-score-a': 'z-score of Test 1',
    'z-score-b': 'z-score of Test 2',
    decide: 'Decide the relationship',
    'sort-list': 'Sort the list',
    'median-of-half': 'Median of the half',
    'percent-below': 'Percent below',
  },
  learn: {
    whyItMatters:
      'The GRE expects you to know the 68-95-99.7 rule and to use symmetry: about 34% of values lie between the mean and +1 SD, 13.5% between +1 and +2 SD, and 2.5% beyond. No tables are needed. In econometrics the same curve sits behind confidence intervals and t-tests: "significant at the 5% level" means a result more than about 2 standard errors from zero, which would happen by chance only about 5% of the time (2 × 2.5%).',
    summary:
      'A z-score is (value − mean) ÷ SD. For a normal distribution about 68% of values lie within 1 SD of the mean, 95% within 2 SD and 99.7% within 3 SD. By symmetry each half of the curve holds 50%: 34% from the mean to +1 SD, 13.5% from +1 to +2 SD and 2.5% beyond +2 SD. To compare two distributions, compare z-scores. Quartiles are medians of the sorted lower and upper halves.',
    formulas: [
      { latex: 'z = \\frac{x - \\mu}{\\sigma}' },
      { latex: '2.5\\% + 13.5\\% + 34\\% = 50\\%', note: 'One half of the curve, from the far tail to the mean.' },
    ],
    example: { seed: 6, level: 3 },
    tips: ['Draw the bell, mark the mean and the ±1, ±2 SD lines, and write 34, 13.5, 2.5 in the slices.', 'Different mean and SD? Convert to z-scores before comparing.'],
  },

  generate(rng, level: Level) {
    switch (level) {
      case 1:
        return level1(rng);
      case 2:
        return level2(rng);
      case 3:
        return level3(rng);
      case 4:
        return level4(rng);
      case 5:
        return level5(rng);
    }
  },
};
