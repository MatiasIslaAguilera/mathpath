// Function composition: evaluate f(g(a)) (L1-L2), expand f(g(x)) (L3), choose the order
// g(f(x)) vs f(g(x)) (L4), and decompose h(x) = f(g(x)) (L5).

import { choiceAnswer, expressionAnswer, numberAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'function-composition';

type Generated = ReturnType<SkillDefinition['generate']>;

// ---------- polynomials: coefficient arrays, ascending degree ----------

type Poly = Q[];
const P = (...c: number[]): Poly => c.map((x) => q(x));

function trim(a: Poly): Poly {
  const r = a.slice();
  while (r.length > 1 && r[r.length - 1].isZero()) r.pop();
  return r;
}
function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  return trim(Array.from({ length: n }, (_, i) => (a[i] ?? q(0)).add(b[i] ?? q(0))));
}
function scale(a: Poly, k: Q): Poly {
  return trim(a.map((c) => c.mul(k)));
}
function mul(a: Poly, b: Poly): Poly {
  const r: Poly = Array.from({ length: a.length + b.length - 1 }, () => q(0));
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] = r[i + j].add(x.mul(y)))));
  return trim(r);
}
/** f(g(x)) */
function compose(f: Poly, g: Poly): Poly {
  let result: Poly = [q(0)];
  let gPow: Poly = [q(1)];
  f.forEach((c) => {
    result = add(result, scale(gPow, c));
    gPow = mul(gPow, g);
  });
  return result;
}
function evalAt(a: Poly, x: Q): Q {
  return a.reduceRight((acc, c) => acc.mul(x).add(c), q(0));
}

/** "3x^{2} - x + 5" for polynomial coefficients, in variable v. */
function latex(a: Poly, v = 'x'): string {
  const terms: string[] = [];
  for (let d = a.length - 1; d >= 0; d--) {
    const c = a[d];
    if (c.isZero()) continue;
    if (d === 0) terms.push(c.toLatex());
    else terms.push(`${coefLatex(c)}${v}${d === 1 ? '' : `^{${d}}`}`);
  }
  return joinTerms(terms);
}
/** mathjs / SymPy syntax. */
function expr(a: Poly, v = 'x'): string {
  const terms: string[] = [];
  a.forEach((c, d) => {
    if (c.isZero()) return;
    terms.push(d === 0 ? c.toExpr() : d === 1 ? `${c.toExpr()}*${v}` : `${c.toExpr()}*${v}^${d}`);
  });
  return terms.length ? terms.join(' + ') : '0';
}
/** a(inner) in mathjs syntax, where inner is a parenthesizable string. */
function exprOf(a: Poly, inner: string): string {
  return a.map((c, d) => (d === 0 ? c.toExpr() : `${c.toExpr()}*(${inner})${d === 1 ? '' : `^${d}`}`)).join(' + ');
}
const par = (x: Q) => (x.sign() < 0 || !x.isInt() ? `(${x.toLatex()})` : x.toLatex());

function polyAnswer(a: Poly): ReturnType<typeof expressionAnswer> {
  return expressionAnswer(expr(a), latex(a));
}

// ---------- interpretation (L1/L2): what a composition means in economics ----------

interface Context {
  x: string;
  mid: string;
  out: string;
  setup: string;
}
const CONTEXTS: Context[] = [
  { x: 'cost', mid: 'price', out: 'quantity sold', setup: 'Price depends on cost, $P = g(c)$, and quantity sold depends on price, $Q = f(P)$.' },
  { x: 'tax rate', mid: 'price', out: 'quantity demanded', setup: 'A tax rate $t$ sets the price, $P = g(t)$, and the price sets quantity demanded, $Q = f(P)$.' },
  { x: 'hours worked', mid: 'output', out: 'revenue', setup: 'Hours worked $h$ set output, $y = g(h)$, and output sets revenue, $R = f(y)$.' },
];

function interpretation(rng: Rng): InterpretationQuestion {
  const ctx = rng.pick(CONTEXTS);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const labels = [
    `${cap(ctx.out)}, as a function of ${ctx.x}`,
    `${cap(ctx.mid)}, as a function of ${ctx.x}`,
    `${cap(ctx.out)}, as a function of ${ctx.mid}`,
    `${cap(ctx.x)}, as a function of ${ctx.out}`,
  ];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return {
    prompt: `${ctx.setup} What does the composition $f(g(\\cdot))$ give?`,
    options,
    correct: 'o0',
    explanation: `$g$ turns ${ctx.x} into ${ctx.mid}, then $f$ turns ${ctx.mid} into ${ctx.out}. Chaining them skips the middle step: $f(g(\\cdot))$ takes ${ctx.x} straight to ${ctx.out}. The inner function is applied first.`,
  };
}

// ---------- levels 1-2: evaluate f(g(a)) ----------

function evaluateComposition(rng: Rng, level: 1 | 2): Generated {
  let f: Poly;
  let g: Poly;
  let params: Record<string, number>;
  let u = 0;
  if (level === 1) {
    const m = rng.nonzero(-6, 6);
    const n = rng.int(-6, 6);
    const p = rng.nonzero(-6, 6);
    const qc = rng.int(-6, 6);
    u = rng.int(-5, 5);
    f = P(n, m);
    g = P(qc, p);
    params = { m, n, p, q: qc, u };
  } else {
    const form = rng.int(0, 1); // 0: f quadratic, g linear; 1: f linear, g quadratic
    const a2 = rng.nonzero(-3, 3);
    const a1 = rng.int(-5, 5);
    const a0 = rng.int(-6, 6);
    const m = rng.nonzero(-5, 5);
    const n = rng.int(-6, 6);
    u = rng.int(-4, 4);
    const quad = P(a0, a1, a2);
    const lin = P(n, m);
    f = form === 0 ? quad : lin;
    g = form === 0 ? lin : quad;
    params = { form, a2, a1, a0, m, n, u };
  }
  const uq = q(u);
  const inner = evalAt(g, uq);
  const value = evalAt(f, inner);
  const answer = numberAnswer(value);
  const gExpr = exprOf(g, par(uq));
  const verify = { type: 'evaluate' as const, expr: exprOf(f, `${exprOf(g, par(uq))}`) };
  const uShown = `(${u})`;

  const steps: Step[] = [
    {
      key: 'inner-first',
      instruction: `In $f(g(${u}))$ the inner function $g$ acts first. Find $g(${u})$.`,
      math: `g(${u}) = ${latex(g, uShown)} = ${inner.toLatex()}`,
      why: 'Work from the inside out: evaluate the inner function at the input, then feed that number to the outer function.',
      ask: { prompt: `$g(${u}) = \\;?$`, answer: numberAnswer(inner), verify: { type: 'evaluate', expr: gExpr } },
    },
    {
      key: 'substitute-inner',
      instruction: `Now use that result as the input of $f$: $f(${inner.toLatex()})$.`,
      math: `f(g(${u})) = f(${inner.toLatex()}) = ${latex(f, `(${inner.toLatex()})`)} = ${value.toLatex()}`,
      why: 'The output of the inner function becomes the input of the outer function.',
      ask: { prompt: `$f(g(${u})) = \\;?$`, answer, verify },
    },
  ];

  const swapped = evalAt(g, evalAt(f, uq));
  const product = evalAt(f, uq).mul(evalAt(g, uq));
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'order-swapped', wrong: numberAnswer(swapped) },
    { id: 'multiplied-functions', wrong: numberAnswer(product) },
  ];

  return {
    params,
    prompt: `Let $f(x) = ${latex(f)}$ and $g(x) = ${latex(g)}$. Find $f(g(${u}))$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    // About half the problems also ask what a composition means (drawn last).
    interpretation: rng.chance(0.5) ? [interpretation(rng)] : undefined,
    verify,
  };
}

// ---------- levels 3-4: compose as an expression ----------

function expandLikeStep(outer: Poly, innerP: Poly, label: string): Step {
  // Ask for the first sub-computation: expand (inner)^2 when the outer is quadratic, else B(inner).
  const innerExpr = expr(innerP);
  if (outer.length === 3) {
    const sq = mul(innerP, innerP);
    return {
      key: 'substitute-inner',
      instruction: `Write the composition by replacing $x$ in the outer function with the inner function (${label}), then expand the squared part.`,
      math: `(${latex(innerP)})^{2} = ${latex(sq)}`,
      why: 'Square the *whole* inner expression: $(px+q)^2 = p^2x^2 + 2pqx + q^2$. Squaring term by term misses the middle term.',
      ask: {
        prompt: `Expand $(${latex(innerP)})^{2}$.`,
        answer: polyAnswer(sq),
        verify: { type: 'equivalent', expr: `(${innerExpr})^2`, variables: ['x'] },
      },
    };
  }
  const B = outer[1];
  const scaled = scale(innerP, B);
  return {
    key: 'substitute-inner',
    instruction: `Write the composition by replacing $x$ in the outer function with the inner function (${label}), then distribute the coefficient.`,
    math: `${par(B)}\\,(${latex(innerP)}) = ${latex(scaled)}`,
    why: 'Substituting means every $x$ in the outer function becomes the whole inner function, in parentheses.',
    ask: {
      prompt: `Expand $${par(B)}(${latex(innerP)})$.`,
      answer: polyAnswer(scaled),
      verify: { type: 'equivalent', expr: `${B.toExpr()}*(${innerExpr})`, variables: ['x'] },
    },
  };
}

/** Outer applied to an inner that was "squared term by term": A(p²x² + q²) + B·inner + C (inner linear). */
function squaredTermByTerm(outer: Poly, inner: Poly): Poly | null {
  if (outer.length !== 3 || inner.length !== 2) return null;
  const wrongSq: Poly = [inner[0].mul(inner[0]), q(0), inner[1].mul(inner[1])];
  return add(add(scale(wrongSq, outer[2]), scale(inner, outer[1])), [outer[0]]);
}

function composeExpression(rng: Rng): Generated {
  let A = 0;
  let B = 0;
  let C = 0;
  let pp = 0;
  let qc = 0;
  for (;;) {
    A = rng.chance(0.5) ? 0 : rng.nonzero(-3, 3);
    B = rng.int(-6, 6);
    C = rng.int(-6, 6);
    pp = rng.nonzero(-4, 4);
    qc = rng.int(-6, 6);
    if (A === 0 && B === 0) continue;
    break;
  }
  const f = trim(P(C, B, A));
  const g = P(qc, pp);
  const result = compose(f, g);
  const answer = polyAnswer(result);
  const literal = exprOf(P(C, B, A), `${pp}*x + ${q(qc).toExpr()}`);
  const verify = { type: 'equivalent' as const, expr: literal, variables: ['x'] };

  const s1 = expandLikeStep(f, g, 'g(x)');
  const steps: Step[] = [
    s1,
    {
      key: 'expand',
      instruction: 'Expand and combine like terms.',
      math: `f(g(x)) = ${latex(result)}`,
      why: 'After substituting, multiply out and collect terms with the same power of $x$.',
      ask: { prompt: '$f(g(x)) = \\;?$', answer, verify },
    },
  ];

  const swapped = compose(g, f);
  const product = mul(f, g);
  const sqWrong = squaredTermByTerm(f, g);
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'order-swapped', wrong: polyAnswer(swapped) },
    { id: 'multiplied-functions', wrong: polyAnswer(product) },
    sqWrong ? { id: 'square-not-expanded', wrong: polyAnswer(sqWrong) } : null,
  ];

  return {
    params: { A, B, C, p: pp, q: qc },
    prompt: `Let $f(x) = ${latex(f)}$ and $g(x) = ${latex(g)}$. Find $f(g(x))$ as a simplified expression.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

function composeOrder(rng: Rng): Generated {
  let which = 0;
  let A = 0;
  let B = 0;
  let C = 0;
  let D = 0;
  let E = 0;
  let F = 0;
  for (;;) {
    which = rng.int(0, 1); // 0: ask f(g(x)); 1: ask g(f(x))
    const quad = rng.int(0, 2); // 0 none, 1 f quadratic, 2 g quadratic
    A = quad === 1 ? rng.nonzero(-2, 2) : 0;
    D = quad === 2 ? rng.nonzero(-2, 2) : 0;
    B = rng.int(-5, 5);
    C = rng.int(-6, 6);
    E = rng.int(-5, 5);
    F = rng.int(-6, 6);
    if ((A === 0 && B === 0) || (D === 0 && E === 0)) continue;
    break;
  }
  const f = trim(P(C, B, A));
  const g = trim(P(F, E, D));
  const outer = which === 0 ? f : g;
  const innerP = which === 0 ? g : f;
  const outerName = which === 0 ? 'f' : 'g';
  const innerName = which === 0 ? 'g' : 'f';
  const result = compose(outer, innerP);
  const answer = polyAnswer(result);
  const literal = exprOf(outer, expr(innerP));
  const verify = { type: 'equivalent' as const, expr: literal, variables: ['x'] };
  const comp = `${outerName}(${innerName}(x))`;

  const s2 = expandLikeStep(outer, innerP, `${innerName}(x)`);
  const steps: Step[] = [
    {
      key: 'identify-inner',
      instruction: `In $${comp}$, the function written *closest to $x$* is applied first.`,
      math: `${comp}: \\; ${innerName} \\text{ first, then } ${outerName}`,
      why: 'Read compositions from the inside out. $f(g(x))$ means "do $g$, then $f$"; $g(f(x))$ means "do $f$, then $g$".',
      ask: {
        prompt: `In $${comp}$, which function is applied first?`,
        answer: choiceAnswer(
          [
            { id: 'f', label: '$f$' },
            { id: 'g', label: '$g$' },
          ],
          innerName,
        ),
      },
    },
    s2,
    {
      key: 'expand',
      instruction: 'Expand and combine like terms.',
      math: `${comp} = ${latex(result)}`,
      why: 'After substituting, multiply out and collect terms with the same power of $x$.',
      ask: { prompt: `$${comp} = \\;?$`, answer, verify },
    },
  ];

  const other = which === 0 ? compose(g, f) : compose(f, g);
  const product = mul(f, g);
  const sqWrong = squaredTermByTerm(outer, innerP);
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'order-swapped', wrong: polyAnswer(other) },
    { id: 'multiplied-functions', wrong: polyAnswer(product) },
    sqWrong ? { id: 'square-not-expanded', wrong: polyAnswer(sqWrong) } : null,
  ];

  return {
    params: { which, A, B, C, D, E, F },
    prompt: `Let $f(x) = ${latex(f)}$ and $g(x) = ${latex(g)}$. Find $${comp}$ as a simplified expression.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- level 5: decomposition ----------

function decompose(rng: Rng): Generated {
  const form = rng.int(0, 2); // 0: (mx+n)^k   1: sqrt(mx+n)   2: e^(mx+n)
  const m = rng.nonzero(-5, 5);
  const n = rng.int(-9, 9);
  const k = form === 0 ? rng.int(2, 5) : 0;
  const inner = P(n, m);
  const innerL = latex(inner);
  const hLatex = form === 0 ? `(${innerL})^{${k}}` : form === 1 ? `\\sqrt{${innerL}}` : `e^{${innerL}}`;
  const outerL = form === 0 ? `f(u) = u^{${k}}` : form === 1 ? 'f(u) = \\sqrt{u}' : 'f(u) = e^{u}';
  const answer = polyAnswer(inner);
  // The problem statement as an equivalence to the inner function (see tests for f(g(x)) = h(x)).
  const verify = { type: 'equivalent' as const, expr: expr(inner), variables: ['x'] };

  const outerLabels = [
    form === 0 ? `Raise to the power ${k}` : 'Raise to a power',
    'Take the square root',
    'Use it as the exponent of $e$',
    'Multiply by a constant',
  ];
  const correctIdx = form === 0 ? 0 : form === 1 ? 1 : 2;
  const labels = [outerLabels[correctIdx], ...outerLabels.filter((_, i) => i !== correctIdx)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));

  const steps: Step[] = [
    {
      key: 'identify-outer',
      instruction: 'The outer function is the *last* operation applied to the inside.',
      math: `h(x) = ${hLatex} \\;\\Rightarrow\\; ${outerL}`,
      why: 'To evaluate $h$, you first compute the inside, then apply one final operation. That last operation is the outer function.',
      ask: { prompt: 'Which operation is applied last, to the expression inside?', answer: choiceAnswer(options, 'o0') },
    },
    {
      key: 'identify-inner',
      instruction: `Whatever sits inside the outer function is the inner function $g(x)$.`,
      math: `g(x) = ${innerL}`,
      why: 'The inner function is what the outer function is applied to. This is exactly the piece the chain rule will differentiate separately.',
      ask: { prompt: `Find the inner function: $g(x) = \\;?$`, answer, verify },
    },
  ];

  const outerAsInner = form === 0 ? { v: `x^${k}`, l: `x^{${k}}` } : form === 1 ? { v: 'sqrt(x)', l: '\\sqrt{x}' } : { v: 'exp(x)', l: 'e^{x}' };
  const candidates: (MisconceptionInstance | null)[] = [{ id: 'outer-as-inner', wrong: expressionAnswer(outerAsInner.v, outerAsInner.l) }];

  return {
    params: { form, m, n, k },
    prompt: `The function $$h(x) = ${hLatex}$$ can be written as $h(x) = f(g(x))$ with outer function $${outerL}$. Find the inner function $g(x)$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- the skill ----------

export const functionComposition: SkillDefinition = {
  id: ID,
  title: 'Function composition',
  track: 'math',
  unit: 'Functions',
  description: 'Evaluate and build compositions f(g(x)), and split a function into outer and inner parts.',
  prerequisites: ['functions-basics'],
  maxDenominator: 1,
  levels: {
    1: { description: 'f(g(a)) with two linear functions', ranges: { m: [-6, 6], n: [-6, 6], p: [-6, 6], q: [-6, 6], u: [-5, 5] } },
    2: {
      description: 'f(g(a)) when f or g is quadratic',
      ranges: { form: [0, 1], a2: [-3, 3], a1: [-5, 5], a0: [-6, 6], m: [-5, 5], n: [-6, 6], u: [-4, 4] },
    },
    3: { description: 'Expand f(g(x)) as an expression', ranges: { A: [-3, 3], B: [-6, 6], C: [-6, 6], p: [-4, 4], q: [-6, 6] } },
    4: {
      description: 'f(g(x)) versus g(f(x))',
      ranges: { which: [0, 1], A: [-2, 2], B: [-5, 5], C: [-6, 6], D: [-2, 2], E: [-5, 5], F: [-6, 6] },
    },
    5: { description: 'Decomposition: find the inner function', ranges: { form: [0, 2], m: [-5, 5], n: [-9, 9], k: [0, 5] } },
  },
  misconceptions: {
    'order-swapped': {
      name: 'Applied the functions in the wrong order',
      explanation:
        '$f(g(x))$ means do $g$ first, then $f$. The function written closest to $x$ goes first. Swapping gives $g(f(x))$, which is usually a different function.',
    },
    'multiplied-functions': {
      name: 'Multiplied f and g instead of composing',
      explanation:
        '$f(g(x))$ is "feed the output of $g$ into $f$", not $f(x)\\cdot g(x)$. Replace each $x$ in $f$ by the whole expression $g(x)$.',
    },
    'square-not-expanded': {
      name: 'Squared term by term',
      explanation:
        '$(3x + 1)^2 = (3x+1)(3x+1) = 9x^2 + 6x + 1$, not $9x^2 + 1$. A square of a sum has a middle term: $(a+b)^2 = a^2 + 2ab + b^2$.',
    },
    'outer-as-inner': {
      name: 'Gave the outer function as the inner one',
      explanation:
        'The outer function is the last operation (the power, root or exponential). The inner function is what it is applied to: for $(3x - 2)^4$ the outer function is $u^4$ and the inner is $3x - 2$.',
    },
  },
  stepLabels: {
    'inner-first': 'Evaluate the inner function first',
    'substitute-inner': 'Substitute the inner result into the outer function',
    expand: 'Expand and simplify',
    'identify-inner': 'Identify the inner function',
    'identify-outer': 'Identify the outer function',
  },
  learn: {
    whyItMatters:
      'Much of economics chains effects together: a tax changes the price, and the price changes quantity demanded, so quantity depends on the tax through a composition. If the price is $P = 50 + 2t$ and demand is $Q = 200 - 3P$, then $Q = 200 - 3(50 + 2t) = 50 - 6t$: each extra dollar of tax cuts quantity by 6 units. The chain rule, coming in derivatives, is how you differentiate these chains.',
    summary:
      '$f(g(x))$ means "apply $g$ first, then $f$". To evaluate at a number, compute the inner value first. To get an expression, replace every $x$ in $f$ by the whole expression $g(x)$ (in parentheses), then expand. Order matters: $f(g(x))$ and $g(f(x))$ are usually different.',
    formulas: [
      { latex: '(f \\circ g)(x) = f(g(x))', note: 'Inner function first.' },
      { latex: '(ax + b)^2 = a^2x^2 + 2abx + b^2', note: 'Do not square term by term.' },
    ],
    example: { seed: 2, level: 3 },
    tips: ['Read compositions from the inside out. The function next to $x$ goes first.'],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
      case 2:
        return evaluateComposition(rng, level);
      case 3:
        return composeExpression(rng);
      case 4:
        return composeOrder(rng);
      case 5:
        return decompose(rng);
    }
  },
};
