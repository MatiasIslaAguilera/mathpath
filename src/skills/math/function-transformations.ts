// Function transformations. L1-L4: follow a point (p, f(p)) of a base function to its image on
// g(x) = A f(B(x - h)) + k. L5: build g from a sequence of moves and evaluate it.

import { numberAnswer, tupleAnswer, expressionAnswer } from '../../engine/answers';
import { coefLatex, joinTerms, parenIfNeg, signed } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { InterpretationQuestion, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'function-transformations';

type Generated = ReturnType<SkillDefinition['generate']>;

const lit = (x: Q | number) => Q.of(x).toExpr();

// ---------- base functions ----------

interface Base {
  /** f(x) as LaTeX, for the prompt. */
  def: string;
  value(p: number): number;
  /** f(arg) evaluated numerically, as a mathjs / SymPy expression. */
  expr(arg: string): string;
  /** Same as `expr` but safe for SymPy to solve (|u| written as sqrt(u^2)). */
  solveExpr(arg: string): string;
  /** f at a known number, as LaTeX. */
  latexAt(v: number): string;
  pickPoint(rng: Rng): number;
}

const BASES: Base[] = [
  {
    def: 'x^{2}',
    value: (p) => p * p,
    expr: (a) => `(${a})^2`,
    solveExpr: (a) => `(${a})^2`,
    latexAt: (v) => `${parenIfNeg(v)}^{2}`,
    pickPoint: (rng) => rng.nonzero(-4, 4),
  },
  {
    def: '\\left|x\\right|',
    value: (p) => Math.abs(p),
    expr: (a) => `abs(${a})`,
    solveExpr: (a) => `sqrt((${a})^2)`,
    latexAt: (v) => `\\left|${v}\\right|`,
    pickPoint: (rng) => rng.nonzero(-6, 6),
  },
  {
    def: '\\sqrt{x}',
    value: (p) => Math.sqrt(p),
    expr: (a) => `sqrt(${a})`,
    solveExpr: (a) => `sqrt(${a})`,
    latexAt: (v) => `\\sqrt{${v}}`,
    pickPoint: (rng) => rng.pick([1, 4, 9, 16]),
  },
  {
    def: 'x^{3}',
    value: (p) => p ** 3,
    expr: (a) => `(${a})^3`,
    solveExpr: (a) => `(${a})^3`,
    latexAt: (v) => `${parenIfNeg(v)}^{3}`,
    pickPoint: (rng) => rng.nonzero(-3, 3),
  },
];

// ---------- levels 1-4: where does a point go? ----------

function pointProblem(rng: Rng, level: 1 | 2 | 3 | 4): Generated {
  const baseIdx = rng.int(0, 3);
  const base = BASES[baseIdx];
  const p = base.pickPoint(rng);
  let form = 0;
  let A = 1;
  let B = 1;
  let h = 0;
  let k = 0;
  let c = 0;
  if (level === 1) {
    form = rng.int(0, 1); // 0: f(x) + k   1: f(x - h)
    if (form === 0) k = rng.nonzero(-6, 6);
    else h = rng.nonzero(-6, 6);
  } else if (level === 2) {
    h = rng.nonzero(-6, 6);
    k = rng.nonzero(-6, 6);
  } else if (level === 3) {
    form = rng.int(0, 1); // 0: A f(x) + k   1: f(-x) + k
    if (form === 0) A = rng.pick([-3, -2, -1, 2, 3]);
    else B = -1;
    k = rng.nonzero(-6, 6);
  } else {
    B = rng.pick([2, 3, 0.5]);
    c = rng.nonzero(-6, 6);
    k = rng.int(-5, 5);
  }

  const Bq = B === 0.5 ? q(1, 2) : q(B);
  const hQ = level === 4 ? q(c).div(Bq) : q(h);
  const fp = base.value(p);
  const X = q(p).div(Bq).add(hQ);
  const Y = q(A * fp + k);
  const answer = tupleAnswer(['x', 'y'], [X, Y]);

  // The argument of f, as LaTeX.
  let arg: string;
  if (level === 4) arg = joinTerms([B === 0.5 ? '\\frac{x}{2}' : `${B}x`, `${-c}`]);
  else if (B === -1) arg = '-x';
  else arg = h === 0 ? 'x' : joinTerms(['x', `${-h}`]);
  const gLatex = `${coefLatex(q(A))}f(${arg})${k === 0 ? '' : ` ${signed(k)}`}`;

  // "The point on g that came from input p", independent of the answer.
  const inner = `${lit(Bq)}*(X - ${lit(hQ)})`;
  const verify = {
    type: 'solve' as const,
    equations: [`Y = ${lit(A)}*${base.solveExpr(inner)} + ${lit(k)}`, `${inner} = ${lit(p)}`],
    unknowns: ['X', 'Y'],
  };
  const horizontalEq = level === 4 ? `${lit(Bq)}*X - ${lit(c)} = ${lit(p)}` : `${inner} = ${lit(p)}`;

  const steps: Step[] = [];
  if (level === 4) {
    steps.push({
      key: 'factor-b',
      instruction: `Factor ${B === 0.5 ? '$\\frac{1}{2}$' : B} out of the input so it looks like $B(x - h)$.`,
      math: `${arg} = ${B === 0.5 ? '\\frac{1}{2}' : B}\\left(x ${hQ.sign() < 0 ? '+' : '-'} ${hQ.abs().toLatex()}\\right)`,
      why: 'The shift is hidden until the scale is factored out: $Bx - c = B(x - c/B)$. The shift is $c/B$, not $c$.',
      ask: { prompt: 'After factoring, the shift is $h$ in $B(x - h)$. What is $h$?', answer: numberAnswer(hQ), verify: { type: 'evaluate', expr: `${lit(c)}/${lit(Bq)}` } },
    });
  }
  steps.push({
    key: 'horizontal',
    instruction: `Horizontal changes act on the input, in reverse. The old input ${p} must now come out of the argument: solve $${arg} = ${p}$.`,
    math: `${arg} = ${p} \\;\\Rightarrow\\; x = ${X.toLatex()}`,
    why: 'Inside $f(\\cdot)$ the changes work backwards: $f(x - 3)$ shifts right by 3, $f(2x)$ squeezes toward the $y$-axis, $f(-x)$ reflects over the $y$-axis.',
    ask: { prompt: `Solve $${arg} = ${p}$. What is the new $x$?`, answer: numberAnswer(X), verify: { type: 'solve', equations: [horizontalEq], unknowns: ['X'] } },
  });
  steps.push({
    key: 'vertical',
    instruction: `Vertical changes act on the output, exactly as written: the old height is ${fp}.`,
    math: `y = ${coefLatex(q(A)) === '' ? '' : `${parenIfNeg(A)}\\cdot `}${fp}${k === 0 ? '' : ` ${signed(k)}`} = ${Y.toLatex()}`,
    why: 'Outside $f$ the changes happen in the order written: first multiply (stretch or reflect), then add the shift.',
    ask: {
      prompt: 'What is the new $y$?',
      answer: numberAnswer(Y),
      verify: { type: 'evaluate', expr: `${lit(A)}*${base.expr(lit(p))} + ${lit(k)}` },
    },
  });
  steps.push({
    key: 'answer',
    instruction: `The point $(${p}, ${fp})$ moves to $(${X.toLatex()}, ${Y.toLatex()})$.`,
    math: `(${p}, ${fp}) \\;\\to\\; (${X.toLatex()}, ${Y.toLatex()})`,
    why: 'Horizontal moves change $x$ (in reverse), vertical moves change $y$ (as written).',
    ask: { prompt: 'Give the image point $(x, y)$.', answer, verify },
  });

  // Misconceptions
  const tup = (x: Q | number, y: Q | number) => tupleAnswer(['x', 'y'], [x, y]);
  const candidates: (MisconceptionInstance | null)[] = [];
  candidates.push(hQ.isZero() ? null : { id: 'horizontal-sign', wrong: tup(q(p).div(Bq).sub(hQ), Y) });
  if (level === 4) {
    candidates.push({ id: 'horizontal-scale-inverted', wrong: tup(Bq.mul(p).add(hQ), Y) });
    candidates.push({ id: 'factor-b-first', wrong: tup(q(p).div(Bq).add(c), Y) });
  }
  if (level === 3) {
    if (form === 0) candidates.push(A < 0 ? { id: 'reflect-wrong-axis', wrong: tup(-p, Math.abs(A) * fp + k) } : null);
    else candidates.push({ id: 'reflect-wrong-axis', wrong: tup(p, -fp + k) });
    if (form === 0) candidates.push({ id: 'vertical-order', wrong: tup(X, A * (fp + k)) });
  }

  // Interpretation (L2, 50%): a per-unit tax is an upward shift of supply. Drawn last.
  let interpretation: InterpretationQuestion[] | undefined;
  if (level === 2 && rng.chance(0.5)) {
    const t = k > 0 ? k : rng.int(1, 6);
    const lbl = [`Up by \\$${t}`, `Down by \\$${t}`, `Right by \\$${t}`, `Left by \\$${t}`];
    const opts = rng.shuffle(lbl.map((label, i) => ({ id: `o${i}`, label })));
    interpretation = [
      {
        prompt: `A per-unit tax of \\$${t} is placed on sellers. Compared with the original supply curve $P = S(Q)$, the new supply curve $P = S(Q) + ${t}$ is shifted...`,
        options: opts,
        correct: 'o0',
        explanation: `To supply the same quantity, sellers now need \\$${t} more per unit (the tax goes to the government), so every price on the curve rises by \\$${t}. Adding a constant to the output is a vertical shift up. It is not a horizontal move.`,
      },
    ];
  }

  return {
    params:
      level === 1
        ? { base: baseIdx, form, p, h, k }
        : level === 2
          ? { base: baseIdx, p, h, k }
          : level === 3
            ? { base: baseIdx, form, p, A, k }
            : { base: baseIdx, p, B, c, k },
    prompt: `Let $f(x) = ${base.def}$. The point $(${p}, ${fp})$ is on the graph of $y = f(x)$. It moves to a point on the graph of $g(x) = ${gLatex}$. Find that point.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 5: build g from words ----------

function fromWords(rng: Rng): Generated {
  const h = rng.nonzero(-5, 5);
  const A = rng.int(2, 4);
  const flip = rng.int(0, 1);
  const k = rng.nonzero(-8, 8);
  const x0 = rng.int(-5, 8);
  const s = flip ? -1 : 1;

  const move: string[] = [
    h > 0 ? `Shift it right ${h} unit${h === 1 ? '' : 's'}.` : `Shift it left ${-h} unit${h === -1 ? '' : 's'}.`,
    `Stretch it vertically by a factor of ${A}.`,
  ];
  if (flip) move.push('Reflect it over the $x$-axis.');
  move.push(k > 0 ? `Shift it up ${k} unit${k === 1 ? '' : 's'}.` : `Shift it down ${-k} unit${k === -1 ? '' : 's'}.`);

  // Closed form: s*A*(x - h)^2 + k.
  const shifted = h > 0 ? `(x - ${h})^{2}` : `(x + ${-h})^{2}`;
  const closed = `${s * A === 1 ? '' : s * A === -1 ? '-' : s * A}${shifted} ${signed(k)}`;
  const value = s * A * (x0 - h) ** 2 + k;
  const answer = numberAnswer(value);

  // Built move by move, separately from the closed form: used for the verify specs.
  const build = (xs: string): string => {
    let e = `(${xs} - ${lit(h)})^2`; // shift right h
    e = `${A}*(${e})`; // stretch
    if (flip) e = `-(${e})`; // reflect
    return `(${e}) + ${lit(k)}`; // shift up k
  };
  const chain = [
    'x^{2}',
    shifted,
    `${A}${shifted}`,
    ...(flip ? [`-${A}${shifted}`] : []),
    closed,
  ].join(' \\;\\to\\; ');
  const gExprValue = `${lit(s * A)}*(x - ${lit(h)})^2 + ${lit(k)}`;

  const steps: Step[] = [
    {
      key: 'formula',
      instruction: 'Apply each move to the formula in order. Moves inside the parentheses act on $x$ in reverse; stretching, reflecting and shifting vertically act on the output.',
      math: chain,
      why: 'Shift right $h$: replace $x$ by $x - h$. Stretch by $A$: multiply the whole output by $A$. Reflect over the $x$-axis: multiply by $-1$. Shift up $k$: add $k$ last.',
      ask: {
        prompt: 'Write $g(x)$.',
        answer: expressionAnswer(gExprValue, closed),
        verify: { type: 'equivalent', expr: build('x'), variables: ['x'] },
      },
    },
    {
      key: 'answer',
      instruction: `Substitute $x = ${x0}$: $g(${x0}) = ${value}$.`,
      math: `g(${x0}) = ${closed.replace(/x/g, `(${x0})`)} = ${value}`,
      why: 'Evaluate in the usual order: the bracket, then the power, then multiply, then add.',
      ask: { prompt: `$g(${x0}) = \\;?$`, answer, verify: { type: 'evaluate', expr: build(`(${x0})`) } },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'vertical-order', wrong: numberAnswer(s * A * ((x0 - h) ** 2 + k)) },
    { id: 'horizontal-sign', wrong: numberAnswer(s * A * (x0 + h) ** 2 + k) },
  ];

  return {
    params: { h, A, flip, k, x0 },
    prompt: `Start with the graph of $y = x^{2}$. ${move.join(' ')} Call the result $y = g(x)$. Find $g(${x0})$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify: { type: 'evaluate', expr: build(`(${x0})`) },
  };
}

// ---------- the skill ----------

export const functionTransformations: SkillDefinition = {
  id: ID,
  title: 'Transformations',
  track: 'math',
  unit: 'Functions',
  description: 'Shift, stretch and reflect graphs: follow a point to its new position and build g(x) from a list of moves.',
  prerequisites: ['functions-basics', 'quadratics-factoring'],
  maxDenominator: 4,
  levels: {
    1: { description: 'One shift: f(x) + k or f(x - h)', ranges: { base: [0, 3], form: [0, 1], p: [-6, 16], h: [-6, 6], k: [-6, 6] } },
    2: { description: 'Both shifts: f(x - h) + k', ranges: { base: [0, 3], p: [-6, 16], h: [-6, 6], k: [-6, 6] } },
    3: { description: 'Reflections and vertical stretch', ranges: { base: [0, 3], form: [0, 1], p: [-6, 16], A: [-3, 3], k: [-6, 6] } },
    4: { description: 'Horizontal scaling with a shift: f(Bx - c)', ranges: { base: [0, 3], p: [-6, 16], B: [0.5, 3], c: [-6, 6], k: [-5, 5] } },
    5: { description: 'Build g(x) from words and evaluate it', ranges: { h: [-5, 5], A: [2, 4], flip: [0, 1], k: [-8, 8], x0: [-5, 8] } },
  },
  misconceptions: {
    'horizontal-sign': {
      name: 'Moved the wrong way horizontally',
      explanation:
        'Changes inside $f(\\cdot)$ work in reverse. $f(x - 3)$ moves the graph right by 3, not left, because the input must be 3 bigger to give the same output. A point at $x = p$ moves to $x = p + 3$.',
    },
    'horizontal-scale-inverted': {
      name: 'Multiplied x by B instead of dividing',
      explanation:
        'In $f(Bx - c)$ the input is multiplied by $B$, so the graph shrinks horizontally by a factor of $B$: x-values are divided by $B$. Solve $Bx - c = p$ to get $x = (p + c)/B$.',
    },
    'factor-b-first': {
      name: 'Shifted before factoring out B',
      explanation:
        '$f(2x - 6) = f(2(x - 3))$: the shift is 3, not 6. Factor $B$ out first, or equivalently solve $Bx - c = p$ for $x$ (add $c$, then divide by $B$).',
    },
    'reflect-wrong-axis': {
      name: 'Confused -f(x) with f(-x)',
      explanation:
        '$-f(x)$ flips the output sign: reflection over the $x$-axis, so $(p, q) \\to (p, -q)$. $f(-x)$ flips the input sign: reflection over the $y$-axis, so $(p, q) \\to (-p, q)$. A minus sign outside acts on $y$; inside acts on $x$.',
    },
    'vertical-order': {
      name: 'Added before multiplying',
      explanation:
        'In $Af(x) + k$ the multiplication happens first and the shift last: $A\\cdot f(x) + k$, not $A(f(x) + k)$. Follow the order the moves are listed: stretch, then shift.',
    },
  },
  stepLabels: {
    horizontal: 'Find the new x (horizontal moves act on the input, in reverse)',
    'factor-b': 'Factor B out of the input',
    vertical: 'Find the new y (vertical moves act on the output, as written)',
    formula: 'Write g(x)',
    answer: 'State the point or value',
  },
  learn: {
    whyItMatters:
      'Shifting curves is how economists show policy. A \\$2 per-unit tax moves supply from $P = 10 + Q$ up to $P = 12 + Q$. Against demand $P = 40 - Q$, equilibrium moves from $10 + Q = 40 - Q$, so $Q = 15$ and $P = 25$, to $12 + Q = 40 - Q$, so $Q = 14$ and $P = 26$. The tax raises the price by \\$1 and cuts the quantity by 1 unit, and you can read that off a picture of the shift.',
    summary:
      'For $g(x) = A\\,f(B(x - h)) + k$: changes outside $f$ act on the output exactly as written ($A$ stretches and flips, $k$ shifts up). Changes inside act on the input, in reverse ($h$ shifts right, $B$ squeezes the graph horizontally by $B$, a negative $B$ reflects over the $y$-axis). A point $(p, q)$ lands at $x = p/B + h$ and $y = Aq + k$.',
    formulas: [
      { latex: 'g(x) = A\\,f\\big(B(x - h)\\big) + k' },
      { latex: '(p, q) \\;\\longmapsto\\; \\left(\\frac{p}{B} + h,\\; Aq + k\\right)', note: 'Where a point goes.' },
    ],
    example: { seed: 3, level: 2 },
    tips: ['Factor $B$ out first: $f(2x - 6) = f(2(x - 3))$ shifts by 3, not 6.', 'Inside the function, do the opposite of what you see. Outside, do what you see.'],
  },

  generate(rng, level) {
    return level === 5 ? fromWords(rng) : pointProblem(rng, level);
  },
};
