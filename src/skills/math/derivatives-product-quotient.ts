// Product & quotient rules. Parts are polynomials (poly-util), so every intermediate is exact.
// Answers are expressions verified with `diff` against the original function.

import { expressionAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';
import { polyAdd, polyDeriv, polyExpr, polyLatex, polyMul, polyScale, type Poly } from './poly-util';

const ID = 'derivatives-product-quotient';
type Body = ReturnType<SkillDefinition['generate']>;
const P = (...cs: number[]): Poly => cs.map((c) => q(c));
const paren = (s: string) => `\\left(${s}\\right)`;

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

interface Parts {
  f: Poly;
  g: Poly;
  v: string;
}

function productBody(params: Record<string, number>, { f, g, v }: Parts, promptFn: (expr: string) => string): Body {
  const fp = polyDeriv(f);
  const gp = polyDeriv(g);
  const result = polyAdd(polyMul(fp, g), polyMul(f, gp));
  const fE = polyExpr(f, v);
  const gE = polyExpr(g, v);
  const orig = `(${fE})*(${gE})`;
  const answer = expressionAnswer(polyExpr(result, v), polyLatex(result, v), [v]);
  const steps: Step[] = [
    {
      key: 'identify-parts',
      instruction: 'Name the two factors.',
      math: `f(${v}) = ${polyLatex(f, v)}, \\qquad g(${v}) = ${polyLatex(g, v)}`,
      why: 'The product rule needs each factor and its derivative.',
    },
    {
      key: 'differentiate-parts',
      instruction: 'Differentiate each factor.',
      math: `f'(${v}) = ${polyLatex(fp, v)}, \\qquad g'(${v}) = ${polyLatex(gp, v)}`,
      why: 'Power rule on each.',
      ask: { prompt: `$g'(${v}) = \\;?$`, answer: expressionAnswer(polyExpr(gp, v), polyLatex(gp, v), [v]), verify: { type: 'diff', expr: gE, variable: v } },
    },
    {
      key: 'apply-rule',
      instruction: "Apply the product rule: $f'g + fg'$.",
      math: `${paren(polyLatex(fp, v))}${paren(polyLatex(g, v))} + ${paren(polyLatex(f, v))}${paren(polyLatex(gp, v))}`,
      why: 'Each factor takes a turn being differentiated while the other stays put.',
    },
    {
      key: 'simplify',
      instruction: 'Expand and combine like terms.',
      math: `= ${polyLatex(result, v)}`,
      why: 'Collect powers of the variable.',
      ask: { prompt: 'So the derivative is?', answer, verify: { type: 'diff', expr: orig, variable: v } },
    },
  ];
  const wrong = polyMul(fp, gp);
  const mis: (MisconceptionInstance | null)[] = [{ id: 'product-of-derivatives', wrong: expressionAnswer(polyExpr(wrong, v), polyLatex(wrong, v), [v]) }];
  return { params, prompt: promptFn(`${paren(polyLatex(f, v))}${paren(polyLatex(g, v))}`), answer, steps, misconceptions: distinctMisconceptions(answer, mis), verify: { type: 'diff', expr: orig, variable: v } };
}

function quotientBody(params: Record<string, number>, { f, g, v }: Parts, promptFn: (expr: string) => string, interpretation?: InterpretationQuestion[]): Body {
  const fp = polyDeriv(f);
  const gp = polyDeriv(g);
  const num = polyAdd(polyMul(fp, g), polyScale(polyMul(f, gp), -1));
  const fE = polyExpr(f, v);
  const gE = polyExpr(g, v);
  const orig = `(${fE})/(${gE})`;
  const value = `(${polyExpr(num, v)})/(${gE})^2`;
  const display = `\\frac{${polyLatex(num, v)}}{${paren(polyLatex(g, v))}^2}`;
  const answer = expressionAnswer(value, display, [v]);
  const steps: Step[] = [
    {
      key: 'identify-parts',
      instruction: 'Name the top and bottom.',
      math: `f(${v}) = ${polyLatex(f, v)}, \\qquad g(${v}) = ${polyLatex(g, v)}`,
      why: 'Quotient rule: $\\left(\\frac{f}{g}\\right)\' = \\frac{f\'g - fg\'}{g^2}$.',
    },
    {
      key: 'differentiate-parts',
      instruction: 'Differentiate top and bottom.',
      math: `f'(${v}) = ${polyLatex(fp, v)}, \\qquad g'(${v}) = ${polyLatex(gp, v)}`,
      why: 'Power rule on each.',
      ask: { prompt: `$f'(${v}) = \\;?$`, answer: expressionAnswer(polyExpr(fp, v), polyLatex(fp, v), [v]), verify: { type: 'diff', expr: fE, variable: v } },
    },
    {
      key: 'apply-rule',
      instruction: "Apply the quotient rule: (top′·bottom − top·bottom′) over bottom squared.",
      math: `\\frac{${paren(polyLatex(fp, v))}${paren(polyLatex(g, v))} - ${paren(polyLatex(f, v))}${paren(polyLatex(gp, v))}}{${paren(polyLatex(g, v))}^2}`,
      why: 'Order matters in the numerator: "low d-high minus high d-low".',
    },
    {
      key: 'simplify',
      instruction: 'Simplify the numerator (keep the denominator squared).',
      math: `= ${display}`,
      why: 'Expand the products in the numerator and collect like terms.',
      ask: { prompt: 'So the derivative is?', answer, verify: { type: 'diff', expr: orig, variable: v } },
    },
  ];
  const swapped = polyScale(num, -1);
  const mis: (MisconceptionInstance | null)[] = [
    { id: 'quotient-order', wrong: expressionAnswer(`(${polyExpr(swapped, v)})/(${gE})^2`, `\\frac{${polyLatex(swapped, v)}}{${paren(polyLatex(g, v))}^2}`, [v]) },
    { id: 'quotient-no-square', wrong: expressionAnswer(`(${polyExpr(num, v)})/(${gE})`, `\\frac{${polyLatex(num, v)}}{${polyLatex(g, v)}}`, [v]) },
    { id: 'quotient-of-derivatives', wrong: expressionAnswer(`(${polyExpr(fp, v)})/(${polyExpr(gp, v)})`, `\\frac{${polyLatex(fp, v)}}{${polyLatex(gp, v)}}`, [v]) },
  ];
  return {
    params,
    prompt: promptFn(`\\frac{${polyLatex(f, v)}}{${polyLatex(g, v)}}`),
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    interpretation,
    verify: { type: 'diff', expr: orig, variable: v },
  };
}

const findDeriv = (expr: string) => `Find the derivative of $$h(x) = ${expr}$$`;

function level1(rng: Rng): Body {
  const a = rng.nonzero(-6, 6);
  const b = rng.nonzero(-9, 9);
  const c = rng.nonzero(-6, 6);
  const d = rng.nonzero(-9, 9);
  return productBody({ a, b, c, d }, { f: P(b, a), g: P(d, c), v: 'x' }, findDeriv);
}

function level2(rng: Rng): Body {
  const a = rng.nonzero(-5, 5);
  const m = rng.int(2, 4);
  const b = rng.nonzero(-6, 6);
  const c = rng.nonzero(-9, 9);
  const f: Poly = Array.from({ length: m + 1 }, (_, i) => q(i === m ? a : 0));
  return productBody({ a, m, b, c }, { f, g: P(c, b), v: 'x' }, findDeriv);
}

function level3(rng: Rng): Body {
  for (;;) {
    const a = rng.nonzero(-6, 6);
    const b = rng.int(-9, 9);
    const c = rng.int(1, 6); // c > 0, d > 0 keeps the denominator positive at the sample points
    const d = rng.int(1, 9);
    if (a * d - b * c === 0) continue;
    return quotientBody({ a, b, c, d }, { f: P(b, a), g: P(d, c), v: 'x' }, findDeriv);
  }
}

function level4(rng: Rng): Body {
  const a = rng.nonzero(-5, 5);
  const b = rng.int(-9, 9);
  const c = rng.int(1, 6);
  const d = rng.int(1, 9);
  return quotientBody({ a, b, c, d }, { f: P(b, 0, a), g: P(d, c), v: 'x' }, findDeriv);
}

function level5(rng: Rng): Body {
  // Average cost AC(q) = (F + v q + w q²)/q. AC'(q) = (w q² − F)/q²: negative exactly when MC < AC.
  const F = rng.int(10, 400);
  const v = rng.int(2, 30);
  const w = rng.int(1, 5);
  const ch = choice(rng, 'Marginal cost is below average cost', ['Marginal cost is above average cost', 'Fixed cost is zero', 'Output is above the profit-maximizing level']);
  const interp: InterpretationQuestion = {
    prompt: "Average cost is falling ($AC'(q) < 0$) exactly when…",
    options: ch.options,
    correct: ch.correct,
    explanation: "Write $AC'(q) = \\frac{1}{q}\\big(MC(q) - AC(q)\\big)$. If the next unit costs less than the current average, adding it pulls the average down. That's why MC crosses AC at AC's minimum.",
  };
  return quotientBody(
    { F, v, w },
    { f: P(F, v, w), g: P(0, 1), v: 'q' },
    (e) => `A firm's total cost is $TC(q) = ${F} + ${v}q + ${w === 1 ? '' : w}q^2$. Find the derivative of its average cost $$AC(q) = ${e}$$`,
    [interp],
  );
}

export const derivativesProductQuotient: SkillDefinition = {
  id: ID,
  title: 'Product & quotient rules',
  track: 'math',
  unit: 'Derivatives',
  description: 'Differentiate products and quotients of functions.',
  prerequisites: ['derivatives-power-rule'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Product of two linear factors', ranges: { a: [-6, 6], b: [-9, 9], c: [-6, 6], d: [-9, 9] } },
    2: { description: 'A power times a linear factor', ranges: { a: [-5, 5], m: [2, 4], b: [-6, 6], c: [-9, 9] } },
    3: { description: 'Quotient of linear functions', ranges: { a: [-6, 6], b: [-9, 9], c: [1, 6], d: [1, 9] } },
    4: { description: 'Quadratic over linear', ranges: { a: [-5, 5], b: [-9, 9], c: [1, 6], d: [1, 9] } },
    5: { description: 'Derivative of average cost', ranges: { F: [10, 400], v: [2, 30], w: [1, 5] } },
  },
  misconceptions: {
    'product-of-derivatives': { name: "Multiplied the derivatives: (fg)′ = f′g′", explanation: "The derivative of a product is NOT the product of derivatives. Use $(fg)' = f'g + fg'$: each factor takes a turn." },
    'quotient-order': { name: 'Subtracted in the wrong order', explanation: "The numerator is $f'g - fg'$ (derivative of the TOP first). Swapping the order flips the sign of the whole answer." },
    'quotient-no-square': { name: 'Forgot to square the denominator', explanation: "The quotient rule's denominator is $g^2$, not $g$." },
    'quotient-of-derivatives': { name: "Divided the derivatives: (f/g)′ = f′/g′", explanation: "Like the product rule, the quotient rule is not term by term: $\\left(\\frac fg\\right)' = \\frac{f'g - fg'}{g^2}$." },
  },
  stepLabels: {
    'identify-parts': 'Name the two parts',
    'differentiate-parts': 'Differentiate each part',
    'apply-rule': 'Apply the product/quotient rule',
    simplify: 'Simplify',
  },
  learn: {
    whyItMatters:
      'Revenue is price × quantity, and when price depends on quantity you need the product rule: with $P(q) = 50 - 2q$, $R(q) = (50 - 2q)q$ and $R\'(q) = (-2)q + (50 - 2q)\\cdot 1 = 50 - 4q$, which is marginal revenue. Average cost $C(q)/q$ needs the quotient rule, and its derivative proves average cost falls exactly when marginal cost is below it.',
    summary: "Product rule: $(fg)' = f'g + fg'$. Quotient rule: $\\left(\\frac fg\\right)' = \\frac{f'g - fg'}{g^2}$. Identify the parts, differentiate each, plug into the rule, then simplify.",
    formulas: [
      { latex: "(fg)' = f'g + fg'" },
      { latex: "\\left(\\frac{f}{g}\\right)' = \\frac{f'g - fg'}{g^2}", note: '"Low d-high minus high d-low, over low squared."' },
    ],
    example: { seed: 1, level: 3 },
    tips: ['Check a product-rule answer by expanding first and using the power rule; you must get the same thing.'],
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
