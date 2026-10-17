// REFERENCE SKILL (math, expression answer). Shows: expression answers, per-term steps,
// a "rewrite first" step for roots/fractions, and expression-valued misconceptions.

import { expressionAnswer, numberAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { InterpretationQuestion, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'derivatives-power-rule';

type Form = 'power' | 'over' | 'root' | 'overroot';

interface Term {
  c: Q;
  n: Q;
  /** How the term is written in the problem; the math is always c·x^n. */
  form: Form;
}

// ---------- display helpers ----------

/** c·x^n in power form: "3x^{4}", "-x", "\frac{1}{2}x^{-\frac{1}{2}}", "7". */
function powerLatex(c: Q, n: Q): string {
  if (n.isZero()) return c.toLatex();
  const xPart = n.eq(1) ? 'x' : `x^{${n.toLatex()}}`;
  return `${coefLatex(c)}${xPart}`;
}

function rootLatex(p: number, r: number): string {
  const inner = p === 1 ? 'x' : `x^{${p}}`;
  return r === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${r}]{${inner}}`;
}

/** The term as it appears in the problem. Negative terms start with "-" (for joinTerms). */
function termLatex(t: Term): string {
  const sign = t.c.sign() < 0 ? '-' : '';
  const a = t.c.abs();
  switch (t.form) {
    case 'power':
      return powerLatex(t.c, t.n);
    case 'over': {
      const k = t.n.neg();
      return `${sign}\\frac{${a.toLatex()}}{${k.eq(1) ? 'x' : `x^{${k.toLatex()}}`}}`;
    }
    case 'root':
      return `${sign}${coefLatex(a)}${rootLatex(t.n.n, t.n.d)}`;
    case 'overroot':
      return `${sign}\\frac{${a.toLatex()}}{${rootLatex(-t.n.n, t.n.d)}}`;
  }
}

const polyLatex = (terms: Term[]) => joinTerms(terms.map(termLatex));

// ---------- expression helpers (mathjs / SymPy syntax) ----------

const termExpr = (c: Q, n: Q) => (n.isZero() ? c.toExpr() : `${c.toExpr()}*x^(${n.toString()})`);
const sumExpr = (parts: string[]) => (parts.length ? parts.join(' + ') : '0');

const deriv = (t: Term) => ({ c: t.c.mul(t.n), n: t.n.sub(1) });

/** Power-form terms → LaTeX, dropping zeros. */
function powerSumLatex(terms: { c: Q; n: Q }[]): string {
  return joinTerms(terms.filter((t) => !t.c.isZero()).map((t) => powerLatex(t.c, t.n)));
}
function powerSumExpr(terms: { c: Q; n: Q }[]): string {
  return sumExpr(terms.filter((t) => !t.c.isZero()).map((t) => termExpr(t.c, t.n)));
}

// ---------- parameter selection ----------

const ROOTS: [number, number][] = [
  [1, 2],
  [3, 2],
  [1, 3],
  [2, 3],
  [5, 2],
  [4, 3],
];

function pick(rng: Rng, level: Level): { params: Record<string, number>; terms: Term[] } {
  switch (level) {
    case 1: {
      const c1 = rng.nonzero(-9, 9);
      const n1 = rng.int(2, 7);
      return { params: { c1, n1 }, terms: [{ c: q(c1), n: q(n1), form: 'power' }] };
    }
    case 2: {
      const c1 = rng.nonzero(-9, 9);
      const n1 = rng.int(3, 6);
      const c2 = rng.nonzero(-9, 9);
      const n2 = rng.int(1, 2);
      const c3 = rng.nonzero(-12, 12);
      return {
        params: { c1, n1, c2, n2, c3 },
        terms: [
          { c: q(c1), n: q(n1), form: 'power' },
          { c: q(c2), n: q(n2), form: 'power' },
          { c: q(c3), n: q(0), form: 'power' },
        ],
      };
    }
    case 3: {
      const c1 = rng.nonzero(-9, 9);
      const n1 = rng.int(2, 5);
      const c2 = rng.nonzero(-9, 9);
      const k2 = rng.int(1, 4);
      const c3 = rng.nonzero(-12, 12);
      return {
        params: { c1, n1, c2, k2, c3 },
        terms: rng.shuffle<Term>([
          { c: q(c1), n: q(n1), form: 'power' },
          { c: q(c2), n: q(-k2), form: 'power' },
        ]).concat([{ c: q(c3), n: q(0), form: 'power' }]),
      };
    }
    case 4: {
      const c1 = rng.nonzero(-9, 9);
      const n1 = rng.int(2, 5);
      const c2 = rng.nonzero(-9, 9);
      const k2 = rng.int(1, 4);
      const m3 = rng.nonzero(-5, 5);
      return {
        params: { c1, n1, c2, k2, m3 },
        terms: rng.shuffle<Term>([
          { c: q(c1), n: q(n1), form: 'power' },
          { c: q(c2), n: q(-k2), form: 'over' },
          { c: q(2 * m3), n: q(1, 2), form: 'root' },
        ]),
      };
    }
    case 5: {
      const [p1, r1] = rng.pick(ROOTS);
      const [p2, r2] = rng.pick(ROOTS);
      const m1 = rng.nonzero(-4, 4);
      const m2 = rng.nonzero(-4, 4);
      const c3 = rng.nonzero(-9, 9);
      const n3 = rng.int(2, 4);
      // coefficient = r·m so that c·n is an integer
      return {
        params: { m1, p1, r1, m2, p2, r2, c3, n3 },
        terms: rng.shuffle<Term>([
          { c: q(r1 * m1), n: q(p1, r1), form: 'root' },
          { c: q(r2 * m2), n: q(-p2, r2), form: 'overroot' },
          { c: q(c3), n: q(n3), form: 'power' },
        ]),
      };
    }
  }
}

// ---------- interpretation: what the derivative MEANS (PLAN §2.3, applied to math) ----------

function choice(rng: Rng, correct: string, wrong: string[]) {
  const options = rng.shuffle([correct, ...wrong].map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

/** f'(x0) evaluated exactly from the derivative's power-form terms. */
function derivAt(derivs: { c: Q; n: Q }[], x0: number): Q {
  return derivs.reduce((sum, t) => {
    if (t.c.isZero()) return sum;
    if (x0 === 1) return sum.add(t.c);
    const k = t.n.valueOf(); // integer here: x0 = 2 is only used at levels 1–3
    return sum.add(t.c.mul(k >= 0 ? q(x0 ** k) : q(1, x0 ** -k)));
  }, q(0));
}

function interpretationFor(rng: Rng, level: Level, derivs: { c: Q; n: Q }[]): InterpretationQuestion {
  const x0 = level <= 3 ? rng.pick([1, 2]) : 1;
  const v = derivAt(derivs, x0);
  const vl = v.toLatex();
  const abs = v.abs().toLatex();
  const sign = v.sign();
  if (rng.chance(0.5)) {
    const { options, correct } = choice(
      rng,
      sign > 0 ? 'Increasing' : sign < 0 ? 'Decreasing' : 'Neither: it is flat there',
      ['Increasing', 'Decreasing', 'Neither: it is flat there'].filter((o) => o !== (sign > 0 ? 'Increasing' : sign < 0 ? 'Decreasing' : 'Neither: it is flat there')),
    );
    return {
      prompt: `Using your answer, $f'(${x0}) = ${vl}$. At $x = ${x0}$, is $f$ increasing or decreasing?`,
      options,
      correct,
      explanation: `The sign of the derivative gives the direction: positive slope means increasing, negative means decreasing, zero means flat (a possible peak or valley). In economics, if $f$ were profit, ${sign > 0 ? 'a positive derivative would say "produce more"' : sign < 0 ? 'a negative derivative would say "produce less"' : 'a zero derivative would mean "you may already be at the best output"'}.`,
    };
  }
  const meaning =
    sign === 0
      ? `At output $${x0}$, profit is flat: a small change in output barely changes it`
      : `At output $${x0}$, producing a bit more ${sign > 0 ? '*raises*' : '*lowers*'} profit by about $${abs}$ dollars per extra unit`;
  const wrong =
    sign === 0
      ? [`Profit at output $${x0}$ is $0$ dollars`, 'Producing more always raises profit', "Profit doesn't depend on output at all"]
      : [
          `At output $${x0}$, producing a bit more ${sign > 0 ? '*lowers*' : '*raises*'} profit by about $${abs}$ dollars per extra unit`,
          `Profit at output $${x0}$ is $${vl}$ dollars`,
          `Profit has changed by $${vl}$ dollars in total since output was $0$`,
        ];
  const { options, correct } = choice(rng, meaning, wrong);
  return {
    prompt: `Suppose $f(x)$ is a firm's profit in dollars when it produces $x$ units. Using your answer, $f'(${x0}) = ${vl}$. What does that tell you?`,
    options,
    correct,
    explanation: `$f'(x)$ is a *rate*: dollars of profit per extra unit of output, which economists call *marginal profit*. $f'(${x0}) = ${vl}$ is the slope at $x = ${x0}$, not the profit itself (that would be $f(${x0})$). It's exact only for a tiny change; for one whole extra unit it's an approximation.`,
  };
}

export const derivativesPowerRule: SkillDefinition = {
  id: ID,
  title: 'Derivatives: power rule',
  track: 'math',
  unit: 'Derivatives',
  description: 'Differentiate sums of powers of x, including roots and 1/xⁿ.',
  prerequisites: ['limits', 'exponent-rules'],
  maxDenominator: 1,
  levels: {
    1: { description: 'One term: cxⁿ', ranges: { c1: [-9, 9], n1: [2, 7] } },
    2: {
      description: 'Polynomials',
      ranges: { c1: [-9, 9], n1: [3, 6], c2: [-9, 9], n2: [1, 2], c3: [-12, 12] },
    },
    3: {
      description: 'Negative exponents',
      ranges: { c1: [-9, 9], n1: [2, 5], c2: [-9, 9], k2: [1, 4], c3: [-12, 12] },
    },
    4: {
      description: 'Rewrite 1/xⁿ and √x first',
      ranges: { c1: [-9, 9], n1: [2, 5], c2: [-9, 9], k2: [1, 4], m3: [-5, 5] },
    },
    5: {
      description: 'Roots and fractional exponents',
      ranges: { m1: [-4, 4], p1: [1, 5], r1: [2, 3], m2: [-4, 4], p2: [1, 5], r2: [2, 3], c3: [-9, 9], n3: [2, 4] },
    },
  },
  misconceptions: {
    'forgot-multiply': {
      name: 'Forgot to bring down the exponent',
      explanation:
        'The power rule has two parts: multiply by the exponent, then subtract 1 from it. $\\frac{d}{dx}x^n = n\\,x^{n-1}$, so $\\frac{d}{dx}5x^3 = 15x^2$, not $5x^2$.',
    },
    'forgot-reduce': {
      name: "Didn't lower the exponent",
      explanation:
        'After multiplying by the exponent, the exponent goes down by one: $\\frac{d}{dx}x^4 = 4x^3$. Keeping $x^4$ makes the slope grow as fast as the function itself, which is wrong.',
    },
    'negative-exponent-direction': {
      name: 'Moved a negative exponent toward zero',
      explanation:
        'Subtracting 1 from a negative exponent makes it *more* negative: $-3 - 1 = -4$. So $\\frac{d}{dx}x^{-3} = -3x^{-4}$, not $-3x^{-2}$.',
    },
    'constant-kept': {
      name: 'Kept the constant term',
      explanation:
        'A constant never changes, so its rate of change is 0. $\\frac{d}{dx}(x^2 + 7) = 2x$. The 7 disappears.',
    },
    'fraction-as-positive-power': {
      name: 'Treated 1/xⁿ as xⁿ',
      explanation:
        '$\\frac{1}{x^n}$ is $x^{-n}$, with a negative exponent. Rewrite it first: $\\frac{4}{x^2} = 4x^{-2}$, whose derivative is $-8x^{-3}$.',
    },
  },
  stepLabels: {
    'multiply-exponent': 'Bring down the exponent',
    'reduce-exponent': 'Lower the exponent by 1',
    'rewrite-powers': 'Rewrite roots and fractions as powers',
    'term-derivative': 'Differentiate one term',
    'constant-term': 'Derivative of a constant',
    combine: 'Combine the term derivatives',
  },
  learn: {
    whyItMatters:
      "A derivative is a rate of change. In economics, *marginal* just means derivative. If cost is $C(q) = 100 + 5q + 2q^2$, then marginal cost is $C'(q) = 5 + 4q$. At $q = 10$, $C'(10) = 45$, so the 11th unit costs about \\$45. The best output is where the derivative of profit is 0, the top of the hill. Profit maximization (MR = MC) and utility maximization in micro theory all rest on this.",
    summary:
      'The power rule turns $x^n$ into $n\\,x^{n-1}$: bring the exponent down as a multiplier, then lower it by one. It works for any exponent (negative, fractional) as long as the term is written as a power of $x$. Differentiate a sum term by term.',
    formulas: [
      { latex: '\\frac{d}{dx}\\,c\\,x^n = c\\,n\\,x^{n-1}', note: 'Power rule, with a constant multiplier $c$.' },
      { latex: '\\frac{d}{dx}\\,c = 0', note: 'Constants have zero slope.' },
      { latex: '\\frac{1}{x^n} = x^{-n}, \\quad \\sqrt[r]{x^p} = x^{p/r}', note: 'Rewrite roots and fractions as powers first.' },
    ],
    example: { seed: 11, level: 4 },
    tips: ['Write every term as $c\\,x^n$ before differentiating. Most mistakes happen in that rewrite, not in the power rule itself.'],
  },

  generate(rng, level) {
    const { params, terms } = pick(rng, level);
    const fLatex = polyLatex(terms);
    const fExpr = sumExpr(terms.map((t) => termExpr(t.c, t.n)));
    const derivs = terms.map(deriv);
    const answerLatex = powerSumLatex(derivs);
    const answerExpr = powerSumExpr(derivs);
    const steps: Step[] = [];

    if (level === 1) {
      const t = terms[0];
      const d = derivs[0];
      steps.push(
        {
          key: 'multiply-exponent',
          instruction: 'Bring the exponent down and multiply it by the coefficient.',
          math: `${t.c.toLatex()} \\cdot ${t.n.toLatex()} = ${d.c.toLatex()}`,
          why: 'Power rule, part 1: the exponent becomes a multiplier.',
          ask: {
            prompt: `What is $${t.c.toLatex()} \\times ${t.n.toLatex()}$?`,
            answer: numberAnswer(d.c),
            verify: { type: 'evaluate', expr: `${t.c.toExpr()}*${t.n.toExpr()}` },
          },
        },
        {
          key: 'reduce-exponent',
          instruction: 'Subtract 1 from the exponent.',
          math: `${t.n.toLatex()} - 1 = ${d.n.toLatex()}`,
          why: 'Power rule, part 2: the new exponent is one less than the old one.',
          ask: {
            prompt: `What is the new exponent, $${t.n.toLatex()} - 1$?`,
            answer: numberAnswer(d.n),
            verify: { type: 'evaluate', expr: `${t.n.toExpr()} - 1` },
          },
        },
      );
    } else {
      const rewritten = terms.filter((t) => t.form !== 'power');
      if (rewritten.length) {
        const first = rewritten[0];
        steps.push({
          key: 'rewrite-powers',
          instruction: 'Rewrite every term as a power of $x$.',
          math: `f(x) = ${powerSumLatex(terms)}`,
          why: '$\\frac{1}{x^n} = x^{-n}$ and $\\sqrt[r]{x^p} = x^{p/r}$. The power rule only applies to the form $c\\,x^n$.',
          ask: {
            prompt: `Write $${termLatex(first)}$ in the form $c\\,x^n$.`,
            answer: expressionAnswer(termExpr(first.c, first.n), powerLatex(first.c, first.n)),
            verify: { type: 'equivalent', expr: termExpr(first.c, first.n), variables: ['x'] },
          },
        });
      }
      terms.forEach((t, i) => {
        const d = derivs[i];
        const isConst = t.n.isZero();
        const shown = powerLatex(t.c, t.n);
        steps.push({
          key: isConst ? 'constant-term' : 'term-derivative',
          instruction: `Differentiate the term $${shown}$.`,
          math: isConst
            ? `\\frac{d}{dx}\\left(${shown}\\right) = 0`
            : `\\frac{d}{dx}\\left(${shown}\\right) = ${t.c.toLatex()}\\cdot ${t.n.sign() < 0 || !t.n.isInt() ? `\\left(${t.n.toLatex()}\\right)` : t.n.toLatex()}\\, x^{${t.n.toLatex()} - 1} = ${powerLatex(d.c, d.n)}`,
          why: isConst ? 'The derivative of a constant is 0.' : 'Power rule: $\\frac{d}{dx}\\,c\\,x^n = c\\,n\\,x^{n-1}$.',
          ask: {
            prompt: `What is the derivative of $${shown}$?`,
            answer: expressionAnswer(isConst ? '0' : termExpr(d.c, d.n), isConst ? '0' : powerLatex(d.c, d.n)),
            verify: { type: 'diff', expr: termExpr(t.c, t.n), variable: 'x' },
          },
        });
      });
    }

    steps.push({
      key: 'combine',
      instruction: level === 1 ? 'Put the new coefficient and exponent together.' : 'Add up the derivatives of the terms.',
      math: `f'(x) = ${answerLatex}`,
      why: level === 1 ? '$\\frac{d}{dx}\\,c\\,x^n = c\\,n\\,x^{n-1}$.' : 'The derivative of a sum is the sum of the derivatives.',
      ask: {
        prompt: "So $f'(x) = \\;?$",
        answer: expressionAnswer(answerExpr, answerLatex),
        verify: { type: 'diff', expr: fExpr, variable: 'x' },
      },
    });

    // ---------- misconceptions ----------
    const wrong = (id: string, mapped: { c: Q; n: Q }[]): MisconceptionInstance => ({
      id,
      wrong: expressionAnswer(powerSumExpr(mapped), powerSumLatex(mapped)),
    });
    const nonConst = (t: Term) => !t.n.isZero();
    const candidates: (MisconceptionInstance | null)[] = [
      wrong(
        'forgot-multiply',
        terms.filter(nonConst).map((t) => ({ c: t.c, n: t.n.sub(1) })),
      ),
      wrong(
        'forgot-reduce',
        terms.filter(nonConst).map((t) => ({ c: t.c.mul(t.n), n: t.n })),
      ),
      terms.some((t) => t.n.sign() < 0)
        ? wrong(
            'negative-exponent-direction',
            terms.map((t) => (t.n.sign() < 0 ? { c: t.c.mul(t.n), n: t.n.add(1) } : deriv(t))),
          )
        : null,
      terms.some((t) => t.n.isZero())
        ? wrong(
            'constant-kept',
            terms.map((t) => (t.n.isZero() ? { c: t.c, n: q(0) } : deriv(t))),
          )
        : null,
      terms.some((t) => t.form === 'over' || t.form === 'overroot')
        ? wrong(
            'fraction-as-positive-power',
            terms.map((t) => (t.form === 'over' || t.form === 'overroot' ? deriv({ ...t, n: t.n.neg() }) : deriv(t))),
          )
        : null,
    ];

    const answer = expressionAnswer(answerExpr, answerLatex);
    return {
      params,
      prompt: `Find $f'(x)$ for $$f(x) = ${fLatex}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, candidates),
      // Half the problems also ask what the derivative means (PLAN: "beyond the number").
      interpretation: rng.chance(0.5) ? [interpretationFor(rng, level, derivs)] : undefined,
      verify: { type: 'diff', expr: fExpr, variable: 'x' },
    };
  },
};
