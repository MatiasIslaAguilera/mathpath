// Sequences & geometric series (math). Number answers, plus two multiple-choice finals (L2 "arithmetic,
// geometric or neither" and L4 "does it converge?"). Sums are verified term by term, and infinite sums
// as the `limit` of the n-term partial sum as n -> oo, never by the closed form the steps teach.

import { choiceAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  ChoiceOption,
  InterpretationQuestion,
  MisconceptionInstance,
  SkillDefinition,
  Step,
  VerifySpec,
} from '../../engine/types';

const ID = 'geometric-series';
type Body = ReturnType<SkillDefinition['generate']>;

// ---------- helpers ----------

/** base^e for an integer exponent e (exact). */
function powQ(base: Q, e: number): Q {
  let out = q(1);
  for (let i = 0; i < Math.abs(e); i++) out = out.mul(base);
  return e >= 0 ? out : q(1).div(out);
}

const one = q(1);
/** a(1 - r^n)/(1 - r), the sum of n terms (r != 1). */
const sumGeo = (a: Q, r: Q, n: number): Q => a.mul(one.sub(powQ(r, n))).div(one.sub(r));
/** n/2 (2a + (n-1)d). */
const sumArith = (a: Q, d: Q, n: number): Q => q(n, 2).mul(a.mul(2).add(d.mul(n - 1)));
const geoTerms = (a: Q, r: Q, n: number): Q[] => Array.from({ length: n }, (_, k) => a.mul(powQ(r, k)));
const arithTerms = (a: Q, d: Q, n: number): Q[] => Array.from({ length: n }, (_, k) => a.add(d.mul(k)));

const listLatex = (ts: Q[]) => ts.map((t) => t.toLatex()).join(', ');
/** "5 - 10 + 20" with signs folded into the operators. */
const sumLatex = (ts: Q[]) =>
  ts.map((t, i) => (i === 0 ? t.toLatex() : t.n < 0 ? ` - ${t.abs().toLatex()}` : ` + ${t.toLatex()}`)).join('');
/** First three terms, then "..." and the last term (or all terms when there are at most three). */
function seriesLatex(ts: Q[]): string {
  if (ts.length <= 3) return sumLatex(ts);
  const last = ts[ts.length - 1];
  return `${sumLatex(ts.slice(0, 3))} + \\cdots ${last.n < 0 ? '-' : '+'} ${last.abs().toLatex()}`;
}
const infiniteLatex = (ts: Q[]) => `${sumLatex(ts.slice(0, 3))} + \\cdots`;

/** Term-by-term expression a*r^0 + a*r^1 + ... (a statement of the sum, not its closed form). */
const geoSumExpr = (a: Q, r: Q, n: number) =>
  Array.from({ length: n }, (_, k) => `${a.toExpr()}*${r.toExpr()}^${k}`).join(' + ');
const arithSumExpr = (a: Q, d: Q, n: number) =>
  Array.from({ length: n }, (_, k) => `(${a.toExpr()} + ${k}*${d.toExpr()})`).join(' + ');
/** The n-term partial sum with numbers in; its limit as n -> oo is the infinite sum. */
const partialSumExpr = (a: Q, r: Q) =>
  // A negative ratio is written (1 - 2 mod(n, 2)) |r|^n: SymPy cannot take a limit of (-1/2)^n for a symbolic n.
  `${a.toExpr()}*(1-${r.n < 0 ? `(1-2*mod(n,2))*${r.abs().toExpr()}^n` : `${r.toExpr()}^n`})/(1-${r.toExpr()})`;
const limitVerify = (a: Q, r: Q): VerifySpec => ({ type: 'limit', expr: partialSumExpr(a, r), variable: 'n', point: 'oo' });

function mk(rng: Rng, rows: { label: string; ok: boolean }[]) {
  const sh = rng.shuffle(rows.map((r, i) => ({ id: `o${i}`, label: r.label, ok: r.ok })));
  const options = sh.map(({ id, label }): ChoiceOption => ({ id, label }));
  return { options, correct: sh.find((o) => o.ok)!.id, idOf: (label: string) => sh.find((o) => o.label === label)!.id };
}

const num = (id: string, v: Q | number): MisconceptionInstance | null => wrongNumber(id, () => v);

/** "Yes, |r| < 1" check used before applying the infinite-sum formula. */
function convergeAnswer(rng: Rng): AnswerSpec {
  const c = mk(rng, [
    { label: 'Yes: $|r| < 1$, so the terms shrink fast enough and the sum settles', ok: true },
    { label: 'No: $|r| \\ge 1$, so the sum grows without bound', ok: false },
    { label: 'Yes, but only if the first term is small enough', ok: false },
  ]);
  return choiceAnswer(c.options, c.correct);
}

const GEO_RATIOS: [number, number][] = [[2, 1], [3, 1], [-2, 1], [1, 2], [1, 3]];

// ---------- Level 1: the n-th term ----------

function level1(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 1);
    if (form === 0) {
      const a = rng.int(1, 40);
      const d = rng.nonzero(-6, 6);
      const n = rng.int(4, 12);
      const ans = q(a + (n - 1) * d);
      const answer = numberAnswer(ans);
      const ts = arithTerms(q(a), q(d), 3);
      const expr = [`${a}`, ...Array.from({ length: n - 1 }, () => `(${d})`)].join('+');
      return {
        params: { form, a, d, rn: 0, rd: 0, n },
        prompt: `An arithmetic sequence begins $${listLatex(ts)}, \\ldots$ Find $a_{${n}}$, the ${n}th term.`,
        answer,
        steps: [
          {
            key: 'identify',
            instruction: 'Read off the first term and the common difference (each term minus the one before).',
            math: `a = ${a}, \\quad d = ${a + d} - ${a < 0 ? `(${a})` : a} = ${d}`,
            why: 'In an arithmetic sequence every step adds the same number $d$.',
            ask: { prompt: 'What is the common difference $d$?', answer: numberAnswer(d), verify: { type: 'evaluate', expr: `(${a + d})-(${a})` } },
          },
          {
            key: 'term',
            instruction: `Start at $a = ${a}$ and add $d$ a total of ${n - 1} times.`,
            math: `a_{${n}} = a + (${n}-1)d = ${a} + ${n - 1}\\cdot(${d}) = ${ans.toLatex()}`,
            why: 'The $n$th term has taken $n-1$ steps from the first: $a_n = a + (n-1)d$.',
            ask: { prompt: `What is $a_{${n}}$?`, answer, verify: { type: 'evaluate', expr } },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [num('exponent-n', a + n * d)]),
        verify: { type: 'evaluate', expr },
      };
    }
    const [rn, rd] = rng.pick(GEO_RATIOS);
    const n = rng.int(4, 7);
    const e = rng.int(2, Math.min(n - 1, 4));
    const c = rng.int(1, 4);
    const a = rd === 1 ? rng.int(1, 9) : c * rd ** e;
    const r = q(rn, rd);
    const ans = powQ(r, n - 1).mul(a);
    if (ans.d > 64) continue;
    const answer = numberAnswer(ans);
    const ts = geoTerms(q(a), r, 3);
    const expr = [`${a}`, ...Array.from({ length: n - 1 }, () => r.toExpr())].join('*');
    return {
      params: { form, a, d: 0, rn, rd, n },
      prompt: `A geometric sequence begins $${listLatex(ts)}, \\ldots$ Find $a_{${n}}$, the ${n}th term.`,
      answer,
      steps: [
        {
          key: 'identify',
          instruction: 'Read off the first term and the common ratio (each term divided by the one before).',
          math: `a = ${a}, \\quad r = \\frac{${ts[1].toLatex()}}{${a}} = ${r.toLatex()}`,
          why: 'In a geometric sequence every step multiplies by the same number $r$.',
          ask: { prompt: 'What is the common ratio $r$?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})/(${a})` } },
        },
        {
          key: 'term',
          instruction: `Start at $a = ${a}$ and multiply by $r$ a total of ${n - 1} times.`,
          math: `a_{${n}} = a\\,r^{${n}-1} = ${a}\\cdot\\left(${r.toLatex()}\\right)^{${n - 1}} = ${ans.toLatex()}`,
          why: 'The $n$th term has taken $n-1$ steps from the first, so the exponent is $n-1$: $a_n = a\\,r^{n-1}$.',
          ask: { prompt: `What is $a_{${n}}$?`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('exponent-n', powQ(r, n).mul(a)), num('arithmetic-for-geometric', q(a).add(r.mul(n - 1)))]),
      verify: { type: 'evaluate', expr },
    };
  }
}

// ---------- Level 2: the ratio, the type, a missing term ----------

const RATIO_ROOTS: [number, number][] = [[2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]];

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  const zero = { form, k: 0, gap: 0, rn: 0, rd: 0, c: 0, kind: 0, base: 0, a: 0, d: 0, e: 0, p: 0, s: 0 };

  if (form === 0) {
    const gap = rng.pick([2, 3]);
    const [rn, rd] = rng.pick(RATIO_ROOTS);
    const k = rng.int(1, 3);
    const c = rng.int(1, 5);
    const r = q(rn, rd);
    const tk = c * rd ** gap;
    const tm = c * rn ** gap;
    const m = k + gap;
    const answer = numberAnswer(r);
    const ratioPower = q(tm, tk);
    const rootEq = `r^${gap} = ${ratioPower.toExpr()}`;
    return {
      params: { ...zero, k, gap, rn, rd, c },
      prompt: `In a geometric sequence, $a_{${k}} = ${tk}$ and $a_{${m}} = ${tm}$.${gap === 2 ? ' The common ratio is positive.' : ''} Find the common ratio $r$.`,
      answer,
      steps: [
        {
          key: 'ratio-power',
          instruction: `Divide the later term by the earlier one. Going from term ${k} to term ${m} multiplies by $r$ exactly ${gap} times.`,
          math: `\\frac{a_{${m}}}{a_{${k}}} = r^{${m}-${k}} = r^{${gap}}, \\qquad r^{${gap}} = \\frac{${tm}}{${tk}} = ${ratioPower.toLatex()}`,
          why: 'Each step multiplies by $r$, so $a_m = a_k\\,r^{m-k}$.',
          ask: { prompt: `What is $r^{${gap}}$?`, answer: numberAnswer(ratioPower), verify: { type: 'evaluate', expr: `${tm}/${tk}` } },
        },
        {
          key: 'root',
          instruction: `Take the ${gap === 2 ? 'square' : 'cube'} root: the ratio is a number whose ${gap === 2 ? 'square' : 'cube'} is $${ratioPower.toLatex()}$.`,
          math: `r = \\sqrt${gap === 2 ? '' : '[3]'}{${ratioPower.toLatex()}} = ${r.toLatex()}`,
          why: `The gap of ${gap} terms is an exponent, so undo it with a root, not a division.`,
          ask: { prompt: 'What is $r$?', answer, verify: { type: 'solve', equations: [rootEq], unknowns: ['r'], positive: true } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('ratio-not-root', ratioPower.div(gap))]),
      verify: { type: 'solve', equations: [rootEq], unknowns: ['r'], positive: true },
    };
  }

  if (form === 1) {
    // Arithmetic, geometric, or neither (the first four terms decide).
    for (;;) {
      const kind = rng.int(0, 2);
      const base = kind === 2 ? rng.int(0, 1) : kind;
      const e = kind === 2 ? rng.nonzero(-2, 2) : 0;
      let a: number;
      let d = 0;
      let rn = 0;
      let rd = 0;
      let ts: Q[];
      if (base === 0) {
        a = rng.int(1, 40);
        d = rng.nonzero(-6, 6);
        ts = arithTerms(q(a), q(d), 4);
      } else {
        [rn, rd] = rng.pick([[2, 1], [3, 1], [-2, 1], [1, 2], [3, 2], [4, 1]] as [number, number][]);
        a = rd === 1 ? rng.int(1, 9) : rng.int(1, 3) * rd ** 3;
        ts = geoTerms(q(a), q(rn, rd), 4);
      }
      if (e) ts = [...ts.slice(0, 3), ts[3].add(e)];
      if (ts.some((t) => t.isZero())) continue;
      const isArith = ts[1].sub(ts[0]).eq(ts[2].sub(ts[1])) && ts[2].sub(ts[1]).eq(ts[3].sub(ts[2]));
      const isGeom = ts[1].mul(ts[1]).eq(ts[0].mul(ts[2])) && ts[2].mul(ts[2]).eq(ts[1].mul(ts[3]));
      const actual = isArith ? 0 : isGeom ? 1 : 2;
      if (actual !== kind) continue;
      const c = mk(rng, [
        { label: 'Arithmetic', ok: kind === 0 },
        { label: 'Geometric', ok: kind === 1 },
        { label: 'Neither', ok: kind === 2 },
      ]);
      const answer = choiceAnswer(c.options, c.correct);
      const diff = ts[1].sub(ts[0]);
      const verdict = ['arithmetic: the differences are all equal', 'geometric: the ratios are all equal', 'neither: the differences and the ratios both change'][kind];
      return {
        params: { ...zero, kind, base, a, d, rn, rd, e },
        prompt: `Look at the first four terms of the sequence $${listLatex(ts)}, \\ldots$ Is it arithmetic, geometric, or neither?`,
        answer,
        steps: [
          {
            key: 'identify',
            instruction: 'Find the first difference, $a_2 - a_1$. Then check whether the next differences match it, and whether the ratios $a_2/a_1$, $a_3/a_2$ match each other.',
            math: `a_2 - a_1 = ${diff.toLatex()}, \\quad a_3 - a_2 = ${ts[2].sub(ts[1]).toLatex()}, \\quad a_4 - a_3 = ${ts[3].sub(ts[2]).toLatex()}`,
            why: 'Arithmetic means a constant difference; geometric means a constant ratio.',
            ask: { prompt: 'What is $a_2 - a_1$?', answer: numberAnswer(diff), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})-(${ts[0].toExpr()})` } },
          },
          {
            key: 'classify',
            instruction: 'Compare the differences and the ratios across all four terms.',
            math: `\\text{The sequence is ${verdict}.}`,
            why: 'One matching pair is not enough: all consecutive pairs must agree.',
            ask: { prompt: 'Which kind of sequence is it?', answer },
          },
        ],
        misconceptions: [],
        verify: { type: 'choice', note: 'arithmetic (constant difference), geometric (constant ratio) or neither, from the first four terms' },
      };
    }
  }

  // Form 2: the middle term of a positive geometric sequence (the geometric mean).
  for (;;) {
    const p = rng.int(1, 4);
    const s = rng.int(1, 4);
    const c = rng.int(1, 4);
    if (p === s || gcd(p, s) !== 1) continue;
    const x = c * s * s;
    const mid = c * s * p;
    const z = c * p * p;
    const answer = numberAnswer(mid);
    const prod = x * z;
    const eq = `u^2 = ${x}*${z}`;
    return {
      params: { ...zero, c, p, s },
      prompt: `The numbers $${x}$, $?$, $${z}$ are three consecutive terms of a positive geometric sequence. Find the middle term.`,
      answer,
      steps: [
        {
          key: 'geo-mean',
          instruction: 'In a geometric sequence the middle term $m$ satisfies $\\frac{m}{x} = \\frac{z}{m}$, so $m^2 = x\\,z$. Multiply the outer terms.',
          math: `m^2 = ${x}\\cdot ${z} = ${prod}`,
          why: 'Both ratios equal $r$: $m = xr$ and $z = mr$, so $m^2 = xz$.',
          ask: { prompt: `What is $${x}\\cdot ${z}$?`, answer: numberAnswer(prod), verify: { type: 'evaluate', expr: `${x}*${z}` } },
        },
        {
          key: 'root',
          instruction: 'The sequence is positive, so take the positive square root.',
          math: `m = \\sqrt{${prod}} = ${mid}`,
          why: 'The middle term is the geometric mean of its neighbours.',
          ask: { prompt: 'What is the middle term?', answer, verify: { type: 'solve', equations: [eq], unknowns: ['u'], positive: true } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('average-not-geometric', q(x + z, 2))]),
      verify: { type: 'solve', equations: [eq], unknowns: ['u'], positive: true },
    };
  }
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

// ---------- Level 3: finite sums ----------

const SUM_RATIOS: [number, number][] = [[2, 1], [3, 1], [-2, 1], [1, 2], [1, 3], [3, 2]];

function level3(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 1);
    if (form === 0) {
      const [rn, rd] = rng.pick(SUM_RATIOS);
      const n = rng.int(3, 6);
      const c = rng.int(1, 4);
      const a = rd === 1 ? rng.int(1, 9) : c * rd ** rng.int(1, n - 1);
      const r = q(rn, rd);
      const S = sumGeo(q(a), r, n);
      if (S.d > 64) continue;
      const ts = geoTerms(q(a), r, n);
      const last = ts[n - 1];
      const answer = numberAnswer(S);
      const expr = geoSumExpr(q(a), r, n);
      const rl = r.toLatex();
      return {
        params: { form, a, d: 0, rn, rd, n },
        prompt: `Find the sum $$${seriesLatex(ts)}$$`,
        answer,
        steps: [
          {
            key: 'identify',
            instruction: 'Find the first term and the common ratio.',
            math: `a = ${a}, \\quad r = \\frac{${ts[1].toLatex()}}{${a}} = ${rl}`,
            why: 'The sum formula needs $a$ and $r$.',
            ask: { prompt: 'What is the common ratio $r$?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})/(${a})` } },
          },
          {
            key: 'count-terms',
            instruction: 'Count the terms: the last term is $a\\,r^{n-1}$, so solve for $n$.',
            math: `${a}\\cdot\\left(${rl}\\right)^{n-1} = ${last.toLatex()} \\;\\Rightarrow\\; n = ${n}`,
            why: 'The exponent in the formula is the number of terms, so count carefully: the first term has exponent 0.',
            ask: {
              prompt: 'How many terms are in the sum?',
              answer: numberAnswer(n),
              verify: { type: 'solve', equations: [`${a}*${r.abs().toExpr()}^(u-1) = ${last.abs().toExpr()}`], unknowns: ['u'] }, // magnitudes: a negative ratio has complex roots for u
            },
          },
          {
            key: 'sum-formula',
            instruction: 'Apply the finite geometric sum formula.',
            math: `S_{${n}} = a\\,\\frac{1-r^{n}}{1-r} = ${a}\\cdot\\frac{1-\\left(${rl}\\right)^{${n}}}{1-${r.n < 0 ? `(${rl})` : rl}} = ${S.toLatex()}`,
            why: '$S_n = a\\,\\frac{1-r^n}{1-r}$, valid for $r \\ne 1$.',
            ask: { prompt: 'What is the sum?', answer, verify: { type: 'evaluate', expr } },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [
          num('exponent-n', sumGeo(q(a), r, n + 1)),
          num('arithmetic-for-geometric', sumArith(q(a), r, n)),
          num('sum-sign-flip', S.neg()),
          num('last-term-as-sum', last),
        ]),
        verify: { type: 'evaluate', expr },
      };
    }
    const a = rng.int(1, 20);
    const d = rng.nonzero(-4, 8);
    const n = rng.int(5, 12);
    const ts = arithTerms(q(a), q(d), n);
    const last = ts[n - 1];
    const S = sumArith(q(a), q(d), n);
    const answer = numberAnswer(S);
    const expr = arithSumExpr(q(a), q(d), n);
    return {
      params: { form, a, d, rn: 0, rd: 0, n },
      prompt: `Find the sum $$${seriesLatex(ts)}$$`,
      answer,
      steps: [
        {
          key: 'identify',
          instruction: 'Find the first term and the common difference.',
          math: `a = ${a}, \\quad d = ${ts[1].toLatex()} - ${a} = ${d}`,
          why: 'The sum formula needs $a$ and $d$.',
          ask: { prompt: 'What is the common difference $d$?', answer: numberAnswer(d), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})-(${a})` } },
        },
        {
          key: 'count-terms',
          instruction: 'Count the terms: the last term is $a + (n-1)d$, so solve for $n$.',
          math: `${a} + (n-1)(${d}) = ${last.toLatex()} \\;\\Rightarrow\\; n = ${n}`,
          why: 'The first term is step 0, so there is one more term than there are steps.',
          ask: {
            prompt: 'How many terms are in the sum?',
            answer: numberAnswer(n),
            verify: { type: 'solve', equations: [`${a} + (u-1)*(${d}) = ${last.toExpr()}`], unknowns: ['u'] },
          },
        },
        {
          key: 'sum-formula',
          instruction: 'Apply the arithmetic sum formula: the average of the first and last term, times the number of terms.',
          math: `S_{${n}} = \\frac{n}{2}\\left(2a + (n-1)d\\right) = \\frac{${n}}{2}\\left(${2 * a} + ${n - 1}\\cdot(${d})\\right) = ${S.toLatex()}`,
          why: '$S_n = \\frac{n}{2}(2a + (n-1)d) = n\\cdot\\frac{a + a_n}{2}$.',
          ask: { prompt: 'What is the sum?', answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('exponent-n', sumArith(q(a), q(d), n + 1)), num('last-term-as-sum', last)]),
      verify: { type: 'evaluate', expr },
    };
  }
}

// ---------- Level 4: infinite sums ----------

const INF_RATIOS: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [-1, 2]];
const CONV_RATIOS: [number, number][] = [[1, 2], [-1, 2], [2, 3], [-3, 4], [2, 1], [3, 1], [-2, 1], [1, 1], [-1, 1], [3, 2], [-3, 2], [4, 3]];

function level4(rng: Rng): Body {
  const form = rng.int(0, 2);
  const zero = { form, a: 0, rn: 0, rd: 0, val: 0, len: 0 };

  if (form === 0) {
    const [rn, rd] = rng.pick(INF_RATIOS);
    const r = q(rn, rd);
    const c = rng.int(1, 6);
    const a = c * one.sub(r).n;
    const S = q(a).div(one.sub(r));
    const answer = numberAnswer(S);
    const ts = geoTerms(q(a), r, 3);
    const rl = r.toLatex();
    return {
      params: { ...zero, a, rn, rd },
      prompt: `Find the sum of the infinite series $$${infiniteLatex(ts)}$$`,
      answer,
      steps: [
        {
          key: 'identify',
          instruction: 'Find the first term and the common ratio.',
          math: `a = ${a}, \\quad r = \\frac{${ts[1].toLatex()}}{${a}} = ${rl}`,
          why: 'Both go into the formula.',
          ask: { prompt: 'What is the common ratio $r$?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})/(${a})` } },
        },
        {
          key: 'converge',
          instruction: `Check $|r| < 1$ before using the formula: $|${rl}| < 1$.`,
          math: `|r| = ${r.abs().toLatex()} < 1`,
          why: 'An infinite geometric series only has a sum when the terms shrink toward 0.',
          ask: { prompt: 'Does the sum exist (is $|r| < 1$)?', answer: convergeAnswer(rng) },
        },
        {
          key: 'sum-formula',
          instruction: 'Apply the infinite sum formula.',
          math: `S = \\frac{a}{1-r} = \\frac{${a}}{1-${r.n < 0 ? `(${rl})` : rl}} = ${S.toLatex()}`,
          why: 'As $n \\to \\infty$, $r^n \\to 0$, so $a\\frac{1-r^n}{1-r} \\to \\frac{a}{1-r}$.',
          ask: { prompt: 'What is the sum?', answer, verify: limitVerify(q(a), r) },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('infinite-a-over-r', q(a).div(r))]),
      verify: limitVerify(q(a), r),
    };
  }

  if (form === 1) {
    const [rn, rd] = rng.pick(CONV_RATIOS);
    const r = q(rn, rd);
    const a = rd === 1 ? rng.int(1, 9) : rng.int(1, 3) * rd * rd;
    const conv = r.abs().valueOf() < 1;
    const V = r.eq(1) ? q(a) : q(a).div(one.sub(r));
    const c = mk(rng, [
      { label: `Converges to $${V.toLatex()}$`, ok: conv },
      { label: 'Diverges', ok: !conv },
      { label: 'Converges to $0$', ok: false },
    ]);
    const answer = choiceAnswer(c.options, c.correct);
    const ts = geoTerms(q(a), r, 3);
    const rl = r.toLatex();
    return {
      params: { ...zero, a, rn, rd },
      prompt: `Does the series $$${infiniteLatex(ts)}$$ converge? If it does, to what?`,
      answer,
      steps: [
        {
          key: 'identify',
          instruction: 'Find the common ratio.',
          math: `r = \\frac{${ts[1].toLatex()}}{${a}} = ${rl}`,
          why: 'Convergence depends only on $r$.',
          ask: { prompt: 'What is the common ratio $r$?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `(${ts[1].toExpr()})/(${a})` } },
        },
        {
          key: 'converge',
          instruction: conv ? `$|r| = ${r.abs().toLatex()} < 1$, so the series converges to $\\frac{a}{1-r}$.` : `$|r| = ${r.abs().toLatex()} \\ge 1$, so the terms do not shrink to 0 and the series diverges.`,
          math: conv ? `S = \\frac{${a}}{1-${r.n < 0 ? `(${rl})` : rl}} = ${V.toLatex()}` : `|r| \\ge 1 \\;\\Rightarrow\\; \\text{diverges}`,
          why: 'It converges exactly when $|r| < 1$. A negative ratio is fine: the terms alternate in sign but still shrink.',
          ask: { prompt: 'Does it converge, and to what?', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        conv && r.n < 0 ? { id: 'diverges-negative', wrong: choiceAnswer(c.options, c.idOf('Diverges')) } : null,
      ]),
      verify: { type: 'choice', note: 'converges to a/(1-r) when |r| < 1, otherwise diverges (r = 1 and r = -1 included)' },
    };
  }

  // Form 2: a repeating decimal as a fraction.
  for (;;) {
    const len = rng.int(1, 2);
    const val = len === 1 ? rng.int(1, 8) : rng.int(1, 98);
    const den = 10 ** len;
    const S = q(val, den - 1);
    if (S.d > 64) continue;
    const digits = String(val).padStart(len, '0');
    const answer = numberAnswer(S);
    const a = q(val, den);
    const r = q(1, den);
    return {
      params: { ...zero, val, len },
      prompt: `Write the repeating decimal $0.\\overline{${digits}}$ as a fraction in lowest terms.`,
      answer,
      steps: [
        {
          key: 'as-series',
          instruction: `Split the decimal into repeating blocks: $0.\\overline{${digits}} = \\frac{${val}}{${den}} + \\frac{${val}}{${den * den}} + \\cdots$ This is a geometric series with first term $\\frac{${val}}{${den}}$.`,
          math: `a = \\frac{${val}}{${den}}, \\qquad r = \\frac{1}{${den}}`,
          why: `Each repeat sits ${len} decimal place${len > 1 ? 's' : ''} further right, so each block is $\\frac{1}{${den}}$ of the one before.`,
          ask: { prompt: 'What is the common ratio $r$?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `1/${den}` } },
        },
        {
          key: 'sum-formula',
          instruction: 'Sum the series with $\\frac{a}{1-r}$, then reduce.',
          math: `S = \\frac{${val}/${den}}{1-1/${den}} = \\frac{${val}}{${den - 1}} = ${S.toLatex()}`,
          why: `The denominator is ${den - 1}, one less than ${den}: that is why repeating decimals have nines in the denominator.`,
          ask: { prompt: 'What is the fraction in lowest terms?', answer, verify: limitVerify(a, r) },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('repeating-over-ten', q(val, den))]),
      verify: limitVerify(a, r),
    };
  }
}

// ---------- Level 5: multiplier and declining-sales shapes ----------

const MPCS: [number, number][] = [[1, 2], [3, 5], [2, 3], [3, 4], [4, 5], [9, 10]];
const DECLINES: [number, number][] = [[10, 10], [20, 5], [25, 4], [50, 2]]; // [p percent, 1/(p/100)]

function mpcInterpretation(rng: Rng, G: number, b: Q, finite: boolean): InterpretationQuestion[] | undefined {
  if (!rng.chance(0.5)) return undefined;
  const mult = one.div(one.sub(b));
  const rounds = geoTerms(q(G), b, 3).map((t) => t.toLatex()).join(', ');
  const why = mk(rng, [
    { label: `Each round is only the fraction $${b.toLatex()}$ of the one before, so the rounds shrink fast enough that their sum settles at $\\frac{G}{1-b}$`, ok: true },
    { label: 'The government stops spending after a while', ok: false },
    { label: 'The rounds are all the same size, so they cancel out', ok: false },
    { label: 'Only the first round counts; later rounds add nothing', ok: false },
  ]);
  const rise = rng.chance(0.5);
  const b2 = rise ? one.add(b).div(2) : b.div(2);
  const mult2 = one.div(one.sub(b2));
  const dir = mk(rng, [
    { label: 'The multiplier rises', ok: rise },
    { label: 'The multiplier falls', ok: !rise },
    { label: 'The multiplier stays the same', ok: false },
    { label: 'It depends only on how large $G$ is', ok: false },
  ]);
  return [
    {
      prompt: finite
        ? `If the re-spending went on forever, the total would approach $\\frac{G}{1-b} = ${mult.mul(G).toLatex()}$ rather than growing without bound. Why?`
        : 'Spending goes round and round forever, yet the total is a finite number. Why?',
      options: why.options,
      correct: why.correct,
      explanation: `The rounds are $${rounds}$, and so on. Each is $${b.toLatex()}$ times the last, so they shrink geometrically (for $|b| < 1$) and the sum is $\\frac{G}{1-b} = ${mult.mul(G).toLatex()}$. If the rounds did not shrink, the total would have no limit.`,
    },
    {
      prompt: `Suppose the MPC changes from $b = ${b.toLatex()}$ to $b' = ${b2.toLatex()}$. The multiplier $\\frac{1}{1-b}$ would...`,
      options: dir.options,
      correct: dir.correct,
      explanation: `The multiplier is $\\frac{1}{1-${b.toLatex()}} = ${mult.toLatex()}$ before and $\\frac{1}{1-${b2.toLatex()}} = ${mult2.toLatex()}$ after, so it ${rise ? 'rises' : 'falls'}: the more of each dollar that is passed on, the more rounds matter.`,
    },
  ];
}

function level5(rng: Rng): Body {
  const form = rng.int(0, 2);
  const zero = { form, G: 0, bn: 0, bd: 0, n: 0, p: 0, ever: 0 };

  if (form === 0 || form === 1) {
    const [bn, bd] = rng.pick(MPCS);
    const b = q(bn, bd);
    const d = bd; // 1/b has denominator d; (1-b) = (d-bn)/d
    let n = 0;
    let G: number;
    if (form === 0) {
      G = 10 * rng.int(1, 20);
    } else {
      const maxN = d === 2 ? 5 : d === 3 ? 4 : d === 10 ? 2 : 3;
      n = rng.int(2, maxN);
      G = rng.int(1, 8) * d ** n;
    }
    const bl = b.toLatex();
    const base = `The government spends \\$${G} million on a project. Everyone who receives money spends $${bl}$ of it, and the people they pay spend $${bl}$ of what they receive, and so on.`;
    if (form === 0) {
      const total = q(G).div(one.sub(b));
      const answer = numberAnswer(total);
      const ts = geoTerms(q(G), b, 3);
      return {
        params: { ...zero, G, bn, bd },
        prompt: `${base} Find the total spending generated, counting the original \\$${G} million and every round after it.`,
        answer,
        steps: [
          {
            key: 'identify',
            instruction: 'The rounds are $G, Gb, Gb^2, \\ldots$ so the first term is $G$ and the ratio is $b$ (the share spent again).',
            math: `${listLatex(ts)}, \\ldots \\quad a = ${G},\\; r = ${bl}`,
            why: 'Each round is the previous round times the fraction re-spent.',
            ask: { prompt: 'What is the common ratio?', answer: numberAnswer(b), verify: { type: 'evaluate', expr: `(${G}*${b.toExpr()})/${G}` } },
          },
          {
            key: 'converge',
            instruction: `Check $|r| = ${bl} < 1$ before using the infinite formula.`,
            math: `|r| = ${bl} < 1`,
            why: 'The rounds must shrink for a total to exist.',
            ask: { prompt: 'Does the total exist (is $|r| < 1$)?', answer: convergeAnswer(rng) },
          },
          {
            key: 'sum-formula',
            instruction: 'Apply $\\frac{G}{1-b}$ (millions of dollars).',
            math: `\\frac{${G}}{1-${bl}} = \\frac{${G}}{${one.sub(b).toLatex()}} = ${total.toLatex()}`,
            why: 'Total $= G(1 + b + b^2 + \\cdots) = \\frac{G}{1-b}$: the multiplier is $\\frac{1}{1-b}$.',
            ask: { prompt: 'What is the total, in millions of dollars?', answer, verify: limitVerify(q(G), b) },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [num('infinite-a-over-r', q(G).div(b)), num('multiplier-b-only', b.mul(G).div(one.sub(b)))]),
        interpretation: mpcInterpretation(rng, G, b, false),
        verify: limitVerify(q(G), b),
      };
    }
    // Form 1: the original spending plus n-1 further rounds.
    const m = n - 1;
    const total = sumGeo(q(G), b, n);
    const answer = numberAnswer(total);
    const last = q(G).mul(powQ(b, n - 1));
    const expr = geoSumExpr(q(G), b, n);
    return {
      params: { ...zero, G, bn, bd, n },
      prompt: `${base} After the original spending, the money is passed on for ${m} more round${m > 1 ? 's' : ''} and then stops. Find the total spending, counting the original \\$${G} million.`,
      answer,
      steps: [
        {
          key: 'identify',
          instruction: 'The rounds are $G, Gb, Gb^2, \\ldots$ so the first term is $G$ and the ratio is $b$.',
          math: `a = ${G}, \\quad r = ${bl}`,
          why: 'Each round is the previous round times the fraction re-spent.',
          ask: { prompt: 'What is the common ratio?', answer: numberAnswer(b), verify: { type: 'evaluate', expr: `(${G}*${b.toExpr()})/${G}` } },
        },
        {
          key: 'count-terms',
          instruction: `Count the terms: the original round plus ${m} more.`,
          math: `1 + ${m} = ${n}`,
          why: 'The original spending is a round too: it is the first term.',
          ask: { prompt: 'How many rounds are added up in total?', answer: numberAnswer(n), verify: { type: 'evaluate', expr: `1 + ${m}` } },
        },
        {
          key: 'sum-formula',
          instruction: 'Apply the finite sum formula (millions of dollars).',
          math: `S_{${n}} = G\\,\\frac{1-b^{${n}}}{1-b} = ${G}\\cdot\\frac{1-\\left(${bl}\\right)^{${n}}}{1-${bl}} = ${total.toLatex()}`,
          why: '$S_n = a\\,\\frac{1-r^n}{1-r}$ with $a = G$ and $r = b$.',
          ask: { prompt: 'What is the total, in millions of dollars?', answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('last-term-as-sum', last), num('multiplier-b-only', total.sub(G))]),
      interpretation: mpcInterpretation(rng, G, b, true),
      verify: { type: 'evaluate', expr },
    };
  }

  // Form 2: declining monthly sales.
  const [p, dd] = rng.pick(DECLINES);
  const ever = rng.chance(0.5) ? 1 : 0;
  const r = q(100 - p, 100);
  let n = 0;
  let a: number;
  if (ever) {
    a = 20 * rng.int(1, 25);
  } else {
    n = rng.int(2, 4);
    a = rng.int(1, 3) * dd ** (n - 1);
  }
  const ts = geoTerms(q(a), r, 3);
  const rl = r.toLatex();
  const base = `A product sells ${a} units in month 1, and sales then fall by ${p}% each month from the month before.`;
  const identify: Step = {
    key: 'identify',
    instruction: `A fall of ${p}% means each month is ${100 - p}% of the month before: the ratio is $1 - \\frac{${p}}{100}$.`,
    math: `${listLatex(ts)}, \\ldots \\quad a = ${a},\\; r = ${rl}`,
    why: 'Falling by $p\\%$ multiplies by $1 - p/100$, not by $p/100$.',
    ask: { prompt: 'What is the common ratio?', answer: numberAnswer(r), verify: { type: 'evaluate', expr: `1 - ${p}/100` } },
  };
  if (ever) {
    const S = q(a).div(one.sub(r));
    const answer = numberAnswer(S);
    return {
      params: { ...zero, G: a, bn: r.n, bd: r.d, p, ever },
      prompt: `${base} Find the total number of units sold over all months, ever.`,
      answer,
      steps: [
        identify,
        {
          key: 'converge',
          instruction: `Check $|r| = ${rl} < 1$ before using the infinite formula.`,
          math: `|r| = ${rl} < 1`,
          why: 'Sales shrink every month, so the total is finite.',
          ask: { prompt: 'Does the total exist (is $|r| < 1$)?', answer: convergeAnswer(rng) },
        },
        {
          key: 'sum-formula',
          instruction: 'Apply $\\frac{a}{1-r}$.',
          math: `\\frac{${a}}{1-${rl}} = \\frac{${a}}{${one.sub(r).toLatex()}} = ${S.toLatex()}`,
          why: '$a + ar + ar^2 + \\cdots = \\frac{a}{1-r}$ when $|r| < 1$.',
          ask: { prompt: 'What is the total, in units?', answer, verify: limitVerify(q(a), r) },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [num('infinite-a-over-r', q(a).div(r))]),
      interpretation: rng.chance(0.5) ? declineInterpretation(rng, p, dd) : undefined,
      verify: limitVerify(q(a), r),
    };
  }
  const S = sumGeo(q(a), r, n);
  const answer = numberAnswer(S);
  const last = q(a).mul(powQ(r, n - 1));
  const expr = geoSumExpr(q(a), r, n);
  return {
    params: { ...zero, G: a, bn: r.n, bd: r.d, n, p },
    prompt: `${base} Find the total number of units sold over the first ${n} months.`,
    answer,
    steps: [
      identify,
      {
        key: 'count-terms',
        instruction: 'Count the terms: one per month.',
        math: `n = ${n}`,
        why: 'Month 1 is the first term, so $n$ months means $n$ terms.',
        ask: { prompt: 'How many terms are added?', answer: numberAnswer(n), verify: { type: 'evaluate', expr: `${n}` } },
      },
      {
        key: 'sum-formula',
        instruction: 'Apply the finite sum formula.',
        math: `S_{${n}} = ${a}\\cdot\\frac{1-\\left(${rl}\\right)^{${n}}}{1-${rl}} = ${S.toLatex()}`,
        why: '$S_n = a\\,\\frac{1-r^n}{1-r}$.',
        ask: { prompt: 'What is the total, in units?', answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [num('last-term-as-sum', last)]),
    verify: { type: 'evaluate', expr },
  };
}

function declineInterpretation(rng: Rng, p: number, d: number): InterpretationQuestion[] {
  const c = mk(rng, [
    { label: `$${d}$`, ok: true },
    { label: `$${d - 1}$`, ok: false },
    { label: `$${d + 1}$`, ok: false },
    { label: `$${100 - p}$`, ok: false },
  ]);
  return [
    {
      prompt: `Sales fall ${p}% a month. The total sold over all months is about how many times month-1 sales?`,
      options: c.options,
      correct: c.correct,
      explanation: `The total is $\\frac{a}{1-r}$ with $1 - r = \\frac{${p}}{100}$, so it is $a$ times $\\frac{1}{${p}/100} = ${d}$. This is the multiplier $\\frac{1}{1-b}$ with $b = 1 - \\frac{${p}}{100}$.`,
    },
  ];
}

// ---------- definition ----------

export const geometricSeries: SkillDefinition = {
  id: ID,
  title: 'Sequences & geometric series',
  track: 'math',
  unit: 'Sequences & series',
  description: 'The n-th term, finite and infinite geometric sums, repeating decimals, and the spending multiplier.',
  prerequisites: ['exponent-rules'],
  maxDenominator: 64,
  levels: {
    1: {
      description: 'The n-th term of an arithmetic or geometric sequence',
      ranges: { form: [0, 1], a: [1, 324], d: [-6, 6], rn: [-2, 3], rd: [0, 3], n: [4, 12] },
    },
    2: {
      description: 'Find the ratio, name the type, find a missing term',
      ranges: {
        form: [0, 2], k: [0, 3], gap: [0, 3], rn: [-3, 4], rd: [0, 3], c: [0, 5], kind: [0, 2], base: [0, 1],
        a: [0, 81], d: [-6, 6], e: [-2, 2], p: [0, 4], s: [0, 4],
      },
    },
    3: {
      description: 'Finite sums, geometric and arithmetic',
      ranges: { form: [0, 1], a: [1, 1000], d: [-4, 8], rn: [-2, 3], rd: [0, 3], n: [3, 12] },
    },
    4: {
      description: 'Infinite sums, convergence and repeating decimals',
      ranges: { form: [0, 2], a: [0, 48], rn: [-3, 4], rd: [0, 5], val: [0, 98], len: [0, 2] },
    },
    5: {
      description: 'The spending multiplier and declining sales',
      ranges: { form: [0, 2], G: [0, 3000], bn: [0, 9], bd: [0, 10], n: [0, 5], p: [0, 50], ever: [0, 1] },
    },
  },
  misconceptions: {
    'exponent-n': {
      name: 'Off by one: counted n steps instead of n - 1',
      explanation:
        'The first term is step 0, so the $n$th term has taken $n-1$ steps: $a_n = a\\,r^{n-1}$ (or $a + (n-1)d$), not $r^n$. In a sum, $n$ terms means the formula uses $r^n$, so count the terms first. Check with $n = 1$: $a_1$ should be just $a$.',
    },
    'arithmetic-for-geometric': {
      name: 'Added the ratio instead of multiplying',
      explanation:
        'In a geometric sequence each step multiplies by $r$; it does not add $r$. From $3, 6, 12$ the next term is $12 \\cdot 2 = 24$, not $12 + 2$. Use powers of $r$ ($r^{n-1}$), and the geometric sum formula, not the arithmetic ones.',
    },
    'ratio-not-root': {
      name: 'Divided the gap into the ratio instead of taking the root',
      explanation:
        'Going $g$ terms further multiplies by $r$ a total of $g$ times, so $\\frac{a_m}{a_k} = r^{g}$. To undo a power take a root: if $r^3 = 8$ then $r = \\sqrt[3]{8} = 2$, not $8 \\div 3$.',
    },
    'average-not-geometric': {
      name: 'Averaged the neighbours instead of taking the geometric mean',
      explanation:
        'The middle term of a geometric sequence is the *geometric* mean, $\\sqrt{xz}$, not the average $\\frac{x+z}{2}$. Between $4$ and $9$ the middle term is $6$ (ratio $\\frac32$), while the average is $6.5$.',
    },
    'sum-sign-flip': {
      name: 'Flipped the signs in the sum formula',
      explanation:
        'The formula is $a\\frac{1-r^n}{1-r}$ (or the equivalent $a\\frac{r^n-1}{r-1}$). Mixing one of each, $\\frac{1-r^n}{r-1}$, gives the negative of the sum. For $r > 1$ the sum is bigger than $a$, so a negative answer is a red flag.',
    },
    'last-term-as-sum': {
      name: 'Gave the last term, not the sum',
      explanation:
        'You found $a\\,r^{n-1}$, the last term. The question asks for the total of all the terms. Run the sum formula; the total is always at least as big as the largest term when all the terms are positive.',
    },
    'infinite-a-over-r': {
      name: 'Divided by r instead of 1 - r',
      explanation:
        'The infinite sum is $\\frac{a}{1-r}$. The denominator is *one minus the ratio*, not the ratio. For $8 + 4 + 2 + \\cdots$, $r = \\frac12$ and the sum is $\\frac{8}{1/2} = 16$. Sanity check: the sum must be at least the first two terms added.',
    },
    'diverges-negative': {
      name: 'Called a sum with a negative ratio divergent',
      explanation:
        'Only the size of $r$ matters: the series converges when $|r| < 1$. With $r = -\\frac12$ the terms alternate in sign ($8, -4, 2, \\ldots$) but they still shrink to 0, and the sum is $\\frac{a}{1-r}$. It diverges when $|r| \\ge 1$ (including $r = -1$).',
    },
    'repeating-over-ten': {
      name: 'Put the repeating digits over 10 (or 100) instead of 9 (or 99)',
      explanation:
        'A repeating block of $k$ digits sums to $\\frac{\\text{block}}{10^k - 1}$: nines, not a power of ten. $0.\\overline{36} = \\frac{36}{99} = \\frac{4}{11}$. Check by dividing: $4 \\div 11 = 0.3636\\ldots$',
    },
    'multiplier-b-only': {
      name: 'Left out the first round',
      explanation:
        '$\\frac{bG}{1-b}$ adds only the *re-spending*. The government\'s own $G$ is a round too, and the first term. The total including it is $G + \\frac{bG}{1-b} = \\frac{G}{1-b}$.',
    },
  },
  stepLabels: {
    identify: 'Find the first term and the ratio (or difference)',
    term: 'Apply the n-th term formula',
    'ratio-power': 'Divide the terms: the ratio is raised to the gap',
    root: 'Take the root',
    'geo-mean': 'Multiply the neighbours: the middle squared',
    classify: 'Compare differences and ratios',
    'count-terms': 'Count the terms',
    'sum-formula': 'Apply the sum formula',
    converge: 'Check |r| < 1',
    'as-series': 'Write the decimal as a geometric series',
  },
  learn: {
    whyItMatters:
      'A government spends \\$100. People spend 3/4 of each dollar they receive, so the rounds of spending are 100, 75, 56.25, and so on, and the total is $\\frac{100}{1 - 3/4} = 400$ dollars: a multiplier of 4. The same geometric sum prices a stream of payments (an annuity) and, with infinitely many terms, a perpetuity, so it sits under every present-value formula you will meet.',
    summary:
      'A geometric sequence multiplies by the same ratio $r$ each step: $a_n = a\\,r^{n-1}$. An arithmetic one adds the same difference. The first $n$ terms of a geometric sequence sum to $a\\frac{1-r^n}{1-r}$. If $|r| < 1$ the terms shrink and the infinite sum is $\\frac{a}{1-r}$; otherwise it diverges.',
    formulas: [
      { latex: 'a_n = a + (n-1)d, \\qquad a_n = a\\,r^{n-1}', note: 'Arithmetic and geometric $n$th terms.' },
      { latex: 'S_n = a\\,\\frac{1-r^n}{1-r} \\quad (r \\ne 1)', note: 'Sum of the first $n$ terms of a geometric sequence.' },
      { latex: 'S_n = \\frac{n}{2}\\left(2a + (n-1)d\\right)', note: 'Arithmetic sum.' },
      { latex: 'S_\\infty = \\frac{a}{1-r} \\quad (|r| < 1)', note: 'Infinite geometric sum.' },
      { latex: '0.\\overline{36} = \\frac{36}{99}', note: 'A repeating block over nines.' },
    ],
    example: { seed: 5, level: 3 },
    tips: [
      'Count the terms before using a sum formula: the first term has exponent 0, so $n$ terms means $r^n$ in the formula.',
      'Check the answer by adding the first few terms: an infinite sum must be bigger than any partial sum.',
    ],
  },

  generate(rng, level) {
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
