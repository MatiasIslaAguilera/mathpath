// Cramer's rule: x_i = det(A_i) / det(A), where A_i is A with column i replaced by the right-hand
// side. L1 one unknown of a 2x2, L2 both, L3 fractional solutions, L4 one unknown of a 3x3,
// L5 the Keynesian income model. Every determinant ask is verified with `det`; the final answer
// is verified against the ORIGINAL equations with `solve`.

import { choiceAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  InterpretationQuestion,
  MisconceptionInstance,
  SkillDefinition,
  Step,
  VerifySpec,
} from '../../engine/types';

const ID = 'cramers-rule';
type Body = ReturnType<SkillDefinition['generate']>;

const VAR_KEYS = ['x', 'y', 'z'];

// ---------- exact determinants and matrix helpers ----------

type M = Q[][];
const toQ = (rows: number[][]): M => rows.map((r) => r.map((v) => q(v)));
function detQ(m: M): Q {
  if (m.length === 1) return m[0][0];
  let total = q(0);
  for (let j = 0; j < m.length; j++) {
    const minor = m.slice(1).map((r) => r.filter((_, c) => c !== j));
    const term = m[0][j].mul(detQ(minor));
    total = j % 2 === 0 ? total.add(term) : total.sub(term);
  }
  return total;
}
const replaceCol = (a: M, i: number, rhs: Q[]): M => a.map((r, k) => r.map((v, c) => (c === i ? rhs[k] : v)));
const replaceRow = (a: M, i: number, rhs: Q[]): M => a.map((r, k) => (k === i ? [...rhs] : r));
const exprMatrix = (m: M) => m.map((r) => r.map((v) => v.toExpr()));

type Fmt = (v: Q) => string;
const exact: Fmt = (v) => v.toLatex();
const decimal: Fmt = (v) => (v.isInt() ? `${v.n}` : `${Number(v.valueOf().toFixed(4))}`);

const bmatrix = (m: M, fmt: Fmt) =>
  `\\begin{bmatrix} ${m.map((r) => r.map(fmt).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** One equation's left side in LaTeX: coefficients times names, zero terms dropped. */
function lhsLatex(row: Q[], names: string[], fmt: Fmt): string {
  const terms: string[] = [];
  row.forEach((c, i) => {
    if (c.isZero()) return;
    terms.push(fmt === exact ? `${coefLatex(c)}${names[i]}` : `${c.eq(1) ? '' : c.eq(-1) ? '-' : fmt(c)}${names[i]}`);
  });
  return joinTerms(terms);
}
const systemLatex = (a: M, rhs: Q[], names: string[], fmt: Fmt) =>
  `\\begin{aligned} ${a.map((r, k) => `${lhsLatex(r, names, fmt)} &= ${fmt(rhs[k])}`).join(' \\\\ ')} \\end{aligned}`;

/** The original equations in mathjs/SymPy syntax, with some unknowns pinned to known values. */
function originalEqs(a: M, rhs: Q[], names: string[], pinned: Record<number, Q>): string[] {
  return a.map((r, k) => {
    const terms = r.map((c, i) => `${c.toExpr()}*${pinned[i] ? pinned[i].toExpr() : names[i]}`);
    return `${terms.join(' + ')} = ${rhs[k].toExpr()}`;
  });
}

// ---------- the shared Cramer's-rule body ----------

interface Sys {
  a: M;
  rhs: Q[];
  names: string[]; // symbols in the equations
  targets: number[]; // which unknowns the problem asks for (indices)
  fmt: Fmt;
  prompt: string;
  params: Record<string, number>;
  /** Equations for the final verify (when the ask is a full tuple). Default: the system itself. */
  verifyEqs?: string[];
  wrongColumn: boolean;
  rowReplacement: boolean;
  /** A step inserted before the determinants (L5's rewrite). */
  firstStep?: Step;
}

function cramerBody(s: Sys): Body {
  const { a, rhs, names, targets, fmt } = s;
  const n = a.length;
  const D = detQ(a);
  const dets = names.map((_, i) => detQ(replaceCol(a, i, rhs)));
  const sol = dets.map((d) => d.div(D));
  const display = (v: Q) => fmt(v);
  const matrixOf = (m: M) => bmatrix(m, fmt);

  const finalVerify: VerifySpec =
    targets.length === n
      ? { type: 'solve', equations: s.verifyEqs ?? originalEqs(a, rhs, names, {}), unknowns: names }
      : {
          type: 'solve',
          equations: originalEqs(
            a,
            rhs,
            names,
            Object.fromEntries(names.map((_, i) => [i, sol[i]]).filter(([i]) => !targets.includes(i as number))),
          ),
          unknowns: [names[targets[0]]],
        };

  const steps: Step[] = [];
  if (s.firstStep) steps.push(s.firstStep);
  steps.push({
    key: 'det-a',
    instruction: 'Write the coefficient matrix $A$ and find its determinant.',
    math: `\\det A = \\det${matrixOf(a)} = ${display(D)}`,
    why: "Cramer's rule divides by $\\det A$, so it must be non-zero. It is the same for every unknown.",
    ask: {
      prompt: 'What is $\\det A$?',
      answer: numberAnswer(D),
      verify: { type: 'det', matrix: exprMatrix(a) },
    },
  });

  targets.forEach((t, pos) => {
    const At = replaceCol(a, t, rhs);
    const nm = names[t];
    const isLast = pos === targets.length - 1;
    steps.push({
      key: `det-${VAR_KEYS[t]}`,
      instruction: `For $${nm}$, replace column ${t + 1} of $A$ with the right-hand side, then take the determinant.`,
      math: `\\det A_{${nm}} = \\det${matrixOf(At)} = ${display(dets[t])}`,
      why: `$A_{${nm}}$ is $A$ with the ${nm}-column swapped for the constants. Only that one column changes.`,
      ask: {
        prompt: `What is $\\det A_{${nm}}$?`,
        answer: numberAnswer(dets[t]),
        verify: { type: 'det', matrix: exprMatrix(At) },
      },
    });
    const finalAnswer: AnswerSpec =
      targets.length === 1
        ? numberAnswer(sol[t])
        : tupleAnswer(
            targets.map((i) => names[i]),
            targets.map((i) => sol[i]),
          );
    steps.push({
      key: pos === 0 ? 'divide' : 'divide-y',
      instruction: `Divide: $${nm} = \\det A_{${nm}} / \\det A$.`,
      math: `${nm} = \\frac{${display(dets[t])}}{${display(D)}} = ${sol[t].toLatex()}`,
      why: "Cramer's rule: each unknown is the ratio of two determinants.",
      ask: isLast
        ? { prompt: targets.length === 1 ? `What is $${nm}$?` : `State $(${targets.map((i) => names[i]).join(', ')})$.`, answer: finalAnswer, verify: finalVerify }
        : {
            prompt: `What is $${nm}$?`,
            answer: numberAnswer(sol[t]),
            verify: { type: 'solve', equations: [`${D.toExpr()}*${nm} = ${dets[t].toExpr()}`], unknowns: [nm] },
          },
    });
  });

  const answer: AnswerSpec =
    targets.length === 1
      ? numberAnswer(sol[targets[0]])
      : tupleAnswer(
          targets.map((i) => names[i]),
          targets.map((i) => sol[i]),
        );

  // ---------- misconceptions ----------
  const wrongFor = (fn: (t: number) => Q): Q[] | null => {
    try {
      return targets.map(fn);
    } catch {
      return null;
    }
  };
  const asAnswer = (vals: Q[] | null): AnswerSpec | null =>
    vals === null
      ? null
      : targets.length === 1
        ? numberAnswer(vals[0])
        : tupleAnswer(
            targets.map((i) => names[i]),
            vals,
          );
  const cand: (MisconceptionInstance | null)[] = [];
  const mk = (id: string, vals: Q[] | null): MisconceptionInstance | null => {
    const w = asAnswer(vals);
    return w ? { id, wrong: w } : null;
  };
  cand.push(s.rowReplacement ? mk('replaced-row', wrongFor((t) => detQ(replaceRow(a, t, rhs)).div(D))) : null);
  cand.push(s.rowReplacement ? mk('ratio-inverted', wrongFor((t) => D.div(dets[t]))) : null);
  cand.push(s.wrongColumn ? mk('wrong-column', wrongFor((t) => sol[(t + 1) % n])) : null);

  return {
    params: s.params,
    prompt: s.prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, cand),
    verify: finalVerify,
  };
}

// ---------- levels ----------

const NAMES2 = ['x', 'y'];
const NAMES3 = ['x', 'y', 'z'];

function level12(rng: Rng, both: boolean): Body {
  for (;;) {
    const [a, b, c, d] = [0, 0, 0, 0].map(() => rng.nonzero(-5, 5));
    const x = rng.nonzero(-6, 6);
    const y = rng.nonzero(-6, 6);
    if (a * d - b * c === 0) continue;
    const A = toQ([[a, b], [c, d]]);
    const rhs = [q(a * x + b * y), q(c * x + d * y)];
    const target = both ? [0, 1] : [0];
    return cramerBody({
      a: A,
      rhs,
      names: NAMES2,
      targets: target,
      fmt: exact,
      prompt: `Use Cramer's rule to solve $$${systemLatex(A, rhs, NAMES2, exact)}$$ ${both ? 'Find $x$ and $y$.' : 'Find $x$.'}`,
      params: { a, b, c, d, x, y },
      wrongColumn: !both,
      rowReplacement: true,
    });
  }
}

function level3(rng: Rng): Body {
  for (;;) {
    const [a, b, c, d] = [0, 0, 0, 0].map(() => rng.nonzero(-5, 5));
    const D = a * d - b * c;
    if (Math.abs(D) < 2 || Math.abs(D) > 6) continue;
    const e = rng.int(-9, 9);
    const f = rng.int(-9, 9);
    const A = toQ([[a, b], [c, d]]);
    const rhs = [q(e), q(f)];
    const x = detQ(replaceCol(A, 0, rhs)).div(D);
    const y = detQ(replaceCol(A, 1, rhs)).div(D);
    if (x.isZero() || y.isZero() || (x.isInt() && y.isInt())) continue;
    return cramerBody({
      a: A,
      rhs,
      names: NAMES2,
      targets: [0, 1],
      fmt: exact,
      prompt: `Use Cramer's rule to solve $$${systemLatex(A, rhs, NAMES2, exact)}$$ Give $x$ and $y$ as fractions or decimals.`,
      params: { a, b, c, d, e, f },
      wrongColumn: false,
      rowReplacement: true,
    });
  }
}

function level4(rng: Rng): Body {
  for (;;) {
    const m = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-4, 4)));
    const sol = [0, 1, 2].map(() => rng.int(-4, 4));
    const which = rng.int(0, 2);
    const A = toQ(m);
    const D = detQ(A);
    if (D.isZero() || D.abs().valueOf() > 40 || sol[which] === 0) continue;
    const rhs = m.map((r) => q(r.reduce((t, v, i) => t + v * sol[i], 0)));
    const p: Record<string, number> = { which };
    m.forEach((r, i) => r.forEach((v, j) => (p[`m${i + 1}${j + 1}`] = v)));
    p.x = sol[0];
    p.y = sol[1];
    p.z = sol[2];
    return cramerBody({
      a: A,
      rhs,
      names: NAMES3,
      targets: [which],
      fmt: exact,
      prompt: `Use Cramer's rule to find $${NAMES3[which]}$: $$${systemLatex(A, rhs, NAMES3, exact)}$$`,
      params: p,
      wrongColumn: true,
      rowReplacement: true,
    });
  }
}

const B_CHOICES = [q(1, 2), q(3, 5), q(3, 4), q(4, 5)];

function level5(rng: Rng): Body {
  const b = rng.pick(B_CHOICES);
  const a = 10 * rng.int(1, 20);
  const I0 = 10 * rng.int(1, 10);
  const G0 = 10 * rng.int(1, 10);
  const T = I0 + G0;
  const A: M = [
    [q(1), q(-1)],
    [b.neg(), q(1)],
  ];
  const rhs = [q(T), q(a)];
  const one = q(1).sub(b);
  const names = ['Y', 'C'];
  const D = one;
  const Y = q(a + T).div(D);
  const C = q(a).add(b.mul(T)).div(D);

  // The rewrite choice: which matrix form is right.
  const sgn = (v: Q) => v;
  const forms: { m: M; ok: boolean }[] = [
    { m: A, ok: true },
    { m: [[q(1), q(1)], [b.neg(), q(1)]], ok: false },
    { m: [[q(1), q(-1)], [sgn(b), q(1)]], ok: false },
    { m: [[q(-1), q(1)], [b.neg(), q(1)]], ok: false },
  ];
  const shuffled = rng.shuffle(forms.map((f, i) => ({ id: `o${i}`, label: `$${bmatrix(f.m, decimal)}$`, ok: f.ok })));
  const options = shuffled.map(({ id, label }) => ({ id, label }));
  const correct = shuffled.find((o) => o.ok)!.id;
  const bd = decimal(b);

  const firstStep: Step = {
    key: 'rewrite',
    instruction: `Move the unknowns to the left: $Y - C = I_0 + G_0$ and $-bY + C = a$. Read off the coefficient matrix for $(Y, C)$.`,
    math: `\\begin{aligned} Y - C &= I_0 + G_0 = ${T} \\\\ -${bd}Y + C &= a = ${a} \\end{aligned} \\qquad A = ${bmatrix(A, decimal)}`,
    why: 'Each equation must have the unknowns on the left and constants on the right. Subtracting $C$ (or $bY$) from both sides flips its sign.',
    ask: { prompt: 'Which is the coefficient matrix of the system in $(Y, C)$?', answer: choiceAnswer(options, correct) },
  };

  const verifyEqs = [`Y = C + ${I0} + ${G0}`, `C = ${a} + ${b.toExpr()}*Y`];
  const body = cramerBody({
    a: A,
    rhs,
    names,
    targets: [0, 1],
    fmt: decimal,
    prompt: `A simple economy has $Y = C + I_0 + G_0$ and $C = a + bY$, with $a = ${a}$, $b = ${bd}$, $I_0 = ${I0}$ and $G_0 = ${G0}$. Write it as a linear system in $(Y, C)$ and use Cramer's rule to find national income $Y$ and consumption $C$.`,
    params: { a, bp: Math.round(b.valueOf() * 100), I0, G0 },
    verifyEqs,
    wrongColumn: false,
    rowReplacement: false,
    firstStep,
  });

  // Misconception: divided by b instead of 1 - b.
  const answer = body.answer;
  const Yw = q(a + T).div(b);
  const Cw = q(a).add(b.mul(Yw));
  const wrong: MisconceptionInstance[] = [{ id: 'multiplier-b', wrong: tupleAnswer(names, [Yw, Cw]) }];
  const misconceptions = distinctMisconceptions(answer, wrong);
  void Y;
  void C;

  // Interpretation: drawn LAST.
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const dG = 10 * rng.int(1, 5);
    const lat = (v: Q) => v.toLatex();
    const mult = q(dG).div(one);
    const fourth = q(dG).div(b).eq(mult) ? q(dG).mul(q(1).add(b)) : q(dG).div(b);
    const raw = [
      { v: mult, ok: true },
      { v: q(dG), ok: false },
      { v: q(dG).mul(b), ok: false },
      { v: fourth, ok: false },
    ];
    const opts = rng.shuffle(raw.map((r, i) => ({ id: `o${i}`, label: `$${lat(r.v)}$`, ok: r.ok })));
    interpretation = [
      {
        prompt: `Here $b = ${bd}$. If government spending $G_0$ rises by ${dG}, by how much does national income $Y$ rise?`,
        options: opts.map(({ id, label }) => ({ id, label })),
        correct: opts.find((o) => o.ok)!.id,
        explanation: `$Y = \\dfrac{a + I_0 + G_0}{1 - b}$, so $\\Delta Y = \\dfrac{\\Delta G_0}{1 - b} = \\dfrac{${dG}}{${decimal(one)}} = ${lat(mult)}$. The factor $1/(1-b) = ${lat(q(1).div(one))}$ is the multiplier: each dollar of spending is spent again, a fraction $b$ at a time.`,
      },
    ];
  }

  return { ...body, misconceptions, interpretation };
}

export const cramersRule: SkillDefinition = {
  id: ID,
  title: "Cramer's rule",
  track: 'math',
  unit: 'Matrices',
  description: "Solve linear systems with determinants: replace one column by the constants and divide.",
  prerequisites: ['determinants'],
  maxDenominator: 6,
  levels: {
    1: {
      description: '2×2 system, find x only (integer solution)',
      ranges: { a: [-5, 5], b: [-5, 5], c: [-5, 5], d: [-5, 5], x: [-6, 6], y: [-6, 6] },
    },
    2: {
      description: '2×2 system, find both x and y',
      ranges: { a: [-5, 5], b: [-5, 5], c: [-5, 5], d: [-5, 5], x: [-6, 6], y: [-6, 6] },
    },
    3: {
      description: '2×2 system with a fractional solution',
      ranges: { a: [-5, 5], b: [-5, 5], c: [-5, 5], d: [-5, 5], e: [-9, 9], f: [-9, 9] },
    },
    4: {
      description: '3×3 system, find one named unknown',
      ranges: {
        which: [0, 2],
        m11: [-4, 4], m12: [-4, 4], m13: [-4, 4],
        m21: [-4, 4], m22: [-4, 4], m23: [-4, 4],
        m31: [-4, 4], m32: [-4, 4], m33: [-4, 4],
        x: [-4, 4], y: [-4, 4], z: [-4, 4],
      },
    },
    5: {
      description: 'The Keynesian income model as a system in (Y, C)',
      ranges: { a: [10, 200], bp: [50, 80], I0: [10, 100], G0: [10, 100] },
    },
  },
  misconceptions: {
    'replaced-row': {
      name: 'Replaced a row instead of a column',
      explanation:
        "In Cramer's rule you swap the unknown's *column* of $A$ for the constants (the right-hand side stacked as a column). Writing the constants as a row replaces the wrong entries and gives a different determinant.",
    },
    'ratio-inverted': {
      name: 'Divided the wrong way',
      explanation: 'The unknown is $\\det A_i / \\det A$: the replaced determinant on top, the coefficient determinant underneath.',
    },
    'wrong-column': {
      name: 'Replaced the column of a different unknown',
      explanation:
        'The column you replace must belong to the unknown you want. Column 1 holds the $x$ coefficients, column 2 the $y$ coefficients, column 3 the $z$ coefficients.',
    },
    'multiplier-b': {
      name: 'Divided by b instead of 1 − b',
      explanation:
        'Eliminating $C$ leaves $(1 - b)Y = a + I_0 + G_0$, so $Y = (a + I_0 + G_0)/(1 - b)$. The coefficient determinant of the system is $1 - b$, not $b$.',
    },
  },
  stepLabels: {
    rewrite: 'Move the unknowns to the left',
    'det-a': 'Find det A',
    'det-x': 'Replace column 1 and take the determinant',
    'det-y': 'Replace column 2 and take the determinant',
    'det-z': 'Replace column 3 and take the determinant',
    divide: 'Divide: det A_i / det A',
    'divide-y': 'Divide for the second unknown',
  },
  learn: {
    whyItMatters:
      "Macro models are linear systems, and Cramer's rule solves them with determinants. In the simple Keynesian model, $Y = C + I_0 + G_0$ and $C = a + bY$. Take $a = 100$, $b = 3/4$, $I_0 = G_0 = 50$. Rewrite it as $Y - C = 100$ and $-\\tfrac34 Y + C = 100$. The coefficient determinant is $1 - \\tfrac34 = \\tfrac14$, and the replaced determinant for $Y$ is $200$, so $Y = 200 \\div \\tfrac14 = 800$ and $C = 700$. The same formula shows the multiplier $1/(1-b) = 4$ in the denominator.",
    summary:
      "For a square system $A\\mathbf{x} = \\mathbf{b}$ with $\\det A \\ne 0$, each unknown is $x_i = \\det A_i / \\det A$, where $A_i$ is $A$ with column $i$ replaced by $\\mathbf{b}$. If $\\det A = 0$ there is no single solution.",
    formulas: [
      { latex: 'x_i = \\dfrac{\\det A_i}{\\det A}', note: '$A_i$: column $i$ of $A$ replaced by the constants.' },
      {
        latex: 'x = \\dfrac{\\det\\begin{bmatrix} e & b \\\\ f & d \\end{bmatrix}}{\\det\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}}, \\quad y = \\dfrac{\\det\\begin{bmatrix} a & e \\\\ c & f \\end{bmatrix}}{\\det\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}}',
        note: 'For $ax + by = e$, $cx + dy = f$.',
      },
    ],
    example: { seed: 3, level: 2 },
    tips: [
      'Compute $\\det A$ first. If it is 0, stop: Cramer\'s rule does not apply.',
      'Only one column changes in each $A_i$. Copy the others exactly, including signs.',
    ],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return level12(rng, false);
      case 2:
        return level12(rng, true);
      case 3:
        return level3(rng);
      case 4:
        return level4(rng);
      default:
        return level5(rng);
    }
  },
};
