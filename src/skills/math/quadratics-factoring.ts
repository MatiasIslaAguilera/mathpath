// Quadratics: factoring (math). Tuple answer: both roots, smaller first, always distinct.
// Every level is built backwards from the roots, so the answer is exact and the factoring is clean.

import { numberAnswer, tupleAnswer } from '../../engine/answers';
import { linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  ChoiceOption,
  InterpretationQuestion,
  Level,
  MisconceptionInstance,
  SkillDefinition,
  Step,
  VerifySpec,
} from '../../engine/types';

const ID = 'quadratics-factoring';
const LABELS = ['Smaller root', 'Larger root'];
const DISPLAY = ['x_1', 'x_2'];

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const k = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** "x + 3" for the root -3, "x - 2" for the root 2, "x" for 0. */
const fac = (r: number) => (r === 0 ? 'x' : r < 0 ? `x + ${-r}` : `x - ${r}`);
/** |n| as the coefficient of x: 1 is left out. */
const cx = (n: number) => (Math.abs(n) === 1 ? '' : `${Math.abs(n)}`);

/** a x^2 + b x + c in LaTeX (zero terms dropped). */
function poly(a: number, b: number, c: number, v = 'x'): string {
  const term = (n: number, mono: string) => {
    if (n === 0) return null;
    if (!mono) return `${n}`;
    return Math.abs(n) === 1 ? `${n < 0 ? '-' : ''}${mono}` : `${n}${mono}`;
  };
  const parts = [term(a, `${v}^2`), term(b, v), term(c, '')].filter((t): t is string => t !== null);
  return parts.map((t, i) => (i === 0 ? t : t.startsWith('-') ? `- ${t.slice(1)}` : `+ ${t}`)).join(' ') || '0';
}

const sortedPair = (x: Q, y: Q): [Q, Q] => (x.valueOf() <= y.valueOf() ? [x, y] : [y, x]);

/**
 * Both roots satisfy the equation and add to -b/a. The last equation fixes the order
 * (|a|(r2 - r1) = sqrt(D)), so the pair (r1, r2) is unique: r1 is the smaller root.
 * `orig` writes the original (unrearranged) equation for a given variable name.
 */
function rootsVerify(A: number, B: number, C: number, orig?: (v: string) => string): VerifySpec {
  const std = (v: string) => `${k(A)}*${v}^2 + ${k(B)}*${v} + ${k(C)} = 0`;
  return {
    type: 'solve',
    equations: [
      orig ? orig('r1') : std('r1'),
      orig ? orig('r2') : std('r2'),
      `r1 + r2 = -(${B})/(${A})`,
      `abs(${A})*(r2 - r1) = sqrt(${k(B)}^2 - 4*${k(A)}*${k(C)})`,
    ],
    unknowns: ['r1', 'r2'],
  };
}

/** The smaller root of A x^2 + B x + C = 0, written independently of the generator's roots. */
const smallerRootExpr = (A: number, B: number, C: number) =>
  `-(${B})/(2*(${A})) - sqrt(${k(B)}^2 - 4*${k(A)}*${k(C)})/(2*abs(${A}))`;

interface Built {
  params: Record<string, number>;
  prompt: string;
  /** Standard form A x^2 + B x + C = 0 */
  A: number;
  B: number;
  C: number;
  r1: Q;
  r2: Q;
  verify: VerifySpec;
  steps: Step[];
  extra: (MisconceptionInstance | null)[];
}

// ---------- shared steps ----------

function pairStep(Bp: number, ACp: number, larger: number, math: string): Step {
  return {
    key: 'find-pair',
    instruction: `Find two numbers that multiply to $${ACp}$ and add to $${Bp}$.`,
    math,
    why: 'To split the middle term, you need two numbers whose product is $ac$ and whose sum is $b$. Try the factor pairs of $ac$ and check their sum.',
    ask: {
      prompt: `Two numbers multiply to $${ACp}$ and add to $${Bp}$. What is the larger one?`,
      answer: numberAnswer(larger),
      verify: { type: 'evaluate', expr: `((${Bp}) + sqrt((${Bp})^2 - 4*(${ACp})))/2` },
    },
  };
}

function zeroStep(A: number, B: number, C: number, r1: Q, factorsTex: string, rootsTex: string): Step {
  return {
    key: 'zero-product',
    instruction: 'Set each factor equal to zero and solve.',
    math: `${factorsTex} = 0 \\;\\Rightarrow\\; ${rootsTex}`,
    why: 'If a product is zero, at least one factor is zero. This only works when the other side is exactly 0.',
    ask: {
      prompt: 'What is the **smaller** root?',
      answer: numberAnswer(r1),
      verify: { type: 'evaluate', expr: smallerRootExpr(A, B, C) },
    },
  };
}

function answerStep(r1: Q, r2: Q, verify: VerifySpec): Step {
  const answer = tupleAnswer(LABELS, [r1, r2], DISPLAY);
  return {
    key: 'answer',
    instruction: 'State both roots, smaller first.',
    math: `x = ${r1.toLatex()} \\quad\\text{or}\\quad x = ${r2.toLatex()}`,
    why: 'A quadratic can have two solutions. Check one by substituting it back into the original equation.',
    ask: { prompt: 'State both roots, smaller first.', answer, verify },
  };
}

// ---------- levels ----------

function distinctRoots(rng: Rng, lo: number, hi: number, nonzero = true): [number, number] {
  for (;;) {
    const a = nonzero ? rng.nonzero(lo, hi) : rng.int(lo, hi);
    const b = nonzero ? rng.nonzero(lo, hi) : rng.int(lo, hi);
    if (a !== b) return a < b ? [a, b] : [b, a];
  }
}

function level1(rng: Rng): Built {
  const [r1, r2] = distinctRoots(rng, -9, 9);
  const B = -(r1 + r2);
  const C = r1 * r2;
  const std = poly(1, B, C);
  const verify = rootsVerify(1, B, C);
  const steps: Step[] = [
    pairStep(B, C, -r1, `x^2 ${B < 0 ? '-' : '+'} ${cx(B)}x ${C < 0 ? '-' : '+'} ${Math.abs(C)} = (${fac(r1)})(${fac(r2)})`),
    zeroStep(1, B, C, q(r1), `(${fac(r1)})(${fac(r2)})`, `x = ${r1} \\text{ or } x = ${r2}`),
    answerStep(q(r1), q(r2), verify),
  ];
  // The B = 0 case has no sign to show: keep the display clean.
  if (B === 0) steps[0].math = `x^2 ${C < 0 ? '-' : '+'} ${Math.abs(C)} = (${fac(r1)})(${fac(r2)})`;
  return {
    params: { r1, r2 },
    prompt: `Solve $${std} = 0$. Give both roots, smaller first.`,
    A: 1, B, C, r1: q(r1), r2: q(r2), verify, steps,
    extra: [],
  };
}

function level2(rng: Rng): Built {
  const form = rng.int(0, 1);
  if (form === 0) {
    const kk = rng.int(2, 12);
    const C = -kk * kk;
    const verify = rootsVerify(1, 0, C);
    const steps: Step[] = [
      {
        key: 'difference-of-squares',
        instruction: `Recognize $x^2 - ${C * -1}$ as a difference of squares: $x^2 - k^2 = (x - k)(x + k)$.`,
        math: `x^2 - ${-C} = x^2 - ${kk}^2 = (x - ${kk})(x + ${kk})`,
        why: 'A difference of two perfect squares always factors as (first - second)(first + second).',
        ask: {
          prompt: `$x^2 - ${-C} = x^2 - k^2$. What is $k$?`,
          answer: numberAnswer(kk),
          verify: { type: 'evaluate', expr: `sqrt(${-C})` },
        },
      },
      zeroStep(1, 0, C, q(-kk), `(x - ${kk})(x + ${kk})`, `x = ${kk} \\text{ or } x = -${kk}`),
      answerStep(q(-kk), q(kk), verify),
    ];
    return {
      params: { form, k: kk, b: 0 },
      prompt: `Solve $x^2 - ${-C} = 0$. Give both roots, smaller first.`,
      A: 1, B: 0, C, r1: q(-kk), r2: q(kk), verify, steps,
      extra: [],
    };
  }
  const b = rng.nonzero(-12, 12);
  const verify = rootsVerify(1, b, 0);
  const [lo, hi] = sortedPair(q(0), q(-b));
  const steps: Step[] = [
    {
      key: 'common-factor',
      instruction: 'Factor out the common factor $x$.',
      math: `x^2 ${b < 0 ? '-' : '+'} ${cx(b)}x = x(x ${b < 0 ? '-' : '+'} ${Math.abs(b)})`,
      why: 'Both terms contain $x$, so pull it out front. Never divide both sides by $x$: that loses the root $x = 0$.',
      ask: {
        prompt: `$x^2 ${b < 0 ? '-' : '+'} ${cx(b)}x = x(x + n)$. What is $n$?`,
        answer: numberAnswer(b),
        verify: { type: 'evaluate', expr: `(${b})` },
      },
    },
    zeroStep(1, b, 0, lo, `x(x ${b < 0 ? '-' : '+'} ${Math.abs(b)})`, `x = 0 \\text{ or } x = ${-b}`),
    answerStep(lo, hi, verify),
  ];
  return {
    params: { form, k: 0, b },
    prompt: `Solve $x^2 ${b < 0 ? '-' : '+'} ${cx(b)}x = 0$. Give both roots, smaller first.`,
    A: 1, B: b, C: 0, r1: lo, r2: hi, verify, steps,
    extra: [],
  };
}

function level3(rng: Rng): Built {
  const a = rng.chance(0.5) ? rng.int(2, 5) : rng.int(-5, -2);
  const [r1, r2] = distinctRoots(rng, -9, 9);
  const b0 = -(r1 + r2);
  const c0 = r1 * r2;
  const A = a, B = a * b0, C = a * c0;
  const verify = rootsVerify(A, B, C);
  const steps: Step[] = [
    {
      key: 'common-factor',
      instruction: `Factor out the common numeric factor $${a}$.`,
      math: `${poly(A, B, C)} = ${a}\\,(${poly(1, b0, c0)})`,
      why: 'Pulling out the common factor first leaves a simple monic quadratic. Dividing by it never changes the roots.',
      ask: {
        prompt: 'What common factor can you take out of every term?',
        answer: numberAnswer(a),
        verify: { type: 'evaluate', expr: `(${a})` },
      },
    },
    pairStep(b0, c0, -r1, `${poly(1, b0, c0)} = (${fac(r1)})(${fac(r2)})`),
    zeroStep(A, B, C, q(r1), `${a}(${fac(r1)})(${fac(r2)})`, `x = ${r1} \\text{ or } x = ${r2}`),
    answerStep(q(r1), q(r2), verify),
  ];
  return {
    params: { a, r1, r2 },
    prompt: `Solve $${poly(A, B, C)} = 0$. Give both roots, smaller first.`,
    A, B, C, r1: q(r1), r2: q(r2), verify, steps,
    extra: [],
  };
}

function level4(rng: Rng): Built {
  for (;;) {
    const p = rng.int(2, 5);
    const r = rng.int(2, 5);
    const qq = rng.nonzero(-9, 9);
    const s = rng.nonzero(-9, 9);
    if (gcd(p, qq) !== 1 || gcd(r, s) !== 1 || qq * r === s * p) continue;
    const A = p * r, B = p * s + qq * r, C = qq * s;
    const verify = rootsVerify(A, B, C);
    const root1 = q(-qq, p);
    const root2 = q(-s, r);
    const [lo, hi] = sortedPair(root1, root2);
    const f1 = linLatex(p, qq), f2 = linLatex(r, s);
    const m = p * s, n = qq * r; // the two numbers that split the middle term
    const larger = Math.max(m, n);
    const smaller = Math.min(m, n);
    const steps: Step[] = [
      pairStep(
        B, A * C, larger,
        `ac = ${A}\\cdot ${k(C)} = ${A * C}, \\quad \\text{numbers: } ${larger} \\text{ and } ${smaller}`,
      ),
      {
        key: 'group',
        instruction: 'Split the middle term with those two numbers, then factor by grouping.',
        math: `${poly(A, B, C)} = ${A}x^2 ${m < 0 ? '-' : '+'} ${cx(m)}x ${n < 0 ? '-' : '+'} ${cx(n)}x ${C < 0 ? '-' : '+'} ${Math.abs(C)} = ${linLatex(p, 0)}(${f2}) ${qq < 0 ? '-' : '+'} ${Math.abs(qq)}(${f2}) = (${f1})(${f2})`,
        why: 'Splitting $bx$ into two terms lets you factor each pair; both pairs then share the same bracket.',
        ask: {
          prompt: `Both groups share the bracket $(${linLatex(r, 0)} + n)$. What is $n$?`,
          answer: numberAnswer(s),
          verify: { type: 'evaluate', expr: `(${s})` },
        },
      },
      zeroStep(A, B, C, lo, `(${f1})(${f2})`, `x = ${root1.toLatex()} \\text{ or } x = ${root2.toLatex()}`),
      answerStep(lo, hi, verify),
    ];
    return {
      params: { p, q: qq, r, s },
      prompt: `Solve $${poly(A, B, C)} = 0$. Give both roots, smaller first.`,
      A, B, C, r1: lo, r2: hi, verify, steps,
      extra: [
        // From (2x + 3) = 0 said x = -3 instead of -3/2: the coefficient of x was ignored.
        { id: 'forgot-leading', wrong: tupleAnswer(LABELS, sortedPair(q(-qq), q(-s)), DISPLAY) },
      ],
    };
  }
}

function level5(rng: Rng): Built {
  const form = rng.int(0, 1);
  if (form === 0) {
    // x^2 + b x = c x + d, built from integer roots.
    const [r1, r2] = distinctRoots(rng, -9, 9);
    const bp = -(r1 + r2);
    const cp = r1 * r2;
    const c = rng.nonzero(-9, 9);
    const b = bp + c;
    const d = -cp;
    const orig = (v: string) => `${v}^2 + ${k(b)}*${v} = ${k(c)}*${v} + ${k(d)}`;
    const verify = rootsVerify(1, bp, cp, orig);
    const steps: Step[] = [
      {
        key: 'standard-form',
        instruction: 'Subtract the right side from both sides so one side is 0.',
        math: `${poly(1, b, 0)} = ${linLatex(c, d)} \\;\\Rightarrow\\; ${poly(1, b, 0)} - (${linLatex(c, d)}) = 0 \\;\\Rightarrow\\; ${poly(1, bp, cp)} = 0`,
        why: 'The zero-product rule needs a 0 on one side. Collect like terms after moving everything over.',
        ask: {
          prompt: 'In standard form $x^2 + bx + c = 0$, what is the constant term $c$?',
          answer: numberAnswer(cp),
          verify: { type: 'evaluate', expr: `0 - (${d})` },
        },
      },
      pairStep(bp, cp, -r1, `${poly(1, bp, cp)} = (${fac(r1)})(${fac(r2)})`),
      zeroStep(1, bp, cp, q(r1), `(${fac(r1)})(${fac(r2)})`, `x = ${r1} \\text{ or } x = ${r2}`),
      answerStep(q(r1), q(r2), verify),
    ];
    return {
      params: { form, b, c, d, p: 0, q: 0, k: 0 },
      prompt: `Solve $${poly(1, b, 0)} = ${linLatex(c, d)}$. Give both roots, smaller first.`,
      A: 1, B: bp, C: cp, r1: q(r1), r2: q(r2), verify, steps,
      extra: [],
    };
  }
  // (x + p)(x + q) = k with k != 0
  for (;;) {
    const p = rng.nonzero(-6, 6);
    const qq = rng.nonzero(-6, 6);
    const a1 = rng.nonzero(-9, 9);
    const a2 = -(p + qq) - a1;
    if (a2 === 0 || Math.abs(a2) > 9 || a1 === a2) continue;
    const kk = p * qq - a1 * a2;
    if (kk === 0) continue;
    const [r1, r2] = a1 < a2 ? [a1, a2] : [a2, a1];
    const bp = p + qq;
    const cp = p * qq - kk;
    const orig = (v: string) => `(${v} + ${k(p)})*(${v} + ${k(qq)}) = ${k(kk)}`;
    const verify = rootsVerify(1, bp, cp, orig);
    const steps: Step[] = [
      {
        key: 'standard-form',
        instruction: 'Expand the left side, then subtract the right side so one side is 0.',
        math: `(${fac(-p)})(${fac(-qq)}) = ${kk} \\;\\Rightarrow\\; ${poly(1, bp, p * qq)} = ${kk} \\;\\Rightarrow\\; ${poly(1, bp, cp)} = 0`,
        why: 'You cannot set each factor equal to $k$. Expand and move $k$ over first, so the other side is 0.',
        ask: {
          prompt: 'In standard form $x^2 + bx + c = 0$, what is the constant term $c$?',
          answer: numberAnswer(cp),
          verify: { type: 'evaluate', expr: `(${p})*(${qq}) - (${kk})` },
        },
      },
      pairStep(bp, cp, -r1, `${poly(1, bp, cp)} = (${fac(r1)})(${fac(r2)})`),
      zeroStep(1, bp, cp, q(r1), `(${fac(r1)})(${fac(r2)})`, `x = ${r1} \\text{ or } x = ${r2}`),
      answerStep(q(r1), q(r2), verify),
    ];
    return {
      params: { form, b: 0, c: 0, d: 0, p, q: qq, k: kk },
      prompt: `Solve $(${fac(-p)})(${fac(-qq)}) = ${kk}$. Give both roots, smaller first.`,
      A: 1, B: bp, C: cp, r1: q(r1), r2: q(r2), verify, steps,
      extra: [
        // Set each factor equal to k: x + p = k and x + q = k.
        { id: 'factor-equals-k', wrong: tupleAnswer(LABELS, sortedPair(q(kk - p), q(kk - qq)), DISPLAY) },
      ],
    };
  }
}

// ---------- interpretation ----------

function signQuestion(rng: Rng, b: Built, level: Level): InterpretationQuestion {
  const { A, B, C } = b;
  const mid = b.r1.add(b.r2).div(2);
  const val = mid.mul(mid).mul(A).add(mid.mul(B)).add(C);
  const positive = val.sign() > 0; // equals: A < 0
  const profit = A < 0 && rng.chance(0.5);
  const labelsPlain = ['Positive', 'Negative', 'Zero', 'It depends on the value of $x$'];
  const labelsProfit = ['Positive (a profit)', 'Negative (a loss)', 'Zero (break-even)', 'It depends on the quantity'];
  const labels = profit ? labelsProfit : labelsPlain;
  const options: ChoiceOption[] = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  const correct = options.find((o) => o.label === labels[positive ? 0 : 1])!.id;
  const f = poly(A, B, C, profit ? 'q' : 'x');
  const shape = A > 0 ? 'opens upward (a smile)' : 'opens downward (a frown)';
  void level;
  return {
    prompt: profit
      ? `A firm's profit is $\\pi(q) = ${f}$. For quantities strictly between the two break-even quantities, profit is...`
      : `Between the two roots, the expression $${f}$ is...`,
    options,
    correct,
    explanation: `The parabola ${shape} because the leading coefficient is $${A}$. It crosses zero at the two roots, so between them it is ${positive ? 'above' : 'below'} the axis. Check at the midpoint $x = ${mid.toLatex()}$: the value is $${val.toLatex()}$, which is ${positive ? 'positive' : 'negative'}.`,
  };
}

// ---------- the skill ----------

export const quadraticsFactoring: SkillDefinition = {
  id: ID,
  title: 'Quadratics: factoring',
  track: 'math',
  unit: 'Quadratics',
  description: 'Solve quadratic equations by factoring and the zero-product rule.',
  prerequisites: ['linear-equations'],
  maxDenominator: 5,
  levels: {
    1: { description: 'Monic: x² + bx + c = 0 with integer roots', ranges: { r1: [-9, 9], r2: [-9, 9] } },
    2: { description: 'Difference of squares, or a common factor of x', ranges: { form: [0, 1], k: [0, 12], b: [-12, 12] } },
    3: { description: 'Factor out a common number first', ranges: { a: [-5, 5], r1: [-9, 9], r2: [-9, 9] } },
    4: { description: 'Non-monic: the AC method', ranges: { p: [2, 5], q: [-9, 9], r: [2, 5], s: [-9, 9] } },
    5: {
      description: 'Rearrange to standard form first',
      ranges: { form: [0, 1], b: [-27, 27], c: [-9, 9], d: [-81, 81], p: [-6, 6], q: [-6, 6], k: [-120, 120] },
    },
  },
  misconceptions: {
    'root-sign': {
      name: 'Read the roots off the factors with the wrong sign',
      explanation:
        'In $(x + 3)(x - 2) = 0$ the roots come from $x + 3 = 0$ and $x - 2 = 0$, so $x = -3$ and $x = 2$, not $3$ and $-2$. Set each factor to zero and solve; check by substituting the root back in.',
    },
    'forgot-leading': {
      name: 'Ignored the coefficient in the factor',
      explanation:
        'From $2x + 3 = 0$ you must divide by 2: $x = -\\frac32$, not $-3$. A root is the value that makes the *whole* factor zero, coefficient included.',
    },
    'factor-equals-k': {
      name: 'Set each factor equal to k instead of 0',
      explanation:
        'The zero-product rule only works when the other side is 0. $(x + 2)(x - 3) = 6$ does not mean $x + 2 = 6$. Expand, move everything to one side so it equals 0, then factor.',
    },
  },
  stepLabels: {
    'standard-form': 'Move everything to one side',
    'common-factor': 'Factor out the common factor',
    'difference-of-squares': 'Factor a difference of squares',
    'find-pair': 'Find two numbers that multiply to ac and add to b',
    group: 'Split the middle term and factor by grouping',
    'zero-product': 'Set each factor equal to zero',
    answer: 'State both roots',
  },
  learn: {
    whyItMatters:
      'A firm whose price falls as it sells more has a quadratic profit function, and its roots are the break-even quantities. Take $\\pi(q) = -q^2 + 14q - 40$. Factor out $-1$ and the rest factors too: $\\pi(q) = -(q - 4)(q - 10)$. So the firm breaks even at 4 and 10 units, and in between it makes a profit: $\\pi(7) = 9$. Factoring turns "when is profit zero?" into two easy linear equations, one per factor.',
    summary:
      'To solve a quadratic by factoring: get it into standard form $ax^2 + bx + c = 0$, take out any common factor, find two numbers that multiply to $ac$ and add to $b$, write the factors, and set each one equal to zero. The zero-product rule says a product is zero only if one of its factors is zero.',
    formulas: [
      { latex: 'x^2 + bx + c = (x + m)(x + n)', note: '$m + n = b$ and $mn = c$. The roots are $-m$ and $-n$.' },
      { latex: 'x^2 - k^2 = (x - k)(x + k)', note: 'Difference of squares.' },
      { latex: 'AB = 0 \\;\\Rightarrow\\; A = 0 \\text{ or } B = 0', note: 'Zero-product rule. It needs 0 on the right-hand side.' },
    ],
    example: { seed: 3, level: 4 },
    tips: [
      'The root has the *opposite* sign of the number in the factor: $(x + 3)$ gives $x = -3$.',
      'Check a root by substituting it into the *original* equation, not your factored version.',
    ],
  },

  generate(rng, level) {
    const built = [level1, level2, level3, level4, level5][level - 1](rng);
    const answer = tupleAnswer(LABELS, [built.r1, built.r2], DISPLAY);
    const rootSign: MisconceptionInstance = {
      id: 'root-sign',
      wrong: tupleAnswer(LABELS, sortedPair(built.r1.neg(), built.r2.neg()), DISPLAY),
    };
    const misconceptions = distinctMisconceptions(answer, [rootSign, ...built.extra]);
    // Interpretation randomness is drawn last so earlier draws (and Learn examples) are stable.
    const interpretation = level === 3 || level === 4 ? [signQuestion(rng, built, level)] : undefined;
    return {
      params: built.params,
      prompt: built.prompt,
      answer,
      steps: built.steps,
      misconceptions,
      interpretation,
      verify: built.verify,
    };
  },
};
