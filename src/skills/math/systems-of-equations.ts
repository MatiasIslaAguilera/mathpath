// Systems of two linear equations (math, tuple answer). L1 cost plans (set equal), L2 substitution,
// L3 direct elimination, L4 elimination after multiplying, L5 a two-item word problem.
// Elimination levels share one engine: `eliminate()` works out multipliers, the combined equation,
// and the wrong answers from adding vs subtracting and from multiplying only the left side.

import { numberAnswer, tupleAnswer } from '../../engine/answers';
import { coefLatex, joinTerms, linLatex, parenIfNeg } from '../../engine/format';
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

const ID = 'systems-of-equations';
type Body = ReturnType<SkillDefinition['generate']>;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (Math.abs(a) * Math.abs(b)) / gcd(a, b);
/** Number inside a mathjs / SymPy expression: negatives in parentheses. */
const n = (v: number | Q) => Q.of(v).toExpr();

const VARS = ['x', 'y'] as const;

/** a·x + b·y = c in LaTeX, with the constant formatted by `fmt`. */
function eqLatex(co: [number, number], c: Q, fmt: (v: Q) => string): string {
  return `${joinTerms([`${coefLatex(q(co[0]))}x`, `${coefLatex(q(co[1]))}y`])} = ${fmt(c)}`;
}
/** a·x + b·y = c in mathjs / SymPy syntax. */
const eqExpr = (co: [number, number], c: Q) => `${n(co[0])}*x + ${n(co[1])}*y = ${c.toExpr()}`;

const exactFmt = (v: Q) => v.toLatex();
/** Dollar amounts as short decimals (13.5, 2.25). */
const decFmt = (v: Q) => `${parseFloat(v.valueOf().toFixed(2))}`;

function pairQuestion(options: ChoiceOption[], correct: string, prompt: string, explanation: string): InterpretationQuestion {
  return { prompt, options, correct, explanation };
}

// ---------------------------------------------------------------------------
// Elimination engine (levels 3-5)
// ---------------------------------------------------------------------------

interface Sys {
  co1: [number, number];
  co2: [number, number];
  c1: Q;
  c2: Q;
  sol: [Q, Q];
  /** Index of the variable that gets eliminated (0 = x, 1 = y). */
  e: 0 | 1;
  fmt: (v: Q) => string;
  labels: string[];
  displayLabels: string[];
}

function eliminationBody(p: Record<string, number>, sys: Sys, prompt: string, interpretation?: InterpretationQuestion[]): Body {
  const { co1, co2, c1, c2, sol, e, fmt } = sys;
  const f = (1 - e) as 0 | 1;
  const E = VARS[e];
  const F = VARS[f];
  const L = lcm(co1[e], co2[e]);
  const m1 = L / Math.abs(co1[e]);
  const m2 = L / Math.abs(co2[e]);
  const s1: [number, number] = [co1[0] * m1, co1[1] * m1];
  const s2: [number, number] = [co2[0] * m2, co2[1] * m2];
  const r1 = c1.mul(m1);
  const r2 = c2.mul(m2);
  const subtract = Math.sign(s1[e]) === Math.sign(s2[e]); // equal E-coefficients → subtract
  const K = q(subtract ? s1[f] - s2[f] : s1[f] + s2[f]);
  const R = subtract ? r1.sub(r2) : r1.add(r2);
  const vf = sol[f];
  const ve = sol[e];
  const answer = tupleAnswer(sys.labels, sol, sys.displayLabels);
  const verify: VerifySpec = { type: 'solve', equations: [eqExpr(co1, c1), eqExpr(co2, c2)], unknowns: ['x', 'y'] };
  const steps: Step[] = [];

  if (m1 !== 1 || m2 !== 1) {
    const which = m1 !== 1 ? 1 : 2;
    const mult = which === 1 ? m1 : m2;
    const coWhich = which === 1 ? co1 : co2;
    steps.push({
      key: 'multiply',
      instruction:
        m1 !== 1 && m2 !== 1
          ? `Multiply equation 1 by ${m1} and equation 2 by ${m2}, so the $${E}$-terms have the same size (${L}).`
          : `Multiply equation ${which} by ${mult}, so the $${E}$-terms have the same size (${L}).`,
      math: `\\begin{aligned}${m1}\\,(1)&:\\; ${eqLatex(s1, r1, fmt)}\\\\ ${m2}\\,(2)&:\\; ${eqLatex(s2, r2, fmt)}\\end{aligned}`,
      why: 'Multiplying every term of an equation (both sides!) by the same number gives an equivalent equation. Pick multipliers that make one variable cancel.',
      ask: {
        prompt: `Using the least common multiple of the $${E}$-coefficients, by what number do you multiply equation ${which}?`,
        answer: numberAnswer(mult),
        verify: { type: 'evaluate', expr: `lcm(${Math.abs(co1[e])}, ${Math.abs(co2[e])})/${Math.abs(coWhich[e])}` },
      },
    });
  }

  steps.push({
    key: 'eliminate',
    instruction: subtract
      ? `The $${E}$-coefficients match, so subtract equation 2 from equation 1 to eliminate $${E}$.`
      : `The $${E}$-coefficients are opposites, so add the equations to eliminate $${E}$.`,
    math: `(1) ${subtract ? '-' : '+'} (2):\\quad ${coefLatex(K)}${F} = ${fmt(R)} \\;\\Rightarrow\\; ${F} = ${fmt(vf)}`,
    why: 'Equal coefficients cancel when you subtract; opposite coefficients cancel when you add.',
    ask: {
      prompt: `What is $${F}$?`,
      answer: numberAnswer(vf),
      verify: { type: 'solve', equations: [`${K.toExpr()}*${F} = ${R.toExpr()}`], unknowns: [F] },
    },
  });

  // Back-substitute into the ORIGINAL equation 1.
  const termL = (i: 0 | 1) => (i === f ? `${co1[i]}\\cdot ${parenIfNeg(vf)}` : `${coefLatex(q(co1[i]))}${VARS[i]}`);
  const termE = (i: 0 | 1) => (i === f ? `${n(co1[i])}*(${vf.toExpr()})` : `${n(co1[i])}*${VARS[i]}`);
  steps.push({
    key: 'back-substitute',
    instruction: `Substitute $${F} = ${fmt(vf)}$ into equation 1 to find $${E}$.`,
    math: `${joinTerms([termL(0), termL(1)])} = ${fmt(c1)} \\;\\Rightarrow\\; ${E} = ${fmt(ve)}`,
    why: 'Once one variable is known, either original equation gives the other one.',
    ask: {
      prompt: `What is $${E}$?`,
      answer: numberAnswer(ve),
      verify: { type: 'solve', equations: [`${termE(0)} + ${termE(1)} = ${c1.toExpr()}`], unknowns: [E] },
    },
  });

  steps.push({
    key: 'answer',
    instruction: 'State the solution as the pair $(x, y)$.',
    math: `(x, y) = (${fmt(sol[0])},\\; ${fmt(sol[1])})`,
    why: 'Check by substituting both values into the other equation as well.',
    ask: { prompt: 'State $(x, y)$.', answer, verify },
  });

  // ---------- misconceptions ----------
  const withF = (vfWrong: Q, veWrong: Q): AnswerSpec => {
    const vals: [Q, Q] = [sol[0], sol[1]];
    vals[f] = vfWrong;
    vals[e] = veWrong;
    return tupleAnswer(sys.labels, vals, sys.displayLabels);
  };
  const cand: (MisconceptionInstance | null)[] = [];
  cand.push(sol[0].eq(sol[1]) ? null : { id: 'swapped-order', wrong: tupleAnswer(sys.labels, [sol[1], sol[0]], sys.displayLabels) });
  // Wrong operation: add when you should subtract (or the reverse), then back-substitute into equation 1.
  try {
    const K2 = q(subtract ? s1[f] + s2[f] : s1[f] - s2[f]);
    const R2 = subtract ? r1.add(r2) : r1.sub(r2);
    const vf2 = R2.div(K2);
    const ve2 = c1.sub(vf2.mul(co1[f])).div(co1[e]);
    cand.push({ id: 'elim-wrong-op', wrong: withF(vf2, ve2) });
  } catch {
    cand.push(null);
  }
  // Multiplied only the left side: the constants stay unscaled.
  if (m1 !== 1 || m2 !== 1) {
    try {
      const det = s1[0] * s2[1] - s1[1] * s2[0];
      const xw = c1.mul(s2[1]).sub(c2.mul(s1[1])).div(det);
      const yw = c2.mul(s1[0]).sub(c1.mul(s2[0])).div(det);
      cand.push({ id: 'multiply-one-side', wrong: tupleAnswer(sys.labels, [xw, yw], sys.displayLabels) });
    } catch {
      cand.push(null);
    }
  }

  return {
    params: p,
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, cand),
    interpretation,
    verify,
  };
}

// ---------------------------------------------------------------------------
// Level 1: two cost plans
// ---------------------------------------------------------------------------

function level1(rng: Rng): Body {
  const x = rng.int(2, 20);
  const mSmall = rng.int(1, 10);
  const dm = rng.int(1, 6);
  const mBig = mSmall + dm;
  const bLow = rng.int(5, 60);
  const bHigh = bLow + dm * x;
  // Plan A is either the high-start/low-rate plan or the reverse.
  const swap = rng.chance(0.5);
  const [b1, m1, b2, m2] = swap ? [bLow, mBig, bHigh, mSmall] : [bHigh, mSmall, bLow, mBig];
  const y = b1 + m1 * x;
  const answer = tupleAnswer(['x', 'y'], [x, y], ['x', 'y']);
  const verify: VerifySpec = { type: 'solve', equations: [`y = ${b1} + ${m1}*x`, `y = ${b2} + ${m2}*x`], unknowns: ['x', 'y'] };
  const dmSigned = q(m1 - m2);
  const steps: Step[] = [
    {
      key: 'set-equal',
      instruction: 'Both plans have the same total cost $y$ at the crossing point, so set the two expressions equal and solve for $x$.',
      math: `${b1} + ${m1 === 1 ? '' : m1}x = ${b2} + ${m2 === 1 ? '' : m2}x \\;\\Rightarrow\\; ${coefLatex(dmSigned)}x = ${b2 - b1} \\;\\Rightarrow\\; x = ${x}`,
      why: 'If $y = f(x)$ and $y = g(x)$ at the same point, then $f(x) = g(x)$ there.',
      ask: {
        prompt: 'After setting the two costs equal, what is $x$ (the number of months)?',
        answer: numberAnswer(x),
        verify: { type: 'solve', equations: [`${b1} + ${m1}*x = ${b2} + ${m2}*x`], unknowns: ['x'] },
      },
    },
    {
      key: 'back-substitute',
      instruction: `Put $x = ${x}$ into either plan to find the total cost $y$.`,
      math: `y = ${b1} + ${m1}\\cdot ${x} = ${y}`,
      why: 'At the crossing point both plans give the same cost, so either one works. Check with the other plan.',
      ask: {
        prompt: 'What is $y$, the total cost in dollars?',
        answer: numberAnswer(y),
        verify: { type: 'solve', equations: [`y = ${b1} + ${m1}*(${x})`], unknowns: ['y'] },
      },
    },
    {
      key: 'answer',
      instruction: 'State the solution as the pair $(x, y)$.',
      math: `(x, y) = (${x},\\; ${y})`,
      why: `Check with the other plan: ${b2} + ${m2} × ${x} = ${b2 + m2 * x}.`,
      ask: { prompt: 'State $(x, y)$.', answer, verify },
    },
  ];

  const cheaper = m1 < m2 ? 'Plan A' : 'Plan B';
  const labels = ['Plan A', 'Plan B', 'They cost the same', 'It depends on the month'];
  const order = rng.shuffle(labels);
  const options: ChoiceOption[] = order.map((label, i) => ({ id: `o${i}`, label }));
  const interpretation: InterpretationQuestion[] = [
    pairQuestion(
      options,
      options[order.indexOf(cheaper)].id,
      `For more than $${x}$ months, which plan is cheaper?`,
      `Plan A grows by $${m1}$ dollars a month and Plan B by $${m2}$. After the crossing point at $x = ${x}$ the plan with the smaller monthly price keeps adding less, so ${cheaper} is cheaper from then on.`,
    ),
  ];

  const swapped = x === y ? null : { id: 'swapped-order', wrong: tupleAnswer(['x', 'y'], [y, x], ['x', 'y']) };
  return {
    params: { b1, m1, b2, m2, x },
    prompt: `Plan A costs \\$${b1} plus \\$${m1} per month. Plan B costs \\$${b2} plus \\$${m2} per month. Let $x$ be the number of months and $y$ the total cost in dollars: $$y = ${b1} + ${m1 === 1 ? '' : m1}x \\qquad y = ${b2} + ${m2 === 1 ? '' : m2}x$$ Find the pair $(x, y)$ where the two plans cost the same.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [swapped]),
    interpretation,
    verify,
  };
}

// ---------------------------------------------------------------------------
// Level 2: substitution
// ---------------------------------------------------------------------------

function level2(rng: Rng): Body {
  for (;;) {
    const m = rng.nonzero(-5, 5);
    const a = rng.nonzero(-7, 7);
    const b = rng.nonzero(-7, 7);
    const x = rng.int(-10, 10);
    const y = rng.int(-10, 10);
    const k = y - m * x;
    const c = a * x + b * y;
    const K = a + b * m;
    if (K === 0) continue;
    const answer = tupleAnswer(['x', 'y'], [x, y], ['x', 'y']);
    const eq1 = `y = ${n(m)}*x + ${n(k)}`;
    const eq2 = `${n(a)}*x + ${n(b)}*y = ${n(c)}`;
    const verify: VerifySpec = { type: 'solve', equations: [eq1, eq2], unknowns: ['x', 'y'] };
    const line1 = `y = ${linLatex(m, k)}`;
    const line2 = eqLatex([a, b], q(c), exactFmt);
    const subbed = `${joinTerms([`${coefLatex(q(a))}x`, (b === 1 ? `(${linLatex(m, k)})` : b === -1 ? `-(${linLatex(m, k)})` : `${b}(${linLatex(m, k)})`)])} = ${c}`;
    const steps: Step[] = [
      {
        key: 'substitute',
        instruction: `Replace $y$ in the second equation by $${linLatex(m, k)}$, then collect the $x$-terms.`,
        math: `${subbed} \\;\\Rightarrow\\; (${a} ${b * m < 0 ? '-' : '+'} ${Math.abs(b * m)})x = ${c} ${b * k > 0 ? '-' : '+'} ${Math.abs(b * k)} \\;\\Rightarrow\\; ${coefLatex(q(K))}x = ${c - b * k}`,
        why: 'The first equation says what $y$ equals, so you can swap it in. Distribute $b$ over every term inside the parentheses.',
        ask: {
          prompt: `After substituting and collecting, $${coefLatex(q(K))}x = \\;?$`,
          answer: numberAnswer(c - b * k),
          verify: { type: 'evaluate', expr: `${n(K)}*${n(x)}` },
        },
      },
      {
        key: 'solve-x',
        instruction: `Divide by $${K}$ to get $x$.`,
        math: `x = \\frac{${c - b * k}}{${K}} = ${x}`,
        why: 'Division undoes multiplication by the coefficient of $x$.',
        ask: {
          prompt: 'What is $x$?',
          answer: numberAnswer(x),
          verify: { type: 'solve', equations: [`${n(a)}*x + ${n(b)}*(${n(m)}*x + ${n(k)}) = ${n(c)}`], unknowns: ['x'] },
        },
      },
      {
        key: 'back-substitute',
        instruction: `Put $x = ${x}$ into $y = ${linLatex(m, k)}$.`,
        math: `y = ${m}\\cdot ${parenIfNeg(x)} ${k < 0 ? '-' : '+'} ${Math.abs(k)} = ${y}`,
        why: 'The first equation is already solved for $y$, so it gives $y$ directly.',
        ask: {
          prompt: 'What is $y$?',
          answer: numberAnswer(y),
          verify: { type: 'solve', equations: [`y = ${n(m)}*(${n(x)}) + ${n(k)}`], unknowns: ['y'] },
        },
      },
      {
        key: 'answer',
        instruction: 'State the solution as the pair $(x, y)$.',
        math: `(x, y) = (${x},\\; ${y})`,
        why: 'Check by substituting both values into the second equation.',
        ask: { prompt: 'State $(x, y)$.', answer, verify },
      },
    ];
    // Misconceptions
    const cand: (MisconceptionInstance | null)[] = [x === y ? null : { id: 'swapped-order', wrong: tupleAnswer(['x', 'y'], [y, x], ['x', 'y']) }];
    // a x + b m x + k = c: the constant k is not multiplied by b.
    const xw = q(c - k, K);
    cand.push({ id: 'substitute-distribute', wrong: tupleAnswer(['x', 'y'], [xw, xw.mul(m).add(k)], ['x', 'y']) });
    return {
      params: { m, k, a, b, c, x, y },
      prompt: `Solve the system: $$\\begin{cases} ${line1} \\\\ ${line2} \\end{cases}$$ Give the pair $(x, y)$.`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, cand),
      verify,
    };
  }
}

// ---------------------------------------------------------------------------
// Level 3: direct elimination
// ---------------------------------------------------------------------------

function level3(rng: Rng): Body {
  for (;;) {
    const a1 = rng.nonzero(-9, 9);
    const a2 = rng.nonzero(-9, 9);
    const b = rng.nonzero(-9, 9);
    const sg = rng.int(0, 1); // 0: equal y-coefficients, 1: opposite
    if ((sg === 0 ? a1 - a2 : a1 + a2) === 0) continue;
    const x = rng.int(-10, 10);
    const y = rng.int(-10, 10);
    if (x === 0 && y === 0) continue;
    const b2 = sg === 0 ? b : -b;
    const c1 = a1 * x + b * y;
    const c2 = a2 * x + b2 * y;
    const sys: Sys = {
      co1: [a1, b], co2: [a2, b2], c1: q(c1), c2: q(c2), sol: [q(x), q(y)], e: 1,
      fmt: exactFmt, labels: ['x', 'y'], displayLabels: ['x', 'y'],
    };
    const prompt = `Solve the system by elimination: $$\\begin{cases} ${eqLatex(sys.co1, sys.c1, exactFmt)} \\\\ ${eqLatex(sys.co2, sys.c2, exactFmt)} \\end{cases}$$ Give the pair $(x, y)$.`;
    return eliminationBody({ a1, a2, b, sg, c1, c2, x, y }, sys, prompt);
  }
}

// ---------------------------------------------------------------------------
// Level 4: multiply first
// ---------------------------------------------------------------------------

function level4(rng: Rng): Body {
  for (;;) {
    const a1 = rng.nonzero(-7, 7);
    const b1 = rng.nonzero(-7, 7);
    const a2 = rng.nonzero(-7, 7);
    const b2 = rng.nonzero(-7, 7);
    if (a1 * b2 - a2 * b1 === 0) continue;
    const ev = rng.int(0, 1);
    const co1: [number, number] = [a1, b1];
    const co2: [number, number] = [a2, b2];
    // Equal-size coefficients on either variable make it a level-3 system (no multiplying needed).
    if (Math.abs(a1) === Math.abs(a2) || Math.abs(b1) === Math.abs(b2)) continue;
    const x = rng.int(-10, 10);
    const y = rng.int(-10, 10);
    if (x === 0 && y === 0) continue;
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    const sys: Sys = {
      co1, co2, c1: q(c1), c2: q(c2), sol: [q(x), q(y)], e: ev as 0 | 1,
      fmt: exactFmt, labels: ['x', 'y'], displayLabels: ['x', 'y'],
    };
    const prompt = `Solve the system by elimination: $$\\begin{cases} ${eqLatex(co1, sys.c1, exactFmt)} \\\\ ${eqLatex(co2, sys.c2, exactFmt)} \\end{cases}$$ Give the pair $(x, y)$.`;
    return eliminationBody({ a1, b1, a2, b2, c1, c2, x, y, ev }, sys, prompt);
  }
}

// ---------------------------------------------------------------------------
// Level 5: word problem
// ---------------------------------------------------------------------------

const ITEMS: [string, string][] = [
  ['coffee', 'bagel'],
  ['pen', 'notebook'],
  ['apple', 'orange'],
  ['sandwich', 'soda'],
  ['muffin', 'tea'],
  ['ticket', 'program'],
];
const plural = (s: string, k: number) => (k === 1 ? s : s === 'sandwich' ? 'sandwiches' : `${s}s`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const dollars = (v: Q) => `\\$${v.valueOf().toFixed(2)}`;

function level5(rng: Rng): Body {
  for (;;) {
    const items = rng.int(0, ITEMS.length - 1);
    const pc = rng.int(4, 32); // prices in quarters of a dollar
    const pb = rng.int(4, 32);
    const q1 = rng.int(1, 6);
    const r1 = rng.int(1, 6);
    const q2 = rng.int(1, 6);
    const r2 = rng.int(1, 6);
    if (q1 * r2 - q2 * r1 === 0) continue;
    const ev = rng.int(0, 1);
    const co1: [number, number] = [q1, r1];
    const co2: [number, number] = [q2, r2];
    if (q1 === q2 || r1 === r2) continue; // otherwise one variable subtracts out without multiplying
    const px = q(pc, 4);
    const py = q(pb, 4);
    const c1 = px.mul(q1).add(py.mul(r1));
    const c2 = px.mul(q2).add(py.mul(r2));
    const [a, b] = ITEMS[items];
    const sys: Sys = {
      co1, co2, c1, c2, sol: [px, py], e: ev as 0 | 1,
      fmt: decFmt, labels: [cap(a), cap(b)], displayLabels: [`\\text{${cap(a)}}`, `\\text{${cap(b)}}`],
    };
    const prompt = `${q1} ${plural(a, q1)} and ${r1} ${plural(b, r1)} cost ${dollars(c1)}. ${q2} ${plural(a, q2)} and ${r2} ${plural(b, r2)} cost ${dollars(c2)}. Let $x$ be the price of one ${a} and $y$ the price of one ${b}, in dollars: $$\\begin{cases} ${eqLatex(co1, c1, decFmt)} \\\\ ${eqLatex(co2, c2, decFmt)} \\end{cases}$$ Find the price of one ${a} and one ${b}.`;
    // Interpretation (50%): drawn last.
    let interpretation: InterpretationQuestion[] | undefined;
    if (rng.chance(0.5)) {
      const labels = ['The same as before', 'Twice as high', 'Half as high', 'It cannot be determined'];
      const order = rng.shuffle(labels);
      const options: ChoiceOption[] = order.map((label, i) => ({ id: `o${i}`, label }));
      interpretation = [
        pairQuestion(
          options,
          options[order.indexOf(labels[0])].id,
          'If both bills were for twice the quantities (and cost twice as much), the prices of one item would be',
          `Doubling every quantity doubles every total, but the price per item does not change: each equation is multiplied by 2, which is the same system. The solution is still ${a} = ${decFmt(px)} and ${b} = ${decFmt(py)}.`,
        ),
      ];
    }
    return eliminationBody({ items, pc, pb, q1, r1, q2, r2, ev }, sys, prompt, interpretation);
  }
}

// ---------------------------------------------------------------------------

export const systemsOfEquations: SkillDefinition = {
  id: ID,
  title: 'Systems of equations',
  track: 'math',
  unit: 'Linear equations & systems',
  description: 'Solve two equations in two unknowns by setting equal, substituting, or eliminating.',
  prerequisites: ['linear-equations'],
  maxDenominator: 4,
  levels: {
    1: {
      description: 'Two cost plans: set the expressions equal',
      ranges: { b1: [5, 180], m1: [1, 16], b2: [5, 180], m2: [1, 16], x: [2, 20] },
    },
    2: {
      description: 'Substitution: y = mx + k',
      ranges: { m: [-5, 5], k: [-60, 60], a: [-7, 7], b: [-7, 7], c: [-140, 140], x: [-10, 10], y: [-10, 10] },
    },
    3: {
      description: 'Elimination: add or subtract directly',
      ranges: { a1: [-9, 9], a2: [-9, 9], b: [-9, 9], sg: [0, 1], c1: [-180, 180], c2: [-180, 180], x: [-10, 10], y: [-10, 10] },
    },
    4: {
      description: 'Elimination: multiply first',
      ranges: { a1: [-7, 7], b1: [-7, 7], a2: [-7, 7], b2: [-7, 7], c1: [-140, 140], c2: [-140, 140], x: [-10, 10], y: [-10, 10], ev: [0, 1] },
    },
    5: {
      description: 'Word problem: two items, two bills',
      ranges: { items: [0, ITEMS.length - 1], pc: [4, 32], pb: [4, 32], q1: [1, 6], r1: [1, 6], q2: [1, 6], r2: [1, 6], ev: [0, 1] },
    },
  },
  misconceptions: {
    'swapped-order': {
      name: 'Wrote the solution as (y, x)',
      explanation:
        'The pair is ordered: the first number is $x$ and the second is $y$. Your values are right but in the wrong slots. Label each value when you find it, and read the question again before you answer.',
    },
    'elim-wrong-op': {
      name: 'Added when you needed to subtract (or the reverse)',
      explanation:
        'A variable only cancels if its coefficients are opposites when you add, or equal when you subtract. If both $y$-terms are $+3y$, adding gives $6y$ (nothing cancelled), so subtract. If they are $+3y$ and $-3y$, add.',
    },
    'multiply-one-side': {
      name: 'Multiplied only the left side of an equation',
      explanation:
        'Multiplying an equation by a number means multiplying every term on both sides, including the constant on the right. $2x + 3y = 5$ times 3 is $6x + 9y = 15$, not $6x + 9y = 5$.',
    },
    'substitute-distribute': {
      name: "Didn't distribute when substituting",
      explanation:
        'When you replace $y$ by $mx + k$ in $by$, the whole expression is multiplied by $b$: $b(mx + k) = bmx + bk$. Forgetting $bk$ changes the constant and gives the wrong $x$.',
    },
  },
  stepLabels: {
    'set-equal': 'Set the two expressions equal',
    substitute: 'Substitute into the other equation',
    'solve-x': 'Solve for x',
    multiply: 'Multiply to match a coefficient',
    eliminate: 'Add or subtract to eliminate a variable',
    'back-substitute': 'Substitute back to get the other variable',
    answer: 'State the solution',
  },
  learn: {
    whyItMatters:
      'Market equilibrium is a system: one equation for demand and one for supply, and the equilibrium is the point on both. So is Cournot competition, where two firms each have a best-response equation. Say demand is $P = 100 - 2Q$ and supply is $P = 20 + 2Q$. Setting them equal gives $100 - 2Q = 20 + 2Q$, so $4Q = 80$, $Q = 20$ and $P = 60$. Check demand: $100 - 40 = 60$. Every multi-market model reduces to solving a system like this.',
    summary:
      'A system asks for the one point $(x, y)$ that satisfies both equations. If both equations are solved for $y$, set the right sides equal. If one is solved for a variable, substitute it into the other. Otherwise add or subtract the equations (after multiplying one or both so a variable has matching coefficients) to eliminate a variable. Find one variable, then substitute back for the other.',
    formulas: [
      { latex: 'y = f(x),\\; y = g(x) \\;\\Rightarrow\\; f(x) = g(x)', note: 'Set equal when both equations give $y$.' },
      { latex: 'y = mx + k \\;\\Rightarrow\\; ax + b(mx + k) = c', note: 'Substitution: distribute $b$ over both terms.' },
      { latex: '(1) \\pm (2)', note: 'Elimination: subtract if the coefficients are equal, add if they are opposites.' },
    ],
    example: { seed: 5, level: 4 },
    tips: [
      'Always check your pair in both original equations. If one fails, there is an arithmetic slip.',
      'To eliminate, scale equations by the least common multiple of the coefficients you want to cancel, and multiply the right side too.',
      'Write the answer as an ordered pair $(x, y)$ with the variables in that order.',
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
