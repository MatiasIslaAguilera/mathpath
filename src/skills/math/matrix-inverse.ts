// Matrix inverse (2×2 only): A⁻¹ = (1/det) [d −b; −c a]. L1–L2 find the inverse (tuple, verified by
// solving A·X = I), L3 spots the singular matrix (choice), L4 solves A x = b as x = A⁻¹ b, L5 finds a
// missing entry of A⁻¹ from A·A⁻¹ = I.

import { numberAnswer, tupleAnswer, choiceAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, ChoiceOption, MisconceptionInstance, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'matrix-inverse';

const bmatrix = (rows: (number | string)[][]) =>
  `\\begin{bmatrix} ${rows.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const strs = (rows: number[][]) => rows.map((r) => r.map((e) => (e < 0 ? `(${e})` : String(e))));
const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c;
const rows2 = <T>(v: T[]): T[][] => [[v[0], v[1]], [v[2], v[3]]];
const LABELS = ['Row 1, col 1', 'Row 1, col 2', 'Row 2, col 1', 'Row 2, col 2'];
const DISPLAY = ['(A^{-1})_{11}', '(A^{-1})_{12}', '(A^{-1})_{21}', '(A^{-1})_{22}'];

type Body = ReturnType<SkillDefinition['generate']>;
type Mat = [number, number, number, number];

const tupleOf = (vals: (Q | number)[]) => tupleAnswer(LABELS, vals, DISPLAY);
const invOf = ([a, b, c, d]: Mat): Q[] => {
  const det = det2(a, b, c, d);
  return [Q.of(d).div(det), Q.of(-b).div(det), Q.of(-c).div(det), Q.of(a).div(det)];
};

export const matrixInverse: SkillDefinition = {
  id: ID,
  title: 'Matrix inverse',
  track: 'math',
  unit: 'Matrices',
  description: 'Invert a 2×2 matrix with the adjugate formula, spot a matrix with no inverse, and solve Ax = b.',
  prerequisites: ['determinants'],
  maxDenominator: 4,
  levels: {
    1: {
      description: '2×2 with determinant ±1: the inverse has whole-number entries',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] },
    },
    2: {
      description: '2×2 with determinant ±2 or ±4: the inverse has fractions',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] },
    },
    3: {
      description: 'Which of four matrices has no inverse?',
      ranges: { form: [0, 1], p: [-6, 6], q: [-6, 6], k: [-3, 3], zpos: [0, 3] },
    },
    4: {
      description: 'Solve Ax = b with x = A⁻¹b',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9], x: [-6, 6], y: [-6, 6], e: [-60, 60], f: [-60, 60] },
    },
    5: {
      description: 'A and its inverse with one entry missing: find it',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9], pos: [0, 3] },
    },
  },
  misconceptions: {
    'no-swap': {
      name: "Didn't swap the diagonal entries",
      explanation:
        'In the inverse of $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ the diagonal entries trade places: $a$ and $d$ swap, while $b$ and $c$ stay where they are but change sign. The matrix is $\\frac{1}{ad-bc}\\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}$.',
    },
    'negated-diagonal': {
      name: 'Negated the diagonal instead',
      explanation:
        'It is the off-diagonal entries $b$ and $c$ that change sign. The diagonal entries swap places but keep their signs.',
    },
    'forgot-det': {
      name: "Didn't divide by the determinant",
      explanation:
        'Swapping and negating gives the adjugate, not the inverse. Divide every entry by $ad - bc$ as well, so that $A A^{-1} = I$.',
    },
    'reciprocal-entries': {
      name: 'Took 1 over each entry',
      explanation:
        'The inverse of a matrix is not the matrix of reciprocals. Use the formula with the determinant, then check by multiplying $A A^{-1}$ and looking for the identity.',
    },
    'a-times-b': {
      name: 'Multiplied A by b instead of its inverse',
      explanation:
        'Solving $A\\mathbf{x} = \\mathbf{b}$ means undoing $A$: $\\mathbf{x} = A^{-1}\\mathbf{b}$. Computing $A\\mathbf{b}$ applies $A$ once more instead.',
    },
    'zero-entry': {
      name: 'Picked the matrix with a zero in it',
      explanation:
        'A zero entry does not make a matrix singular. $\\begin{bmatrix} 0 & 2 \\\\ 3 & 1 \\end{bmatrix}$ has determinant $-6$ and an inverse. Only $ad - bc = 0$ means no inverse.',
    },
  },
  stepLabels: {
    det: 'Find the determinant',
    adjugate: 'Swap the diagonal, negate the off-diagonal',
    scale: 'Divide every entry by the determinant',
    singular: 'A determinant of 0 means no inverse',
    multiply: 'Multiply the inverse by b',
    identity: 'Use A times its inverse = I',
  },
  learn: {
    whyItMatters:
      'Two linked markets have prices satisfying $2P_1 + P_2 = 10$ and $P_1 + 3P_2 = 15$. In matrix form $A\\mathbf{p} = \\mathbf{b}$ with $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 3 \\end{bmatrix}$. Its determinant is $2\\cdot 3 - 1\\cdot 1 = 5$, so $A^{-1} = \\frac{1}{5}\\begin{bmatrix} 3 & -1 \\\\ -1 & 2 \\end{bmatrix}$ and $\\mathbf{p} = A^{-1}\\mathbf{b} = (3, 4)$. Check: $2\\cdot 3 + 4 = 10$ and $3 + 3\\cdot 4 = 15$. The inverse solves the model for any right-hand side, which is how comparative statics and econometrics are written.',
    summary:
      'A square matrix $A$ has an inverse $A^{-1}$ with $A A^{-1} = I$ exactly when $\\det A \\ne 0$. For $2 \\times 2$: swap the diagonal, negate the off-diagonal, divide by the determinant. Then $A\\mathbf{x} = \\mathbf{b}$ gives $\\mathbf{x} = A^{-1}\\mathbf{b}$.',
    formulas: [
      {
        latex: 'A^{-1} = \\frac{1}{ad - bc}\\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}',
        note: 'For $A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ with $ad - bc \\ne 0$.',
      },
      { latex: 'A\\mathbf{x} = \\mathbf{b} \\;\\Rightarrow\\; \\mathbf{x} = A^{-1}\\mathbf{b}', note: 'Multiply on the left.' },
    ],
    example: { seed: 7, level: 2 },
    tips: [
      'Check any inverse by multiplying: $A A^{-1}$ must be the identity $\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}$.',
      'The determinant goes first. If it is 0, stop: there is no inverse.',
    ],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return findInverse(rng, [1, -1]);
      case 2:
        return findInverse(rng, [2, -2, 4, -4]);
      case 3:
        return level3(rng);
      case 4:
        return level4(rng);
      default:
        return level5(rng);
    }
  },
};

/** The four equations of A·X = I, X = [a b; c d] (unknowns a, b, c, d in reading order). */
function inverseVerify([p, q, r, s]: Mat): VerifySpec {
  return {
    type: 'solve',
    equations: [
      `(${p})*a + (${q})*c = 1`,
      `(${p})*b + (${q})*d = 0`,
      `(${r})*a + (${s})*c = 0`,
      `(${r})*b + (${s})*d = 1`,
    ],
    unknowns: ['a', 'b', 'c', 'd'],
  };
}

const detStep = (m: Mat, det: number): Step => ({
  key: 'det',
  instruction: 'Find the determinant first. If it were 0 there would be no inverse.',
  math: `\\det A = ${paren(m[0])}\\cdot${paren(m[3])} - ${paren(m[1])}\\cdot${paren(m[2])} = ${det}`,
  why: 'The inverse formula divides by $ad - bc$, so it only exists when that is not 0.',
  ask: {
    prompt: 'What is $\\det A$?',
    answer: numberAnswer(det),
    verify: { type: 'det', matrix: strs(rows2(m)) },
  },
});

const adjStep = (adj: number[], d: number, note: string): Step => ({
  key: 'adjugate',
  instruction: 'Swap $a$ and $d$, and negate $b$ and $c$.',
  math: `${bmatrix([['a', 'b'], ['c', 'd']])} \\;\\to\\; ${bmatrix([['d', '-b'], ['-c', 'a']])} = ${bmatrix(rows2(adj))}`,
  why: `This swapped-and-negated matrix is the adjugate; ${note}`,
  ask: {
    prompt: 'What is the top-left entry of the swapped matrix? (It is $d$.)',
    answer: numberAnswer(d),
    verify: { type: 'evaluate', expr: `(${d})` },
  },
});

function findInverse(rng: Rng, dets: number[]): Body {
  for (;;) {
    const det = dets[rng.int(0, dets.length - 1)];
    const a = rng.nonzero(-6, 6);
    const b = rng.int(-6, 6);
    const c = rng.int(-6, 6);
    if ((det + b * c) % a !== 0) continue; // d from a·d − b·c = det
    const d = (det + b * c) / a;
    if (Math.abs(d) > 9) continue;
    const m: Mat = [a, b, c, d];
    const inv = invOf(m);
    if (Math.abs(det) > 1 && inv.every((v) => v.d === 1)) continue; // L2 wants a fraction
    const answer = tupleOf(inv);
    const adj = [d, -b, -c, a];
    const verify = inverseVerify(m);
    const steps: Step[] = [
      detStep(m, det),
      adjStep(adj, d, 'it is the numerator of the inverse.'),
      {
        key: 'scale',
        instruction: `Divide every entry by the determinant, ${det}.`,
        math: `A^{-1} = \\frac{1}{${det}}${bmatrix(rows2(adj))} = ${bmatrix(rows2(inv.map((v) => v.toLatex())))}`,
        why: 'The inverse is the adjugate divided by $ad - bc$, so that $A A^{-1} = I$.',
        ask: { prompt: 'Enter the four entries of $A^{-1}$.', answer, verify },
      },
    ];
    const cand: (MisconceptionInstance | null)[] = [
      { id: 'no-swap', wrong: tupleOf([a, -b, -c, d].map((v) => Q.of(v).div(det))) },
      { id: 'negated-diagonal', wrong: tupleOf([-d, b, c, -a].map((v) => Q.of(v).div(det))) },
      { id: 'forgot-det', wrong: tupleOf(adj) },
      [a, b, c, d].some((v) => v === 0)
        ? null
        : { id: 'reciprocal-entries', wrong: tupleOf([a, b, c, d].map((v) => Q.of(1).div(v))) },
    ];
    return {
      params: { a, b, c, d },
      prompt: `Find the inverse of $A = ${bmatrix([[a, b], [c, d]])}$.`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, cand),
      verify,
    };
  }
}

const inline = (m: Mat) => `$${bmatrix(rows2(m))}$`;

function level3(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 1); // 0: row 2 is a multiple of row 1; 1: column 2 is a multiple of column 1
    const p = rng.nonzero(-6, 6);
    const q = rng.nonzero(-6, 6);
    const k = rng.nonzero(-3, 3);
    const zpos = rng.int(0, 3);
    const sing: Mat = form === 0 ? [p, q, k * p, k * q] : [p, k * p, q, k * q];
    // Two near-misses: the singular matrix with one entry nudged by 1 (entries stay nonzero).
    const idx = rng.shuffle([0, 1, 2, 3]);
    const near = (i: number): Mat | null => {
      const m = [...sing] as Mat;
      m[i] += rng.chance(0.5) ? 1 : -1;
      return m[i] === 0 || det2(...m) === 0 ? null : m;
    };
    const n1 = near(idx[0]);
    const n2 = near(idx[1]);
    if (!n1 || !n2) continue;
    // The zero-entry decoy: one zero, nonzero determinant.
    const z: Mat = [rng.nonzero(-6, 6), rng.nonzero(-6, 6), rng.nonzero(-6, 6), rng.nonzero(-6, 6)];
    z[zpos] = 0;
    const dz = det2(...z);
    if (dz === 0) continue;
    if (new Set([sing, n1, n2, z].map((m) => m.join(','))).size < 4) continue;
    const order = rng.shuffle([
      { id: 'sing', m: sing },
      { id: 'zero', m: z },
      { id: 'n1', m: n1 },
      { id: 'n2', m: n2 },
    ]);
    const options: ChoiceOption[] = order.map((_e, i) => ({ id: `o${i}`, label: `$${'ABCD'[i]}$` }));
    const idOf = (id: string) => options[order.findIndex((e) => e.id === id)].id;
    const answer: AnswerSpec = choiceAnswer(options, idOf('sing'));
    const verify: VerifySpec = {
      type: 'choice',
      note: 'Exactly one option has determinant 0 (ad - bc); the other three have nonzero determinants.',
    };
    const steps: Step[] = [
      {
        key: 'det',
        instruction: 'A zero entry is not what matters; the determinant is. Try it on the matrix that has a zero.',
        math: `\\det${bmatrix(rows2(z))} = ${paren(z[0])}\\cdot${paren(z[3])} - ${paren(z[1])}\\cdot${paren(z[2])} = ${dz}`,
        why: 'A matrix with a zero entry can still have a nonzero determinant, and then it has an inverse.',
        ask: {
          prompt: `What is the determinant of ${inline(z)}?`,
          answer: numberAnswer(dz),
          verify: { type: 'det', matrix: strs(rows2(z)) },
        },
      },
      {
        key: 'singular',
        instruction: 'Check $ad - bc$ for each matrix. The one where it equals 0 has no inverse.',
        math: `\\det${bmatrix(rows2(sing))} = ${paren(sing[0])}\\cdot${paren(sing[3])} - ${paren(sing[1])}\\cdot${paren(sing[2])} = 0`,
        why: 'A determinant of 0 means one row (or column) is a multiple of the other, so the matrix cannot be undone.',
        ask: { prompt: 'Which matrix has no inverse?', answer },
      },
    ];
    return {
      params: { form, p, q, k, zpos },
      prompt: `Exactly one of these matrices has no inverse. Which one? $$${order.map((e, i) => `${'ABCD'[i]} = ${bmatrix(rows2(e.m))}`).join(', \\quad ')}$$`,
      answer,
      steps,
      misconceptions: [{ id: 'zero-entry', wrong: choiceAnswer(options, idOf('zero')) }],
      verify,
    };
  }
}

function level4(rng: Rng): Body {
  for (;;) {
    const a = rng.int(-5, 5);
    const b = rng.int(-5, 5);
    const c = rng.int(-5, 5);
    const d = rng.int(-5, 5);
    const det = det2(a, b, c, d);
    if (det === 0 || Math.abs(det) > 4) continue;
    const x = rng.nonzero(-6, 6);
    const y = rng.nonzero(-6, 6);
    const e = a * x + b * y;
    const f = c * x + d * y;
    const m: Mat = [a, b, c, d];
    const answer = tupleAnswer(['x', 'y'], [x, y], ['x', 'y']);
    const verify: VerifySpec = {
      type: 'solve',
      equations: [`(${a})*x + (${b})*y = (${e})`, `(${c})*x + (${d})*y = (${f})`],
      unknowns: ['x', 'y'],
    };
    const adj = [d, -b, -c, a];
    const steps: Step[] = [
      detStep(m, det),
      adjStep(adj, d, 'divided by the determinant it is $A^{-1}$.'),
      {
        key: 'multiply',
        instruction: 'Multiply the inverse by $\\mathbf{b}$: $\\mathbf{x} = A^{-1}\\mathbf{b}$.',
        math: `\\mathbf{x} = \\frac{1}{${det}}${bmatrix(rows2(adj))}${bmatrix([[e], [f]])} = ${bmatrix([[x], [y]])}`,
        why: 'Multiplying both sides of $A\\mathbf{x} = \\mathbf{b}$ on the left by $A^{-1}$ leaves $\\mathbf{x}$ alone.',
        ask: { prompt: 'Find $x$ and $y$.', answer, verify },
      },
    ];
    return {
      params: { a, b, c, d, x, y, e, f },
      prompt: `Solve $A\\mathbf{x} = \\mathbf{b}$ using $\\mathbf{x} = A^{-1}\\mathbf{b}$, where $$A = ${bmatrix([[a, b], [c, d]])}, \\quad \\mathbf{b} = ${bmatrix([[e], [f]])}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [
        { id: 'a-times-b', wrong: tupleAnswer(['x', 'y'], [a * e + b * f, c * e + d * f], ['x', 'y']) },
      ]),
      verify,
    };
  }
}

function level5(rng: Rng): Body {
  for (;;) {
    const a = rng.int(-6, 6);
    const b = rng.int(-6, 6);
    const c = rng.int(-6, 6);
    const d = rng.int(-6, 6);
    const det = det2(a, b, c, d);
    if (det === 0 || Math.abs(det) > 4 || Math.abs(det) === 1) continue;
    const pos = rng.int(0, 3);
    const m: Mat = [a, b, c, d];
    const A = rows2(m);
    const inv = invOf(m);
    const invM = rows2(inv);
    const i = Math.floor(pos / 2);
    const j = pos % 2;
    // Row r of A times column j of A⁻¹ involves the missing entry (row i, col j) when A[r][i] ≠ 0.
    const r = A[0][i] !== 0 ? 0 : 1;
    if (A[r][i] === 0) continue;
    const terms = [0, 1].map((k) => (k === i ? `(${A[r][k]})*x` : `(${A[r][k]})*${invM[k][j].toExpr()}`));
    const delta = r === j ? 1 : 0;
    const verify: VerifySpec = { type: 'solve', equations: [`${terms.join(' + ')} = ${delta}`], unknowns: ['x'] };
    const answer = numberAnswer(inv[pos]);
    const shown = invM.map((row, ri) => row.map((v, ci) => (ri === i && ci === j ? '?' : v.toLatex())));
    const adj = [d, -b, -c, a];
    const termsTeX = [0, 1].map((k) => `${paren(A[r][k])}\\cdot${k === i ? '?' : invM[k][j].toLatex()}`).join(' + ');
    const steps: Step[] = [
      detStep(m, det),
      {
        key: 'identity',
        instruction: `Use $A A^{-1} = I$. Row ${r + 1} of $A$ times column ${j + 1} of $A^{-1}$ must equal the identity entry ${delta}.`,
        math: `(A A^{-1})_{${r + 1}${j + 1}} = ${termsTeX} = ${delta}`,
        why: 'Every entry of $A A^{-1}$ must match the identity matrix, which gives an equation for the missing entry.',
        ask: { prompt: 'What is the missing entry?', answer, verify },
      },
    ];
    return {
      params: { a, b, c, d, pos },
      prompt: `Here is $A$ and its inverse with one entry replaced by $?$. Find the missing entry. $$A = ${bmatrix(A)}, \\quad A^{-1} = ${bmatrix(shown)}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('no-swap', () => Q.of([a, -b, -c, d][pos]).div(det)),
        wrongNumber('negated-diagonal', () => Q.of([-d, b, c, -a][pos]).div(det)),
        wrongNumber('forgot-det', () => adj[pos]),
      ]),
      verify,
    };
  }
}
