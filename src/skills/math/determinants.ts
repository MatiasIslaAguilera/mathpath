// Determinants: 2×2 (ad − bc), a singular parameter, triangular 3×3, cofactor expansion, and the
// determinant rules (kA, AB, Aᵀ, row swap). Every determinant ask is verified with `det`.

import { numberAnswer, choiceAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { SkillDefinition, Step } from '../../engine/types';

const ID = 'determinants';

const bmatrix = (rows: (number | string)[][]) =>
  `\\begin{bmatrix} ${rows.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const strs = (rows: number[][]) => rows.map((r) => r.map((e) => (e < 0 ? `(${e})` : String(e))));
const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c;
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const coefK = (c: number) => (c === 1 ? 'k' : c === -1 ? '-k' : `${c}k`);

type Body = ReturnType<SkillDefinition['generate']>;

export const determinants: SkillDefinition = {
  id: ID,
  title: 'Determinants',
  track: 'math',
  unit: 'Matrices',
  description: 'Compute 2×2 and 3×3 determinants, find when a matrix is singular, and use the determinant rules.',
  prerequisites: ['matrix-operations'],
  maxDenominator: 1,
  levels: {
    1: {
      description: '2×2: ad − bc',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] },
    },
    2: {
      description: '2×2 with a parameter: for which k is it singular?',
      ranges: { b: [-9, 9], c: [-9, 9], d: [-9, 9], k: [-9, 9] },
    },
    3: {
      description: '3×3 triangular, or with a row of zeros',
      ranges: {
        form: [0, 1],
        m11: [-5, 5], m12: [-5, 5], m13: [-5, 5],
        m21: [-5, 5], m22: [-5, 5], m23: [-5, 5],
        m31: [-5, 5], m32: [-5, 5], m33: [-5, 5],
      },
    },
    4: {
      description: '3×3 general: cofactor expansion along the first row',
      ranges: {
        m11: [-5, 5], m12: [-5, 5], m13: [-5, 5],
        m21: [-5, 5], m22: [-5, 5], m23: [-5, 5],
        m31: [-5, 5], m32: [-5, 5], m33: [-5, 5],
      },
    },
    5: {
      description: 'Properties: det(kA), det(AB), det(Aᵀ), swapping rows',
      ranges: { form: [0, 3], n: [2, 3], d: [-6, 6], e: [-6, 6], k: [-3, 3] },
    },
  },
  misconceptions: {
    'added-diagonals': {
      name: 'Added the diagonal products',
      explanation:
        'The determinant of $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ is $ad - bc$: the main diagonal minus the other diagonal. Adding them gives a different number.',
    },
    'reversed-diagonals': {
      name: 'Subtracted the wrong way',
      explanation:
        'The order matters: it is (main diagonal) $-$ (other diagonal), $ad - bc$. Reversing it gives $bc - ad$, which has the opposite sign.',
    },
    'cofactor-signs': {
      name: 'Left out the alternating signs',
      explanation:
        'Along the first row the cofactor signs alternate $+, -, +$. The middle term is subtracted: $a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}$. Adding all three gives the wrong number.',
    },
    'diagonal-sum': {
      name: 'Added the diagonal instead of multiplying',
      explanation:
        'For a triangular matrix the determinant is the product of the diagonal entries, not their sum. (The sum is the trace, a different quantity.)',
    },
    'scalar-once': {
      name: 'Multiplied by k only once',
      explanation:
        'Multiplying a whole $n \\times n$ matrix by $k$ multiplies every row by $k$, and each row multiplies the determinant by $k$. So $\\det(kA) = k^n \\det A$, not $k \\det A$.',
    },
    'swap-keeps-sign': {
      name: 'Kept the sign after a row swap',
      explanation: 'Swapping two rows flips the sign of the determinant: the new determinant is $-\\det A$.',
    },
    'product-as-sum': {
      name: 'Added the determinants',
      explanation:
        'The determinant of a product is the product of the determinants: $\\det(AB) = \\det A \\cdot \\det B$. There is no such rule for sums.',
    },
  },
  stepLabels: {
    diagonals: 'Multiply the diagonals',
    subtract: 'Subtract the products',
    diagonal: 'Start multiplying down the diagonal',
    'zero-row': 'Spot the row of zeros',
    rule: 'Pick the determinant rule',
    'solve-k': 'Set the determinant to 0 and solve for k',
    triangular: 'Multiply down the diagonal',
    'minor-1': 'First minor (delete row 1, column 1)',
    'minor-2': 'Second minor (delete row 1, column 2)',
    'minor-3': 'Third minor (delete row 1, column 3)',
    signs: 'Alternate the signs + − +',
    expand: 'Add the signed terms',
    property: 'Apply the determinant rule',
  },
  learn: {
    whyItMatters:
      "A zero determinant means a linear system has no single solution. Take demand $Q = 100 - 2P$ and supply $Q = -20 + 4P$. Written as $2P + Q = 100$ and $-4P + Q = -20$, the coefficient matrix has determinant $2\\cdot 1 - 1\\cdot(-4) = 6$. That is not zero, so there is exactly one equilibrium: $P = 20$, $Q = 60$. Give supply the same slope as demand and the determinant becomes 0: the curves are parallel, with no unique equilibrium. Cramer's rule and the Hessian test in optimization both start from this one number.",
    summary:
      'The determinant is a single number from a square matrix. For $2 \\times 2$ it is $ad - bc$. For $3 \\times 3$, expand along the first row with signs $+, -, +$ times the $2 \\times 2$ minors. A matrix with determinant 0 is singular: it has no inverse.',
    formulas: [
      { latex: '\\det\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} = ad - bc', note: 'Main diagonal minus the other diagonal.' },
      { latex: '\\det A = a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}', note: '$M_{1j}$ is the determinant left after deleting row 1 and column $j$.' },
      { latex: '\\det(kA) = k^n \\det A, \\quad \\det(AB) = \\det A \\det B, \\quad \\det A^{T} = \\det A', note: 'For an $n \\times n$ matrix. Swapping two rows changes the sign.' },
    ],
    example: { seed: 7, level: 4 },
    tips: [
      'A triangular matrix (zeros all on one side of the diagonal) has determinant equal to the product of its diagonal. A row of zeros makes the determinant 0.',
      'Write the minors out one at a time. Most 3×3 mistakes are sign slips, not hard arithmetic.',
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
      default:
        return level5(rng);
    }
  },
};

function level1(rng: Rng): Body {
  for (;;) {
    const a = rng.int(-9, 9);
    const b = rng.int(-9, 9);
    const c = rng.int(-9, 9);
    const d = rng.int(-9, 9);
    const det = det2(a, b, c, d);
    if (det === 0) continue;
    const matrix = strs([[a, b], [c, d]]);
    const verify = { type: 'det' as const, matrix };
    const answer = numberAnswer(det);
    return {
      params: { a, b, c, d },
      prompt: `Find the determinant: $$\\det ${bmatrix([[a, b], [c, d]])}$$`,
      answer,
      steps: [
        {
          key: 'diagonals',
          instruction: 'Multiply the main diagonal, then multiply the other diagonal.',
          math: `ad = ${paren(a)}\\cdot${paren(d)} = ${a * d}, \\qquad bc = ${paren(b)}\\cdot${paren(c)} = ${b * c}`,
          why: 'For a $2 \\times 2$ matrix, $\\det = ad - bc$: you need both diagonal products.',
          ask: {
            prompt: 'What is the main-diagonal product $ad$?',
            answer: numberAnswer(a * d),
            verify: { type: 'evaluate', expr: `(${a})*(${d})` },
          },
        },
        {
          key: 'subtract',
          instruction: 'Subtract the second product from the first.',
          math: `ad - bc = ${a * d} - ${paren(b * c)} = ${det}`,
          why: 'Main diagonal minus the other diagonal, in that order.',
          ask: { prompt: 'What is the determinant?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('added-diagonals', () => a * d + b * c),
        wrongNumber('reversed-diagonals', () => b * c - a * d),
      ]),
      verify,
    };
  }
}

function level2(rng: Rng): Body {
  for (;;) {
    const b = rng.nonzero(-9, 9);
    const c = rng.nonzero(-9, 9);
    const d = rng.nonzero(-9, 9);
    if ((b * c) % d !== 0) continue;
    const k = (b * c) / d;
    if (k === 0 || Math.abs(k) > 9) continue;
    const bc = b * c;
    const answer = numberAnswer(k);
    const expr = `(${d})*k - (${bc})`;
    const eq = `(${d})*k = (${bc})`;
    const verify = { type: 'solve' as const, equations: [eq], unknowns: ['k'] };
    const detLatex = `${coefK(d)} - ${paren(bc)}`;
    const steps: Step[] = [
      {
        key: 'diagonals',
        instruction: 'Write the determinant as an expression in $k$.',
        math: `\\det = k\\cdot${paren(d)} - ${paren(b)}\\cdot${paren(c)} = ${detLatex}`,
        why: 'A matrix is singular exactly when its determinant is 0, so first find the determinant.',
        ask: {
          prompt: 'Write the determinant as an expression in $k$.',
          answer: { kind: 'expression', value: expr, variables: ['k'], display: detLatex },
          verify: { type: 'equivalent', expr, variables: ['k'] },
        },
      },
      {
        key: 'solve-k',
        instruction: 'Set the determinant equal to 0 and solve for $k$.',
        math: `${detLatex} = 0 \\;\\Rightarrow\\; ${coefK(d)} = ${bc} \\;\\Rightarrow\\; k = ${k}`,
        why: 'Singular means determinant 0.',
        ask: { prompt: 'So $k = \\;?$', answer, verify },
      },
    ];
    return {
      params: { b, c, d, k },
      prompt: `For which value of $k$ is the matrix singular? $$${bmatrix([['k', b], [c, d]])}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('added-diagonals', () => Q.of(-bc).div(d)),
        wrongNumber('reversed-diagonals', () => Q.of(bc).div(d)),
      ]),
      verify,
    };
  }
}

type M3 = number[][];
const minors = (m: M3) => [
  det2(m[1][1], m[1][2], m[2][1], m[2][2]),
  det2(m[1][0], m[1][2], m[2][0], m[2][2]),
  det2(m[1][0], m[1][1], m[2][0], m[2][1]),
];
const sub2 = (m: M3, col: number) => {
  const cols = [0, 1, 2].filter((j) => j !== col);
  return [
    [m[1][cols[0]], m[1][cols[1]]],
    [m[2][cols[0]], m[2][cols[1]]],
  ];
};
const det3 = (m: M3) => {
  const [m1, m2, m3] = minors(m);
  return m[0][0] * m1 - m[0][1] * m2 + m[0][2] * m3;
};
const params3 = (m: M3, extra: Record<string, number> = {}) => {
  const p: Record<string, number> = { ...extra };
  m.forEach((row, i) => row.forEach((v, j) => (p[`m${i + 1}${j + 1}`] = v)));
  return p;
};

function level3(rng: Rng): Body {
  for (;;) {
    const form = rng.chance(0.3) ? 1 : 0;
    const m: M3 = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    if (form === 0) {
      const upper = rng.chance(0.5);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          if (i === j) m[i][j] = rng.nonzero(-5, 5);
          else if (upper ? j > i : j < i) m[i][j] = rng.int(-5, 5);
        }
    } else {
      const z = rng.int(0, 2);
      for (let i = 0; i < 3; i++) if (i !== z) for (let j = 0; j < 3; j++) m[i][j] = rng.int(-5, 5);
      if (m.filter((r) => r.some((v) => v !== 0)).length < 2) continue;
    }
    const det = det3(m);
    if (form === 1 && det !== 0) continue;
    const verify = { type: 'det' as const, matrix: strs(m) };
    const answer = numberAnswer(det);
    const diag = [m[0][0], m[1][1], m[2][2]];
    const zeroRow = m.findIndex((r) => r.every((v) => v === 0));
    const final: Step = {
      key: 'triangular',
      instruction:
        form === 0
          ? 'Multiply down the main diagonal.'
          : `Row ${zeroRow + 1} is all zeros, so the determinant is 0.`,
      math:
        form === 0
          ? `\\det = ${diag.map(paren).join('\\cdot')} = ${det}`
          : `\\text{row } ${zeroRow + 1} = (0,\\,0,\\,0) \\;\\Rightarrow\\; \\det = 0`,
      why:
        form === 0
          ? 'For a triangular matrix the determinant is the product of the diagonal entries.'
          : 'Expanding along a row of zeros gives 0 in every term.',
      ask: { prompt: 'What is the determinant?', answer, verify },
    };
    const first: Step =
      form === 0
        ? {
            key: 'diagonal',
            instruction: 'All the entries on one side of the diagonal are 0, so only the main diagonal matters. Start multiplying it.',
            math: `${paren(diag[0])}\\cdot${paren(diag[1])} = ${diag[0] * diag[1]}`,
            why: 'A triangular matrix has determinant equal to the product of its diagonal entries.',
            ask: {
              prompt: `What is the product of the first two diagonal entries, $${paren(diag[0])}\\cdot${paren(diag[1])}$?`,
              answer: numberAnswer(diag[0] * diag[1]),
              verify: { type: 'evaluate', expr: `(${diag[0]})*(${diag[1]})` },
            },
          }
        : {
            key: 'zero-row',
            instruction: 'Look for a row made entirely of zeros.',
            math: `\\text{row } ${zeroRow + 1} = (0,\\,0,\\,0)`,
            why: 'A zero row forces the determinant to 0.',
            ask: {
              prompt: 'Which row is all zeros? (Enter 1, 2 or 3.)',
              answer: numberAnswer(zeroRow + 1),
              verify: { type: 'evaluate', expr: String(zeroRow + 1) },
            },
          };
    return {
      params: params3(m, { form }),
      prompt: `Find the determinant: $$\\det ${bmatrix(m)}$$`,
      answer,
      steps: [first, final],
      misconceptions: distinctMisconceptions(answer, [
        form === 0 ? wrongNumber('diagonal-sum', () => diag[0] + diag[1] + diag[2]) : null,
      ]),
      verify,
    };
  }
}

function level4(rng: Rng): Body {
  for (;;) {
    const m: M3 = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-5, 5)));
    const [m1, m2, m3] = minors(m);
    const det = det3(m);
    if (det === 0 || m[0].some((v) => v === 0) || m2 === 0) continue;
    const verify = { type: 'det' as const, matrix: strs(m) };
    const answer = numberAnswer(det);
    const steps: Step[] = [0, 1, 2].map((j) => {
      const s = sub2(m, j);
      const val = [m1, m2, m3][j];
      return {
        key: `minor-${j + 1}`,
        instruction: `Delete row 1 and column ${j + 1}. The minor $M_{1${j + 1}}$ is the determinant of what is left.`,
        math: `M_{1${j + 1}} = \\det${bmatrix(s)} = ${paren(s[0][0])}\\cdot${paren(s[1][1])} - ${paren(s[0][1])}\\cdot${paren(s[1][0])} = ${val}`,
        why: 'A minor is the determinant of the smaller matrix left after deleting a row and a column.',
        ask: {
          prompt: `What is $M_{1${j + 1}}$, the determinant of $${bmatrix(s)}$?`,
          answer: numberAnswer(val),
          verify: { type: 'det' as const, matrix: strs(s) },
        },
      };
    });
    const opts = rng.shuffle([
      { id: 'o0', label: 'Minus ($-$)' },
      { id: 'o1', label: 'Plus ($+$)' },
    ]);
    steps.push({
      key: 'signs',
      instruction: 'The signs along the first row alternate: plus, minus, plus.',
      math: '\\det A = +\\,a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}',
      why: 'The cofactor sign is $(-1)^{i+j}$, so the middle entry of the first row is subtracted.',
      ask: {
        prompt: 'Which sign goes with the middle term, $a_{12}M_{12}$?',
        answer: choiceAnswer(opts, 'o0'),
      },
    });
    steps.push({
      key: 'expand',
      instruction: 'Add the three signed terms.',
      math: `\\det A = ${paren(m[0][0])}(${m1}) - ${paren(m[0][1])}(${m2}) + ${paren(m[0][2])}(${m3}) = ${det}`,
      why: 'Cofactor expansion along the first row.',
      ask: { prompt: 'What is the determinant?', answer, verify },
    });
    return {
      params: params3(m),
      prompt: `Find the determinant by expanding along the first row: $$\\det ${bmatrix(m)}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('cofactor-signs', () => m[0][0] * m1 + m[0][1] * m2 + m[0][2] * m3),
      ]),
      verify,
    };
  }
}

function level5(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 3);
    const n = rng.int(2, 3);
    const d = rng.nonzero(-6, 6);
    let e = 0;
    let k = 0;
    if (form === 0) {
      k = rng.nonzero(-3, 3);
      if (Math.abs(k) === 1) continue;
    }
    if (form === 1) {
      e = rng.nonzero(-6, 6);
      if (d + e === d * e) continue;
    }
    const value = form === 0 ? k ** n * d : form === 1 ? d * e : form === 2 ? d : -d;
    const expr =
      form === 0 ? `(${k})^${n}*(${d})` : form === 1 ? `(${d})*(${e})` : form === 2 ? `(${d})` : `-(${d})`;
    const answer = numberAnswer(value);
    const nn = `${n}\\times${n}`;
    const prompts = [
      `$A$ is a $${nn}$ matrix with $\\det A = ${d}$. Find $\\det(${k}A)$.`,
      `$A$ and $B$ are $${nn}$ matrices with $\\det A = ${d}$ and $\\det B = ${e}$. Find $\\det(AB)$.`,
      `$A$ is a $${nn}$ matrix with $\\det A = ${d}$. Find $\\det(A^{T})$.`,
      `$A$ is a $${nn}$ matrix with $\\det A = ${d}$. $B$ is $A$ with two rows swapped. Find $\\det B$.`,
    ];
    const maths = [
      `\\det(${k}A) = (${k})^{${n}}\\det A = ${paren(k)}^{${n}}\\cdot${paren(d)} = ${value}`,
      `\\det(AB) = \\det A\\cdot\\det B = ${paren(d)}\\cdot${paren(e)} = ${value}`,
      `\\det(A^{T}) = \\det A = ${d}`,
      `\\det B = -\\det A = ${value}`,
    ];
    const instructions = [
      `Every one of the ${n} rows is multiplied by $${k}$, so the determinant is multiplied by $${k}$ ${n} times.`,
      'The determinant of a product is the product of the determinants.',
      'Transposing does not change the determinant.',
      'Swapping two rows flips the sign of the determinant.',
    ];
    const whys = [
      'For an $n \\times n$ matrix, $\\det(kA) = k^n \\det A$.',
      '$\\det(AB) = \\det A \\cdot \\det B$.',
      '$\\det(A^T) = \\det A$.',
      'A row swap changes the sign of the determinant.',
    ];
    const verify = { type: 'evaluate' as const, expr };
    const ruleLabels = [
      '$\\det(kA) = k^n \\det A$',
      '$\\det(AB) = \\det A \\cdot \\det B$',
      '$\\det(A^T) = \\det A$',
      'Swapping two rows flips the sign',
    ];
    const ruleOpts = rng.shuffle(ruleLabels.map((label, i) => ({ id: `o${i}`, label })));
    return {
      params: { form, n, d, e, k },
      prompt: prompts[form],
      answer,
      steps: [
        {
          key: 'rule',
          instruction: 'Pick the determinant rule that matches the question.',
          math: ['\\det(kA) = k^n \\det A', '\\det(AB) = \\det A \\cdot \\det B', '\\det(A^T) = \\det A', '\\det B = -\\det A'][form],
          why: 'Each operation on a matrix has a fixed effect on the determinant.',
          ask: {
            prompt: 'Which rule applies here?',
            answer: choiceAnswer(ruleOpts, ruleOpts.find((o) => o.label === ruleLabels[form])!.id),
          },
        },
        {
          key: 'property',
          instruction: instructions[form],
          math: maths[form],
          why: whys[form],
          ask: { prompt: 'What is the value?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        form === 0 ? wrongNumber('scalar-once', () => k * d) : null,
        form === 1 ? wrongNumber('product-as-sum', () => d + e) : null,
        form === 3 ? wrongNumber('swap-keeps-sign', () => d) : null,
      ]),
      verify,
    };
  }
}
