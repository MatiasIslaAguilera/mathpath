// Limits & continuity. Every limit is verified with the `limit` VerifySpec (numeric approach in
// the TS harness, sympy.limit in the cross-check), never by the algebra the steps teach.

import { numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { Level, SkillDefinition } from '../../engine/types';
import { polyEval, polyExpr, polyLatex, type Poly } from './poly-util';

const ID = 'limits';
type Body = ReturnType<SkillDefinition['generate']>;
const P = (...cs: number[]): Poly => cs.map((c) => q(c));
const lim = (to: string) => `\\lim_{x \\to ${to}}`;

function level1(rng: Rng): Body {
  for (;;) {
    const a = rng.nonzero(-5, 5);
    const b = rng.int(-9, 9);
    const c = rng.int(-9, 9);
    const k = rng.int(1, 9);
    const x0 = rng.int(-4, 4);
    if (x0 + k === 0) continue;
    const top: Poly = P(c, b, a);
    const value = polyEval(top, x0).div(x0 + k);
    if (value.d > 12) continue;
    const expr = `(${polyExpr(top)})/(x + ${k})`;
    const answer = numberAnswer(value);
    return {
      params: { a, b, c, k, x0 },
      prompt: `Find $$${lim(`${x0}`)} \\frac{${polyLatex(top)}}{x + ${k}}$$`,
      answer,
      steps: [
        {
          key: 'substitute',
          instruction: `Try substituting $x = ${x0}$.`,
          math: `\\frac{${polyEval(top, x0).toLatex()}}{${x0 + k}} = ${value.toLatex()}`,
          why: 'If substituting gives a real number (no 0 in the denominator), the function is continuous there and that number IS the limit.',
          ask: { prompt: `What is the denominator at $x = ${x0}$?`, answer: numberAnswer(x0 + k), verify: { type: 'evaluate', expr: `${x0} + ${k}` } },
        },
        {
          key: 'evaluate',
          instruction: 'The denominator is not zero, so the limit is the value.',
          math: `${lim(`${x0}`)} \\frac{${polyLatex(top)}}{x + ${k}} = ${value.toLatex()}`,
          why: 'Rational functions are continuous wherever the denominator is nonzero.',
          ask: { prompt: 'So the limit is?', answer, verify: { type: 'limit', expr, variable: 'x', point: `${x0}` } },
        },
      ],
      misconceptions: [],
      verify: { type: 'limit', expr, variable: 'x', point: `${x0}` },
    };
  }
}

function level2(rng: Rng): Body {
  for (;;) {
    const r = rng.int(-6, 6);
    const s = rng.int(-6, 6);
    if (r === s) continue;
    const top = P(r * s, -(r + s), 1); // (x − r)(x − s)
    const answer = numberAnswer(r - s);
    const expr = `(${polyExpr(top)})/(x - (${r}))`;
    const denom = r === 0 ? 'x' : r > 0 ? `x - ${r}` : `x + ${-r}`;
    const sFactor = s === 0 ? 'x' : s > 0 ? `x - ${s}` : `x + ${-s}`;
    return {
      params: { r, s },
      prompt: `Find $$${lim(`${r}`)} \\frac{${polyLatex(top)}}{${denom}}$$`,
      answer,
      steps: [
        {
          key: 'zero-over-zero',
          instruction: `Substitute $x = ${r}$: both top and bottom are 0.`,
          math: `\\frac{0}{0}`,
          why: '0/0 is not a number: it means "simplify first". The limit usually still exists.',
          ask: { prompt: `What is the numerator at $x = ${r}$?`, answer: numberAnswer(0), verify: { type: 'evaluate', expr: polyExpr(top).replace(/x/g, `(${r})`) } },
        },
        {
          key: 'factor',
          instruction: `The numerator is 0 at $x = ${r}$, so $(${denom})$ is a factor.`,
          math: `${polyLatex(top)} = (${denom})(${sFactor})`,
          why: 'If a polynomial is zero at x = r, then (x − r) divides it.',
          ask: { prompt: `Factor: $${polyLatex(top)} = (${denom})(\\,?\\,)$`, answer: { kind: 'expression', value: `x - (${s})`, variables: ['x'], display: sFactor }, verify: { type: 'equivalent', expr: `(${polyExpr(top)})/(x - (${r}))`, variables: ['x'] } },
        },
        {
          key: 'cancel',
          instruction: 'Cancel the common factor, then substitute.',
          math: `${lim(`${r}`)} (${sFactor}) = ${r} - ${s < 0 ? `(${s})` : s} = ${r - s}`,
          why: 'The two functions agree everywhere except at x = r itself, and a limit never looks AT the point, only near it.',
          ask: { prompt: 'So the limit is?', answer, verify: { type: 'limit', expr, variable: 'x', point: `${r}` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        r - s !== 0 ? wrongNumber('zero-over-zero-is-zero', () => 0) : null,
        wrongNumber('cancel-wrong-factor', () => s - r),
      ]),
      verify: { type: 'limit', expr, variable: 'x', point: `${r}` },
    };
  }
}

function level3(rng: Rng): Body {
  for (;;) {
    const lower = rng.chance(0.25);
    const a = rng.nonzero(-9, 9);
    const b = rng.int(-9, 9);
    const c = rng.int(-9, 9);
    const d = rng.nonzero(-9, 9);
    const e = rng.int(-9, 9);
    const f = rng.nonzero(-9, 9);
    const top: Poly = lower ? P(c, a) : P(c, b, a);
    const bottom: Poly = P(f, e, d);
    const value = lower ? q(0) : q(a, d);
    const expr = `(${polyExpr(top)})/(${polyExpr(bottom)})`;
    // The trap answer (constant terms) must differ from the true limit to be diagnosable.
    const trap = c === 0 ? null : q(c, f);
    if (trap && trap.eq(value)) continue;
    const answer = numberAnswer(value);
    return {
      params: { lower: lower ? 1 : 0, a, b: lower ? 0 : b, c, d, e, f },
      prompt: `Find $$${lim('\\infty')} \\frac{${polyLatex(top)}}{${polyLatex(bottom)}}$$`,
      answer,
      steps: [
        {
          key: 'leading-terms',
          instruction: 'For very large $x$, only the highest-power terms matter.',
          math: lower ? `\\frac{${polyLatex(top)}}{${polyLatex(bottom)}} \\approx \\frac{${a}x}{${d}x^2} = \\frac{${q(a, d).toLatex()}}{x} \\to 0` : `\\frac{${polyLatex(top)}}{${polyLatex(bottom)}} \\approx \\frac{${a}x^2}{${d}x^2} = ${value.toLatex()}`,
          why: lower ? 'The bottom grows faster (x² vs x), so the fraction shrinks to 0.' : 'Divide top and bottom by x²: every other term goes to 0.',
          ask: { prompt: 'What is the limit?', answer, verify: { type: 'limit', expr, variable: 'x', point: 'oo' } },
        },
        {
          key: 'evaluate',
          instruction: 'State the limit.',
          math: `${lim('\\infty')} = ${value.toLatex()}`,
          why: 'Same degree: ratio of leading coefficients. Lower degree on top: 0.',
          ask: { prompt: 'So the limit is?', answer, verify: { type: 'limit', expr, variable: 'x', point: 'oo' } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [trap ? wrongNumber('lower-terms-ratio', () => trap) : null]),
      verify: { type: 'limit', expr, variable: 'x', point: 'oo' },
    };
  }
}

function level4(rng: Rng): Body {
  for (;;) {
    const c = rng.int(1, 3);
    const a = rng.nonzero(-6, 6);
    const b = rng.int(-9, 9);
    const k = q(a * c + b, c * c);
    if (k.isZero() || k.d > 9) continue;
    const answer = numberAnswer(k);
    const left = `${a === 1 ? '' : a === -1 ? '-' : a}x ${b < 0 ? `- ${-b}` : `+ ${b}`}`;
    const wrongK = q(a * c - b, c * c);
    return {
      params: { a, b, c },
      prompt: `For what value of $k$ is $$f(x) = \\begin{cases} ${left}, & x < ${c} \\\\ kx^2, & x \\ge ${c} \\end{cases}$$ continuous everywhere?`,
      answer,
      steps: [
        {
          key: 'match-sides',
          instruction: `The two pieces must meet at $x = ${c}$.`,
          math: `\\lim_{x \\to ${c}^-} f(x) = ${a}\\cdot ${c} ${b < 0 ? `- ${-b}` : `+ ${b}`} = ${a * c + b}, \\qquad f(${c}) = k\\cdot ${c * c}`,
          why: 'Continuous means no jump: the left-hand limit equals the value at the point.',
          ask: { prompt: `What is $\\lim_{x \\to ${c}^-} f(x)$?`, answer: numberAnswer(a * c + b), verify: { type: 'limit', expr: `${a}*x + (${b})`, variable: 'x', point: `${c}`, side: '-' } },
        },
        {
          key: 'evaluate',
          instruction: 'Solve for $k$.',
          math: `${c * c}k = ${a * c + b} \\;\\Rightarrow\\; k = ${k.toLatex()}`,
          why: 'Set the two expressions equal at the boundary.',
          ask: { prompt: '$k = \\;?$', answer, verify: { type: 'solve', equations: [`${a}*${c} + (${b}) = k*${c}^2`], unknowns: ['k'] } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongK.isZero() ? null : wrongNumber('continuity-sign', () => wrongK)]),
      verify: { type: 'solve', equations: [`${a}*${c} + (${b}) = k*${c}^2`], unknowns: ['k'] },
    };
  }
}

function level5(rng: Rng): Body {
  for (;;) {
    const m = rng.int(1, 6);
    const a = rng.int(1, 9);
    const value = q(a, 2 * m);
    if (value.d > 12) continue;
    const answer = numberAnswer(value);
    const inside = `${a === 1 ? '' : a}x + ${m * m}`;
    const expr = `(sqrt(${a}*x + ${m * m}) - ${m})/x`;
    return {
      params: { a, m },
      prompt: `Find $$${lim('0')} \\frac{\\sqrt{${inside}} - ${m}}{x}$$`,
      answer,
      steps: [
        {
          key: 'zero-over-zero',
          instruction: 'Substituting $x = 0$ gives 0/0.',
          math: `\\frac{\\sqrt{${m * m}} - ${m}}{0} = \\frac{0}{0}`,
          why: '0/0 means simplify first.',
          ask: { prompt: 'What is the numerator at $x = 0$?', answer: numberAnswer(0), verify: { type: 'evaluate', expr: `sqrt(${m * m}) - ${m}` } },
        },
        {
          key: 'conjugate',
          instruction: `Multiply top and bottom by the conjugate $\\sqrt{${inside}} + ${m}$.`,
          math: `\\frac{(${inside}) - ${m * m}}{x(\\sqrt{${inside}} + ${m})} = \\frac{${a}}{\\sqrt{${inside}} + ${m}}`,
          why: '$(\\sqrt{A} - m)(\\sqrt{A} + m) = A - m^2$ removes the square root, and the x cancels.',
        },
        {
          key: 'evaluate',
          instruction: 'Now substitute $x = 0$.',
          math: `\\frac{${a}}{${m} + ${m}} = ${value.toLatex()}`,
          why: 'After cancelling, the expression is continuous at 0.',
          ask: { prompt: 'So the limit is?', answer, verify: { type: 'limit', expr, variable: 'x', point: '0' } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('conjugate-forgot-half', () => q(a, m)), wrongNumber('zero-over-zero-is-zero', () => 0)]),
      verify: { type: 'limit', expr, variable: 'x', point: '0' },
    };
  }
}

export const limits: SkillDefinition = {
  id: ID,
  title: 'Limits & continuity',
  track: 'math',
  unit: 'Limits',
  description: 'Limits by substitution, factoring, leading terms and conjugates; continuity.',
  prerequisites: ['functions-basics'],
  maxDenominator: 12,
  levels: {
    1: { description: 'Direct substitution', ranges: { a: [-5, 5], b: [-9, 9], c: [-9, 9], k: [1, 9], x0: [-4, 4] } },
    2: { description: '0/0: factor and cancel', ranges: { r: [-6, 6], s: [-6, 6] } },
    3: { description: 'Limits at infinity', ranges: { lower: [0, 1], a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9], e: [-9, 9], f: [-9, 9] } },
    4: { description: 'Make a piecewise function continuous', ranges: { a: [-6, 6], b: [-9, 9], c: [1, 3] } },
    5: { description: 'Square roots: multiply by the conjugate', ranges: { a: [1, 9], m: [1, 6] } },
  },
  misconceptions: {
    'zero-over-zero-is-zero': { name: 'Treated 0/0 as 0', explanation: '0/0 is undefined, not 0. It is a signal that the expression can be simplified; the limit is what the simplified expression approaches.' },
    'cancel-wrong-factor': { name: 'Kept the wrong factor', explanation: 'Cancel the factor that matches the denominator, then substitute into what remains: $\\frac{(x-r)(x-s)}{x-r} = x - s \\to r - s$.' },
    'lower-terms-ratio': { name: 'Used the constant terms instead of the leading terms', explanation: 'As $x \\to \\infty$ the highest powers dominate; constants become negligible. Compare the leading coefficients (or degrees).' },
    'continuity-sign': { name: 'Sign slip when matching the pieces', explanation: 'Evaluate the left piece exactly at the boundary, $a\\cdot c + b$, including the sign of $b$, and set it equal to $k c^2$.' },
    'conjugate-forgot-half': { name: 'Lost the 2 from the conjugate', explanation: 'After cancelling, the denominator is $\\sqrt{A} + m$, which at $x = 0$ is $m + m = 2m$, not $m$.' },
  },
  stepLabels: {
    substitute: 'Try substituting the point',
    'zero-over-zero': '0/0 means: simplify first',
    factor: 'Factor the numerator',
    cancel: 'Cancel the common factor',
    'leading-terms': 'Compare the leading terms',
    'match-sides': 'Make the two sides meet',
    conjugate: 'Multiply by the conjugate',
    evaluate: 'Evaluate the simplified expression',
  },
  learn: {
    whyItMatters:
      'A derivative IS a limit: the slope over smaller and smaller changes. If cost is $C(q) = q^2$, the extra cost per unit from $q = 10$ to $10 + h$ is $\\frac{(10+h)^2 - 100}{h} = 20 + h$, and as $h \\to 0$ that approaches $20$: the marginal cost. In economics, "marginal" always means this limit, and continuity is why a small price change causes only a small change in quantity.',
    summary:
      'The limit of $f(x)$ as $x \\to a$ is the value $f$ approaches near $a$ (not at it). Try substituting first. If you get $\\frac{0}{0}$, simplify: factor and cancel, or multiply by a conjugate. At infinity, compare the highest powers. A function is continuous at $a$ if the limit equals $f(a)$.',
    formulas: [
      { latex: '\\lim_{x\\to a}\\frac{(x-a)g(x)}{x-a} = g(a)', note: 'Cancel the factor that makes it 0/0.' },
      { latex: '\\lim_{x\\to\\infty}\\frac{ax^n + \\dots}{dx^n + \\dots} = \\frac{a}{d}', note: 'Same degree: ratio of leading coefficients.' },
      { latex: "f'(a) = \\lim_{h\\to 0}\\frac{f(a+h) - f(a)}{h}", note: 'The derivative is a limit.' },
    ],
    example: { seed: 5, level: 2 },
    tips: ['0/0 is a signal to simplify, never an answer.'],
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

