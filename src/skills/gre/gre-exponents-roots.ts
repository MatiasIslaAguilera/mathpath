// GRE · Exponents & roots. Formats: numeric entry (L1, L2, L4, L5), quantitative comparison
// (L3), select all that apply (L4). QC relations come from a proven case analysis
// (monomialRelation below), not sampling; the skill test re-checks them on a grid.

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'gre-exponents-roots';
type Body = ReturnType<SkillDefinition['generate']>;

const qpow = (x: Q, e: number): Q => {
  let r = Q.of(1);
  for (let i = 0; i < e; i++) r = r.mul(x);
  return r;
};
const relQ = (a: Q, b: Q): QcRelation => {
  const s = a.sub(b).sign();
  return s > 0 ? 'a' : s < 0 ? 'b' : 'c';
};

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

const decideStep = (relation: QcRelation, why: string, math = ''): Step => ({
  key: 'decide',
  instruction: relation === 'd' ? 'Different allowed values give different relationships.' : 'Every allowed value gives the same relationship.',
  math: math || (relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B' : relation === 'b' ? 'B > A' : 'A = B'),
  why,
  ask: { prompt: 'So which is it?', answer: qcAnswer(relation) },
});

// ---------- level 1: roots and powers ----------

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];

function level1(rng: Rng): Body {
  const form = rng.int(0, 2);
  const P = { form, k: 0, b: 0, c: 0, e: 0, x: 0, y: 0 };
  if (form === 0) {
    const b = rng.pick([2, 3, 5, 6, 7, 10, 11]);
    const k = rng.int(2, 9);
    const n = k * k * b;
    const answer = numberAnswer(k);
    const verify = { type: 'evaluate', expr: `sqrt(${n})/sqrt(${b})` } as const;
    return {
      params: { ...P, k, b },
      prompt: `If $\\sqrt{${n}} = k\\sqrt{${b}}$, where $k$ is a positive integer, what is $k$?`,
      answer,
      steps: [
        {
          key: 'perfect-square',
          instruction: `Find the largest perfect square that divides ${n}.`,
          math: `${n} = ${k * k} \\times ${b}`,
          why: 'Pull perfect squares out of a root: $\\sqrt{ab} = \\sqrt{a}\\sqrt{b}$.',
          ask: { prompt: `What is the largest perfect square dividing ${n}?`, answer: numberAnswer(k * k), verify: { type: 'evaluate', expr: `${k * k}` } },
        },
        {
          key: 'take-root',
          instruction: 'Take the square root of the perfect square.',
          math: `\\sqrt{${n}} = \\sqrt{${k * k}}\\sqrt{${b}} = ${k}\\sqrt{${b}}`,
          why: `$\\sqrt{${k * k}} = ${k}$`,
          ask: { prompt: 'So $k$ is?', answer, verify },
        },
      ],
      misconceptions: [],
      verify,
    };
  }
  if (form === 1) {
    const c = rng.int(2, 4);
    const e = rng.int(2, 5);
    const val = (-c) ** e;
    const answer = numberAnswer(val);
    const verify = { type: 'evaluate', expr: `(-${c})^${e}` } as const;
    return {
      params: { ...P, c, e },
      prompt: `What is the value of $(-${c})^{${e}}$?`,
      answer,
      steps: [
        {
          key: 'sign',
          instruction: `A negative number to an ${e % 2 === 0 ? 'even' : 'odd'} power is ${e % 2 === 0 ? 'positive' : 'negative'}.`,
          math: `(-${c})^{${e}} = ${e % 2 === 0 ? '+' : '-'}${c}^{${e}}`,
          why: 'Each pair of negative factors makes a positive.',
          ask: { prompt: 'Is the result positive or negative?', answer: { kind: 'choice', options: [{ id: 'pos', label: 'Positive' }, { id: 'neg', label: 'Negative' }], correct: e % 2 === 0 ? 'pos' : 'neg' } },
        },
        { key: 'evaluate-power', instruction: `Compute ${c}^${e} and apply the sign.`, math: `${c}^{${e}} = ${c ** e}`, why: 'Multiply the base by itself the given number of times.', ask: { prompt: 'Value?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('negative-power-sign', () => c ** e)]),
      verify,
    };
  }
  const [x, y, z] = rng.pick(TRIPLES);
  const kk = rng.chance(0.5) ? 1 : 2;
  const X = x * kk;
  const Y = y * kk;
  const Z = z * kk;
  const answer = numberAnswer(Z);
  const verify = { type: 'evaluate', expr: `sqrt(${X}^2+${Y}^2)` } as const;
  return {
    params: { ...P, x: X, y: Y },
    prompt: `What is the value of $\\sqrt{${X}^2 + ${Y}^2}$?`,
    answer,
    steps: [
      { key: 'square-first', instruction: 'Square each number and ADD before taking the root.', math: `${X}^2 + ${Y}^2 = ${X * X} + ${Y * Y} = ${X * X + Y * Y}`, why: '$\\sqrt{a^2 + b^2}$ is NOT $a + b$.', ask: { prompt: 'What is the sum under the root?', answer: numberAnswer(X * X + Y * Y), verify: { type: 'evaluate', expr: `${X}^2+${Y}^2` } } },
      { key: 'take-root', instruction: 'Take the square root.', math: `\\sqrt{${X * X + Y * Y}} = ${Z}`, why: `$${Z}^2 = ${Z * Z}$`, ask: { prompt: 'Value?', answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('sqrt-of-sum', () => X + Y)]),
    verify,
  };
}

// ---------- level 2: same-base equations ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  const r = rng.pick([2, 3, 5]);
  const tMax = r === 2 ? 7 : r === 3 ? 5 : 4;
  const P = { form, r, s: 0, t: 0, c: 0, m: 0 };
  if (form === 0) {
    const s = rng.int(2, 3);
    const t = rng.int(2, tMax);
    const B = r ** s;
    const R = r ** t;
    const x = Q.of(t).div(s);
    const answer = numberAnswer(x);
    const verify: VerifySpec = { type: 'solve', equations: [`${B}^x = ${R}`], unknowns: ['x'], positive: true };
    return {
      params: { ...P, s, t },
      prompt: `If $${B}^x = ${R}$, what is $x$?`,
      answer,
      steps: [
        {
          key: 'common-base',
          instruction: `Write both sides as powers of ${r}.`,
          math: `${B} = ${r}^{${s}}, \\quad ${R} = ${r}^{${t}} \\;\\Rightarrow\\; (${r}^{${s}})^x = ${r}^{${t}}`,
          why: 'Same base means the exponents must be equal.',
          ask: { prompt: `${R} is ${r} to what power?`, answer: numberAnswer(t), verify: { type: 'evaluate', expr: `${t}` } },
        },
        { key: 'equate-exponents', instruction: 'Multiply the exponents on the left and set them equal.', math: `${s}x = ${t} \\;\\Rightarrow\\; x = ${x.toLatex()}`, why: '$(a^m)^n = a^{mn}$', ask: { prompt: 'So $x$ is?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('same-base-skipped', () => t)]),
      verify,
    };
  }
  const R = (t: number) => r ** t;
  if (form === 1) {
    const c = rng.int(1, 4);
    const t = rng.int(c + 1, Math.min(c + 5, tMax + 2));
    const x = t - c;
    const answer = numberAnswer(x);
    const verify: VerifySpec = { type: 'solve', equations: [`${r}^(x+${c}) = ${R(t)}`], unknowns: ['x'], positive: true };
    return {
      params: { ...P, t, c },
      prompt: `If $${r}^{x+${c}} = ${R(t)}$, what is $x$?`,
      answer,
      steps: [
        { key: 'common-base', instruction: `Write ${R(t)} as a power of ${r}.`, math: `${R(t)} = ${r}^{${t}}`, why: 'Same base means the exponents must be equal.', ask: { prompt: `${R(t)} is ${r} to what power?`, answer: numberAnswer(t), verify: { type: 'evaluate', expr: `${t}` } } },
        { key: 'equate-exponents', instruction: 'Set the exponents equal and solve.', math: `x + ${c} = ${t} \\;\\Rightarrow\\; x = ${x}`, why: 'Subtract the constant from both sides.', ask: { prompt: 'So $x$ is?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('exponent-shift-ignored', () => t)]),
      verify,
    };
  }
  const m = rng.int(2, 3);
  const c = rng.int(1, 3);
  const t = rng.int(c + 1, c + 6);
  const x = Q.of(t - c).div(m);
  const answer = numberAnswer(x);
  const verify: VerifySpec = { type: 'solve', equations: [`${r}^(${m}*x+${c}) = ${R(t)}`], unknowns: ['x'], positive: true };
  return {
    params: { ...P, t, c, m },
    prompt: `If $${r}^{${m}x+${c}} = ${R(t)}$, what is $x$?`,
    answer,
    steps: [
      { key: 'common-base', instruction: `Write ${R(t)} as a power of ${r}.`, math: `${R(t)} = ${r}^{${t}}`, why: 'Same base means the exponents must be equal.', ask: { prompt: `${R(t)} is ${r} to what power?`, answer: numberAnswer(t), verify: { type: 'evaluate', expr: `${t}` } } },
      { key: 'equate-exponents', instruction: 'Set the exponents equal and solve the linear equation.', math: `${m}x + ${c} = ${t} \\;\\Rightarrow\\; x = ${x.toLatex()}`, why: 'Subtract the constant, then divide by the coefficient.', ask: { prompt: 'So $x$ is?', answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('exponent-shift-ignored', () => Q.of(t).div(m)), wrongNumber('exponent-coefficient-ignored', () => t - c)]),
    verify,
  };
}

// ---------- level 3: QC with powers and roots ----------

/** Exponents are stored doubled (p2 = 2p) so that 1/2 is the integer 1. */
// lo/hi are the sampling window for the harness: inside the stated domain (so no constraint strings are needed)
// and away from 0 and +-1 so tiny differences are not rounded to 'equal'.
interface Dom {
  text: string;
  neg: boolean;
  lo: number;
  hi: number;
  constraints: string[];
  test: Q;
}
const DOMS: Dom[] = [
  { text: '0 < x < 1', neg: false, lo: 0.1, hi: 0.95, constraints: [], test: Q.of(1).div(4) },
  { text: 'x > 1', neg: false, lo: 1.05, hi: 20, constraints: [], test: Q.of(4) },
  { text: 'x > 0', neg: false, lo: 0.1, hi: 20, constraints: [], test: Q.of(4) },
  { text: '-1 < x < 0', neg: true, lo: -0.95, hi: -0.1, constraints: [], test: Q.of(-1).div(2) },
  { text: 'x < -1', neg: true, lo: -20, hi: -1.05, constraints: [], test: Q.of(-2) },
  { text: 'x < 0', neg: true, lo: -20, hi: -0.1, constraints: [], test: Q.of(-2) },
];

/**
 * Proven case analysis for A = x^p vs B = x^q, p != q.
 * Positive x: on (0,1) the larger exponent gives the smaller value; on (1, inf) the larger
 * exponent gives the larger value; on (0, inf) x = 1 gives equality and x = 2 does not, so D.
 * Negative x = -y (integer exponents): x^p = (-1)^p y^p, so
 *   different parity: the even power is positive and the odd one negative;
 *   same parity: compare y^p and y^q as above (y in (0,1), (1, inf) or (0, inf)); for two odd
 *   powers the order flips because of the minus signs.
 */
function monomialRelation(dom: number, p2: number, q2: number): QcRelation {
  const posRel = (kind: number): QcRelation => (kind === 0 ? (p2 > q2 ? 'b' : 'a') : kind === 1 ? (p2 > q2 ? 'a' : 'b') : 'd');
  if (dom <= 2) return posRel(dom);
  const p = p2 / 2;
  const q = q2 / 2;
  if (p % 2 !== q % 2) return p % 2 === 0 ? 'a' : 'b';
  const y = posRel(dom - 3);
  if (y === 'd') return 'd';
  if (p % 2 === 0) return y;
  return y === 'a' ? 'b' : 'a';
}

const monoTex = (p2: number) => (p2 === 1 ? '\\sqrt{x}' : p2 === 2 ? 'x' : `x^{${p2 / 2}}`);
const monoExpr = (p2: number) => (p2 === 1 ? 'sqrt(x)' : p2 === 2 ? 'x' : `x^${p2 / 2}`);
const monoAt = (x: Q, p2: number): Q => (p2 === 1 ? Q.of(Math.sqrt(x.n)).div(Math.sqrt(x.d)) : qpow(x, p2 / 2));
const monoAtExpr = (x: Q, p2: number): string => (p2 === 1 ? `sqrt(${x.toString()})` : `${x.toExpr()}^${p2 / 2}`);

function level3(rng: Rng): Body {
  const form = rng.chance(0.75) ? 0 : 1;
  if (form === 1) {
    const BASES: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]];
    for (;;) {
      const [a1, b1] = rng.pick(BASES);
      const [a2, b2] = rng.pick(BASES);
      const m = rng.int(2, 4);
      const n = rng.int(2, 4);
      if (a1 === a2 && b1 === b2) continue;
      if (m === n) continue;
      const A = qpow(Q.of(a1).div(b1), m);
      const B = qpow(Q.of(a2).div(b2), n);
      const relation = relQ(A, B);
      const answer = qcAnswer(relation);
      const tex = (a: number, b: number, e: number) => `$\\left(\\frac{${a}}{${b}}\\right)^{${e}}$`;
      return {
        params: { form, dom: 0, p2: 2, q2: 2, a1, b1, m, a2, b2, n },
        prompt: QC_PROMPT('', tex(a1, b1, m), tex(a2, b2, n)),
        answer,
        steps: [
          { key: 'compute-a', instruction: 'Compute Quantity A exactly.', math: `\\left(\\frac{${a1}}{${b1}}\\right)^{${m}} = ${A.toLatex()}`, why: 'Raise the numerator and the denominator to the power.', ask: { prompt: 'Value of Quantity A?', answer: numberAnswer(A), verify: { type: 'evaluate', expr: `(${a1}/${b1})^${m}` } } },
          { key: 'compute-b', instruction: 'Compute Quantity B exactly.', math: `\\left(\\frac{${a2}}{${b2}}\\right)^{${n}} = ${B.toLatex()}`, why: 'Same method.', ask: { prompt: 'Value of Quantity B?', answer: numberAnswer(B), verify: { type: 'evaluate', expr: `(${a2}/${b2})^${n}` } } },
          decideStep(relation, 'With no variables the relationship is never D. Powers of a fraction between 0 and 1 SHRINK as the exponent grows.', `${A.toLatex()} \\text{ vs } ${B.toLatex()}`),
        ],
        misconceptions: distinctMisconceptions(answer, [{ id: 'fraction-powers-grow', wrong: qcAnswer(m > n ? 'a' : 'b') }]),
        verify: { type: 'qc', quantityA: `(${a1}/${b1})^${m}`, quantityB: `(${a2}/${b2})^${n}`, variables: [], constraints: [] },
      };
    }
  }
  const dom = rng.int(0, 5);
  const d = DOMS[dom];
  const pool = d.neg ? [2, 4, 6, 8] : [1, 2, 4, 6, 8];
  const p2 = rng.pick(pool);
  let q2 = rng.pick(pool);
  while (q2 === p2) q2 = rng.pick(pool);
  const relation = monomialRelation(dom, p2, q2);
  const answer = qcAnswer(relation);
  const A = monoAt(d.test, p2);
  const B = monoAt(d.test, q2);
  const setup = `$${d.text}$`;
  return {
    params: { form, dom, p2, q2, a1: 0, b1: 2, m: 2, a2: 0, b2: 2, n: 2 },
    prompt: QC_PROMPT(setup, `$${monoTex(p2)}$`, `$${monoTex(q2)}$`),
    answer,
    steps: [
      {
        key: 'test-value',
        instruction: `Plug in a number that fits: try x = ${d.test.toString()}.`,
        math: `A = ${A.toLatex()}, \\quad B = ${B.toLatex()}`,
        why: 'Fractions between 0 and 1 shrink when raised to bigger powers; negative numbers change sign with odd powers.',
        ask: { prompt: `What is Quantity A when $x = ${d.test.toLatex()}$?`, answer: numberAnswer(A), verify: { type: 'evaluate', expr: monoAtExpr(d.test, p2) } },
      },
      decideStep(relation, relation === 'd' ? 'Test a second value (like x = 1 or a different sign): A, B or C must hold for EVERY allowed x.' : 'Reason about the whole interval, not one value: the ordering of powers is the same everywhere in it.'),
    ],
    misconceptions: distinctMisconceptions(answer, [d.neg ? null : { id: 'fraction-powers-grow', wrong: qcAnswer(p2 > q2 ? 'a' : 'b') }]),
    verify: { type: 'qc', quantityA: monoExpr(p2), quantityB: monoExpr(q2), variables: [{ name: 'x', min: d.lo, max: d.hi }], constraints: d.constraints },
  };
}

// ---------- level 4: factoring common powers ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 2);
  const P = { form, r: 0, a: 0, b: 0 };
  if (form === 0) {
    const r = rng.int(2, 5);
    const b = rng.int(2, 8);
    const dif = rng.int(1, 4);
    const a = b + dif;
    const val = r ** dif + 1;
    const answer = numberAnswer(val);
    const verify = { type: 'evaluate', expr: `(${r}^${a} + ${r}^${b})/${r}^${b}` } as const;
    return {
      params: { ...P, r, a, b },
      prompt: `What is the value of $\\frac{${r}^{${a}} + ${r}^{${b}}}{${r}^{${b}}}$?`,
      answer,
      steps: [
        { key: 'factor-common', instruction: `Factor ${r}^${b} out of the top.`, math: `${r}^{${a}} + ${r}^{${b}} = ${r}^{${b}}(${r}^{${dif}} + 1)`, why: 'Never add exponents of a SUM; factor the smallest power out.', ask: { prompt: `What is $${r}^{${dif}} + 1$?`, answer, verify: { type: 'evaluate', expr: `${r}^${dif}+1` } } },
        { key: 'cancel', instruction: 'Cancel the common power.', math: `\\frac{${r}^{${b}}(${r}^{${dif}}+1)}{${r}^{${b}}} = ${val}`, why: 'Equal factors on top and bottom cancel.', ask: { prompt: 'Value?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('added-bases', () => r ** a)]),
      verify,
    };
  }
  if (form === 1) {
    const r = rng.int(2, 5);
    const a = rng.int(2, 7);
    const val = r * (r - 1);
    const answer = numberAnswer(val);
    const verify = { type: 'evaluate', expr: `(${r}^${a + 1} - ${r}^${a})/${r}^${a - 1}` } as const;
    return {
      params: { ...P, r, a },
      prompt: `What is the value of $\\frac{${r}^{${a + 1}} - ${r}^{${a}}}{${r}^{${a - 1}}}$?`,
      answer,
      steps: [
        { key: 'factor-common', instruction: `Factor ${r}^${a} out of the top.`, math: `${r}^{${a + 1}} - ${r}^{${a}} = ${r}^{${a}}(${r} - 1)`, why: 'Factor the smallest power.', ask: { prompt: `What is $${r} - 1$?`, answer: numberAnswer(r - 1), verify: { type: 'evaluate', expr: `${r}-1` } } },
        { key: 'cancel', instruction: `Divide: ${r}^${a} ÷ ${r}^${a - 1} = ${r}.`, math: `\\frac{${r}^{${a}}(${r}-1)}{${r}^{${a - 1}}} = ${r}(${r}-1) = ${val}`, why: '$\\frac{a^m}{a^n} = a^{m-n}$', ask: { prompt: 'Value?', answer, verify } },
      ],
      misconceptions: [],
      verify,
    };
  }
  // select all: r copies of r^a
  const r = rng.int(2, 4);
  const a = rng.int(2, 8);
  const R = BigInt(r);
  type Opt = { label: string; v: bigint; kind: string };
  const pw = (e: number) => R ** BigInt(e);
  const goodPool: Opt[] = [
    { label: `${r}^{${a + 1}}`, v: pw(a + 1), kind: 'g' },
    { label: `${r} \\cdot ${r}^{${a}}`, v: R * pw(a), kind: 'g' },
    { label: `\\frac{${r}^{${a + 2}}}{${r}}`, v: pw(a + 2) / R, kind: 'g' },
  ];
  if (r === 4) goodPool.push({ label: `2^{${2 * a + 2}}`, v: 2n ** BigInt(2 * a + 2), kind: 'g' });
  const doubled: Opt = { label: `${r}^{${2 * a}}`, v: pw(2 * a), kind: 'doubled' };
  const badPool: Opt[] = [
    { label: `(${r}^{${a}})^{${r}}`, v: pw(a * r), kind: 'b' },
    { label: `(${r}^{${a}})^{2}`, v: pw(2 * a), kind: 'b' },
    { label: `${r}^{${a + r}}`, v: pw(a + r), kind: 'b' },
  ];
  const nGood = rng.int(1, 3);
  const goods = rng.shuffle(goodPool).slice(0, nGood);
  const bads = [doubled, ...rng.shuffle(badPool).slice(0, 4 - nGood)];
  const chosen = rng.shuffle([...goods, ...bads]);
  const options: ChoiceOption[] = chosen.map((o, i) => ({ id: `o${i}`, label: `$${o.label}$` }));
  const target = pw(a + 1);
  if (chosen.some((o) => (o.v === target) !== (o.kind === 'g'))) throw new Error('gre-exponents-roots: option bookkeeping error');
  const correct = options.filter((_, i) => chosen[i].v === target).map((o) => o.id);
  const doubledId = options[chosen.indexOf(doubled)].id;
  const answer = multiAnswer(options, correct);
  const sum = Array.from({ length: r }, () => `${r}^{${a}}`).join(' + ');
  return {
    params: { ...P, r, a },
    prompt: `Which of the following are equal to $${sum}$? Select all that apply.`,
    answer,
    steps: [
      { key: 'factor-common', instruction: `The sum has ${r} equal terms, so it is ${r} times one term.`, math: `${sum} = ${r}\\cdot ${r}^{${a}} = ${r}^{${a + 1}}`, why: 'Adding equal powers multiplies by the count; it does NOT add exponents.', ask: { prompt: `What power of ${r} is this sum?`, answer: numberAnswer(a + 1), verify: { type: 'evaluate', expr: `${a}+1` } } },
      { key: 'test-each', instruction: 'Rewrite each option as a single power and compare exponents.', math: chosen.map((o) => o.label).join(',\\quad '), why: 'Select-all needs every correct option and no wrong one.', ask: { prompt: 'Select all equal expressions.', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'added-bases', wrong: multiAnswer(options, [...correct, doubledId]) }]),
    verify: { type: 'choice', note: 'tests/skills/gre-exponents-roots.test.ts evaluates every option with BigInt' },
  };
}

// ---------- level 5: units digits ----------

function cycleOf(r: number): number[] {
  const out: number[] = [];
  let d = r % 10;
  do {
    out.push(d);
    d = (d * r) % 10;
  } while (d !== out[0]);
  return out;
}
const unitsExpr = (r: number, n: number) => `mod(${r}^(mod(${n}-1,4)+1),10)`;

function level5(rng: Rng): Body {
  const form = rng.int(0, 1);
  const bases = [2, 3, 4, 7, 8, 9];
  const r = rng.pick(bases);
  const n = rng.int(20, 99);
  const s = rng.pick(bases);
  const m = rng.int(20, 99);
  const cr = cycleOf(r);
  const unit = (cyc: number[], e: number) => cyc[(e - 1) % cyc.length];
  if (form === 0) {
    const val = unit(cr, n);
    const answer = numberAnswer(val);
    const verify = { type: 'evaluate', expr: unitsExpr(r, n) } as const;
    return {
      params: { form, r, n, s: 0, m: 0 },
      prompt: `What is the units (ones) digit of $${r}^{${n}}$?`,
      answer,
      steps: [
        { key: 'cycle', instruction: `List the units digits of the powers of ${r}: ${cr.join(', ')}, then it repeats.`, math: `${r}^1,\\ ${r}^2,\\ \\dots \\to ${cr.join(',\\ ')},\\ \\dots`, why: 'Units digits of powers repeat in a short cycle.', ask: { prompt: 'How long is the cycle?', answer: numberAnswer(cr.length), verify: { type: 'evaluate', expr: `${cr.length}` } } },
        { key: 'position', instruction: `Find the position of exponent ${n} in the cycle: the remainder of ${n} ÷ ${cr.length}, where a remainder of 0 means the LAST digit.`, math: `${n} \\bmod ${cr.length} = ${n % cr.length} \\;\\Rightarrow\\; \\text{digit } ${val}`, why: 'The first power is position 1, not 0.', ask: { prompt: `Units digit of $${r}^{${n}}$?`, answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('units-cycle-off-by-one', () => cr[n % cr.length])]),
      verify,
    };
  }
  const cs = cycleOf(s);
  const d1 = unit(cr, n);
  const d2 = unit(cs, m);
  const val = (d1 + d2) % 10;
  const answer = numberAnswer(val);
  const verify = { type: 'evaluate', expr: `mod(${unitsExpr(r, n)}+${unitsExpr(s, m)},10)` } as const;
  return {
    params: { form, r, n, s, m },
    prompt: `What is the units (ones) digit of $${r}^{${n}} + ${s}^{${m}}$?`,
    answer,
    steps: [
      { key: 'cycle', instruction: `Find the units digit of each power using its cycle (${r}: ${cr.join(', ')}; ${s}: ${cs.join(', ')}).`, math: `${r}^{${n}} \\to ${d1}, \\quad ${s}^{${m}} \\to ${d2}`, why: 'Only the units digits matter for the units digit of a sum.', ask: { prompt: `Units digit of $${r}^{${n}}$?`, answer: numberAnswer(d1), verify: { type: 'evaluate', expr: unitsExpr(r, n) } } },
      { key: 'combine', instruction: 'Add the two digits and keep the units digit.', math: `${d1} + ${d2} = ${d1 + d2} \\to ${val}`, why: 'The units digit of a sum depends only on the units digits of the terms.', ask: { prompt: 'Units digit of the sum?', answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('units-cycle-off-by-one', () => (cr[n % cr.length] + cs[m % cs.length]) % 10)]),
    verify,
  };
}

export const greExponentsRoots: SkillDefinition = {
  id: ID,
  title: 'Exponents & roots',
  track: 'gre',
  unit: 'GRE · Arithmetic',
  description: 'Simplifying roots, same-base equations, powers of fractions and negatives, factoring common powers, and units digits.',
  prerequisites: ['gre-integers'],
  maxDenominator: 4,
  workingPad: [2],
  levels: {
    1: { description: 'Roots and powers', ranges: { form: [0, 2], k: [0, 9], b: [0, 11], c: [0, 4], e: [0, 5], x: [0, 48], y: [0, 48] } },
    2: { description: 'Same-base equations', ranges: { form: [0, 2], r: [2, 5], s: [0, 3], t: [0, 9], c: [0, 4], m: [0, 3] } },
    3: {
      description: 'QC with powers of fractions and negatives',
      ranges: { form: [0, 1], dom: [0, 5], p2: [1, 8], q2: [1, 8], a1: [0, 3], b1: [2, 5], m: [2, 4], a2: [0, 3], b2: [2, 5], n: [2, 4] },
    },
    4: { description: 'Factor out common powers', ranges: { form: [0, 2], r: [0, 5], a: [0, 12], b: [0, 8] } },
    5: { description: 'Units digit of a power', ranges: { form: [0, 1], r: [2, 9], n: [20, 99], s: [0, 9], m: [0, 99] } },
  },
  misconceptions: {
    'sqrt-of-sum': { name: 'Took the root of each term in a sum', explanation: '$\\sqrt{a + b} \\ne \\sqrt{a} + \\sqrt{b}$. Roots only split over multiplication: $\\sqrt{ab} = \\sqrt{a}\\sqrt{b}$. Add under the root first: $\\sqrt{9 + 16} = \\sqrt{25} = 5$, not $3 + 4$.' },
    'negative-power-sign': { name: 'Dropped the sign of a negative base', explanation: 'A negative base to an ODD power stays negative: $(-2)^3 = -8$. Only even powers make it positive.' },
    'same-base-skipped': { name: 'Equated the exponent without matching bases', explanation: 'You can only equate exponents once both sides have the SAME base. $9^x = 27$ becomes $3^{2x} = 3^3$, so $2x = 3$.' },
    'exponent-shift-ignored': { name: 'Forgot to undo the rest of the exponent', explanation: 'Set the WHOLE exponent equal: $2^{x+1} = 2^5$ gives $x + 1 = 5$, so $x = 4$, not 5. Divide by any coefficient too.' },
    'exponent-coefficient-ignored': { name: 'Forgot to divide by the coefficient of x', explanation: 'From $2x + 1 = 5$ you get $2x = 4$, then divide: $x = 2$.' },
    'fraction-powers-grow': { name: 'Thought a bigger power always gives a bigger number', explanation: 'For $0 < x < 1$, raising to a higher power makes the number SMALLER ($x^2 < x$) and a root makes it larger ($\\sqrt{x} > x$). For $x > 1$ it is the reverse. Test a value from each region.' },
    'added-bases': { name: 'Added exponents when adding powers', explanation: 'Exponents add only when you MULTIPLY powers. $2^{20} + 2^{18}$ is not $2^{38}$, and $2^a + 2^a = 2 \\cdot 2^a = 2^{a+1}$, not $2^{2a}$. Factor out the smaller power instead.' },
    'units-cycle-off-by-one': { name: 'Miscounted the position in the units-digit cycle', explanation: 'The first power is position 1. If the exponent leaves remainder 0 when divided by the cycle length, you are at the LAST digit of the cycle, not the first.' },
  },
  stepLabels: {
    'perfect-square': 'Find the largest perfect square factor',
    'take-root': 'Take the square root',
    sign: 'Decide the sign',
    'evaluate-power': 'Compute the power',
    'square-first': 'Square and add before the root',
    'common-base': 'Write both sides with the same base',
    'equate-exponents': 'Set the exponents equal',
    'test-value': 'Plug in a test value',
    'compute-a': 'Compute Quantity A',
    'compute-b': 'Compute Quantity B',
    decide: 'Decide the relationship',
    'factor-common': 'Factor out the common power',
    cancel: 'Cancel the common power',
    'test-each': 'Test each option',
    cycle: 'Find the units-digit cycle',
    position: 'Find the position in the cycle',
    combine: 'Combine the units digits',
  },
  learn: {
    whyItMatters:
      'Exponent and root manipulations show up in algebra, in quantitative comparisons, and in "which of the following equals..." questions, often with a trap such as treating a sum of powers like a product. They matter beyond the test: compound growth is an exponent. At 7% a year, money doubles in about 10 years, because 1.07^10 ≈ 1.97, and comparing growth rates means comparing powers of numbers slightly above 1.',
    summary:
      'Take perfect squares out of roots. To solve an exponential equation, rewrite both sides with the same base and equate exponents. For $0 < x < 1$, higher powers shrink and roots grow; for $x > 1$ the reverse; negative bases flip sign with odd powers. Factor the smallest power out of a sum. Units digits of powers repeat in cycles of length 1, 2 or 4.',
    formulas: [
      { latex: 'a^m a^n = a^{m+n}, \\quad \\frac{a^m}{a^n} = a^{m-n}, \\quad (a^m)^n = a^{mn}' },
      { latex: '\\sqrt{ab} = \\sqrt{a}\\sqrt{b}, \\quad \\sqrt{a + b} \\ne \\sqrt{a} + \\sqrt{b}' },
      { latex: 'a^m + a^n = a^n(a^{m-n} + 1)', note: 'Factor, never "add the exponents".' },
    ],
    example: { seed: 3, level: 2 },
    tips: ['In a QC with powers, test a value in (0,1), 1, a value above 1, and negatives if allowed.', 'The units digits of 2, 3, 7, 8 cycle with length 4; 4 and 9 with length 2.'],
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
