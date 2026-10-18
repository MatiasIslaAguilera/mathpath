// Chain rule. The inner function u(x) is a polynomial (poly-util), the outer a power.
// Answers are expressions verified with `diff` against the original composite.

import { expressionAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';
import { polyDeriv, polyEval, polyExpr, polyLatex, type Poly } from './poly-util';

const ID = 'derivatives-chain-rule';
type Body = ReturnType<SkillDefinition['generate']>;
const P = (...cs: number[]): Poly => cs.map((c) => q(c));
const paren = (s: string) => `\\left(${s}\\right)`;
const powE = (base: string, n: string) => `(${base})^(${n})`;

/** Outer function u^n (n may be a fraction like 1/2 or negative). Returns the pieces for steps. */
interface Chain {
  u: Poly;
  n: [number, number]; // exponent as numerator/denominator
  /** How the original function is written. */
  fLatex: string;
}

const nStr = ([a, b]: [number, number]) => (b === 1 ? `${a}` : `${a}/${b}`);
const nQ = ([a, b]: [number, number]) => q(a, b);

function chainBody(params: Record<string, number>, c: Chain): Body {
  const { u } = c;
  const n = nQ(c.n);
  const nm1 = n.sub(1);
  const up = polyDeriv(u);
  const uE = polyExpr(u);
  const upE = polyExpr(up);
  const orig = powE(uE, nStr(c.n));
  const outerE = `${n.toExpr()}*${powE(uE, nm1.toString())}`;
  const value = `${outerE}*(${upE})`;
  const uL = polyLatex(u);
  const outerL = `${n.eq(1) ? '' : n.toLatex()}${paren(uL)}^{${nm1.toLatex()}}`;
  const display = `${outerL}\\cdot${paren(polyLatex(up))}`;
  const answer = expressionAnswer(value, display);
  const steps: Step[] = [
    {
      key: 'identify-inner',
      instruction: 'Identify the inner function $u(x)$ and the outer function.',
      math: `u(x) = ${uL}, \\qquad \\text{outer: } u^{${n.toLatex()}}`,
      why: 'The chain rule handles a function inside another function.',
      ask: { prompt: 'What is the inner function $u(x)$?', answer: expressionAnswer(uE, uL), verify: { type: 'equivalent', expr: uE, variables: ['x'] } },
    },
    {
      key: 'outer-derivative',
      instruction: 'Differentiate the outer power, leaving the inside alone.',
      math: `\\frac{d}{du}u^{${n.toLatex()}} = ${n.toLatex()}u^{${nm1.toLatex()}} = ${outerL}`,
      why: 'Power rule on the outside, with u kept as a block.',
    },
    {
      key: 'inner-derivative',
      instruction: 'Differentiate the inner function.',
      math: `u'(x) = ${polyLatex(up)}`,
      why: 'Power rule on the inside.',
      ask: { prompt: "$u'(x) = \\;?$", answer: expressionAnswer(upE, polyLatex(up)), verify: { type: 'diff', expr: uE, variable: 'x' } },
    },
    {
      key: 'multiply',
      instruction: "Multiply: outer′ × inner′.",
      math: `\\frac{d}{dx}${c.fLatex} = ${display}`,
      why: 'Chain rule: $\\frac{d}{dx}f(u(x)) = f\'(u)\\cdot u\'(x)$.',
      ask: { prompt: 'So the derivative is?', answer, verify: { type: 'diff', expr: orig, variable: 'x' } },
    },
  ];
  const ex = (id: string, v: string, d: string): MisconceptionInstance => ({ id, wrong: expressionAnswer(v, d) });
  const mis = [
    ex('forgot-inner', outerE, outerL),
    ex('inner-only', upE, polyLatex(up)),
    n.isInt() && n.valueOf() > 1 ? ex('outer-exponent-kept', `${n.toExpr()}*${powE(uE, n.toString())}*(${upE})`, `${n.toLatex()}${paren(uL)}^{${n.toLatex()}}\\cdot${paren(polyLatex(up))}`) : null,
    ex('inner-not-derivative', `${outerE}*(${uE})`, `${outerL}\\cdot${paren(uL)}`),
  ];
  return {
    params,
    prompt: `Find the derivative of $$h(x) = ${c.fLatex}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    verify: { type: 'diff', expr: orig, variable: 'x' },
  };
}

function level1(rng: Rng): Body {
  const a = rng.nonzero(-5, 5);
  const b = rng.int(1, 9); // u > 0 at the sample points keeps every form real
  const n = rng.int(2, 6);
  const u = P(b, Math.abs(a));
  return chainBody({ a: Math.abs(a), b, n }, { u, n: [n, 1], fLatex: `${paren(polyLatex(u))}^{${n}}` });
}

function level2(rng: Rng): Body {
  const a = rng.int(1, 4);
  const b = rng.int(-6, 6);
  const c = rng.int(10, 20); // keeps u = ax² + bx + c positive at the sample points
  const n = rng.int(2, 4);
  const u = P(c, b, a);
  return chainBody({ a, b, c, n }, { u, n: [n, 1], fLatex: `${paren(polyLatex(u))}^{${n}}` });
}

function level3(rng: Rng): Body {
  const sqrtForm = rng.chance(0.5);
  const a = rng.int(1, 6);
  const b = rng.int(1, 9);
  if (sqrtForm) {
    const u = P(b, 0, a);
    return chainBody({ form: 0, a, b, k: 0 }, { u, n: [1, 2], fLatex: `\\sqrt{${polyLatex(u)}}` });
  }
  const k = rng.int(1, 4);
  const u = P(b, a);
  return chainBody({ form: 1, a, b, k }, { u, n: [-k, 1], fLatex: `\\frac{1}{${paren(polyLatex(u))}${k === 1 ? '' : `^{${k}}`}}` });
}

function level4(rng: Rng): Body {
  // x·(ax + b)^n: product rule outside, chain rule inside.
  const a = rng.int(1, 5);
  const b = rng.int(1, 9);
  const n = rng.int(2, 5);
  const u = P(b, a);
  const uE = polyExpr(u);
  const orig = `x*(${uE})^${n}`;
  const value = `(${uE})^${n} + x*${n * a}*(${uE})^${n - 1}`;
  const uL = polyLatex(u);
  const display = `${paren(uL)}^{${n}} + ${n * a}x${paren(uL)}^{${n - 1}}`;
  const answer = expressionAnswer(value, display);
  const steps: Step[] = [
    { key: 'identify-inner', instruction: 'This is a product: $x$ times $(u)^n$ with $u = ' + uL + '$.', math: `h(x) = x\\cdot${paren(uL)}^{${n}}`, why: 'Use the product rule outside and the chain rule for the second factor.' },
    {
      key: 'inner-derivative',
      instruction: 'Differentiate the second factor with the chain rule.',
      math: `\\frac{d}{dx}${paren(uL)}^{${n}} = ${n}${paren(uL)}^{${n - 1}}\\cdot ${a} = ${n * a}${paren(uL)}^{${n - 1}}`,
      why: 'Outer derivative times inner derivative.',
      ask: { prompt: `$\\frac{d}{dx}${paren(uL)}^{${n}} = \\;?$`, answer: expressionAnswer(`${n * a}*(${uE})^${n - 1}`, `${n * a}${paren(uL)}^{${n - 1}}`), verify: { type: 'diff', expr: `(${uE})^${n}`, variable: 'x' } },
    },
    {
      key: 'product-rule',
      instruction: "Product rule: (first)′·second + first·(second)′.",
      math: `1\\cdot${paren(uL)}^{${n}} + x\\cdot ${n * a}${paren(uL)}^{${n - 1}}`,
      why: "$(fg)' = f'g + fg'$ with $f = x$.",
      ask: { prompt: 'So the derivative is?', answer, verify: { type: 'diff', expr: orig, variable: 'x' } },
    },
  ];
  return {
    params: { a, b, n },
    prompt: `Find the derivative of $$h(x) = x${paren(uL)}^{${n}}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [{ id: 'forgot-inner', wrong: expressionAnswer(`(${uE})^${n} + x*${n}*(${uE})^${n - 1}`, `${paren(uL)}^{${n}} + ${n}x${paren(uL)}^{${n - 1}}`) }]),
    verify: { type: 'diff', expr: orig, variable: 'x' },
  };
}

function level5(rng: Rng): Body {
  // d/dx (ax² + b)^n at x0: n(ax0² + b)^(n−1)·2a·x0
  for (;;) {
    const a = rng.int(1, 2);
    const b = rng.int(-3, 3);
    const n = rng.int(2, 3);
    const x0 = rng.nonzero(-2, 2);
    const u = P(b, 0, a);
    const ux0 = polyEval(u, x0);
    const val = q(n).mul(ux0.valueOf() ** (n - 1)).mul(2 * a * x0);
    if (Math.abs(val.valueOf()) > 2000) continue;
    const answer = numberAnswer(val);
    const uL = polyLatex(u);
    const derivExpr = `${n}*(${polyExpr(u)})^${n - 1}*(${2 * a}*x)`;
    return {
      params: { a, b, n, x0 },
      prompt: `For $h(x) = ${paren(uL)}^{${n}}$, find $h'(${x0})$.`,
      answer,
      steps: [
        { key: 'identify-inner', instruction: 'Inner function and its derivative.', math: `u = ${uL}, \\quad u' = ${2 * a}x`, why: 'Chain rule pieces.', ask: { prompt: "$u'(x) = \\;?$", answer: expressionAnswer(`${2 * a}*x`, `${2 * a}x`), verify: { type: 'diff', expr: polyExpr(u), variable: 'x' } } },
        { key: 'multiply', instruction: 'Write the derivative.', math: `h'(x) = ${n}${paren(uL)}^{${n - 1}}\\cdot ${2 * a}x`, why: 'Outer′ × inner′.' },
        {
          key: 'evaluate',
          instruction: `Plug in $x = ${x0}$.`,
          math: `u(${x0}) = ${ux0.toLatex()}, \\quad h'(${x0}) = ${n}\\cdot ${ux0.toLatex()}^{${n - 1}}\\cdot ${2 * a}\\cdot ${x0 < 0 ? `(${x0})` : x0} = ${val.toLatex()}`,
          why: 'Evaluate the inside first, then multiply.',
          ask: { prompt: `$h'(${x0}) = \\;?$`, answer, verify: { type: 'evaluate', expr: derivExpr.replace(/x/g, `(${x0})`) } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('forgot-inner', () => q(n).mul(ux0.valueOf() ** (n - 1)))]),
      verify: { type: 'limit', expr: `((${polyExpr(u).replace(/x/g, `(${x0} + h)`)})^${n} - (${polyExpr(u).replace(/x/g, `(${x0})`)})^${n})/h`, variable: 'h', point: '0' },
    };
  }
}

export const derivativesChainRule: SkillDefinition = {
  id: ID,
  title: 'Chain rule',
  track: 'math',
  unit: 'Derivatives',
  description: 'Differentiate a function of a function: outer derivative times inner derivative.',
  prerequisites: ['derivatives-product-quotient', 'function-composition'],
  maxDenominator: 1,
  levels: {
    1: { description: '(ax + b)ⁿ', ranges: { a: [1, 5], b: [1, 9], n: [2, 6] } },
    2: { description: '(ax² + bx + c)ⁿ', ranges: { a: [1, 4], b: [-6, 6], c: [10, 20], n: [2, 4] } },
    3: { description: 'Square roots and 1/(…)ᵏ', ranges: { form: [0, 1], a: [1, 6], b: [1, 9], k: [0, 4] } },
    4: { description: 'Chain rule inside a product', ranges: { a: [1, 5], b: [1, 9], n: [2, 5] } },
    5: { description: 'Evaluate at a point', ranges: { a: [1, 2], b: [-3, 3], n: [2, 3], x0: [-2, 2] } },
  },
  misconceptions: {
    'forgot-inner': { name: 'Forgot to multiply by the inner derivative', explanation: "The chain rule has two factors: the outer derivative AND the derivative of the inside. $\\frac{d}{dx}(3x+1)^5 = 5(3x+1)^4\\cdot 3$." },
    'inner-only': { name: 'Differentiated only the inside', explanation: "The outer function still has to be differentiated (with the inside kept as a block), then multiplied by u′." },
    'outer-exponent-kept': { name: "Didn't lower the outer exponent", explanation: 'Power rule on the outside: $u^n \\to n\\,u^{n-1}$. The exponent goes down by one.' },
    'inner-not-derivative': { name: 'Multiplied by the inner function instead of its derivative', explanation: "The last factor is u′(x), the DERIVATIVE of the inside, not u itself." },
  },
  stepLabels: {
    'identify-inner': 'Identify the inner function u(x)',
    'outer-derivative': 'Differentiate the outer function',
    'inner-derivative': 'Differentiate the inner function',
    multiply: "Multiply: outer′ × inner′",
    'product-rule': 'Product rule for the outer product',
    evaluate: 'Plug in the point',
  },
  learn: {
    whyItMatters:
      'Effects chain in economics: a tax changes the price, and the price changes the quantity demanded. If $Q = 100 - 2P$ and $P = 10 + 0.5t$, then $\\frac{dQ}{dt} = \\frac{dQ}{dP}\\cdot\\frac{dP}{dt} = (-2)(0.5) = -1$: each dollar of tax cuts quantity by one unit. Comparative statics in your theory courses is mostly the chain rule.',
    summary: "If $h(x) = f(u(x))$, then $h'(x) = f'(u(x))\\cdot u'(x)$: differentiate the outside with the inside left alone, then multiply by the derivative of the inside.",
    formulas: [
      { latex: "\\frac{d}{dx}f(u(x)) = f'(u)\\cdot u'(x)" },
      { latex: "\\frac{d}{dx}u^n = n\\,u^{n-1}\\,u'" },
      { latex: "\\frac{d}{dx}\\sqrt{u} = \\frac{u'}{2\\sqrt{u}}" },
    ],
    example: { seed: 2, level: 2 },
    tips: ['Name the inner function u out loud before you start; most chain-rule errors are forgetting u′.'],
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
