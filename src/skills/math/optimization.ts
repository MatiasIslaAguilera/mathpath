// Single-variable optimization, economics flavored. Answers are (argmax/argmin, optimal value)
// tuples; the verify solves "derivative = 0" for the quantity (positive) and evaluates the value.

import { expressionAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'optimization';
type Body = ReturnType<SkillDefinition['generate']>;

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

const marginalZeroQuestion = (rng: Rng, what: string, qStar: Q): InterpretationQuestion => {
  const ch = choice(rng, `0: one more unit adds (almost) nothing to ${what}`, [`Positive: ${what} is still rising`, `Negative: ${what} is falling`, `${qStar.toLatex()}, the optimal quantity`].map((s) => s.replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2')));
  return {
    prompt: `At the optimal quantity, what is the derivative of ${what}?`,
    options: ch.options,
    correct: ch.correct,
    explanation: `At an interior optimum the derivative is zero. Before it, the next unit adds ${what} (keep going); after it, the next unit subtracts (stop). This is why economists say "produce until marginal revenue equals marginal cost".`,
  };
};

interface Spec {
  params: Record<string, number>;
  prompt: string;
  v: string; // variable
  /** What the learner calls the optimal value in their working: R, AC, pi (profit), A (area). */
  valueName: string;
  fLatex: string; // objective, LaTeX
  fExpr: string; // objective, mathjs/SymPy
  dLatex: string;
  dExpr: string;
  xStar: Q;
  value: Q;
  labels: [string, string];
  displayLabels: [string, string];
  maximize: boolean;
  secondOrder: string; // LaTeX for the second-order check
  wrong: (MisconceptionInstance | null)[];
  interpretation: InterpretationQuestion[];
  solveWhy: string;
}

function build(s: Spec): Body {
  const answer = tupleAnswer(s.labels, [s.xStar, s.value], s.displayLabels);
  const steps: Step[] = [
    {
      key: 'objective',
      instruction: `Identify the function to ${s.maximize ? 'maximize' : 'minimize'}.`,
      math: s.fLatex,
      why: 'Everything else follows from writing the objective as a function of one variable.',
    },
    {
      key: 'derivative',
      instruction: 'Differentiate.',
      math: s.dLatex,
      why: 'At an interior optimum the slope of the objective is zero.',
      ask: { prompt: 'What is the derivative?', answer: expressionAnswer(s.dExpr, s.dLatex.split('=').pop()!.trim(), [s.v]), verify: { type: 'diff', expr: s.fExpr, variable: s.v } },
    },
    {
      key: 'solve',
      instruction: 'Set the derivative to 0 and solve.',
      math: `${s.dLatex.split('=').pop()!.trim()} = 0 \\;\\Rightarrow\\; ${s.v} = ${s.xStar.toLatex()}`,
      why: s.solveWhy,
      ask: { prompt: `$${s.v}^* = \\;?$`, answer: numberAnswer(s.xStar), verify: { type: 'solve', equations: [`${s.dExpr} = 0`], unknowns: [s.v], positive: true } },
    },
    {
      key: 'second-order',
      instruction: `Check that it's a ${s.maximize ? 'maximum' : 'minimum'}.`,
      math: s.secondOrder,
      why: s.maximize ? 'Second derivative negative: concave down, a peak.' : 'Second derivative positive: concave up, a valley.',
    },
    {
      key: 'value',
      instruction: 'Evaluate the objective at the optimum.',
      math: `${s.displayLabels[1]} = ${s.value.toLatex()}`,
      why: 'The question asks for the best achievable value too, not just where it happens.',
      ask: { prompt: `$${s.displayLabels[0]}$ and the ${s.maximize ? 'maximum' : 'minimum'} value?`, answer, verify: { type: 'solve', equations: [`${s.dExpr} = 0`, `V = ${s.fExpr}`], unknowns: [s.v, 'V'], positive: true } },
    },
  ];
  return {
    params: s.params,
    prompt: s.prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, s.wrong),
    interpretation: s.interpretation.length ? s.interpretation : undefined,
    verify: { type: 'solve', equations: [`${s.dExpr} = 0`, `V = ${s.fExpr}`], unknowns: [s.v, 'V'], positive: true },
    working: { solutions: [{ [s.v]: s.xStar.toExpr(), [s.valueName]: s.value.toExpr() }] },
  };
}

const wrongTuple = (id: string, labels: [string, string], display: [string, string], x: Q, v: Q): MisconceptionInstance => ({ id, wrong: tupleAnswer(labels, [x, v], display) });

function level1(rng: Rng): Body {
  // Revenue R(q) = a q − b q²  ⇒  q* = a/(2b), R* = a²/(4b)
  const b = rng.int(1, 6);
  const k = rng.int(2, 20);
  const a = 2 * b * k + rng.pick([0, 0, b]); // q* is an integer or a half
  const xStar = q(a, 2 * b);
  const R = (x: Q) => x.mul(a).sub(x.mul(x).mul(b));
  const labels: [string, string] = ['Quantity', 'Maximum revenue'];
  const disp: [string, string] = ['q^*', 'R^*'];
  return build({
    params: { a, b },
    prompt: `A firm's revenue (in dollars) from selling $q$ units is $$R(q) = ${a}q - ${b === 1 ? '' : b}q^2$$ Find the quantity that maximizes revenue and the maximum revenue.`,
    v: 'q',
    valueName: 'R',
    fLatex: `R(q) = ${a}q - ${b === 1 ? '' : b}q^2`,
    fExpr: `${a}*q - ${b}*q^2`,
    dLatex: `R'(q) = ${a} - ${2 * b}q`,
    dExpr: `${a} - ${2 * b}*q`,
    xStar,
    value: R(xStar),
    labels,
    displayLabels: disp,
    maximize: true,
    secondOrder: `R''(q) = -${2 * b} < 0`,
    // R(q) = 0 at q = a/b: the other classic slip (same number as forgetting the 2).
    wrong: [wrongTuple('set-function-zero', labels, disp, q(a, b), R(q(a, b)))],
    interpretation: [marginalZeroQuestion(rng, 'revenue', xStar)],
    solveWhy: `Marginal revenue is zero: selling one more unit no longer adds revenue.`,
  });
}

function level2(rng: Rng): Body {
  // AC(q) = F/q + w q  ⇒  q* = √(F/w), AC* = 2 w q*
  const w = rng.int(1, 6);
  const qs = rng.int(2, 15);
  const F = w * qs * qs;
  const labels: [string, string] = ['Quantity', 'Minimum average cost'];
  const disp: [string, string] = ['q^*', 'AC^*'];
  const ac = (x: Q) => q(F).div(x).add(x.mul(w));
  const ch = choice(rng, 'Dollars per unit', ['Dollars', 'Units', 'Units per dollar']);
  return build({
    params: { w, qs, F },
    prompt: `A firm's average cost (dollars per unit) is $$AC(q) = \\frac{${F}}{q} + ${w === 1 ? '' : w}q$$ for $q > 0$. Find the output that minimizes average cost and that minimum.`,
    v: 'q',
    valueName: 'AC',
    fLatex: `AC(q) = \\frac{${F}}{q} + ${w === 1 ? '' : w}q`,
    fExpr: `${F}/q + ${w}*q`,
    dLatex: `AC'(q) = -\\frac{${F}}{q^2} + ${w}`,
    dExpr: `-${F}/q^2 + ${w}`,
    xStar: q(qs),
    value: ac(q(qs)),
    labels,
    displayLabels: disp,
    maximize: false,
    secondOrder: `AC''(q) = \\frac{${2 * F}}{q^3} > 0 \\text{ for } q > 0`,
    wrong: [wrongTuple('forgot-sqrt', labels, disp, q(F, w), ac(q(F, w)))],
    interpretation: [
      {
        prompt: 'What are the units of the minimum average cost?',
        options: ch.options,
        correct: ch.correct,
        explanation: 'Average cost is total cost (dollars) divided by output (units): dollars per unit. The minimum is the cheapest cost per unit the firm can reach, its efficient scale.',
      },
    ],
    solveWhy: `$\\frac{${F}}{q^2} = ${w} \\Rightarrow q^2 = ${F / w} \\Rightarrow q = ${qs}$ (output can't be negative).`,
  });
}

function level3(rng: Rng): Body {
  // π(q) = p q − (F + v q + w q²)  ⇒  q* = (p − v)/(2w), π* = w k² − F (kept positive)
  let w: number, k: number, F: number;
  do {
    w = rng.int(1, 5);
    k = rng.int(3, 20);
    F = rng.int(10, 200);
  } while (w * k * k <= F);
  const v = rng.int(2, 30);
  const p = v + 2 * w * k;
  const pi = (x: Q) => x.mul(p).sub(q(F).add(x.mul(v)).add(x.mul(x).mul(w)));
  const labels: [string, string] = ['Quantity', 'Maximum profit'];
  const disp: [string, string] = ['q^*', '\\pi^*'];
  return build({
    params: { p, v, w, F },
    prompt: `A competitive firm sells at a price of \\$${p} per unit. Its total cost is $$C(q) = ${F} + ${v}q + ${w === 1 ? '' : w}q^2$$ Find the profit-maximizing output and the maximum profit.`,
    v: 'q',
    valueName: 'pi',
    fLatex: `\\pi(q) = ${p}q - (${F} + ${v}q + ${w === 1 ? '' : w}q^2)`,
    fExpr: `${p}*q - (${F} + ${v}*q + ${w}*q^2)`,
    dLatex: `\\pi'(q) = ${p} - ${v} - ${2 * w}q`,
    dExpr: `${p} - ${v} - ${2 * w}*q`,
    xStar: q(k),
    value: pi(q(k)),
    labels,
    displayLabels: disp,
    maximize: true,
    secondOrder: `\\pi''(q) = -${2 * w} < 0`,
    wrong: [
      wrongTuple('forgot-two', labels, disp, q(p - v, w), pi(q(p - v, w))),
      wrongTuple('profit-forgot-fixed', labels, disp, q(k), pi(q(k)).add(F)),
    ],
    interpretation: [marginalZeroQuestion(rng, 'profit', q(k))],
    solveWhy: 'Price = marginal cost: the last unit sells for exactly what it costs to make.',
  });
}

function level4(rng: Rng): Body {
  // Demand P = A − B q, constant marginal cost c:  π = (A − Bq)q − cq  ⇒  q* = (A − c)/(2B), P* = A − B q*
  const B = rng.int(1, 5);
  const k = rng.int(2, 20);
  const c = rng.int(2, 40);
  const A = c + 2 * B * k;
  const qStar = q(k);
  const price = q(A).sub(qStar.mul(B));
  const labels: [string, string] = ['Quantity', 'Price'];
  const disp: [string, string] = ['q^*', 'P^*'];
  const answer = tupleAnswer(labels, [qStar, price], disp);
  const ch = choice(rng, 'Price is above marginal cost', ['Price equals marginal cost', 'Price is below marginal cost', 'It depends on fixed cost']);
  const steps: Step[] = [
    { key: 'objective', instruction: 'Write profit as revenue minus cost, using the demand curve for the price.', math: `\\pi(q) = (${A} - ${B === 1 ? '' : B}q)q - ${c}q`, why: 'A firm with market power picks q; the demand curve then sets the price.' },
    {
      key: 'derivative',
      instruction: 'Differentiate.',
      math: `\\pi'(q) = ${A} - ${2 * B}q - ${c}`,
      why: "Product rule on (A − Bq)·q gives A − 2Bq: marginal revenue falls twice as fast as price.",
      ask: { prompt: "What is $\\pi'(q)$?", answer: expressionAnswer(`${A} - ${2 * B}*q - ${c}`, `${A} - ${2 * B}q - ${c}`, ['q']), verify: { type: 'diff', expr: `(${A} - ${B}*q)*q - ${c}*q`, variable: 'q' } },
    },
    {
      key: 'solve',
      instruction: 'Set it to 0: marginal revenue = marginal cost.',
      math: `${A} - ${2 * B}q = ${c} \\;\\Rightarrow\\; q^* = ${k}`,
      why: 'MR = MC is the profit-maximizing rule for any firm.',
      ask: { prompt: '$q^* = \\;?$', answer: numberAnswer(qStar), verify: { type: 'solve', equations: [`${A} - ${2 * B}*q - ${c} = 0`], unknowns: ['q'] } },
    },
    { key: 'second-order', instruction: "Check it's a maximum.", math: `\\pi''(q) = -${2 * B} < 0`, why: 'Concave down: a peak.' },
    {
      key: 'value',
      instruction: 'Read the price off the demand curve.',
      math: `P^* = ${A} - ${B}\\cdot ${k} = ${price.toLatex()}`,
      why: 'The firm charges the highest price at which buyers take q* units.',
      ask: { prompt: 'State $q^*$ and the price $P^*$.', answer, verify: { type: 'solve', equations: [`${A} - ${2 * B}*q - ${c} = 0`, `P = ${A} - ${B}*q`], unknowns: ['q', 'P'] } },
    },
  ];
  return {
    params: { A, B, c },
    prompt: `A firm faces demand $P = ${A} - ${B === 1 ? '' : B}q$ (price in dollars) and has a constant marginal cost of \\$${c} per unit. Find its profit-maximizing quantity and price.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [wrongTuple('price-equals-mc', labels, disp, q(A - c, B), q(c))]),
    interpretation: [
      {
        prompt: 'At the profit-maximizing output, how does price compare with marginal cost?',
        options: ch.options,
        correct: ch.correct,
        explanation: `P* = ${price.toLatex()} > MC = ${c}. With a downward-sloping demand curve, selling one more unit means cutting the price on every unit, so marginal revenue is below price. The firm stops where MR = MC, which leaves price above marginal cost. That gap is market power.`.replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2'),
      },
    ],
    verify: { type: 'solve', equations: [`${A} - ${2 * B}*q - ${c} = 0`, `P = ${A} - ${B}*q`], unknowns: ['q', 'P'] },
    // Working pad: at q*, marginal revenue equals marginal cost, and profit is (P − c)q.
    working: { names: { MR: String(c), MC: String(c), pi: price.sub(c).mul(qStar).toExpr() } },
  };
}

function level5(rng: Rng): Body {
  // Fence L along three sides of a rectangle against a wall: area x(L − 2x)  ⇒  x* = L/4, A* = L²/8
  const m = rng.int(5, 40);
  const L = 4 * m;
  const xStar = q(m);
  const area = (x: Q) => x.mul(q(L).sub(x.mul(2)));
  const labels: [string, string] = ['Side perpendicular to the wall', 'Maximum area'];
  const disp: [string, string] = ['x^*', 'A^*'];
  return build({
    params: { L },
    prompt: `You have ${L} meters of fence to enclose a rectangular area against a long wall (the wall needs no fence). If $x$ is the length of each side perpendicular to the wall, what $x$ gives the largest area, and what is that area (in m²)?`,
    v: 'x',
    valueName: 'A',
    fLatex: `A(x) = x(${L} - 2x) = ${L}x - 2x^2`,
    fExpr: `x*(${L} - 2*x)`,
    dLatex: `A'(x) = ${L} - 4x`,
    dExpr: `${L} - 4*x`,
    xStar,
    value: area(xStar),
    labels,
    displayLabels: disp,
    maximize: true,
    secondOrder: `A''(x) = -4 < 0`,
    wrong: [wrongTuple('square-guess', labels, disp, q(L, 3), q(L, 3).mul(q(L, 3)))],
    interpretation: [],
    solveWhy: 'The two perpendicular sides use 2x of fence; the side along the wall gets the rest, L − 2x.',
  });
}

export const optimization: SkillDefinition = {
  id: ID,
  title: 'Optimization',
  track: 'math',
  unit: 'Applications',
  description: 'Maximize revenue and profit, minimize average cost: derivative = 0, then check.',
  prerequisites: ['concavity-second-derivative'],
  maxDenominator: 4,
  workingPad: [1, 2, 3, 4, 5],
  levels: {
    1: { description: 'Maximize revenue', ranges: { a: [4, 246], b: [1, 6] } },
    2: { description: 'Minimize average cost', ranges: { w: [1, 6], qs: [2, 15], F: [4, 1350] } },
    3: { description: 'Maximize profit with quadratic cost', ranges: { p: [8, 230], v: [2, 30], w: [1, 5], F: [10, 200] } },
    4: { description: 'A firm facing a demand curve', ranges: { A: [6, 240], B: [1, 5], c: [2, 40] } },
    5: { description: 'Fence along a wall', ranges: { L: [20, 160] } },
  },
  misconceptions: {
    'forgot-two': { name: 'Forgot the 2 from differentiating the square', explanation: '$\\frac{d}{dq}(bq^2) = 2bq$, not $bq$. Dropping the 2 doubles the answer.' },
    'forgot-sqrt': { name: 'Forgot the square root', explanation: '$\\frac{F}{q^2} = w$ gives $q^2 = \\frac{F}{w}$, so $q = \\sqrt{F/w}$, not $F/w$.' },
    'set-function-zero': { name: 'Set the function to 0 instead of its derivative', explanation: 'The optimum is where the SLOPE is zero (a flat top or bottom), not where the function itself is zero.' },
    'profit-forgot-fixed': { name: 'Left the fixed cost out of profit', explanation: "Fixed cost doesn't change the best quantity (its derivative is 0), but it's still a cost: subtract it when you compute profit." },
    'price-equals-mc': { name: 'Used price = marginal cost', explanation: 'P = MC is the competitive rule. A firm facing a downward-sloping demand curve sets marginal REVENUE = MC, which gives a smaller quantity and a higher price.' },
    'square-guess': { name: 'Assumed the best shape is a square', explanation: 'Against a wall only three sides need fence, so the optimum is not a square: the side along the wall is twice the perpendicular sides ($x = L/4$).' },
  },
  stepLabels: {
    objective: 'Write the function to optimize',
    derivative: 'Differentiate',
    solve: 'Set the derivative to 0 and solve',
    'second-order': "Check it's a max (or min)",
    value: 'Evaluate the function there',
  },
  learn: {
    whyItMatters:
      'Every "best choice" in micro theory is an optimization. A firm with revenue $R(q) = 100q - 2q^2$ maximizes it where $R\'(q) = 100 - 4q = 0$, at $q = 25$, earning $R(25) = 2500 - 1250 = 1250$ dollars. Firms maximize profit, consumers maximize utility, and planners minimize cost; the recipe is always: derivative = 0, then check it is the right kind of point.',
    summary:
      'Write what you want to maximize or minimize as a function of one variable. Set its derivative to zero and solve. Check the second derivative (negative for a max, positive for a min), keep only solutions that make sense (output ≥ 0), and evaluate the function there.',
    formulas: [
      { latex: "f'(x^*) = 0", note: 'First-order condition.' },
      { latex: "f''(x^*) < 0 \\Rightarrow \\max, \\quad f''(x^*) > 0 \\Rightarrow \\min", note: 'Second-order condition.' },
      { latex: 'MR(q^*) = MC(q^*)', note: 'Profit maximization.' },
    ],
    example: { seed: 2, level: 3 },
    tips: ['Fixed costs never change the optimal quantity, only the profit level.'],
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
