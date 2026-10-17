// Concavity & the second-derivative test. Polynomials only (exact arithmetic via poly-util).
// The economics hook: f″ < 0 is diminishing marginal returns, and it's what makes a critical
// point of profit a maximum.

import { choiceAnswer, expressionAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, Level, SkillDefinition, Step } from '../../engine/types';
import { polyDeriv, polyEval, polyExpr, polyLatex, type Poly } from './poly-util';

const ID = 'concavity-second-derivative';
type Body = ReturnType<SkillDefinition['generate']>;

const P = (...cs: number[]): Poly => cs.map((c) => q(c));

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

const derivSteps = (f: Poly, v = 'x'): Step[] => {
  const f1 = polyDeriv(f);
  const f2 = polyDeriv(f1);
  return [
    {
      key: 'first-derivative',
      instruction: `Differentiate once to get $f'(${v})$.`,
      math: `f'(${v}) = ${polyLatex(f1, v)}`,
      why: 'Power rule on each term.',
      ask: { prompt: `$f'(${v}) = \\;?$`, answer: expressionAnswer(polyExpr(f1, v), polyLatex(f1, v), [v]), verify: { type: 'diff', expr: polyExpr(f, v), variable: v } },
    },
    {
      key: 'second-derivative',
      instruction: `Differentiate again to get $f''(${v})$.`,
      math: `f''(${v}) = ${polyLatex(f2, v)}`,
      why: 'The second derivative is the derivative of the first derivative: it measures how the slope changes.',
      ask: { prompt: `$f''(${v}) = \\;?$`, answer: expressionAnswer(polyExpr(f2, v), polyLatex(f2, v), [v]), verify: { type: 'diff', expr: polyExpr(f1, v), variable: v } },
    },
  ];
};

function level1(rng: Rng): Body {
  const deg = rng.int(3, 4);
  const cs = Array.from({ length: deg + 1 }, (_, i) => (i === deg ? rng.nonzero(-5, 5) : rng.int(-9, 9)));
  const f = P(...cs);
  const f1 = polyDeriv(f);
  const f2 = polyDeriv(f1);
  const answer = expressionAnswer(polyExpr(f2), polyLatex(f2));
  return {
    params: { deg, c0: cs[0], c1: cs[1], c2: cs[2], c3: cs[3], c4: cs[4] ?? 0 },
    prompt: `Find $f''(x)$ for $$f(x) = ${polyLatex(f)}$$`,
    answer,
    steps: derivSteps(f),
    misconceptions: distinctMisconceptions(answer, [{ id: 'used-first-derivative', wrong: expressionAnswer(polyExpr(f1), polyLatex(f1)) }]),
    verify: { type: 'diff', expr: polyExpr(f1), variable: 'x' },
  };
}

function level2(rng: Rng): Body {
  const a = rng.nonzero(-4, 4);
  const b = rng.int(-9, 9);
  const c = rng.int(-9, 9);
  const d = rng.int(-9, 9);
  const x0 = rng.int(-3, 3);
  const f = P(d, c, b, a);
  const f1 = polyDeriv(f);
  const f2 = polyDeriv(f1);
  const v = polyEval(f2, x0);
  const answer = numberAnswer(v);
  const steps = derivSteps(f);
  steps.push({
    key: 'evaluate',
    instruction: `Evaluate $f''$ at $x = ${x0}$.`,
    math: `f''(${x0}) = ${v.toLatex()}`,
    why: 'Substitute the point into the second derivative.',
    ask: { prompt: `$f''(${x0}) = \\;?$`, answer, verify: { type: 'evaluate', expr: polyExpr(f2).replace(/x/g, `(${x0})`) } },
  });
  const sign = v.sign();
  const word = sign > 0 ? 'Concave up (curving upward, like a cup)' : sign < 0 ? 'Concave down (curving downward, like a cap)' : 'Neither: f″ = 0 there, so this test says nothing';
  const ch = choice(rng, word, ['Concave up (curving upward, like a cup)', 'Concave down (curving downward, like a cap)', 'Neither: f″ = 0 there, so this test says nothing']);
  const interp: InterpretationQuestion = {
    prompt: `At $x = ${x0}$, how is the graph of $f$ curving?`,
    options: ch.options,
    correct: ch.correct,
    explanation: `$f''(${x0}) = ${v.toLatex()}$. Positive means the slope is increasing (concave up); negative means the slope is decreasing (concave down). In economics, a concave-down production or utility function is *diminishing marginal returns*: each extra unit adds less than the one before.`,
  };
  return {
    params: { a, b, c, d, x0 },
    prompt: `For $$f(x) = ${polyLatex(f)}$$ find $f''(${x0})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [wrongNumber('used-first-derivative', () => polyEval(f1, x0))]),
    interpretation: [interp],
    verify: { type: 'evaluate', expr: polyExpr(f2).replace(/x/g, `(${x0})`) },
  };
}

function level3(rng: Rng): Body {
  const a = rng.pick([-2, -1, 1, 2]);
  const b = rng.nonzero(-9, 9);
  const c = rng.int(-9, 9);
  const d = rng.int(-9, 9);
  const f = P(d, c, b, a);
  const x = q(-b, 3 * a);
  const answer = numberAnswer(x);
  const steps = derivSteps(f);
  steps.push({
    key: 'solve-f2-zero',
    instruction: "Set $f''(x) = 0$ and solve: that's where the concavity can change.",
    math: `${polyLatex(polyDeriv(polyDeriv(f)))} = 0 \\;\\Rightarrow\\; x = ${x.toLatex()}`,
    why: "An inflection point is where f″ changes sign. For a cubic, f″ is linear, so it changes sign exactly at its root.",
    ask: { prompt: 'The inflection point is at $x = \\;?$', answer, verify: { type: 'solve', equations: [`${polyExpr(polyDeriv(polyDeriv(f)))} = 0`], unknowns: ['x'] } },
  });
  return {
    params: { a, b, c, d },
    prompt: `Find the $x$-coordinate of the inflection point of $$f(x) = ${polyLatex(f)}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [wrongNumber('inflection-wrong-formula', () => q(-b, 2 * a))]),
    verify: { type: 'solve', equations: [`${polyExpr(polyDeriv(polyDeriv(f)))} = 0`], unknowns: ['x'] },
  };
}

/** A cubic whose critical points are exactly r1 < r2 (integer coefficients). */
function cubicWithCriticalPoints(rng: Rng): { a: number; r1: number; r2: number; d: number; f: Poly } {
  for (;;) {
    const a = rng.nonzero(-2, 2);
    const r1 = rng.int(-5, 4);
    const r2 = r1 + rng.int(1, 6);
    if ((a * (r1 + r2)) % 2 !== 0) continue; // keep the x² coefficient an integer
    const d = rng.int(-9, 9);
    // f'(x) = 3a(x − r1)(x − r2)  ⇒  f(x) = a x³ − (3a(r1+r2)/2) x² + 3a r1 r2 x + d
    const f = P(d, 3 * a * r1 * r2, (-3 * a * (r1 + r2)) / 2, a);
    return { a, r1, r2, d, f };
  }
}

const KINDS = ['A local maximum', 'A local minimum', 'Neither (not a critical point)'];

function level4(rng: Rng): Body {
  const { a, r1, r2, d, f } = cubicWithCriticalPoints(rng);
  const at = rng.chance(0.5) ? r1 : r2;
  const f2 = polyDeriv(polyDeriv(f));
  const curv = polyEval(f2, at);
  const options: ChoiceOption[] = KINDS.map((label, i) => ({ id: `k${i}`, label }));
  const correct = curv.sign() < 0 ? 'k0' : 'k1';
  const answer = choiceAnswer(options, correct);
  const steps = derivSteps(f);
  steps.push(
    {
      key: 'critical-points',
      instruction: "Check that it's a critical point: $f'(x) = 0$ there.",
      math: `f'(${at}) = ${polyEval(polyDeriv(f), at).toLatex()}`,
      why: 'Local maxima and minima of a smooth function happen where the slope is zero.',
      ask: { prompt: `$f'(${at}) = \\;?$`, answer: numberAnswer(polyEval(polyDeriv(f), at)), verify: { type: 'evaluate', expr: polyExpr(polyDeriv(f)).replace(/x/g, `(${at})`) } },
    },
    {
      key: 'classify',
      instruction: `Evaluate $f''(${at})$ and read its sign.`,
      math: `f''(${at}) = ${curv.toLatex()} ${curv.sign() < 0 ? '< 0 \\Rightarrow \\text{maximum}' : '> 0 \\Rightarrow \\text{minimum}'}`,
      why: 'f″ < 0: concave down, a hilltop (max). f″ > 0: concave up, a valley (min).',
      ask: { prompt: `At $x = ${at}$, $f$ has…`, answer },
    },
  );
  return {
    params: { a, r1, r2, d, at },
    prompt: `$$f(x) = ${polyLatex(f)}$$ has a critical point at $x = ${at}$. What kind of point is it?`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [{ id: 'sign-flipped', wrong: choiceAnswer(options, correct === 'k0' ? 'k1' : 'k0') }]),
    verify: { type: 'choice', note: 'tests/skills/concavity-second-derivative.test.ts re-derives the sign of f″' },
  };
}

function level5(rng: Rng): Body {
  for (;;) {
    const a = rng.int(1, 2);
    const r1 = rng.int(-6, -1);
    const r2 = rng.int(2, 12);
    if ((3 * a * (r1 + r2)) % 2 !== 0) continue;
    // π'(q) = −3a(q − r1)(q − r2)  ⇒  π(q) = −a q³ + (3a(r1+r2)/2) q² − 3a r1 r2 q
    const f = P(0, -3 * a * r1 * r2, (3 * a * (r1 + r2)) / 2, -a);
    const answer = numberAnswer(r2);
    const steps = derivSteps(f, 'q');
    steps.push(
      {
        key: 'critical-points',
        instruction: "Set marginal profit $\\pi'(q) = 0$ and solve.",
        math: `${polyLatex(polyDeriv(f), 'q')} = 0 \\;\\Rightarrow\\; q = ${r1} \\text{ or } q = ${r2}`,
        why: 'Profit can only peak where one more unit adds nothing: marginal profit is zero.',
        ask: { prompt: 'What is the positive solution of $\\pi\'(q) = 0$?', answer, verify: { type: 'solve', equations: [`${polyExpr(polyDeriv(f), 'q')} = 0`], unknowns: ['q'], positive: true } },
      },
      {
        key: 'classify',
        instruction: "Check the second-order condition at that point.",
        math: `\\pi''(${r2}) = ${polyEval(polyDeriv(polyDeriv(f)), r2).toLatex()} < 0 \\;\\Rightarrow\\; \\text{maximum}`,
        why: 'π″ < 0 at the critical point: it is a peak. (A negative quantity makes no economic sense here anyway.)',
        ask: { prompt: 'So profit is maximized at $q = \\;?$', answer, verify: { type: 'evaluate', expr: `${r2}` } },
      },
    );
    return {
      params: { a, r1, r2 },
      prompt: `A firm's profit (in thousands of dollars) from producing $q$ units is $$\\pi(q) = ${polyLatex(f, 'q')}$$ What output $q$ maximizes profit?`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [wrongNumber('picked-min', () => r1)]),
      interpretation: [
        (() => {
          const ch = choice(rng, '0: one more unit adds (almost) nothing to profit', [
            'Positive: profit is still rising',
            'Negative: profit is falling',
            `${r2}: the optimal quantity`,
          ]);
          return {
            prompt: `At $q = ${r2}$, what is marginal profit $\\pi'(q)$?`,
            options: ch.options,
            correct: ch.correct,
            explanation: 'At an interior maximum the first derivative is zero: before it, marginal profit is positive (produce more); after it, negative (produce less). That is the "marginal revenue = marginal cost" condition in disguise.',
          };
        })(),
      ],
      verify: { type: 'solve', equations: [`${polyExpr(polyDeriv(f), 'q')} = 0`], unknowns: ['q'], positive: true },
    };
  }
}

export const concavitySecondDerivative: SkillDefinition = {
  id: ID,
  title: 'Concavity & second-derivative test',
  track: 'math',
  unit: 'Applications',
  description: 'Second derivatives, inflection points, and telling maxima from minima.',
  prerequisites: ['derivatives-power-rule'],
  maxDenominator: 6,
  levels: {
    1: { description: "Find f″(x)", ranges: { deg: [3, 4], c0: [-9, 9], c1: [-9, 9], c2: [-9, 9], c3: [-9, 9], c4: [-5, 5] } },
    2: { description: "Evaluate f″ and read the concavity", ranges: { a: [-4, 4], b: [-9, 9], c: [-9, 9], d: [-9, 9], x0: [-3, 3] } },
    3: { description: 'Inflection point of a cubic', ranges: { a: [-2, 2], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },
    4: { description: 'Classify a critical point', ranges: { a: [-2, 2], r1: [-5, 4], r2: [-4, 10], d: [-9, 9], at: [-5, 10] } },
    5: { description: 'Maximize a cubic profit function', ranges: { a: [1, 2], r1: [-6, -1], r2: [2, 12] } },
  },
  misconceptions: {
    'used-first-derivative': { name: "Used f′ instead of f″", explanation: "Concavity is about how the slope changes, so it needs the derivative of the derivative. Differentiate twice." },
    'inflection-wrong-formula': { name: 'Used the parabola vertex formula', explanation: "$-\\frac{b}{2a}$ is the vertex of $ax^2 + bx + c$. For a cubic $ax^3 + bx^2 + \\dots$, $f''(x) = 6ax + 2b = 0$ gives $x = -\\frac{b}{3a}$." },
    'sign-flipped': { name: 'Mixed up the sign rule', explanation: "f″ > 0 means concave UP (a valley): a minimum. f″ < 0 means concave DOWN (a hilltop): a maximum. Picture $x^2$ (f″ = 2 > 0) with its minimum at 0." },
    'picked-min': { name: 'Picked the wrong critical point', explanation: "π′ = 0 has two solutions; check π″ at each. The maximum is where π″ < 0 (and here the other root is negative, which makes no sense as an output level)." },
  },
  stepLabels: {
    'first-derivative': "Find f′",
    'second-derivative': "Differentiate again: f″",
    evaluate: "Evaluate f″ at the point",
    'solve-f2-zero': "Set f″ = 0",
    'critical-points': "Find where f′ = 0",
    classify: "f″ < 0 → max, f″ > 0 → min",
  },
  learn: {
    whyItMatters:
      'The first derivative finds where the slope is zero; the second tells you whether that point is a hilltop or a valley. For profit $\\pi(q) = -q^3 + 6q^2 + 15q$, $\\pi\'(q) = -3q^2 + 12q + 15 = 0$ gives $q = 5$ or $q = -1$, and $\\pi\'\'(5) = -6(5) + 12 = -18 < 0$, so $q = 5$ is the profit maximum. In micro theory, concavity is diminishing marginal returns, and "second-order conditions" are this test.',
    summary:
      "$f''$ is the rate of change of the slope. $f'' > 0$: concave up (the slope is increasing). $f'' < 0$: concave down. At a critical point ($f' = 0$), $f'' < 0$ means a local maximum and $f'' > 0$ a local minimum. An inflection point is where $f''$ changes sign.",
    formulas: [
      { latex: "f''(x) = \\frac{d}{dx}f'(x)" },
      { latex: "f'(c) = 0,\\; f''(c) < 0 \\Rightarrow \\text{local max}; \\quad f''(c) > 0 \\Rightarrow \\text{local min}" },
      { latex: 'f(x) = ax^3 + bx^2 + cx + d \\;\\Rightarrow\\; \\text{inflection at } x = -\\frac{b}{3a}' },
    ],
    example: { seed: 9, level: 5 },
    tips: ['If f″ = 0 at a critical point, the test is inconclusive: check the sign of f′ on each side instead.'],
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

