// GRE · Inequalities & absolute value. Formats: multiple choice (L1), numeric entry (L2, L3),
// quantitative comparison (L4), select all that apply (L5). QC relations at L4 come from a table
// of PROVEN cases (the proof sits beside each entry); the skill test re-checks them on a grid.

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, VerifySpec } from '../../engine/types';

const ID = 'gre-inequalities-absolute-value';
type Body = ReturnType<SkillDefinition['generate']>;

const flip = (r: QcRelation): QcRelation => (r === 'a' ? 'b' : r === 'b' ? 'a' : r);
const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

// ---------- level 1: solve a linear inequality (multiple choice) ----------

const OPS = ['<', '>', '\\le', '\\ge'] as const;
const opText = (o: number) => ['<', '>', '≤', '≥'][o];
const opFlip = (o: number) => [1, 0, 3, 2][o]; // < <-> >, ≤ <-> ≥
const opStrictToggle = (o: number) => [2, 3, 0, 1][o];

function level1(rng: Rng): Body {
  const a = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
  const b = rng.int(-9, 9);
  const t = rng.int(-6, 8);
  const c = a * t + b;
  const op = rng.int(0, 3);
  const solOp = a < 0 ? opFlip(op) : op;
  const lhs = linLatex(a, b);
  const opt = (o: number, v: Q) => `$x ${OPS[o]} ${v.toLatex()}$`;
  const T = Q.of(t);
  const cands: { key: string; o: number; v: Q }[] = [
    { key: 'ok', o: solOp, v: T },
    { key: 'noflip', o: opFlip(solOp), v: T }, // the unflipped direction when a < 0
    { key: 'sign', o: solOp, v: Q.of(c + b).div(a) }, // added b instead of subtracting
    { key: 'nodiv', o: solOp, v: Q.of(c - b) }, // forgot to divide by a
    { key: 'strict', o: opStrictToggle(solOp), v: T }, // wrong endpoint
    { key: 'neg', o: opFlip(solOp), v: T.neg() },
  ];
  const seen = new Set<string>();
  const list = cands.filter((x) => {
    const k = `${x.o}|${x.v.toString()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (list.length < 5 || list[0].key !== 'ok') return level1(rng);
  // prefer the named mistakes; keep the correct one plus four others
  const chosen = [list[0], ...list.slice(1, 5)];
  const order = rng.shuffle(chosen);
  const options: ChoiceOption[] = order.map((x, i) => ({ id: `o${i}`, label: opt(x.o, x.v) }));
  const idOf = (key: string) => {
    const j = order.findIndex((x) => x.key === key);
    return j < 0 ? null : options[j].id;
  };
  const answer = { kind: 'choice' as const, options, correct: idOf('ok')! };
  const notFlipId = a < 0 ? idOf('noflip') : null;
  const verify: VerifySpec = { type: 'choice', note: 'tests/skills/gre-inequalities-absolute-value.test.ts checks each option against the inequality on a grid' };
  const rhsMinusB = c - b;
  return {
    params: { form: 0, a, b, c, t, op, h: 0, k: 0, fam: 0, sgn: 0, nm: 0, set: 0 },
    prompt: `Which of the following is the solution set of $${lhs} ${OPS[op]} ${c}$?`,
    answer,
    steps: [
      {
        key: 'isolate',
        instruction: `Subtract ${b} from both sides (adding or subtracting never changes the direction).`,
        math: `${a === 1 ? '' : a === -1 ? '-' : a}x ${OPS[op]} ${rhsMinusB}`,
        why: 'The goal is to get x alone using inverse operations.',
        ask: { prompt: `What is $${c} - (${b})$?`, answer: numberAnswer(rhsMinusB), verify: { type: 'evaluate', expr: `${c}-(${b})` } },
      },
      {
        key: 'divide',
        instruction: a < 0 ? `Divide by ${a}. Dividing by a NEGATIVE reverses the inequality sign.` : `Divide by ${a}; the sign stays the same.`,
        math: `x ${OPS[solOp]} ${t}`,
        why: 'Multiplying or dividing by a negative number flips the inequality: $-2 < 3$ but $2 > -3$.',
        ask: { prompt: 'The boundary value of $x$?', answer: numberAnswer(t), verify: { type: 'evaluate', expr: `(${c}-(${b}))/(${a})` } },
      },
      { key: 'pick', instruction: `Match "x ${opText(solOp)} ${t}" to an option.`, math: `x ${OPS[solOp]} ${t}`, why: 'Check: plug a number from the solution set back into the original.', ask: { prompt: 'Which option?', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [notFlipId ? { id: 'inequality-not-flipped', wrong: { kind: 'choice', options, correct: notFlipId } } : null]),
    verify,
  };
}

// ---------- level 2: |x - h| = b ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  const P = { form: 0, a: 0, b: 0, c: 0, t: 0, op: 0, h: 0, k: 0, fam: 0, sgn: 0, nm: 0, set: 0 };
  if (form === 2) {
    // |a x + c| = d with solutions h +/- k, a x + c = a(x - h)
    const a = rng.int(2, 4);
    const h = rng.nonzero(-6, 8);
    const k = rng.int(1, 6);
    const c = -a * h;
    const d = a * k;
    const ax = `${a}x`;
    const answer = numberAnswer(2 * h);
    const verify: VerifySpec = { type: 'evaluate', expr: `(${d}-(${c}))/${a} + (-${d}-(${c}))/${a}` };
    return {
      params: { ...P, form, a, c, h, k, b: d },
      prompt: `What is the sum of the solutions of $|${linLatex(Q.of(a), Q.of(c))}| = ${d}$?`,
      answer,
      steps: [
        {
          key: 'two-cases',
          instruction: `An absolute value equal to ${d} means the inside is ${d} OR −${d}.`,
          math: `${ax} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${d} \\quad\\text{or}\\quad ${ax} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = -${d}`,
          why: '$|u| = d$ with $d > 0$ has TWO solutions: $u = d$ and $u = -d$.',
          ask: { prompt: `Solve the first case: $${ax} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${d}$. What is $x$?`, answer: numberAnswer(h + k), verify: { type: 'evaluate', expr: `(${d}-(${c}))/${a}` } },
        },
        { key: 'sum', instruction: 'Solve the second case and add the solutions.', math: `${h + k} + ${h - k} = ${2 * h}`, why: 'The solutions are symmetric about the center, so their sum is twice the center.', ask: { prompt: 'Sum of the solutions?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('abs-one-solution', () => h + k)]),
      verify,
    };
  }
  const h = rng.int(-9, 9);
  const b = rng.int(1, 12);
  const inner = `x ${h < 0 ? '+' : '-'} ${Math.abs(h)}`;
  const hasShift = h !== 0;
  const innerTex = hasShift ? inner : 'x';
  const product = form === 1;
  const val = product ? h * h - b * b : 2 * h;
  const answer = numberAnswer(val);
  const verify: VerifySpec = { type: 'evaluate', expr: product ? `(${h}+${b})*(${h}-${b})` : `(${h}+${b})+(${h}-${b})` };
  return {
    params: { ...P, form, h, b },
    prompt: `What is the ${product ? 'product' : 'sum'} of the solutions of $|${innerTex}| = ${b}$?`,
    answer,
    steps: [
      {
        key: 'two-cases',
        instruction: `Split into two cases: ${innerTex} = ${b} or ${innerTex} = −${b}.`,
        math: `x = ${h} + ${b} = ${h + b} \\quad\\text{or}\\quad x = ${h} - ${b} = ${h - b}`,
        why: '$|u| = b$ with $b > 0$ has TWO solutions: $u = b$ and $u = -b$.',
        ask: { prompt: 'What is the larger solution?', answer: numberAnswer(h + b), verify: { type: 'evaluate', expr: `${h}+${b}` } },
      },
      { key: product ? 'product' : 'sum', instruction: product ? 'Multiply the two solutions.' : 'Add the two solutions.', math: product ? `(${h + b})(${h - b}) = ${val}` : `${h + b} + (${h - b}) = ${val}`, why: product ? 'Difference of squares: $(h+b)(h-b) = h^2 - b^2$.' : 'The solutions are symmetric about the center $h$, so they sum to $2h$.', ask: { prompt: product ? 'Product of the solutions?' : 'Sum of the solutions?', answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('abs-one-solution', () => h + b)]),
    verify,
  };
}

// ---------- level 3: count integer solutions of |x - h| < b ----------

function level3(rng: Rng): Body {
  const h = rng.int(-9, 9);
  const b2 = rng.chance(0.65) ? 2 * rng.int(1, 12) : 2 * rng.int(1, 11) + 1; // b = b2/2, a whole number most of the time
  const strict = rng.chance(0.5);
  const B = Q.of(b2).div(2);
  const count = (isStrict: boolean) => {
    let n = 0;
    for (let x = h - 15; x <= h + 15; x++) {
      const d = Q.of(Math.abs(x - h)).sub(B).sign(); // |x-h| - b
      if (isStrict ? d < 0 : d <= 0) n++;
    }
    return n;
  };
  const got = count(strict);
  const answer = numberAnswer(got);
  const bTxt = B.isInt() ? `${B.n}` : `${b2 / 2}`;
  const inner = h === 0 ? 'x' : `x ${h < 0 ? '+' : '-'} ${Math.abs(h)}`;
  const verify: VerifySpec = { type: 'evaluate', expr: strict ? `-2*floor(-${bTxt})-1` : `2*floor(${bTxt})+1` };
  const lo = Q.of(h).sub(B);
  const hi = Q.of(h).add(B);
  return {
    params: { form: 0, a: 0, b: b2, c: 0, t: 0, op: strict ? 0 : 2, h, k: 0, fam: 0, sgn: 0, nm: 0, set: 0 },
    prompt: `How many integers $x$ satisfy $|${inner}| ${strict ? '<' : '\\le'} ${bTxt}$?`,
    answer,
    steps: [
      {
        key: 'compound',
        instruction: 'Rewrite the absolute value as a compound inequality: the inside is between −b and b.',
        math: `${lo.toLatex()} ${strict ? '<' : '\\le'} x ${strict ? '<' : '\\le'} ${hi.toLatex()}`,
        why: '$|u| < b$ means $-b < u < b$. With "≤" the endpoints are included.',
        ask: { prompt: 'What is the left endpoint, $h - b$?', answer: numberAnswer(lo), verify: { type: 'evaluate', expr: `${h}-${bTxt}` } },
      },
      {
        key: 'count',
        instruction: `Count the integers from the smallest to the largest allowed. ${B.isInt() ? (strict ? 'The endpoints are NOT included.' : 'The endpoints ARE included.') : 'The endpoints are not integers, so the question of inclusion does not arise.'}`,
        math: `\\text{count} = ${got}`,
        why: 'Count = largest − smallest + 1 over the integers that qualify.',
        ask: { prompt: 'How many integers?', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('endpoint-inclusion', () => count(!strict))]),
    verify,
  };
}

// ---------- level 4: QC with inequality constraints ----------

interface Fam {
  /** setup constraint, LaTeX in names u, v */
  cond: (u: string, v: string) => string;
  /** mathjs constraints */
  cons: (u: string, v: string) => string[];
  /** quantities */
  A: (u: string, v: string) => { tex: string; expr: string };
  B: (u: string, v: string) => { tex: string; expr: string };
  /** proven relation for the unscaled quantities */
  rel: QcRelation;
  proof: string;
  /** a sampling window for u and v */
  win: [[number, number], [number, number]];
  /** a point meeting the constraint and the JS value of each quantity there */
  pt: [number, number];
  fa: (u: number, v: number) => number;
  fb: (u: number, v: number) => number;
  /** B is a constant (so a coefficient is applied by multiplying it) */
  oneVar?: boolean;
}
const FAMS: Fam[] = [
  { cond: (u, v) => `${u} < ${v} < 0`, cons: (u, v) => [`${u} < ${v}`, `${v} < 0`], A: (u, v) => ({ tex: `${u}${v}`, expr: `${u}*${v}` }), B: (_u, v) => ({ tex: `${v}^2`, expr: `${v}^2` }), rel: 'a', proof: 'uv - v^2 = v(u - v) > 0 because v < 0 and u - v < 0', win: [[-20, -0.1], [-20, -0.1]], pt: [-3, -2], fa: (u, v) => u * v, fb: (_u, v) => v * v },
  { cond: (u, v) => `0 < ${u} < ${v}`, cons: (u, v) => [`${u} > 0`, `${u} < ${v}`], A: (u, v) => ({ tex: `${u}${v}`, expr: `${u}*${v}` }), B: (u) => ({ tex: `${u}^2`, expr: `${u}^2` }), rel: 'a', proof: 'uv - u^2 = u(v - u) > 0 because u > 0 and v - u > 0', win: [[0.1, 20], [0.1, 20]], pt: [2, 3], fa: (u, v) => u * v, fb: (u) => u * u },
  { cond: (u, v) => `0 < ${u} < ${v}`, cons: (u, v) => [`${u} > 0`, `${u} < ${v}`], A: (u) => ({ tex: `\\frac{1}{${u}}`, expr: `1/${u}` }), B: (_u, v) => ({ tex: `\\frac{1}{${v}}`, expr: `1/${v}` }), rel: 'a', proof: '1/u - 1/v = (v - u)/(uv) > 0', win: [[0.1, 20], [0.1, 20]], pt: [2, 4], fa: (u) => 1 / u, fb: (_u, v) => 1 / v },
  { cond: (u, v) => `${u} < ${v} < 0`, cons: (u, v) => [`${u} < ${v}`, `${v} < 0`], A: (u) => ({ tex: `\\frac{1}{${u}}`, expr: `1/${u}` }), B: (_u, v) => ({ tex: `\\frac{1}{${v}}`, expr: `1/${v}` }), rel: 'a', proof: '1/u - 1/v = (v - u)/(uv) > 0 because v - u > 0 and uv > 0', win: [[-20, -0.1], [-20, -0.1]], pt: [-4, -2], fa: (u) => 1 / u, fb: (_u, v) => 1 / v },
  { cond: (u, v) => `${u} < 0 < ${v}`, cons: (u, v) => [`${u} < 0`, `${v} > 0`], A: (u) => ({ tex: `\\frac{1}{${u}}`, expr: `1/${u}` }), B: (_u, v) => ({ tex: `\\frac{1}{${v}}`, expr: `1/${v}` }), rel: 'b', proof: '1/u < 0 < 1/v', win: [[-20, -0.1], [0.1, 20]], pt: [-2, 4], fa: (u) => 1 / u, fb: (_u, v) => 1 / v },
  { cond: (u, v) => `${u} < ${v}`, cons: (u, v) => [`${u} < ${v}`], A: (u) => ({ tex: `${u}^2`, expr: `${u}^2` }), B: (_u, v) => ({ tex: `${v}^2`, expr: `${v}^2` }), rel: 'd', proof: 'u = -2, v = 1 gives 4 > 1 but u = 1, v = 2 gives 1 < 4', win: [[-20, 20], [-20, 20]], pt: [1, 2], fa: (u) => u * u, fb: (_u, v) => v * v },
  { cond: (u, v) => `${u} < ${v}`, cons: (u, v) => [`${u} < ${v}`], A: (u) => ({ tex: `${u}^3`, expr: `${u}^3` }), B: (_u, v) => ({ tex: `${v}^3`, expr: `${v}^3` }), rel: 'b', proof: 'x -> x^3 is increasing, so u < v gives u^3 < v^3', win: [[-10, 10], [-10, 10]], pt: [-1, 2], fa: (u) => u ** 3, fb: (_u, v) => v ** 3 },
  { cond: (u) => `0 < ${u} < 1`, cons: (u) => [`${u} > 0`, `${u} < 1`], A: (u) => ({ tex: `${u}^2`, expr: `${u}^2` }), B: (u) => ({ tex: `${u}^3`, expr: `${u}^3` }), rel: 'a', proof: 'u^2 - u^3 = u^2(1 - u) > 0', win: [[0.1, 0.95], [0.1, 0.95]], pt: [0.5, 0.5], fa: (u) => u * u, fb: (u) => u ** 3, oneVar: true },
  { cond: (u) => `${u} > 1`, cons: (u) => [`${u} > 1`], A: (u) => ({ tex: `${u}^2`, expr: `${u}^2` }), B: (u) => ({ tex: `${u}`, expr: `${u}` }), rel: 'a', proof: 'u^2 - u = u(u - 1) > 0', win: [[1.05, 20], [1.05, 20]], pt: [3, 3], fa: (u) => u * u, fb: (u) => u, oneVar: true },
  { cond: (u, v) => `${u} < ${v} < 0`, cons: (u, v) => [`${u} < ${v}`, `${v} < 0`], A: (u) => ({ tex: `${u}^2`, expr: `${u}^2` }), B: (_u, v) => ({ tex: `${v}^2`, expr: `${v}^2` }), rel: 'a', proof: 'u < v < 0 means |u| > |v|, so u^2 > v^2', win: [[-20, -0.1], [-20, -0.1]], pt: [-3, -2], fa: (u) => u * u, fb: (_u, v) => v * v },
  { cond: (u, v) => `0 < ${u} < ${v}`, cons: (u, v) => [`${u} > 0`, `${u} < ${v}`], A: (u, v) => ({ tex: `\\frac{${u}}{${v}}`, expr: `${u}/${v}` }), B: () => ({ tex: '1', expr: '1' }), rel: 'b', proof: 'u/v < 1 because 0 < u < v', win: [[0.1, 20], [0.1, 20]], pt: [2, 5], fa: (u, v) => u / v, fb: () => 1 },
  { cond: (u, v) => `${u} < ${v} < 0`, cons: (u, v) => [`${u} < ${v}`, `${v} < 0`], A: (u, v) => ({ tex: `\\frac{${u}}{${v}}`, expr: `${u}/${v}` }), B: () => ({ tex: '1', expr: '1' }), rel: 'a', proof: 'u < v < 0 means |u| > |v|, so u/v = |u|/|v| > 1', win: [[-20, -0.1], [-20, -0.1]], pt: [-6, -2], fa: (u, v) => u / v, fb: () => 1 },
  { cond: (u, v) => `${u} < ${v}`, cons: (u, v) => [`${u} < ${v}`], A: (u, v) => ({ tex: `${u} - ${v}`, expr: `${u}-${v}` }), B: () => ({ tex: '0', expr: '0' }), rel: 'b', proof: 'u - v < 0', win: [[-20, 20], [-20, 20]], pt: [1, 4], fa: (u, v) => u - v, fb: () => 0 },
];
/**
 * How the harness samples each family. Ordering constraints (u < v) are slow to filter by rejection, so the
 * sampler gets an equivalent parametrisation instead: an anchor variable plus a positive gap d, with the other
 * variable written as anchor +/- d. 'neg': u < v < 0 (anchor v, u = v - d); 'pos': 0 < u < v (anchor u, v = u + d);
 * 'any': u < v (anchor u, v = u + d); 'split': u < 0 < v; 'one': a single variable.
 */
const KINDS = ['neg', 'pos', 'pos', 'neg', 'split', 'any', 'any', 'one', 'one', 'neg', 'pos', 'neg', 'any'] as const;
const NAMES: [string, string][] = [['x', 'y'], ['a', 'b'], ['m', 'n'], ['p', 'q'], ['r', 's'], ['j', 'k']];

function level4(rng: Rng): Body {
  const fam = rng.int(0, FAMS.length - 1);
  const nm = rng.int(0, 5);
  const sgn = rng.pick([1, 1, 1, -1]);
  const [u, v] = NAMES[nm];
  const F = FAMS[fam];
  const relation: QcRelation = sgn === 1 ? F.rel : flip(F.rel);
  const qa = F.A(u, v);
  const qb = F.B(u, v);
  const neg = (t: string) => (t === '0' ? '0' : `-${t.includes(' ') ? `(${t})` : t}`);
  const texA = sgn === 1 ? qa.tex : neg(qa.tex);
  const texB = sgn === 1 ? qb.tex : neg(qb.tex);
  const exprA = sgn === 1 ? qa.expr : `-(${qa.expr})`;
  const exprB = sgn === 1 ? qb.expr : `-(${qb.expr})`;
  const answer = qcAnswer(relation);
  const [pu, pv] = F.pt;
  const diff = sgn * (F.fa(pu, pv) - F.fb(pu, pv));
  const diffQ = Q.of(Math.round(diff * 1e6)).div(1e6);
  const [wu, wv] = F.win;
  const kind = KINDS[fam];
  let sampA = exprA;
  let sampB = exprB;
  let vars: { name: string; min: number; max: number }[];
  if (kind === 'one') vars = [{ name: u, min: wu[0], max: wu[1] }];
  else if (kind === 'split') vars = [{ name: u, min: wu[0], max: wu[1] }, { name: v, min: wv[0], max: wv[1] }];
  else {
    const anchorIsV = kind === 'neg';
    const A2 = anchorIsV ? F.A(`(${v}-d)`, v) : F.A(u, `(${u}+d)`);
    const B2 = anchorIsV ? F.B(`(${v}-d)`, v) : F.B(u, `(${u}+d)`);
    sampA = sgn === 1 ? A2.expr : `-(${A2.expr})`;
    sampB = sgn === 1 ? B2.expr : `-(${B2.expr})`;
    vars = anchorIsV
      ? [{ name: v, min: wv[0], max: wv[1] }, { name: 'd', min: 0.1, max: 20 }]
      : [{ name: u, min: wu[0], max: wu[1] }, { name: 'd', min: 0.1, max: 20 }];
  }
  const testStr = F.oneVar ? `${u} = ${pu}` : `${u} = ${pu},\\ ${v} = ${pv}`;
  const testPlain = F.oneVar ? `${u} = ${pu}` : `${u} = ${pu} and ${v} = ${pv}`;
  return {
    params: { form: 0, a: 0, b: 0, c: 0, t: 0, op: 0, h: 0, k: 0, fam, sgn, nm, set: 0 },
    prompt: QC_PROMPT(`$${F.cond(u, v)}$`, `$${texA}$`, `$${texB}$`),
    answer,
    steps: [
      {
        key: 'test-values',
        instruction: `Plug in numbers that obey the condition: ${testPlain}.`,
        math: `A - B = ${diffQ.toLatex()}`,
        why: 'Pick numbers that satisfy EVERY constraint, then check whether the answer could change with other allowed numbers.',
        ask: { prompt: `What is Quantity A minus Quantity B when $${testStr}$?`, answer: numberAnswer(diffQ), verify: { type: 'evaluate', expr: `(${sgn}*(${exprNum(F, pu, pv, 'A')}))-(${sgn}*(${exprNum(F, pu, pv, 'B')}))` } },
      },
      {
        key: 'decide',
        instruction: relation === 'd' ? 'Try a second allowed pair that behaves differently.' : 'Prove it for every allowed value, not just the test values.',
        math: relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B' : relation === 'b' ? 'B > A' : 'A = B',
        why: relation === 'd' ? `Two allowed cases that disagree prove D (${F.proof}).` : `Proof: ${F.proof}${sgn === -1 ? ', and the minus signs reverse it' : ''}. A, B or C must hold for every allowed value.`,
        ask: { prompt: 'So which is it?', answer },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [relation === 'd' ? { id: 'tested-one-case', wrong: qcAnswer(diff > 0 ? 'a' : diff < 0 ? 'b' : 'c') } : null]),
    verify: { type: 'qc', quantityA: sampA, quantityB: sampB, variables: vars, constraints: [] },
  };
}

/** Quantity expression with numbers substituted, for a step verify. */
function exprNum(F: Fam, pu: number, pv: number, which: 'A' | 'B'): string {
  const q = which === 'A' ? F.A('u', 'v') : F.B('u', 'v');
  return q.expr.replace(/\bu\b/g, `(${pu})`).replace(/\bv\b/g, `(${pv})`);
}

// ---------- level 5: "which must be true?" (select all) ----------

interface Stmt {
  tex: string; // uses P and Q as the variable names
  f: (p: number, q: number) => boolean;
  must: boolean;
}
interface CSet {
  text: string; // uses P and Q
  ok: (p: number, q: number) => boolean;
  ex: [number, number];
  stmts: Stmt[];
}
const S = (tex: string, f: (p: number, q: number) => boolean, must: boolean): Stmt => ({ tex, f, must });
const CSETS: CSet[] = [
  {
    text: 'P > Q > 0',
    ok: (p, q) => p > q && q > 0,
    ex: [3, 2],
    stmts: [
      S('P^2 > Q^2', (p, q) => p * p > q * q, true),
      S('\\frac{1}{P} < \\frac{1}{Q}', (p, q) => 1 / p < 1 / q, true),
      S('P - Q > 0', (p, q) => p - q > 0, true),
      S('-P > -Q', (p, q) => -p > -q, false),
      S('\\frac{P}{Q} > 1', (p, q) => p / q > 1, true),
      S('PQ > Q^2', (p, q) => p * q > q * q, true),
      S('P > 2Q', (p, q) => p > 2 * q, false),
      S('Q - P > 0', (p, q) => q - p > 0, false),
      S('P^2 > 2Q', (p, q) => p * p > 2 * q, false),
    ],
  },
  {
    text: 'P < Q < 0',
    ok: (p, q) => p < q && q < 0,
    ex: [-3, -2],
    stmts: [
      S('P^2 > Q^2', (p, q) => p * p > q * q, true),
      S('\\frac{1}{P} > \\frac{1}{Q}', (p, q) => 1 / p > 1 / q, true),
      S('PQ > 0', (p, q) => p * q > 0, true),
      S('P + Q > 0', (p, q) => p + q > 0, false),
      S('\\frac{P}{Q} > 1', (p, q) => p / q > 1, true),
      S('-P < -Q', (p, q) => -p < -q, false),
      S('P^2 < Q^2', (p, q) => p * p < q * q, false),
      S('P^3 < Q^3', (p, q) => p ** 3 < q ** 3, true),
      S('P < 2Q', (p, q) => p < 2 * q, false),
    ],
  },
  {
    text: 'P > Q',
    ok: (p, q) => p > q,
    ex: [1, -2],
    stmts: [
      S('P^3 > Q^3', (p, q) => p ** 3 > q ** 3, true),
      S('P - Q > 0', (p, q) => p - q > 0, true),
      S('-P < -Q', (p, q) => -p < -q, true),
      S('P^2 > Q^2', (p, q) => p * p > q * q, false),
      S('P + 1 > Q', (p, q) => p + 1 > q, true),
      S('P > Q + 1', (p, q) => p > q + 1, false),
      S('PQ > 0', (p, q) => p * q > 0, false),
      S('P^2 + Q^2 > 0', (p, q) => p * p + q * q > 0, true),
      S('2P > 2Q', (p, q) => 2 * p > 2 * q, true),
    ],
  },
  {
    text: 'P > Q \\text{ and } PQ > 0',
    ok: (p, q) => p > q && p * q > 0,
    ex: [-1, -2],
    stmts: [
      S('\\frac{1}{P} < \\frac{1}{Q}', (p, q) => 1 / p < 1 / q, true),
      S('P^2 > Q^2', (p, q) => p * p > q * q, false),
      S('P - Q > 0', (p, q) => p - q > 0, true),
      S('P + Q > 0', (p, q) => p + q > 0, false),
      S('\\frac{P}{Q} > 0', (p, q) => p / q > 0, true),
      S('P^3 > Q^3', (p, q) => p ** 3 > q ** 3, true),
      S('|P| > |Q|', (p, q) => Math.abs(p) > Math.abs(q), false),
    ],
  },
];
const GRID = [-8, -4, -3, -2, -1.5, -1, -0.5, -0.25, 0.25, 0.5, 1, 1.5, 2, 3, 4, 8];
const gridPairs = GRID.flatMap((p) => GRID.map((q): [number, number] => [p, q]));

function level5(rng: Rng): Body {
  const set = rng.int(0, CSETS.length - 1);
  const nm = rng.int(0, 5);
  const phrasing = rng.int(0, 1);
  const C = CSETS[set];
  const [n1, n2] = NAMES[nm];
  const sub = (t: string) => t.replace(/P/g, n1).replace(/Q/g, n2);
  const pts = gridPairs.filter(([p, q]) => C.ok(p, q));
  // The table's claims are re-checked on a grid: a "must" statement has no counterexample, any other has one.
  for (const s of C.stmts) {
    const hasCounter = pts.some(([p, q]) => !s.f(p, q));
    if (s.must === hasCounter) throw new Error(`gre-inequalities-absolute-value: table error for ${s.tex} under ${C.text}`);
  }
  const musts = C.stmts.filter((s) => s.must);
  const nots = C.stmts.filter((s) => !s.must);
  const nTrue = rng.int(1, Math.min(3, musts.length));
  const nFalse = Math.min(5 - nTrue, nots.length);
  const chosenTrue = rng.shuffle(musts).slice(0, nTrue);
  const chosenFalse = rng.shuffle(nots).slice(0, nFalse);
  const order = rng.shuffle([...chosenTrue, ...chosenFalse]);
  const options: ChoiceOption[] = order.map((s, i) => ({ id: `o${i}`, label: `$${sub(s.tex)}$` }));
  const correct = options.filter((_, i) => order[i].must).map((o) => o.id);
  const answer = multiAnswer(options, correct);
  // "sometimes true" decoys: false statements that hold for at least one allowed pair
  const sometimes = order.findIndex((s) => !s.must && pts.some(([p, q]) => s.f(p, q)));
  const [ep, eq] = C.ex;
  const first = order[0];
  return {
    params: { form: 0, a: 0, b: 0, c: 0, t: 0, op: 0, h: 0, k: 0, fam: 0, sgn: 0, nm, set },
    prompt: phrasing === 0 ? `If $${sub(C.text)}$, which of the following MUST be true? Select all that apply.` : `Given that $${sub(C.text)}$, which of the following statements must be true? Select all that apply.`,
    answer,
    steps: [
      {
        key: 'test-values',
        instruction: `Test numbers that fit the condition, such as ${n1} = ${ep}, ${n2} = ${eq}, then look for COUNTEREXAMPLES (negatives, fractions, numbers close together).`,
        math: `${n1} = ${ep},\\ ${n2} = ${eq}`,
        why: '"Must be true" means true for EVERY allowed pair; one counterexample makes an option false. "Could be true" is a much weaker claim.',
        ask: { prompt: `For $${n1} = ${ep}$, $${n2} = ${eq}$, is the first option true?`, answer: { kind: 'choice', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], correct: first.f(ep, eq) ? 'yes' : 'no' } },
      },
      { key: 'test-each', instruction: 'Check each option by algebra or by a counterexample. Remember: multiplying or taking reciprocals of inequalities depends on signs.', math: order.map((s) => `${sub(s.tex)}: ${s.must ? '\\checkmark' : '\\times'}`).join(',\\quad '), why: 'Select-all needs every correct option and no wrong one.', ask: { prompt: 'Select all that MUST be true.', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [sometimes >= 0 ? { id: 'must-vs-could', wrong: multiAnswer(options, [...correct, options[sometimes].id]) } : null]),
    verify: { type: 'choice', note: 'tests/skills/gre-inequalities-absolute-value.test.ts searches a grid for counterexamples to every option' },
  };
}

export const greInequalitiesAbsoluteValue: SkillDefinition = {
  id: ID,
  title: 'Inequalities & absolute value',
  track: 'gre',
  unit: 'GRE · Algebra',
  description: 'Solving linear inequalities, absolute value equations and inequalities, and reasoning with inequality constraints.',
  prerequisites: ['gre-equations-word-problems'],
  maxDenominator: 1,
  levels: {
    1: {
      description: 'Solve a linear inequality (multiple choice)',
      ranges: { form: [0, 0], a: [-5, 5], b: [-9, 9], c: [-100, 100], t: [-6, 8], op: [0, 3], h: [0, 0], k: [0, 0], fam: [0, 0], sgn: [0, 0], nm: [0, 0], set: [0, 0] },
    },
    2: {
      description: 'Absolute value equations: two solutions',
      ranges: { form: [0, 2], a: [0, 4], b: [0, 24], c: [-32, 24], t: [0, 0], op: [0, 0], h: [-9, 9], k: [0, 6], fam: [0, 0], sgn: [0, 0], nm: [0, 0], set: [0, 0] },
    },
    3: {
      description: 'Count the integers in an absolute value inequality',
      ranges: { form: [0, 0], a: [0, 0], b: [2, 24], c: [0, 0], t: [0, 0], op: [0, 2], h: [-9, 9], k: [0, 0], fam: [0, 0], sgn: [0, 0], nm: [0, 0], set: [0, 0] },
    },
    4: {
      description: 'QC with inequality constraints',
      ranges: { form: [0, 0], a: [0, 0], b: [0, 0], c: [0, 0], t: [0, 0], op: [0, 0], h: [0, 0], k: [0, 0], fam: [0, 12], sgn: [-1, 1], nm: [0, 5], set: [0, 0] },
    },
    5: {
      description: '"Must be true" (select all)',
      ranges: { form: [0, 0], a: [0, 0], b: [0, 0], c: [0, 0], t: [0, 0], op: [0, 0], h: [0, 0], k: [0, 0], fam: [0, 0], sgn: [0, 0], nm: [0, 5], set: [0, 3] },
    },
  },
  misconceptions: {
    'inequality-not-flipped': { name: 'Did not flip the sign when dividing by a negative', explanation: 'Multiplying or dividing both sides by a NEGATIVE number reverses the inequality: $-2x > 6$ gives $x < -3$, not $x > -3$. Test a number from your answer in the original inequality.' },
    'abs-one-solution': { name: 'Found only one solution of an absolute value equation', explanation: '$|u| = b$ (with $b > 0$) means $u = b$ OR $u = -b$: two solutions, symmetric about the center. Solve both cases.' },
    'endpoint-inclusion': { name: 'Included (or dropped) the endpoints', explanation: '"<" excludes the endpoints and "≤" includes them. When the endpoints are integers this changes the count by 2.' },
    'must-vs-could': { name: 'Picked an option that is only sometimes true', explanation: '"MUST be true" needs the statement to hold for EVERY allowed pair. An option that is true for some pairs but fails for others ("could be true") is not correct. Hunt for a counterexample.' },
    'tested-one-case': { name: 'Decided from a single test', explanation: 'A, B or C must hold for EVERY allowed value. If two allowed cases disagree, the answer is D, so always try a second, different case.' },
  },
  stepLabels: {
    isolate: 'Isolate the x-term',
    divide: 'Divide (flip for a negative)',
    pick: 'Match an option',
    'two-cases': 'Split into two cases',
    sum: 'Add the solutions',
    product: 'Multiply the solutions',
    compound: 'Rewrite as a compound inequality',
    count: 'Count the integers',
    'test-values': 'Test allowed values',
    decide: 'Decide the relationship',
    'test-each': 'Test each option',
  },
  learn: {
    whyItMatters:
      'Inequality questions are where the GRE hides its sign traps: multiplying by a negative flips the direction, squaring or taking reciprocals depends on signs, and "must be true" is stricter than "could be true". Absolute value is the language of deviations: a policy rate within 0.5 of a 2% target is |r − 2| ≤ 0.5, which allows every rate from 1.5% to 2.5%, and that is 11 rates in steps of 0.1.',
    summary:
      'Solve inequalities like equations, but flip the sign when multiplying or dividing by a negative. $|u| = b$ means $u = b$ or $u = -b$. $|u| < b$ means $-b < u < b$ (endpoints included for ≤). For constraints like $x < y < 0$, reason with signs: multiplying by a negative reverses order, and squares/reciprocals depend on whether the numbers are positive or negative. "Must be true" means no counterexample exists.',
    formulas: [
      { latex: '|x - h| = b \\iff x = h + b \\ \\text{or}\\ x = h - b' },
      { latex: '|x - h| < b \\iff h - b < x < h + b' },
      { latex: 'a < b,\\ c < 0 \\;\\Rightarrow\\; ac > bc', note: 'Multiplying by a negative flips the sign.' },
    ],
    example: { seed: 2, level: 4 },
    tips: ['To test "must be true", try positive, negative and fractional values that fit the condition.', 'Check a solution by plugging a number from it back into the original inequality.'],
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
