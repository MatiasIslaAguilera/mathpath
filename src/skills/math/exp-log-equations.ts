// Exponential & log equations (math). Integer / fraction answers, plus one irrational level (L4).
// Verification of exponential equations pairs the original equation with its logarithm form, so
// SymPy (which also returns complex branches of exponential equations) has a unique real solution.

import { choiceAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { coefLatex, linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'exp-log-equations';

const exprNumber = (value: string, display: string): AnswerSpec => ({ kind: 'number', value, display });

function choice(rng: Rng, correct: string, wrong: string[]): AnswerSpec {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return choiceAnswer(options, 'o0');
}

const lg = (b: number) => `\\log_{${b}}`;

type Body = ReturnType<SkillDefinition['generate']>;

export const expLogEquations: SkillDefinition = {
  id: ID,
  title: 'Exponential & log equations',
  track: 'math',
  unit: 'Exponents & logarithms',
  description: 'Solve equations with the unknown in an exponent or inside a logarithm.',
  prerequisites: ['logarithm-rules'],
  maxDenominator: 6,
  irrationalAnswers: true,
  levels: {
    1: { description: 'Match exponents: b^(x+c) = b^k', ranges: { b: [2, 5], k: [2, 5], c: [-3, 3] } },
    2: {
      description: 'Rewrite both sides in a common base',
      ranges: { form: [0, 2], r: [2, 3], p: [2, 3], q: [1, 6] },
    },
    3: {
      description: 'Log equations: log_b(mx + n) = k',
      ranges: { b: [2, 10], k: [1, 4], m: [-5, 5], x: [-9, 12], n: [-30, 30] },
    },
    4: {
      description: 'Natural exponentials: A e^(kx) = B',
      ranges: { A: [1, 9], B: [2, 60], k: [-4, 4] },
    },
    5: {
      description: 'Two logs, check for an extraneous root',
      ranges: { form: [0, 1], b: [2, 10], k: [1, 4], d: [1, 200], r: [1, 200] },
    },
  },
  misconceptions: {
    'divide-not-log': {
      name: 'Divided the numbers instead of matching exponents',
      explanation:
        'For $4^x = 8$, dividing $8 \\div 4$ gives 2, but that is not the exponent. Write both sides in the same base, $2^{2x} = 2^3$, then set the exponents equal: $2x = 3$, so $x = \\frac32$. Check: $4^{3/2} = 8$.',
    },
    'log-times': {
      name: 'Multiplied the base and the exponent',
      explanation:
        '$\\log_2 x = 5$ means $2^5 = x$, which is $32$, not $2\\cdot 5 = 10$. The log equation says "the power you put on the base to get $x$ is 5", so *raise* the base to that power.',
    },
    'log-power-swapped': {
      name: 'Swapped the base and the exponent',
      explanation:
        '$\\log_2 x = 5$ means $x = 2^5 = 32$, with the *base* being raised to the *answer*. Swapping gives $5^2 = 25$, which is wrong. Check: $\\log_2 32 = 5$.',
    },
    'ln-subtract': {
      name: 'Subtracted instead of dividing after taking logs',
      explanation:
        'After taking $\\ln$ of $e^{2x} = 5$ you get $2x = \\ln 5$. The 2 multiplies $x$, so divide: $x = \\frac{\\ln 5}{2}$, not $\\ln 5 - 2$.',
    },
    'kept-extraneous': {
      name: 'Kept a root that makes a log argument negative',
      explanation:
        'Squaring and solving a quadratic can produce a root that the original equation cannot accept. Logs need positive arguments, so a root that makes any argument $\\le 0$ is *extraneous* and must be thrown out. Always plug the roots back into the original logs.',
    },
  },
  stepLabels: {
    'same-base': 'Rewrite both sides with the same base',
    'equate-exponents': 'Set the exponents equal',
    'exponential-form': 'Rewrite the log as an exponent',
    isolate: 'Isolate the exponential',
    'take-log': 'Take ln of both sides',
    solve: 'Solve for x',
    'combine-logs': 'Combine the logs',
    quadratic: 'Solve the quadratic',
    'check-domain': 'Check the domain (log arguments > 0)',
  },
  learn: {
    whyItMatters:
      'How long until something doubles or halves? Solving $1.07^t = 2$ gives $t = \\frac{\\ln 2}{\\ln 1.07} \\approx 10.2$ years: money growing at 7% doubles in about a decade. Continuous-time growth models in macroeconomics use $e^{gt}$: with growth rate $g = 0.03$, output doubles when $e^{0.03t} = 2$, so $t = \\frac{\\ln 2}{0.03} \\approx 23.1$ years. Both are exponential equations, and logs are the tool that gets the unknown out of the exponent.',
    summary:
      'To solve an equation with the unknown in an exponent, either rewrite both sides with the same base and match exponents, or isolate the exponential and take a log of both sides. To solve a log equation, rewrite it in exponential form: $\\log_b y = k$ means $y = b^k$. When two logs are combined, check every root: log arguments must be positive.',
    formulas: [
      { latex: 'b^u = b^v \\Rightarrow u = v', note: 'Same base: match exponents.' },
      { latex: '\\log_b y = k \\iff y = b^k', note: 'Log form and exponential form.' },
      { latex: 'A e^{kx} = B \\Rightarrow x = \\frac{\\ln(B/A)}{k}', note: 'Isolate, take $\\ln$, divide.' },
      { latex: '\\log_b A + \\log_b B = k \\Rightarrow AB = b^k', note: 'Then check the domain.' },
    ],
    example: { seed: 4, level: 5 },
    tips: [
      'Isolate the exponential *before* taking logs: $3e^{2x} = 30$ becomes $e^{2x} = 10$ first.',
      'After solving a log equation, substitute back. A root that makes an argument zero or negative is not a solution.',
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

// ---------- Level 1: b^(x+c) = b^k ----------

function level1(rng: Rng): Body {
  const b = rng.pick([2, 3, 5]);
  const k = rng.int(2, 5);
  const c = rng.nonzero(-3, 3);
  const N = b ** k;
  const x = k - c;
  const answer = numberAnswer(x);
  const lhs = linLatex(1, c);
  const verify = {
    type: 'solve' as const,
    equations: [`(${b})^(x + ${q(c).toExpr()}) = ${N}`, `(x + ${q(c).toExpr()})*log(${b}) = log(${N})`],
    unknowns: ['x'],
  };
  return {
    params: { b, k, c },
    prompt: `Solve for $x$. $$${b}^{${lhs}} = ${N}$$`,
    answer,
    steps: [
      {
        key: 'same-base',
        instruction: `Write ${N} as a power of ${b}.`,
        math: `${N} = ${b}^{${k}}`,
        why: 'To compare exponents, both sides need the same base.',
        ask: { prompt: `$${N} = ${b}^{?}$. What is the exponent?`, answer: numberAnswer(k), verify: { type: 'evaluate', expr: `log(${N})/log(${b})` } },
      },
      {
        key: 'equate-exponents',
        instruction: 'Same base on both sides, so the exponents must be equal.',
        math: `${lhs} = ${k}`,
        why: 'If $b^u = b^v$ then $u = v$.',
        ask: {
          prompt: 'Which equation do the exponents give?',
          answer: choice(rng, `$${lhs} = ${k}$`, [`$${lhs} = ${N}$`, `$x = ${k}$`]),
        },
      },
      {
        key: 'solve',
        instruction: `Solve for $x$.`,
        math: `x = ${k} ${c > 0 ? '-' : '+'} ${Math.abs(c)} = ${x}`,
        why: `Undo the ${c > 0 ? 'addition' : 'subtraction'} of ${Math.abs(c)}.`,
        ask: { prompt: '$x = \\,?$', answer, verify },
      },
    ],
    misconceptions: [],
    verify,
  };
}

// ---------- Level 2: common base ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 2); // 0: r^p base, r^q rhs; 1: r^q base, r^p rhs; 2: r^p base, r^-q rhs
  const r = rng.pick([2, 3]);
  let p: number;
  let qq: number;
  do {
    p = rng.int(2, 3);
    qq = rng.int(1, 6);
  } while (p === qq);
  const e1 = form === 1 ? qq : p; // exponent of r in the base
  const e2 = form === 0 ? qq : form === 1 ? p : -qq; // exponent of r on the right
  const L = r ** e1;
  const Rq = e2 >= 0 ? q(r ** e2) : q(1, r ** -e2);
  const x = q(e2, e1);
  const answer = numberAnswer(x);
  const rhsLatex = Rq.toLatex();
  const rhsExpr = Rq.isInt() ? `${Rq.n}` : `(${Rq.n}/${Rq.d})`;
  const verify = {
    type: 'solve' as const,
    equations: [`${L}^x = ${rhsExpr}`, `x*log(${L}) = log(${rhsExpr})`],
    unknowns: ['x'],
  };
  const steps: Step[] = [
    {
      key: 'same-base',
      instruction: `Both ${L} and ${Rq.isInt() ? Rq.n : `$${rhsLatex}$`} are powers of ${r}. Write the base ${L} as a power of ${r}.`,
      math: `${L} = ${r}^{${e1}}, \\qquad ${rhsLatex} = ${r}^{${e2}}`,
      why: 'Writing both sides with the same base lets you compare exponents.',
      ask: { prompt: `$${L} = ${r}^{?}$. What is the exponent?`, answer: numberAnswer(e1), verify: { type: 'evaluate', expr: `log(${L})/log(${r})` } },
    },
    {
      key: 'equate-exponents',
      instruction: `Rewrite the equation as $\\left(${r}^{${e1}}\\right)^x = ${r}^{${e2}}$, so $${r}^{${e1}x} = ${r}^{${e2}}$. Set the exponents equal.`,
      math: `${e1}x = ${e2}`,
      why: 'Same base: $b^u = b^v$ gives $u = v$. And $(b^m)^x = b^{mx}$.',
      ask: {
        prompt: `Right side: $${rhsLatex} = ${r}^{?}$. What is the exponent? (Then $${e1}x$ equals it.)`,
        answer: numberAnswer(e2),
        verify: { type: 'evaluate', expr: `log(${rhsExpr})/log(${r})` },
      },
    },
    {
      key: 'solve',
      instruction: `Divide both sides by ${e1}.`,
      math: `x = \\frac{${e2}}{${e1}} = ${x.toLatex()}`,
      why: 'Undo the multiplication by dividing.',
      ask: { prompt: '$x = \\,?$', answer, verify },
    },
  ];
  const mis: (MisconceptionInstance | null)[] = [wrongNumber('divide-not-log', () => Rq.div(L))];
  return {
    params: { form, r, p, q: qq },
    prompt: `Solve for $x$. $$${L}^{x} = ${rhsLatex}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    verify,
  };
}

// ---------- Level 3: log equations ----------

function level3(rng: Rng): Body {
  let b: number, k: number, m: number, x: number, n: number;
  for (;;) {
    b = rng.pick([2, 3, 5, 10]);
    k = rng.int(1, 4);
    m = rng.nonzero(-5, 5);
    x = rng.nonzero(-9, 12);
    const target = b ** k;
    n = target - m * x;
    if (target > 130 || n === 0 || Math.abs(n) > 30) continue;
    break;
  }
  const target = b ** k;
  const answer = numberAnswer(x);
  const inner = linLatex(m, n);
  const innerExpr = `${q(m).toExpr()}*x + ${q(n).toExpr()}`;
  const verify = { type: 'solve' as const, equations: [`log(${innerExpr})/log(${b}) = ${k}`], unknowns: ['x'] };
  const mis: (MisconceptionInstance | null)[] = [
    wrongNumber('log-times', () => q(b * k - n, m)),
    wrongNumber('log-power-swapped', () => q(k ** b - n, m)),
  ];
  return {
    params: { b, k, m, x, n },
    prompt: `Solve for $x$. $$${lg(b)}\\left(${inner}\\right) = ${k}$$`,
    answer,
    steps: [
      {
        key: 'exponential-form',
        instruction: `Rewrite the log as an exponent: the base ${b} raised to ${k} equals the argument.`,
        math: `${inner} = ${b}^{${k}} = ${target}`,
        why: '$\\log_b y = k$ means $y = b^k$.',
        ask: { prompt: `What is $${b}^{${k}}$?`, answer: numberAnswer(target), verify: { type: 'evaluate', expr: `(${b})^(${k})` } },
      },
      {
        key: 'solve',
        instruction: 'Solve the linear equation for $x$.',
        math: `${linLatex(m, 0)} = ${target} ${n > 0 ? '-' : '+'} ${Math.abs(n)} = ${target - n} \\;\\Rightarrow\\; x = ${x}`,
        why: 'Subtract the constant, then divide by the coefficient of $x$.',
        ask: { prompt: '$x = \\,?$', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, mis),
    verify,
  };
}

// ---------- Level 4: A e^(kx) = B ----------

function level4(rng: Rng): Body {
  let A: number, B: number, k: number, val: number;
  for (;;) {
    A = rng.int(1, 9);
    B = rng.int(2, 60);
    k = rng.nonzero(-4, 4);
    if (A === B) continue;
    val = Math.log(B / A) / k;
    if (Math.abs(val) < 0.1) continue;
    break;
  }
  const ratio = q(B, A);
  const ratioLatex = ratio.toLatex();
  const lnRatio = `log(${ratio.toExpr()})`;
  const value = `${lnRatio}/${q(k).toExpr()}`;
  const expLatex = `${coefLatex(q(k))}x`;
  const lhs = `${A === 1 ? '' : A}e^{${expLatex}}`;
  const answer = exprNumber(
    value,
    `\\frac{\\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`}}{${k}} \\approx ${val.toFixed(2)}`,
  );
  const verify = {
    type: 'solve' as const,
    equations: [`${A}*exp(${q(k).toExpr()}*x) = ${B}`, `${q(k).toExpr()}*x = ${lnRatio}`],
    unknowns: ['x'],
  };
  const mis: MisconceptionInstance[] = [
    { id: 'ln-subtract', wrong: exprNumber(`${lnRatio} - ${q(k).toExpr()}`, `\\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`} - ${q(k).toExpr()}`) },
  ];
  return {
    params: { A, B, k },
    prompt: `Solve for $x$. Round to 2 decimal places. $$${lhs} = ${B}$$`,
    answer,
    steps: [
      {
        key: 'isolate',
        instruction: A === 1 ? 'The exponential is already alone.' : `Divide both sides by ${A} to isolate the exponential.`,
        math: `e^{${expLatex}} = ${A === 1 ? B : `\\frac{${B}}{${A}}`}`,
        why: 'Get $e^{(\\cdot)}$ alone before taking a log.',
        ask: { prompt: `What is $\\frac{${B}}{${A}}$ (the right-hand side)?`, answer: numberAnswer(ratio), verify: { type: 'evaluate', expr: `(${B})/(${A})` } },
      },
      {
        key: 'take-log',
        instruction: 'Take $\\ln$ of both sides. $\\ln$ undoes $e^{(\\cdot)}$.',
        math: `${expLatex} = \\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`} \\approx ${Math.log(B / A).toFixed(2)}`,
        why: '$\\ln(e^u) = u$.',
        ask: {
          prompt: `What is $\\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`}$? Round to 2 decimal places.`,
          answer: exprNumber(lnRatio, `\\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`} \\approx ${Math.log(B / A).toFixed(2)}`),
          verify: { type: 'evaluate', expr: lnRatio },
        },
      },
      {
        key: 'solve',
        instruction: `Divide by ${k} to get $x$.`,
        math: `x = \\frac{\\ln ${ratio.isInt() ? ratioLatex : `\\left(${ratioLatex}\\right)`}}{${k}} \\approx ${val.toFixed(2)}`,
        why: 'The coefficient multiplies $x$, so divide (do not subtract).',
        ask: { prompt: '$x = \\,?$ Round to 2 decimal places.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, mis),
    verify,
  };
}

// ---------- Level 5: two logs, extraneous root ----------

/** (b, k, f1, f2): f1 * f2 = b^k with 1 <= f1 < f2 <= 200. */
const L5_CASES: { b: number; k: number; f1: number; f2: number }[] = [];
for (const b of [2, 3, 5, 10]) {
  for (let k = 1; k <= 4; k++) {
    const N = b ** k;
    if (N > 1000) continue;
    for (let f1 = 1; f1 * f1 < N; f1++) {
      if (N % f1 !== 0) continue;
      const f2 = N / f1;
      if (f2 <= 200) L5_CASES.push({ b, k, f1, f2 });
    }
  }
}

function level5(rng: Rng): Body {
  const form = rng.int(0, 1); // 0: log x + log(x - d) = k   1: log(x + d) + log x = k
  const { b, k, f1, f2 } = rng.pick(L5_CASES);
  const d = f2 - f1;
  const r = form === 0 ? f2 : f1; // the valid root
  const e = form === 0 ? f1 : f2; // the extraneous root is -e
  const N = b ** k;
  const answer = numberAnswer(r);
  const lhs =
    form === 0 ? `${lg(b)} x + ${lg(b)}(x - ${d})` : `${lg(b)}(x + ${d}) + ${lg(b)} x`;
  const eqExpr =
    form === 0
      ? `log(x)/log(${b}) + log(x - ${d})/log(${b}) = ${k}`
      : `log(x + ${d})/log(${b}) + log(x)/log(${b}) = ${k}`;
  const verify = { type: 'solve' as const, equations: [eqExpr], unknowns: ['x'] };
  const dx = d === 1 ? 'x' : `${d}x`;
  const quad = form === 0 ? `x^2 - ${dx} - ${N} = 0` : `x^2 + ${dx} - ${N} = 0`;
  const prod = form === 0 ? `x(x - ${d}) = ${N}` : `x(x + ${d}) = ${N}`;
  const rootsLabel = (u: number, v: number) => `$x = ${u}$ or $x = ${v}$`;
  return {
    params: { form, b, k, d, r },
    prompt: `Solve for $x$. $$${lhs} = ${k}$$`,
    answer,
    steps: [
      {
        key: 'combine-logs',
        instruction: 'Add logs of the same base: multiply the arguments, then rewrite as an exponent.',
        math: `${lg(b)}\\big(${form === 0 ? `x(x - ${d})` : `(x + ${d})x`}\\big) = ${k} \\;\\Rightarrow\\; ${prod}`,
        why: '$\\log A + \\log B = \\log(AB)$, and $\\log_b y = k$ means $y = b^k$.',
        ask: { prompt: `What is $${b}^{${k}}$ (the right-hand side of the product equation)?`, answer: numberAnswer(N), verify: { type: 'evaluate', expr: `(${b})^(${k})` } },
      },
      {
        key: 'quadratic',
        instruction: 'Expand and move everything to one side, then solve the quadratic.',
        math: `${quad} \\;\\Rightarrow\\; (x - ${r})(x + ${e}) = 0 \\;\\Rightarrow\\; x = ${r} \\text{ or } x = -${e}`,
        why: 'The roots multiply to $-' + N + '$ and differ by ' + d + '; factor to find them.',
        ask: {
          prompt: `Which are the roots of $${quad}$?`,
          answer: choice(rng, rootsLabel(r, -e), [rootsLabel(-r, e), rootsLabel(r, e), rootsLabel(-r, -e)]),
        },
      },
      {
        key: 'check-domain',
        instruction: 'Plug each root into the original logs. Every argument must be positive.',
        math:
          form === 0
            ? `x = -${e}: \\; \\log_{${b}}(-${e}) \\text{ is undefined.} \\qquad x = ${r}: \\; ${r} > 0 \\text{ and } ${r} - ${d} = ${f1} > 0.`
            : `x = -${e}: \\; \\log_{${b}}(-${e}) \\text{ is undefined.} \\qquad x = ${r}: \\; ${r} > 0 \\text{ and } ${r} + ${d} = ${f2} > 0.`,
        why: 'A log needs a positive argument. A root that breaks that is extraneous.',
        ask: {
          prompt: 'Which root is valid?',
          answer: choice(rng, `$x = ${r}$ only`, [`$x = -${e}$ only`, 'Both roots', 'Neither root']),
        },
      },
      {
        key: 'solve',
        instruction: 'State the solution.',
        math: `x = ${r}`,
        why: 'Only the root that keeps every log argument positive is a solution.',
        ask: { prompt: '$x = \\,?$', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('kept-extraneous', () => -e)]),
    verify,
  };
}
