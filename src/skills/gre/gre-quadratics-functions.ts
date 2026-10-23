// GRE Quadratics & functions. Formats: numeric entry (L1-L3, L5), select-all (L1 form 3),
// quantitative comparison (L4). QC relations are proven by hand per form (identity, sign of a
// square, sign of 2xn) and re-derived by the harness's sampler through the `qc` verify.

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step } from '../../engine/types';

const ID = 'gre-quadratics-functions';
type Body = ReturnType<SkillDefinition['generate']>;

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** x^2 + bx + c as LaTeX. */
function quadLatex(b: number, c: number): string {
  let s = 'x^2';
  if (b !== 0) s += b === 1 ? ' + x' : b === -1 ? ' - x' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}x`;
  if (c !== 0) s += ` ${sgn(c)}`;
  return s;
}
/** p x^2 + q x + r as LaTeX (leading coefficient may be any nonzero integer). */
function polyLatex(p: number, q: number, r: number): string {
  let s = p === 1 ? 'x^2' : p === -1 ? '-x^2' : `${p}x^2`;
  if (q !== 0) s += ` ${q > 0 ? '+' : '-'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}x`;
  if (r !== 0) s += ` ${sgn(r)}`;
  return s;
}
/** mathjs/SymPy text for p*x^2 + q*x + r evaluated at a literal. */
const polyAt = (p: number, q: number, r: number, at: number) => `(${p}*${par(at)}^2 + ${q}*${par(at)} + ${r})`;

function shuffleOptions(rng: Rng, labels: string[], correctIdx: number[]): { options: ChoiceOption[]; correct: string[] } {
  const tagged = labels.map((label, i) => ({ label, good: correctIdx.includes(i) }));
  const shuffled = rng.shuffle(tagged);
  const options = shuffled.map((t, i) => ({ id: `o${i}`, label: t.label }));
  return { options, correct: options.filter((_, i) => shuffled[i].good).map((o) => o.id) };
}

// ---------- level 1: factor and solve ----------

function level1(rng: Rng): Body {
  let r1: number, r2: number;
  do {
    r1 = rng.int(-9, 9);
    r2 = rng.int(-9, 9);
  } while (r1 === 0 || r2 === 0 || Math.abs(r1) === Math.abs(r2));
  const form = rng.int(0, 3);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const eq = quadLatex(b, c);
  const m = -r1; // factored form (x + m)(x + n)
  const n = -r2;
  const D = `(${b})^2 - 4*(${c})`;
  const rootA = `((-(${b})) + sqrt(${D}))/2`;
  const rootB = `((-(${b})) - sqrt(${D}))/2`;
  const pairStep: Step = {
    key: 'find-pair',
    instruction: `Look for two numbers with product ${c} and sum ${b}. They give the factors $(x + m)(x + n)$.`,
    math: `${quadLatex(b, c)} = (x ${sgn(m)})(x ${sgn(n)})`,
    why: 'Factoring x² + bx + c: find m, n with m·n = c and m + n = b.',
    ask: { prompt: `Two numbers have product $${c}$ and sum $${b}$. What is the larger one?`, answer: numberAnswer(Math.max(m, n)), verify: { type: 'evaluate', expr: `((${b}) + sqrt(${D}))/2` } },
  };
  const rootsMath = `x ${sgn(m)} = 0 \\Rightarrow x = ${-m}, \\qquad x ${sgn(n)} = 0 \\Rightarrow x = ${-n}`;
  if (form === 3) {
    const extras: number[] = [];
    for (let v = -10; v <= 10; v++) if (v !== 0 && v !== r1 && v !== r2 && v !== m && v !== n) extras.push(v);
    const picked = rng.shuffle(extras).slice(0, 2);
    const vals = [r1, r2, m, n, ...picked];
    const { options, correct } = shuffleOptions(rng, vals.map(String), [0, 1]);
    const wrongIds = options.filter((o) => o.label === String(m) || o.label === String(n)).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    return {
      params: { r1, r2, form },
      prompt: `Which of the following are solutions of $${eq} = 0$?\n\nSelect all that apply.`,
      answer,
      steps: [
        pairStep,
        {
          key: 'test-each',
          instruction: 'A root makes the factor (x + m) equal to 0, so it is −m. (Or back-solve: plug each option into the equation.)',
          math: rootsMath,
          why: '(x + 3)(x − 2) = 0 gives x = −3 and x = 2: the roots have the OPPOSITE signs of the numbers in the factors.',
          ask: { prompt: 'Select all the solutions.', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'root-sign', wrong: multiAnswer(options, wrongIds) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-quadratics-functions.test.ts plugs every option into the quadratic' },
    };
  }
  const labels = ['sum of the solutions', 'product of the solutions', 'greater solution'];
  const answerQ = form === 0 ? r1 + r2 : form === 1 ? r1 * r2 : Math.max(r1, r2);
  const answer = numberAnswer(answerQ);
  const verifyExpr = form === 0 ? `${rootA} + ${rootB}` : form === 1 ? `(${rootA}) * (${rootB})` : `(${rootA})`;
  return {
    params: { r1, r2, form },
    prompt: `If $${eq} = 0$, what is the ${labels[form]}?`,
    answer,
    steps: [
      pairStep,
      {
        key: 'roots',
        instruction: form === 1 ? 'The roots are −m and −n, so their product is mn = c.' : 'The roots are −m and −n (the opposite signs of the numbers in the factors).',
        math: rootsMath,
        why: 'Setting each factor to 0 flips the sign of the number inside it.',
        ask: { prompt: `What is the ${labels[form]}?`, answer, verify: { type: 'evaluate', expr: verifyExpr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      wrongNumber('root-sign', () => (form === 0 ? -(r1 + r2) : form === 2 ? Math.max(m, n) : r1 * r2)),
    ]),
    verify: { type: 'evaluate', expr: verifyExpr },
  };
}

// ---------- level 2: special products ----------

function level2(rng: Rng): Body {
  let x: number, y: number;
  do {
    x = rng.int(-9, 12);
    y = rng.int(-9, 12);
  } while (x === y || x === 0 || y === 0);
  const form = rng.int(0, 2);
  const s = x + y;
  const d = x - y;
  const p = x * y;
  const u = x * x + y * y;
  if (form === 0) {
    const answer = numberAnswer(s * d);
    return {
      params: { x, y, form },
      prompt: `If $x + y = ${s}$ and $x - y = ${d}$, what is the value of $x^2 - y^2$?`,
      answer,
      steps: [
        {
          key: 'recognize',
          instruction: 'Recognize a difference of squares: $x^2 - y^2 = (x+y)(x-y)$. No need to solve for x and y.',
          math: 'x^2 - y^2 = (x + y)(x - y)',
          why: 'GRE problems hand you exactly the pieces of a special product.',
        },
        {
          key: 'substitute',
          instruction: 'Substitute the two given values.',
          math: `(${s})(${d}) = ${s * d}`,
          why: 'Use the given sum and difference directly.',
          ask: { prompt: `What is $x^2 - y^2$?`, answer, verify: { type: 'evaluate', expr: `(${par(x)})^2 - (${par(y)})^2` } },
        },
      ],
      misconceptions: [],
      verify: { type: 'evaluate', expr: `(${par(x)})^2 - (${par(y)})^2` },
    };
  }
  if (form === 1) {
    const answer = numberAnswer(u);
    return {
      params: { x, y, form },
      prompt: `If $x + y = ${s}$ and $xy = ${p}$, what is the value of $x^2 + y^2$?`,
      answer,
      steps: [
        {
          key: 'expand',
          instruction: 'Square the sum: $(x+y)^2 = x^2 + 2xy + y^2$, so $x^2 + y^2 = (x+y)^2 - 2xy$.',
          math: '(x + y)^2 = x^2 + 2xy + y^2',
          why: 'The middle term 2xy does not vanish: (x + y)² ≠ x² + y².',
        },
        {
          key: 'substitute',
          instruction: 'Substitute the given values.',
          math: `(${s})^2 - 2(${p}) = ${s * s} ${sgn(-2 * p)} = ${u}`,
          why: 'Rearranging the expansion gives the quantity asked for.',
          ask: { prompt: `What is $x^2 + y^2$?`, answer, verify: { type: 'evaluate', expr: `(${par(x)})^2 + (${par(y)})^2` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('square-term-by-term', () => s * s)]),
      verify: { type: 'evaluate', expr: `(${par(x)})^2 + (${par(y)})^2` },
    };
  }
  const answer = numberAnswer(s * s);
  return {
    params: { x, y, form },
    prompt: `If $x^2 + y^2 = ${u}$ and $xy = ${p}$, what is the value of $(x + y)^2$?`,
    answer,
    steps: [
      {
        key: 'expand',
        instruction: 'Expand: $(x+y)^2 = x^2 + 2xy + y^2$.',
        math: '(x + y)^2 = x^2 + y^2 + 2xy',
        why: 'The cross term 2xy is the part people forget.',
      },
      {
        key: 'substitute',
        instruction: 'Substitute the given values.',
        math: `${u} + 2(${p}) = ${s * s}`,
        why: 'Both pieces are given.',
        ask: { prompt: `What is $(x + y)^2$?`, answer, verify: { type: 'evaluate', expr: `(${par(x)} + ${par(y)})^2` } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('square-term-by-term', () => u)]),
    verify: { type: 'evaluate', expr: `(${par(x)} + ${par(y)})^2` },
  };
}

// ---------- level 3: function notation ----------

function level3(rng: Rng): Body {
  const form = rng.int(0, 1);
  if (form === 0) {
    const p = rng.nonzero(-3, 3);
    const q = rng.int(-5, 5);
    const r = rng.int(-6, 6);
    let a: number, b: number;
    do {
      a = rng.int(-4, 4);
      b = rng.int(-4, 4);
    } while (a === b);
    const f = (t: number) => p * t * t + q * t + r;
    const answer = numberAnswer(f(a) - f(b));
    const expr = `${polyAt(p, q, r, a)} - ${polyAt(p, q, r, b)}`;
    return {
      params: { p, q, r, a, b, form },
      prompt: `If $f(x) = ${polyLatex(p, q, r)}$, what is the value of $f(${a}) - f(${b})$?`,
      answer,
      steps: [
        {
          key: 'evaluate-first',
          instruction: `Substitute $x = ${a}$ (use parentheses around negatives).`,
          math: `f(${a}) = ${f(a)}`,
          why: 'f(a) means: replace every x by a, then square before multiplying.',
          ask: { prompt: `What is $f(${a})$?`, answer: numberAnswer(f(a)), verify: { type: 'evaluate', expr: polyAt(p, q, r, a) } },
        },
        {
          key: 'evaluate-second',
          instruction: `Substitute $x = ${b}$.`,
          math: `f(${b}) = ${f(b)}`,
          why: 'Same rule for the second value.',
          ask: { prompt: `What is $f(${b})$?`, answer: numberAnswer(f(b)), verify: { type: 'evaluate', expr: polyAt(p, q, r, b) } },
        },
        {
          key: 'subtract',
          instruction: 'Subtract.',
          math: `${f(a)} - (${f(b)}) = ${f(a) - f(b)}`,
          why: 'Keep the order f(a) − f(b).',
          ask: { prompt: `What is $f(${a}) - f(${b})$?`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('operation-order', () => f(b) - f(a))]),
      verify: { type: 'evaluate', expr },
    };
  }
  const p = rng.nonzero(-4, 4);
  const q = rng.int(-6, 6);
  const a = rng.int(-4, 4);
  const f = (t: number) => p * t + q;
  const inner = f(a);
  const answer = numberAnswer(f(inner));
  const lin = (t: string) => `(${p}*${t} + ${q})`;
  const expr = lin(`(${lin(par(a))})`);
  return {
    params: { p, q, r: 0, a, b: 0, form },
    prompt: `If $f(x) = ${p === 1 ? '' : p === -1 ? '-' : p}x ${sgn(q)}$, what is the value of $f(f(${a}))$?`,
    answer,
    steps: [
      {
        key: 'inner',
        instruction: `Work from the inside out: first find $f(${a})$.`,
        math: `f(${a}) = ${inner}`,
        why: 'In f(f(a)) the inner function is evaluated first.',
        ask: { prompt: `What is $f(${a})$?`, answer: numberAnswer(inner), verify: { type: 'evaluate', expr: lin(par(a)) } },
      },
      {
        key: 'outer',
        instruction: `Now feed that result into f: find $f(${inner})$.`,
        math: `f(${inner}) = ${f(inner)}`,
        why: 'The output of the inner function becomes the input of the outer one.',
        ask: { prompt: `What is $f(f(${a}))$?`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('operation-order', () => f(a) * f(a))]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 4: quantitative comparison with quadratics ----------

function level4(rng: Rng): Body {
  // The sampling verifier is slow, so most comparisons are variable-free (form 3, exact).
  const pick = rng.int(0, 19);
  const form = pick < 12 ? 3 : pick < 13 ? 0 : pick < 16 ? 1 : 2;
  const m = rng.int(1, 6);
  const n = rng.int(1, 6);
  const h = rng.int(-5, 5);
  const k = rng.int(1, 6);
  if (form === 3) {
    const c = rng.int(-5, 12);
    const min = c - h * h;
    const t = rng.chance(0.35) ? c : min + rng.int(-2, 2);
    const relation: QcRelation = min > t ? 'a' : min < t ? 'b' : 'c';
    const answer = qcAnswer(relation);
    const fx = `x^2 ${h === 0 ? '' : `${h > 0 ? '-' : '+'} ${Math.abs(2 * h)}x `}${c === 0 ? "" : sgn(c)}`.replace(/\s+/g, ' ');
    return {
      params: { form, m, n, h, k, c, t },
      prompt: QC_PROMPT(`$f(x) = ${fx}$, where $x$ is any real number.`, 'The minimum value of $f(x)$', `$${t}$`),
      answer,
      steps: [
        {
          key: 'vertex',
          instruction: `Complete the square: $f(x) = (x ${sgn(-h)})^2 ${sgn(c - h * h)}$. The square is smallest (zero) at $x = ${h}$.`,
          math: `f(x) = (x ${sgn(-h)})^2 ${sgn(c - h * h)} \\ge ${c - h * h}`,
          why: 'For x² + bx + c the minimum is at x = −b/2. It is NOT the constant term c, which is only f(0).',
          ask: { prompt: `At what value of $x$ is $f(x)$ smallest?`, answer: numberAnswer(h), verify: { type: 'evaluate', expr: `-(${-2 * h})/2` } },
        },
        {
          key: 'min-value',
          instruction: `Substitute the vertex into $f$.`,
          math: `f(${h}) = ${min}`,
          why: 'The minimum value is f at the vertex.',
          ask: { prompt: `What is the minimum value of $f(x)$?`, answer: numberAnswer(min), verify: { type: 'evaluate', expr: `(${h})^2 - 2*(${h})*(${h}) + ${c}` } },
        },
        {
          key: 'decide',
          instruction: `Compare ${min} with ${t}.`,
          math: `${min} \\text{ vs } ${t}`,
          why: 'With no free variable left, the relationship is determined (never D).',
          ask: { prompt: 'So which is it?', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'constant-as-minimum', wrong: qcAnswer(c > t ? 'a' : c < t ? 'b' : 'c') }]),
      verify: { type: 'qc', quantityA: `(${h})^2 - 2*(${h})*(${h}) + ${c}`, quantityB: `${t}`, variables: [], constraints: [] },
    };
  }
  const params = { form, m, n, h, k, c: 0, t: 0 };
  if (form === 0) {
    // (x - m)(x + n) = x^2 + (n - m)x - mn: an identity.
    const lin = n - m;
    const B = `x^2 ${lin === 0 ? '' : `${lin > 0 ? '+' : '-'} ${Math.abs(lin) === 1 ? '' : Math.abs(lin)}x `}- ${m * n}`;
    return {
      params,
      prompt: QC_PROMPT('$x$ is a real number.', `$(x - ${m})(x + ${n})$`, `$${B}$`),
      answer: qcAnswer('c'),
      steps: [
        {
          key: 'expand',
          instruction: 'Simplify both sides the same way: expand Quantity A.',
          math: `(x - ${m})(x + ${n}) = x^2 ${sgn(n - m)}x - ${m * n}`,
          why: 'In QC, if one side can be rewritten to match the other, they are equal for every x.',
          ask: { prompt: `What is the constant term of $(x - ${m})(x + ${n})$ once expanded?`, answer: numberAnswer(-m * n), verify: { type: 'evaluate', expr: `-${m}*${n}` } },
        },
        {
          key: 'decide',
          instruction: 'The expansion matches Quantity B exactly.',
          math: 'A = B \\text{ for every } x',
          why: 'Identical expressions are equal for all x: answer C.',
          ask: { prompt: 'So which is it?', answer: qcAnswer('c') },
        },
      ],
      misconceptions: [],
      verify: { type: 'qc', quantityA: `(x - ${m})*(x + ${n})`, quantityB: `x^2 + (${n - m})*x - ${m * n}`, variables: [{ name: 'x', min: -10, max: 10 }], constraints: [] },
    };
  }
  if (form === 1) {
    // A - B = (x - h)^2 >= 0, equal only at x = h. Integer x so the case x = h is allowed.
    const restricted = rng.chance(0.5);
    const relation: QcRelation = restricted ? 'a' : 'd';
    const answer = qcAnswer(relation);
    return {
      params,
      prompt: QC_PROMPT(restricted ? `$x$ is an integer and $x \\ne ${h}$.` : '$x$ is an integer.', `$(x ${sgn(-h)})^2 + ${k}$`, `$${k}$`),
      answer,
      steps: [
        {
          key: 'subtract',
          instruction: 'Subtract Quantity B from Quantity A.',
          math: `A - B = (x ${sgn(-h)})^2 \\ge 0`,
          why: 'A square is never negative, but it CAN be zero.',
          ask: { prompt: `What is Quantity A minus Quantity B when $x = ${h}$?`, answer: numberAnswer(0), verify: { type: 'evaluate', expr: `((${h}) - (${h}))^2` } },
        },
        {
          key: 'decide',
          instruction: restricted ? `A − B is zero only at $x = ${h}$, which is excluded.` : `A − B is zero at $x = ${h}$ but positive elsewhere.`,
          math: restricted ? 'A > B' : '\\text{both } A = B \\text{ and } A > B \\text{ occur}',
          why: 'A, B or C must hold for EVERY allowed x; two different outcomes mean D.',
          ask: { prompt: 'So which is it?', answer },
        },
      ],
      misconceptions: restricted ? [] : distinctMisconceptions(answer, [{ id: 'tested-one-case', wrong: qcAnswer('a') }]),
      verify: {
        type: 'qc',
        quantityA: `(x - (${h}))^2 + ${k}`,
        quantityB: `${k}`,
        variables: [{ name: 'x', min: -12, max: 12, integer: true }],
        constraints: restricted ? [`x != ${h}`] : [],
      },
    };
  }
  // form 2/3: (x+n)^2 vs x^2 + n^2: A - B = 2nx, sign of x decides.
  const sub = rng.chance(0.5) ? 2 : rng.int(0, 1);
  const relation: QcRelation = sub === 0 ? 'a' : sub === 1 ? 'b' : 'd';
  const setup = sub === 0 ? `$x > 0$` : sub === 1 ? `$x < 0$` : `$x$ is an integer.`;
  const answer = qcAnswer(relation);
  return {
    params,
    prompt: QC_PROMPT(setup.endsWith('.') ? setup : `${setup}.`, `$(x + ${n})^2$`, `$x^2 + ${n * n}$`),
    answer,
    steps: [
      {
        key: 'subtract',
        instruction: 'Expand Quantity A and subtract Quantity B.',
        math: `(x + ${n})^2 - (x^2 + ${n * n}) = ${2 * n}x`,
        why: '(x + n)² = x² + 2nx + n²: the middle term is what separates A from B.',
        ask: { prompt: `What is Quantity A minus Quantity B when $x = 1$?`, answer: numberAnswer(2 * n), verify: { type: 'evaluate', expr: `(1 + ${n})^2 - (1^2 + ${n * n})` } },
      },
      {
        key: 'decide',
        instruction: `The sign of $${2 * n}x$ is the sign of $x$.`,
        math: sub === 0 ? 'x > 0 \\Rightarrow A - B > 0' : sub === 1 ? 'x < 0 \\Rightarrow A - B < 0' : 'x > 0,\\; x = 0,\\; x < 0 \\text{ all allowed}',
        why: 'If x can be positive, zero or negative, the comparison changes: D.',
        ask: { prompt: 'So which is it?', answer },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'square-term-by-term', wrong: qcAnswer('c') }]),
    verify: {
      type: 'qc',
      quantityA: `(x + ${n})^2`,
      quantityB: `x^2 + ${n * n}`,
      variables: [{ name: 'x', min: -10, max: 10, integer: sub === 2 }],
      constraints: sub === 0 ? ['x > 0'] : sub === 1 ? ['x < 0'] : [],
    },
  };
}

// ---------- level 5: symbol-defined operations ----------

function level5(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 1);
    const p = rng.int(2, 5);
    const x = rng.int(-4, 5);
    const y = rng.int(-4, 5);
    const z = rng.int(-4, 5);
    const op = (a: number, b: number) => (form === 0 ? p * a - b * b : a * a - p * b);
    const inner = op(y, z);
    if (Math.abs(inner) > 14) continue;
    const result = op(x, inner);
    const wrong = op(op(x, y), z);
    if (Math.abs(result) > 300 || Math.abs(wrong) > 300) continue;
    const def = form === 0 ? `a \\oplus b = ${p}a - b^2` : `a \\oplus b = a^2 - ${p}b`;
    const e = (a: string, b: string) => (form === 0 ? `(${p}*${a} - ${b}^2)` : `(${a}^2 - ${p}*${b})`);
    const expr = e(par(x), e(par(y), par(z)));
    const answer = numberAnswer(result);
    return {
      params: { form, p, x, y, z },
      prompt: `For all numbers $a$ and $b$, let $${def}$. What is the value of $${par(x)} \\oplus (${par(y)} \\oplus ${par(z)})$?`,
      answer,
      steps: [
        {
          key: 'inner',
          instruction: `The parentheses come first: find $${par(y)} \\oplus ${par(z)}$ using the rule with $a = ${y}$, $b = ${z}$.`,
          math: form === 0 ? `${par(y)} \\oplus ${par(z)} = ${p}(${y}) - (${z})^2 = ${inner}` : `${par(y)} \\oplus ${par(z)} = (${y})^2 - ${p}(${z}) = ${inner}`,
          why: 'A defined symbol is just a recipe: substitute for a and b, in order.',
          ask: { prompt: `What is $${par(y)} \\oplus ${par(z)}$?`, answer: numberAnswer(inner), verify: { type: 'evaluate', expr: e(par(y), par(z)) } },
        },
        {
          key: 'outer',
          instruction: `Now use $a = ${x}$ and $b = ${inner}$.`,
          math: form === 0 ? `${par(x)} \\oplus (${inner}) = ${p}(${x}) - (${inner})^2 = ${result}` : `${par(x)} \\oplus (${inner}) = (${x})^2 - ${p}(${inner}) = ${result}`,
          why: 'The result of the inner operation is the b-value of the outer one.',
          ask: { prompt: `What is $${par(x)} \\oplus (${par(y)} \\oplus ${par(z)})$?`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('operation-order', () => wrong)]),
      verify: { type: 'evaluate', expr },
    };
  }
}

export const greQuadraticsFunctions: SkillDefinition = {
  id: ID,
  title: 'Quadratics & functions',
  track: 'gre',
  unit: 'GRE · Algebra',
  description: 'Factoring, special products, function notation, quadratic comparisons and symbol-defined operations.',
  prerequisites: ['gre-equations-word-problems', 'gre-exponents-roots'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Factor and solve (numeric entry, select all)', ranges: { r1: [-9, 9], r2: [-9, 9], form: [0, 3] } },
    2: { description: 'Special products', ranges: { x: [-9, 12], y: [-9, 12], form: [0, 2] } },
    3: { description: 'Function notation', ranges: { p: [-4, 4], q: [-6, 6], r: [-6, 6], a: [-4, 4], b: [-4, 4], form: [0, 1] } },
    4: { description: 'Quantitative comparison with quadratics', ranges: { form: [0, 3], m: [1, 6], n: [1, 6], h: [-5, 5], k: [1, 6], c: [-5, 12], t: [-35, 30] } },
    5: { description: 'Symbol-defined operations', ranges: { form: [0, 1], p: [2, 5], x: [-4, 5], y: [-4, 5], z: [-4, 5] } },
  },
  misconceptions: {
    'square-term-by-term': { name: 'Squared a sum term by term', explanation: '$(a+b)^2 = a^2 + 2ab + b^2$, not $a^2 + b^2$. The cross term $2ab$ is zero only when $a$ or $b$ is 0.' },
    'root-sign': { name: 'Took the numbers in the factors as the roots', explanation: '$(x+3)(x-2) = 0$ means $x + 3 = 0$ or $x - 2 = 0$, so the roots are $-3$ and $2$: the OPPOSITE signs of the numbers in the factors.' },
    'operation-order': { name: 'Evaluated in the wrong order', explanation: 'Do the inner operation or the correct function value first. In $x \\oplus (y \\oplus z)$ the parentheses come first, and in $f(a) - f(b)$ the order of subtraction matters.' },
    'constant-as-minimum': { name: 'Took the constant term as the minimum', explanation: 'In $x^2 + bx + c$ the constant $c$ is just $f(0)$. The minimum is at the vertex $x = -b/2$, and it is $c - b^2/4$, smaller than $c$ unless $b = 0$.' },
    'tested-one-case': { name: 'Decided from a single value', explanation: 'A square can be zero. When $x$ may equal the value that makes the square 0, Quantity A can equal Quantity B in one case and exceed it in the others: answer D.' },
  },
  stepLabels: {
    'find-pair': 'Find the factor pair',
    roots: 'Read off the roots',
    'test-each': 'Test each option',
    recognize: 'Recognize the special product',
    expand: 'Expand the square',
    substitute: 'Substitute the given values',
    'evaluate-first': 'Evaluate f at the first input',
    'evaluate-second': 'Evaluate f at the second input',
    subtract: 'Subtract and compare',
    inner: 'Evaluate the inner expression first',
    outer: 'Evaluate the outer expression',
    decide: 'Decide the relationship',
    vertex: 'Find the vertex',
    'min-value': 'Find the minimum value',
  },
  learn: {
    whyItMatters:
      'Quadratics and function notation appear in many GRE algebra questions, and the fastest route is usually a special product rather than solving for the variables: given $x+y=7$ and $x-y=3$, $x^2-y^2 = 21$ with no further work. The same skill reads economics formulas: a profit function $\\pi(q) = -q^2 + 40q - 300$ is a quadratic, its roots are the break-even quantities ($q = 10$ and $q = 30$) and its vertex $q = 20$ is the profit-maximizing output.',
    summary:
      'A quadratic $x^2 + bx + c$ factors as $(x+m)(x+n)$ with $mn = c$ and $m+n = b$; its roots are $-m$ and $-n$, with sum $-b$ and product $c$. Memorize $(a+b)^2 = a^2+2ab+b^2$ and $a^2-b^2=(a+b)(a-b)$. $f(a)$ means substitute $a$ for every $x$. For a defined operation, substitute carefully and work inside parentheses first.',
    formulas: [
      { latex: '(a+b)^2 = a^2 + 2ab + b^2', note: 'Never $a^2+b^2$.' },
      { latex: 'a^2 - b^2 = (a+b)(a-b)' },
      { latex: 'x^2 + bx + c = 0 \\Rightarrow x_1 + x_2 = -b,\\; x_1 x_2 = c' },
    ],
    example: { seed: 3, level: 1 },
    tips: ['A square is never negative, but it can be zero: check that case in QC.', 'Put parentheses around negative inputs: $f(-2)$ with $x^2$ is $(-2)^2$.'],
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
