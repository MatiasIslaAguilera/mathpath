// Quadratic formula (math). L1 asks for the discriminant (a number); L2-L5 ask for both roots
// (a tuple, smaller first). Irrational roots stay exact in the answer spec
// ("(3 - sqrt(13))/2"); the learner types a decimal rounded to at least two places.

import { numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
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

const ID = 'quadratic-formula';

const isSq = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
const pn = (n: number) => (n < 0 ? `(${n})` : `${n}`); // LaTeX / mathjs: wrap negatives
const sgn = (n: number) => (n < 0 ? '-' : '+');

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

// ---------- exact roots: value (number), expression string (mathjs/SymPy), LaTeX ----------

interface Root {
  v: number;
  e: string;
  tex: string;
}

/**
 * The root  (c0 + s*sqrt(D)) / den   ("frac"), or  c0 + s*sqrt(D)/den   ("sqrtOnly"; the
 * misconception where only the square root is divided). Perfect-square D gives an exact fraction.
 */
function ex(c0: number, s: 1 | -1, D: number, den: number, mode: 'frac' | 'sqrtOnly' = 'frac'): Root {
  if (den < 0) {
    den = -den;
    s = (-s) as 1 | -1;
    if (mode === 'frac') c0 = -c0;
  }
  const sd = Math.sqrt(D);
  const op = s > 0 ? '+' : '-';
  if (isSq(D)) {
    const exact = mode === 'frac' ? q(c0 + s * sd, den) : q(c0 * den + s * sd, den);
    return { v: exact.valueOf(), e: exact.toString(), tex: exact.toLatex() };
  }
  if (mode === 'frac') {
    const v = (c0 + s * sd) / den;
    const numTex = c0 === 0 ? `${s > 0 ? '' : '-'}\\sqrt{${D}}` : `${c0} ${op} \\sqrt{${D}}`;
    return {
      v,
      e: `(${q(c0).toExpr()} ${op} sqrt(${D}))/${q(den).toExpr()}`,
      tex: `\\frac{${numTex}}{${den}} \\approx ${v.toFixed(2)}`,
    };
  }
  const v = c0 + (s * sd) / den;
  const sqTex = `\\frac{\\sqrt{${D}}}{${den}}`;
  return {
    v,
    e: `${q(c0).toExpr()} ${op} sqrt(${D})/${q(den).toExpr()}`,
    tex: `${c0 === 0 ? (s > 0 ? '' : '-') : `${c0} ${op} `}${sqTex} \\approx ${v.toFixed(2)}`,
  };
}

function tuple(labels: string[], display: string[], pair: (s: 1 | -1) => Root): AnswerSpec {
  const [lo, hi] = [pair(-1), pair(1)].sort((x, y) => x.v - y.v);
  return {
    kind: 'tuple',
    labels,
    values: [lo.e, hi.e],
    display: `${display[0]} = ${lo.tex},\\; ${display[1]} = ${hi.tex}`,
  };
}

/** Both roots satisfy the equation, add to -b/a, and r2 - r1 = sqrt(D)/|a| fixes the order. */
function rootsVerify(A: number, B: number, C: number, positive = false): VerifySpec {
  return {
    type: 'solve',
    equations: [
      `${pn(A)}*r1^2 + ${pn(B)}*r1 + ${pn(C)} = 0`,
      `${pn(A)}*r2^2 + ${pn(B)}*r2 + ${pn(C)} = 0`,
      `r1 + r2 = -(${B})/(${A})`,
      `abs(${A})*(r2 - r1) = sqrt(${pn(B)}^2 - 4*${pn(A)}*${pn(C)})`,
    ],
    unknowns: ['r1', 'r2'],
    ...(positive ? { positive: true } : {}),
  };
}

function choice(rng: Rng, labels: string[], correctIndex: number): { options: ChoiceOption[]; correct: string } {
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: options.find((o) => o.label === labels[correctIndex])!.id };
}

type Body = ReturnType<SkillDefinition['generate']>;

// ---------- level 1: the discriminant ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 2); // 0: D > 0, 1: D = 0, 2: D < 0 (chosen first, then params built to hit it)
  let a = 1, b = 0, c = 0;
  for (;;) {
    a = rng.int(1, 5);
    b = rng.int(-12, 12);
    if (form === 1) {
      if (b === 0 || (b * b) % (4 * a) !== 0) continue;
      c = (b * b) / (4 * a);
      if (c > 12) continue;
      break;
    }
    c = rng.int(-12, 12);
    const D = b * b - 4 * a * c;
    if (form === 0 ? D > 0 : D < 0) break;
  }
  const D = b * b - 4 * a * c;
  const answer = numberAnswer(D);
  const verify: VerifySpec = { type: 'evaluate', expr: `${pn(b)}^2 - 4*${pn(a)}*${pn(c)}` };
  const verdict = D > 0 ? 'two real roots' : D === 0 ? 'one real root' : 'no real roots';
  const steps: Step[] = [
    {
      key: 'discriminant',
      instruction: 'Substitute $a$, $b$ and $c$ into $b^2 - 4ac$.',
      math: `D = b^2 - 4ac = ${pn(b)}^2 - 4\\cdot ${a}\\cdot ${pn(c)} = ${b * b} ${sgn(-4 * a * c)} ${Math.abs(4 * a * c)} = ${D}`,
      why: 'Square $b$ first (a negative $b$ gives a positive square), then subtract the product $4ac$ with its sign.',
      ask: { prompt: `$a = ${a},\\; b = ${b},\\; c = ${c}$. What is $D = b^2 - 4ac$?`, answer, verify },
    },
    {
      key: 'answer',
      instruction: `State the discriminant. Since $D ${D > 0 ? '> 0' : D === 0 ? '= 0' : '< 0'}$, the equation has ${verdict}.`,
      math: `D = ${D}`,
      why: 'The sign of $D$ decides how many real roots there are: positive means two, zero means one, negative means none.',
      ask: { prompt: 'State the discriminant $D$.', answer, verify },
    },
  ];
  const misconceptions: MisconceptionInstance[] = distinctMisconceptions(answer, [
    wrongNumber('disc-sign', () => b * b + 4 * a * c),
    wrongNumber('neg-b-squared', () => -(b * b) - 4 * a * c),
  ]);
  const count = D > 0 ? 0 : D === 0 ? 1 : 2;
  const labels = ['Two real solutions', 'Exactly one real solution', 'No real solutions', 'Infinitely many solutions'];
  const iq = choice(rng, labels, count === 0 ? 0 : count === 1 ? 1 : 2);
  const interpretation: InterpretationQuestion[] = [
    {
      prompt: `How many real solutions does $${poly(a, b, c)} = 0$ have?`,
      options: iq.options,
      correct: iq.correct,
      explanation: `$D = ${D}$. ${
        D > 0 ? 'A positive discriminant gives two different real roots.' : D === 0 ? 'A zero discriminant gives exactly one (repeated) root, $x = -b/2a$.' : 'A negative discriminant means $\\sqrt{D}$ is not real, so the parabola never crosses the $x$-axis.'
      }`,
    },
  ];
  return {
    params: { form, a, b, c },
    prompt: `Compute the discriminant $D = b^2 - 4ac$ of $${poly(a, b, c)} = 0$.`,
    answer,
    steps,
    misconceptions,
    interpretation,
    verify,
  };
}

// ---------- levels 2-5: the formula ----------

interface Setup {
  params: Record<string, number>;
  A: number;
  B: number;
  C: number;
  prompt: string;
  labels: string[];
  display: string[];
  /** Equation shown in the identify step. */
  eqTex: string;
}

function formulaLevel(rng: Rng, level: 2 | 3 | 4 | 5, s: Setup): Body {
  const { A, B, C, labels, display } = s;
  const D = B * B - 4 * A * C;
  const sq = isSq(D);
  const roots = (c0: number, d: number, den: number, mode: 'frac' | 'sqrtOnly' = 'frac') =>
    tuple(labels, display, (sg) => ex(c0, sg, d, den, mode));
  const answer = roots(-B, D, 2 * A);
  const verify = rootsVerify(A, B, C, level === 5);
  const smallerExpr = `-(${B})/(2*(${A})) - sqrt(${pn(B)}^2 - 4*${pn(A)}*${pn(C)})/(2*abs(${A}))`;
  const [r1, r2] = [ex(-B, -1, D, 2 * A), ex(-B, 1, D, 2 * A)].sort((x, y) => x.v - y.v);
  const loSpec: AnswerSpec = { kind: 'number', value: r1.e, display: r1.tex };
  const round = sq ? '' : ' Round to 2 decimal places.';

  const steps: Step[] = [
    {
      key: 'identify',
      instruction: `Write the equation as $ax^2 + bx + c = 0$ and read off $a$, $b$ and $c$.`,
      math: `${s.eqTex} \\;\\Rightarrow\\; a = ${A},\\; b = ${B},\\; c = ${C}`,
      why: 'Each coefficient keeps its sign. A missing term has coefficient 0, and $-q^2$ means $a = -1$.',
      ask: {
        prompt: `What is $b$ in $${s.eqTex}$? (Watch the sign.)`,
        answer: numberAnswer(B),
        verify: { type: 'evaluate', expr: `(${B})` },
      },
    },
    {
      key: 'discriminant',
      instruction: 'Compute the discriminant $D = b^2 - 4ac$.',
      math: `D = ${pn(B)}^2 - 4\\cdot ${pn(A)}\\cdot ${pn(C)} = ${B * B} ${sgn(-4 * A * C)} ${Math.abs(4 * A * C)} = ${D}`,
      why: 'If $D > 0$ there are two real roots. Compute it first: it is reused under the square root.',
      ask: {
        prompt: 'What is $D = b^2 - 4ac$?',
        answer: numberAnswer(D),
        verify: { type: 'evaluate', expr: `${pn(B)}^2 - 4*${pn(A)}*${pn(C)}` },
      },
    },
  ];
  if (level === 2) {
    steps.push({
      key: 'sqrt',
      instruction: `Take the square root of $D$.`,
      math: `\\sqrt{${D}} = ${Math.sqrt(D)}`,
      why: 'A perfect-square discriminant means the roots are rational, so the quadratic could also have been factored.',
      ask: {
        prompt: `What is $\\sqrt{${D}}$?`,
        answer: numberAnswer(Math.sqrt(D)),
        verify: { type: 'evaluate', expr: `sqrt(${D})` },
      },
    });
  }
  steps.push({
    key: 'plug-in',
    instruction: `Apply the formula with both signs of the square root.`,
    math: `x = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{-${pn(B)} \\pm \\sqrt{${D}}}{2\\cdot ${pn(A)}} \\;\\Rightarrow\\; ${display[0]} = ${r1.tex},\\; ${display[1]} = ${r2.tex}`,
    why: 'The whole numerator, $-b \\pm \\sqrt{D}$, is divided by $2a$ (not just the square root, and not just by 2).',
    ask: {
      prompt: `What is the **smaller** ${level === 5 ? 'break-even quantity' : 'root'}?${round}`,
      answer: loSpec,
      verify: { type: 'evaluate', expr: smallerExpr },
    },
  });
  steps.push({
    key: 'answer',
    instruction: 'State both roots, smaller first.',
    math: `${display[0]} = ${r1.tex}, \\quad ${display[1]} = ${r2.tex}`,
    why: 'The two roots are the two signs of $\\pm$. Check the sum: it should equal $-b/a$.',
    ask: { prompt: `State both ${level === 5 ? 'quantities' : 'roots'}, smaller first.${round}`, answer, verify },
  });

  const candidates: (MisconceptionInstance | null)[] = [
    D2ok(B * B + 4 * A * C) ? { id: 'disc-sign', wrong: roots(-B, B * B + 4 * A * C, 2 * A) } : null,
    { id: 'minus-b-sign', wrong: roots(B, D, 2 * A) },
    { id: 'divide-only-sqrt', wrong: roots(-B, D, 2 * A, 'sqrtOnly') },
    Math.abs(A) !== 1 ? { id: 'two-not-2a', wrong: roots(-B, D, 2) } : null,
  ];

  const body: Body = {
    params: s.params,
    prompt: s.prompt + (sq ? '' : ' Give decimals rounded to 2 places.'),
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
  if (level === 5) body.interpretation = [profitQuestion(rng, -A, B, -C)];
  return body;
}

const D2ok = (d: number) => d >= 0;

function profitQuestion(rng: Rng, a: number, b: number, c: number): InterpretationQuestion {
  const pi = (n: number) => -a * n * n + b * n - c;
  const top = Math.ceil(b / a) + 3;
  const inside: number[] = [];
  const outside: number[] = [];
  for (let n = 1; n <= top; n++) (pi(n) > 0 ? inside : outside).push(n);
  const good = rng.pick(inside);
  const bad = rng.shuffle(outside).slice(0, 3);
  const labels = [`${good} units`, ...bad.map((n) => `${n} units`)];
  const { options, correct } = choice(rng, labels, 0);
  const r1 = (b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const r2 = (b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return {
    prompt: `At which quantity does the firm earn a positive profit, $\\pi(q) = ${poly(-a, b, -c, 'q')} > 0$?`,
    options,
    correct,
    explanation: `The parabola opens downward, so profit is positive only between the break-even quantities ($${r1.toFixed(2)}$ and $${r2.toFixed(2)}$). At $q = ${good}$: $\\pi = ${pi(good)} > 0$. At $q = ${bad[0]}$: $\\pi = ${pi(bad[0])} \\le 0$.`,
  };
}

// ---------- parameter draws ----------

function level2(rng: Rng): Body {
  for (;;) {
    const a = rng.int(1, 4), b = rng.int(-12, 12), c = rng.int(-12, 12);
    const D = b * b - 4 * a * c;
    if (D <= 0 || !isSq(D)) continue;
    return formulaLevel(rng, 2, {
      params: { a, b, c }, A: a, B: b, C: c,
      prompt: `Solve $${poly(a, b, c)} = 0$ with the quadratic formula. Give the smaller root first.`,
      labels: ['Smaller root', 'Larger root'], display: ['x_1', 'x_2'], eqTex: `${poly(a, b, c)} = 0`,
    });
  }
}

function level3(rng: Rng): Body {
  for (;;) {
    const b = rng.int(-12, 12), c = rng.int(-12, 12);
    const D = b * b - 4 * c;
    if (D <= 0 || isSq(D)) continue;
    return formulaLevel(rng, 3, {
      params: { b, c }, A: 1, B: b, C: c,
      prompt: `Solve $${poly(1, b, c)} = 0$ with the quadratic formula. Give the smaller root first.`,
      labels: ['Smaller root', 'Larger root'], display: ['x_1', 'x_2'], eqTex: `${poly(1, b, c)} = 0`,
    });
  }
}

function level4(rng: Rng): Body {
  for (;;) {
    const a = rng.int(2, 5), b = rng.int(-15, 15), c = rng.int(-12, 12);
    const D = b * b - 4 * a * c;
    if (D <= 0 || isSq(D)) continue;
    return formulaLevel(rng, 4, {
      params: { a, b, c }, A: a, B: b, C: c,
      prompt: `Solve $${poly(a, b, c)} = 0$ with the quadratic formula. Give the smaller root first.`,
      labels: ['Smaller root', 'Larger root'], display: ['x_1', 'x_2'], eqTex: `${poly(a, b, c)} = 0`,
    });
  }
}

function level5(rng: Rng): Body {
  const wantSquare = rng.chance(0.3);
  for (;;) {
    const a = rng.int(1, 3), b = rng.int(2, 30), c = rng.int(1, 60);
    const D = b * b - 4 * a * c;
    if (D <= 0 || isSq(D) !== wantSquare) continue;
    // The profit question needs a whole quantity strictly between the roots.
    let hasInside = false;
    for (let n = 1; n <= Math.ceil(b / a); n++) if (-a * n * n + b * n - c > 0) hasInside = true;
    if (!hasInside) continue;
    const f = poly(-a, b, -c, 'q');
    return formulaLevel(rng, 5, {
      params: { a, b, c }, A: -a, B: b, C: -c,
      prompt: `A firm's profit from producing $q$ units is $\\pi(q) = ${f}$ dollars. Find the break-even quantities, where $\\pi(q) = 0$. Give the smaller quantity first.`,
      labels: ['Smaller quantity', 'Larger quantity'], display: ['q_1', 'q_2'], eqTex: `${f} = 0`,
    });
  }
}

// ---------- the skill ----------

export const quadraticFormula: SkillDefinition = {
  id: ID,
  title: 'Quadratic formula',
  track: 'math',
  unit: 'Quadratics',
  description: 'Use the discriminant and the quadratic formula to solve any quadratic, including break-even problems.',
  prerequisites: ['quadratics-factoring'],
  maxDenominator: 6,
  workingPad: [2, 3, 4, 5],
  irrationalAnswers: true,
  levels: {
    1: { description: 'The discriminant b² − 4ac', ranges: { form: [0, 2], a: [1, 5], b: [-12, 12], c: [-12, 12] } },
    2: { description: 'Perfect-square discriminant: rational roots', ranges: { a: [1, 4], b: [-12, 12], c: [-12, 12] } },
    3: { description: 'Monic with irrational roots', ranges: { b: [-12, 12], c: [-12, 12] } },
    4: { description: 'Non-monic with irrational roots', ranges: { a: [2, 5], b: [-15, 15], c: [-12, 12] } },
    5: { description: 'Break-even quantities from a profit function', ranges: { a: [1, 3], b: [2, 30], c: [1, 60] } },
  },
  misconceptions: {
    'disc-sign': {
      name: 'Added 4ac instead of subtracting',
      explanation:
        'The discriminant is $b^2 - 4ac$, a *subtraction*. For $x^2 - 3x - 4 = 0$: $D = 9 - 4(1)(-4) = 9 + 16 = 25$. The minus sign in front of $4ac$ stays, and $ac$ itself may be negative.',
    },
    'neg-b-squared': {
      name: 'Squared -b as -b²',
      explanation:
        '$(-3)^2 = 9$, not $-9$. Squaring a negative number gives a positive number, so put brackets around $b$ before you square it.',
    },
    'minus-b-sign': {
      name: 'Used +b instead of -b',
      explanation:
        'The formula starts with $-b$. If $b = -5$ then $-b = +5$. Using $b$ directly flips both roots to their negatives. Check a root by substituting it into the equation.',
    },
    'divide-only-sqrt': {
      name: 'Divided only the square root by 2a',
      explanation:
        'The fraction bar covers the whole numerator: $x = \\dfrac{-b \\pm \\sqrt{D}}{2a}$. Dividing only $\\sqrt{D}$ by $2a$ leaves $-b$ undivided. Work out $-b \\pm \\sqrt{D}$ first, then divide.',
    },
    'two-not-2a': {
      name: 'Divided by 2 instead of 2a',
      explanation:
        'The denominator is $2a$, the *product* of 2 and $a$. For $3x^2 + \\dots$ it is 6, not 2. Only when $a = 1$ is $2a = 2$.',
    },
  },
  stepLabels: {
    identify: 'Read off a, b and c',
    discriminant: 'Compute the discriminant',
    sqrt: 'Take the square root',
    'plug-in': 'Apply the formula',
    answer: 'State the answer',
  },
  learn: {
    whyItMatters:
      'Not every profit function factors nicely. Take $\\pi(q) = -q^2 + 10q - 20$. Setting it to zero gives $q^2 - 10q + 20 = 0$, with $D = 100 - 80 = 20$, so the break-even quantities are $5 \\pm \\sqrt{5}$, about $2.76$ and $7.24$ units. Profit is positive between them. The discriminant also tells you at a glance whether break-even exists at all: if $D < 0$, the firm never covers its costs.',
    summary:
      'For $ax^2 + bx + c = 0$, the discriminant $D = b^2 - 4ac$ tells you how many real roots there are: two if $D > 0$, one if $D = 0$, none if $D < 0$. When $D \\ge 0$ the roots are $x = \\dfrac{-b \\pm \\sqrt{D}}{2a}$. If $D$ is a perfect square the roots are rational (and the quadratic factors).',
    formulas: [
      { latex: 'D = b^2 - 4ac', note: 'Positive: two real roots. Zero: one. Negative: none.' },
      { latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      { latex: 'x_1 + x_2 = -\\frac{b}{a}', note: 'A quick check on your two roots.' },
    ],
    example: { seed: 3, level: 3 },
    tips: [
      'Put brackets around negative numbers when you substitute: $b = -5$ gives $(-5)^2 = 25$ and $-b = 5$.',
      'For $-q^2 + 10q - 20$, $a = -1$ and $c = -20$, so $4ac = 80$. You can multiply the whole equation by $-1$ to make $a$ positive first.',
    ],
  },
  generate(rng, level) {
    const body = [level1, level2, level3, level4, level5][level - 1](rng);
    // Both roots, so the working pad can check lines (engine/working.ts). Level 5 is written in q.
    if (body.answer.kind === 'tuple') body.working = { solutions: body.answer.values.map((v) => ({ [level === 5 ? 'q' : 'x']: v })) };
    return body;
  },
};
