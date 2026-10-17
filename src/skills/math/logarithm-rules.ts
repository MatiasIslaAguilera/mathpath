// Logarithm rules (math). Integer answers at levels 1-4, an irrational (decimal) answer at level 5.
// Logs are verified as `log(x)/log(b)` (natural log), never the two-argument form.

import { choiceAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { checkAnswer, type CheckResult } from '../../engine/checker';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerInput, AnswerSpec, MisconceptionInstance, Problem, SkillDefinition } from '../../engine/types';

const ID = 'logarithm-rules';

/** A number answer whose exact value is an expression (irrational allowed). */
const exprNumber = (value: string, display: string): AnswerSpec => ({ kind: 'number', value, display });

function choice(rng: Rng, correct: string, wrong: string[]): AnswerSpec {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return choiceAnswer(options, 'o0');
}

const isPowerOf = (x: number, b: number): boolean => {
  while (x > 1 && x % b === 0) x /= b;
  return x === 1;
};

const lg = (b: number) => `\\log_{${b}}`;
/** "log_b(x)" in mathjs / SymPy syntax. */
const logb = (x: string | number, b: number) => `log(${x})/log(${b})`;

type Body = ReturnType<SkillDefinition['generate']>;

export const logarithmRules: SkillDefinition = {
  id: ID,
  title: 'Logarithm rules',
  track: 'math',
  unit: 'Exponents & logarithms',
  description: 'Evaluate logs, combine them with the product, quotient and power rules, and change base.',
  prerequisites: ['exponent-rules', 'inverse-functions'],
  maxDenominator: 1,
  irrationalAnswers: true,
  check: checkLevel5Aware,
  levels: {
    1: { description: 'Evaluate log_b of a power of b', ranges: { b: [2, 10], k: [-3, 6] } },
    2: {
      description: 'Natural log and special values',
      ranges: { form: [0, 3], b: [2, 12], k: [-9, 9], m: [2, 20] },
    },
    3: {
      description: 'Product and quotient rules',
      ranges: { form: [0, 1], b: [2, 12], k: [1, 4], A: [2, 1728], B: [2, 1728] },
    },
    4: {
      description: 'Condense to a single log',
      ranges: { b: [2, 10], p: [2, 3], A: [2, 5], B: [2, 9], C: [2, 12] },
    },
    5: {
      description: 'Approximate with ln 2 and ln 3, change of base',
      ranges: { form: [0, 2], a: [0, 4], b: [0, 4], u: [2, 3] },
    },
  },
  misconceptions: {
    'log-of-sum': {
      name: 'Treated log(A + B) as log A + log B',
      explanation:
        'The product rule combines a *sum of logs* into the log of a *product*: $\\log A + \\log B = \\log(AB)$, not $\\log(A+B)$. There is no rule that simplifies $\\log(A+B)$.',
    },
    'log-division-confusion': {
      name: 'Treated log A − log B as log A ÷ log B',
      explanation:
        'Subtracting logs divides the *arguments*: $\\log A - \\log B = \\log\\frac{A}{B}$. Dividing the logs, $\\frac{\\log A}{\\log B}$, is a different number (it is the change-of-base ratio).',
    },
    'power-rule-misplaced': {
      name: 'Multiplied the argument by p instead of raising it to p',
      explanation:
        'A coefficient in front of a log becomes an *exponent* on the argument: $p\\log A = \\log(A^p)$, not $\\log(pA)$. For example $2\\log 5 = \\log 25$, not $\\log 10$.',
    },
    'negative-k-sign': {
      name: 'Lost the sign for a fraction argument',
      explanation:
        'A fraction $\\frac{1}{b^k}$ is $b^{-k}$, so its log is $-k$: $\\log_3\\frac19 = \\log_3 3^{-2} = -2$. Check: $3^{-2} = \\frac19$.',
    },
    'ln-e-confusion': {
      name: 'Thought ln(e^k) = e^k',
      explanation:
        '$\\ln$ is the log with base $e$, so it *undoes* $e^{(\\cdot)}$: $\\ln(e^k) = k$. The answer is the exponent, not $e^k$.',
    },
  },
  stepLabels: {
    'rewrite-power': 'Write the number as a power of the base',
    inverse: 'log and exponent undo each other',
    'product-rule': 'log(A)+log(B) = log(AB)',
    'quotient-rule': 'log(A)−log(B) = log(A/B)',
    'power-rule': 'p·log(A) = log(A^p)',
    'change-base': 'Change of base',
    evaluate: 'Evaluate',
  },
  learn: {
    whyItMatters:
      'Logs turn multiplication into addition and percentage growth into slopes. In econometrics, if $\\ln(\\text{wage})$ rises by 0.05, wages rose about 5% (exactly $e^{0.05} - 1 \\approx 5.1\\%$). In a log-log regression of quantity on price, a coefficient of $-1.5$ is an elasticity: a 1% rise in price lowers quantity demanded by about 1.5%. The rules on this page are what make those readings legitimate.',
    summary:
      '$\\log_b x$ is the exponent you put on $b$ to get $x$, so $\\log_b(b^k) = k$. Logs of products add, logs of quotients subtract, and a coefficient in front of a log becomes an exponent on its argument. $\\ln$ is the log with base $e$. To compute any log from $\\ln$, divide: $\\log_b x = \\frac{\\ln x}{\\ln b}$.',
    formulas: [
      { latex: '\\log_b(b^k) = k, \\quad \\log_b 1 = 0, \\quad \\log_b b = 1' },
      { latex: '\\log_b A + \\log_b B = \\log_b(AB)', note: 'Product rule.' },
      { latex: '\\log_b A - \\log_b B = \\log_b\\frac{A}{B}', note: 'Quotient rule.' },
      { latex: 'p\\log_b A = \\log_b(A^p)', note: 'Power rule.' },
      { latex: '\\log_b x = \\frac{\\ln x}{\\ln b}', note: 'Change of base.' },
      { latex: '\\ln(e^k) = k, \\quad e^{\\ln x} = x' },
    ],
    example: { seed: 5, level: 3 },
    tips: [
      'Always ask: "what power of the base is this number?" Fractions are negative powers.',
      'There is no rule for $\\log(A + B)$. Only products, quotients and powers inside a log can be split.',
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

// ---------- Level 1 ----------

function level1(rng: Rng): Body {
  const b = rng.pick([2, 3, 4, 5, 6, 7, 10]);
  const k = rng.int(-3, 6);
  const pos = b ** Math.abs(k);
  const argLatex = k >= 0 ? `${pos}` : `\\frac{1}{${pos}}`;
  const argExpr = k >= 0 ? `${pos}` : `(1/${pos})`;
  const expr = logb(argExpr, b);
  const answer = numberAnswer(k);
  const mis: (MisconceptionInstance | null)[] = [k < 0 ? wrongNumber('negative-k-sign', () => -k) : null];
  return {
    params: { b, k },
    prompt: `Evaluate. $$${lg(b)} ${argLatex}$$`,
    answer,
    steps: [
      {
        key: 'rewrite-power',
        instruction: `Write ${k >= 0 ? pos : `$\\frac{1}{${pos}}$`} as a power of ${b}.`,
        math: `${argLatex} = ${b}^{${k}}`,
        why: k >= 0 ? 'A log asks "what power of the base gives this number?"' : 'A fraction $\\frac{1}{b^n}$ is $b^{-n}$, a negative power.',
        ask: {
          prompt: `${k >= 0 ? `$${pos}$` : `$\\frac{1}{${pos}}$`} $= ${b}^{?}$. What is the exponent?`,
          answer,
          verify: { type: 'evaluate', expr },
        },
      },
      {
        key: 'inverse',
        instruction: 'A log undoes the power of its own base.',
        math: `${lg(b)}\\left(${b}^{${k}}\\right) = ${k}`,
        why: '$\\log_b(b^k) = k$.',
        ask: { prompt: `So $${lg(b)} ${argLatex} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, mis),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 2 ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 3);
  const b = rng.int(2, 12);
  const k = rng.int(-9, 9);
  const m = rng.int(2, 20);
  const params = { form, b, k, m };
  const kE = q(k).toExpr();

  if (form === 0) {
    const answer = numberAnswer(k);
    const expr = `log(exp(${kE}))`;
    return {
      params,
      prompt: `Evaluate. $$\\ln\\left(e^{${k}}\\right)$$`,
      answer,
      steps: [
        {
          key: 'rewrite-power',
          instruction: '$\\ln$ is the log with base $e$. The argument is already a power of $e$.',
          math: `\\ln\\left(e^{${k}}\\right) = \\log_e\\left(e^{${k}}\\right)`,
          why: '$\\ln x = \\log_e x$.',
          ask: { prompt: `$e^{${k}} = e^{?}$. What is the exponent?`, answer, verify: { type: 'evaluate', expr } },
        },
        {
          key: 'inverse',
          instruction: 'The log undoes the power of its own base.',
          math: `\\ln\\left(e^{${k}}\\right) = ${k}`,
          why: '$\\ln(e^k) = k$.',
          ask: { prompt: `So $\\ln\\left(e^{${k}}\\right) = \\,?$`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'ln-e-confusion', wrong: exprNumber(`exp(${kE})`, `e^{${k}}`) }]),
      verify: { type: 'evaluate', expr },
    };
  }

  if (form === 1) {
    const answer = numberAnswer(m);
    const expr = `exp(log(${m}))`;
    return {
      params,
      prompt: `Evaluate. $$e^{\\ln ${m}}$$`,
      answer,
      steps: [
        {
          key: 'inverse',
          instruction: `$\\ln ${m}$ is the power of $e$ that gives ${m}.`,
          math: `e^{\\ln ${m}} = ${m}`,
          why: 'An exponential and a log with the same base undo each other.',
          ask: {
            prompt: `$e^{\\ln ${m}}$ means: $e$ raised to the power that gives which number?`,
            answer: choice(rng, `$${m}$`, [`$e$`, `$\\ln ${m}$`, `$1$`]),
          },
        },
        {
          key: 'evaluate',
          instruction: 'State the value.',
          math: `e^{\\ln ${m}} = ${m}`,
          why: '$e^{\\ln x} = x$ for $x > 0$.',
          ask: { prompt: `So $e^{\\ln ${m}} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: [],
      verify: { type: 'evaluate', expr },
    };
  }

  if (form === 2) {
    const answer = numberAnswer(0);
    const expr = logb('1', b);
    return {
      params,
      prompt: `Evaluate. $$${lg(b)} 1$$`,
      answer,
      steps: [
        {
          key: 'rewrite-power',
          instruction: `Write 1 as a power of ${b}.`,
          math: `1 = ${b}^{0}`,
          why: 'Any nonzero number to the power 0 is 1.',
          ask: { prompt: `$1 = ${b}^{?}$. What is the exponent?`, answer, verify: { type: 'evaluate', expr } },
        },
        {
          key: 'inverse',
          instruction: 'The log undoes the power.',
          math: `${lg(b)} 1 = ${lg(b)}\\left(${b}^{0}\\right) = 0`,
          why: '$\\log_b 1 = 0$ for every base.',
          ask: { prompt: `So $${lg(b)} 1 = \\,?$`, answer, verify: { type: 'evaluate', expr } },
        },
      ],
      misconceptions: [],
      verify: { type: 'evaluate', expr },
    };
  }

  const answer = numberAnswer(1);
  const expr = logb(b, b);
  return {
    params,
    prompt: `Evaluate. $$${lg(b)} ${b}$$`,
    answer,
    steps: [
      {
        key: 'rewrite-power',
        instruction: `Write ${b} as a power of ${b}.`,
        math: `${b} = ${b}^{1}`,
        why: 'Any number is its own first power.',
        ask: { prompt: `$${b} = ${b}^{?}$. What is the exponent?`, answer, verify: { type: 'evaluate', expr } },
      },
      {
        key: 'inverse',
        instruction: 'The log undoes the power.',
        math: `${lg(b)} ${b} = ${lg(b)}\\left(${b}^{1}\\right) = 1`,
        why: '$\\log_b b = 1$ for every base.',
        ask: { prompt: `So $${lg(b)} ${b} = \\,?$`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: [],
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 3 ----------

function divisorPairs(N: number, b: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = 2; d < N; d++) {
    if (N % d !== 0) continue;
    const e = N / d;
    if (e < 2 || isPowerOf(d, b) || isPowerOf(e, b)) continue;
    out.push([d, e]);
  }
  return out;
}

function level3(rng: Rng): Body {
  const form = rng.int(0, 1); // 0: sum (product rule), 1: difference (quotient rule)
  let b: number;
  let k: number;
  let A: number;
  let B: number;
  if (form === 0) {
    b = rng.pick([6, 10, 12]);
    k = rng.int(2, 3);
    const pairs = divisorPairs(b ** k, b);
    [A, B] = rng.pick(pairs);
  } else {
    for (;;) {
      b = rng.pick([2, 3, 5, 10]);
      k = rng.int(1, 4);
      B = rng.int(3, 12);
      if (b ** k > 100 || isPowerOf(B, b)) continue;
      A = B * b ** k;
      break;
    }
  }
  const answer = numberAnswer(k);
  const op = form === 0 ? '+' : '-';
  const expr = `${logb(A, b)} ${op} ${logb(B, b)}`;
  const arg = form === 0 ? A * B : A / B;
  const mis: (MisconceptionInstance | null)[] =
    form === 0
      ? [{ id: 'log-of-sum', wrong: exprNumber(logb(A + B, b), `${lg(b)} ${A + B}`) }]
      : [{ id: 'log-division-confusion', wrong: exprNumber(`log(${A})/log(${B})`, `\\frac{${lg(b)} ${A}}{${lg(b)} ${B}}`) }];
  return {
    params: { form, b, k, A, B },
    prompt: `Evaluate. $$${lg(b)} ${A} ${op} ${lg(b)} ${B}$$`,
    answer,
    steps: [
      {
        key: form === 0 ? 'product-rule' : 'quotient-rule',
        instruction: form === 0 ? 'Add logs of the same base: multiply the arguments.' : 'Subtract logs of the same base: divide the arguments.',
        math:
          form === 0
            ? `${lg(b)} ${A} + ${lg(b)} ${B} = ${lg(b)}(${A}\\cdot ${B}) = ${lg(b)} ${arg}`
            : `${lg(b)} ${A} - ${lg(b)} ${B} = ${lg(b)}\\frac{${A}}{${B}} = ${lg(b)} ${arg}`,
        why: form === 0 ? '$\\log A + \\log B = \\log(AB)$.' : '$\\log A - \\log B = \\log\\frac{A}{B}$.',
        ask: {
          prompt: form === 0 ? `What is $${A}\\times ${B}$?` : `What is $${A} \\div ${B}$?`,
          answer: numberAnswer(arg),
          verify: { type: 'evaluate', expr: form === 0 ? `(${A})*(${B})` : `(${A})/(${B})` },
        },
      },
      {
        key: 'evaluate',
        instruction: `Write ${arg} as a power of ${b}, then the log is the exponent.`,
        math: `${lg(b)} ${arg} = ${lg(b)}\\left(${b}^{${k}}\\right) = ${k}`,
        why: '$\\log_b(b^k) = k$.',
        ask: { prompt: `So the value is?`, answer, verify: { type: 'evaluate', expr } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, mis),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- Level 4 ----------

function level4(rng: Rng): Body {
  let b: number, p: number, A: number, B: number, C: number, N: number;
  for (;;) {
    b = rng.pick([2, 3, 5, 10]);
    p = rng.int(2, 3);
    A = rng.int(2, 5);
    B = rng.int(2, 9);
    C = rng.int(2, 12);
    const top = A ** p * B;
    if (top % C !== 0) continue;
    N = top / C;
    if (N < 2 || C === A || C === B) continue;
    break;
  }
  const answer = numberAnswer(N);
  const Ap = A ** p;
  const verify = {
    type: 'solve' as const,
    equations: [`${p}*${logb(A, b)} + ${logb(B, b)} - ${logb(C, b)} = ${logb('u', b)}`],
    unknowns: ['u'],
  };
  return {
    params: { b, p, A, B, C },
    prompt: `Write as a single logarithm and enter the argument. $$${p}${lg(b)} ${A} + ${lg(b)} ${B} - ${lg(b)} ${C} = ${lg(b)}(?)$$`,
    answer,
    steps: [
      {
        key: 'power-rule',
        instruction: `Move the coefficient ${p} up as an exponent.`,
        math: `${p}${lg(b)} ${A} = ${lg(b)}\\left(${A}^{${p}}\\right) = ${lg(b)} ${Ap}`,
        why: '$p\\log A = \\log(A^p)$.',
        ask: { prompt: `What is $${A}^{${p}}$?`, answer: numberAnswer(Ap), verify: { type: 'evaluate', expr: `(${A})^(${p})` } },
      },
      {
        key: 'product-rule',
        instruction: 'Adding logs multiplies the arguments.',
        math: `${lg(b)} ${Ap} + ${lg(b)} ${B} = ${lg(b)}(${Ap}\\cdot ${B}) = ${lg(b)} ${Ap * B}`,
        why: '$\\log A + \\log B = \\log(AB)$.',
        ask: { prompt: `What is $${Ap}\\times ${B}$?`, answer: numberAnswer(Ap * B), verify: { type: 'evaluate', expr: `(${A})^(${p})*(${B})` } },
      },
      {
        key: 'quotient-rule',
        instruction: 'Subtracting a log divides the argument.',
        math: `${lg(b)} ${Ap * B} - ${lg(b)} ${C} = ${lg(b)}\\frac{${Ap * B}}{${C}} = ${lg(b)} ${N}`,
        why: '$\\log A - \\log B = \\log\\frac{A}{B}$.',
        ask: { prompt: `What is $${Ap * B} \\div ${C}$? This is the argument of the single log.`, answer, verify: { type: 'evaluate', expr: `(${A})^(${p})*(${B})/(${C})` } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      wrongNumber('log-of-sum', () => p * A + B - C),
      wrongNumber('power-rule-misplaced', () => q(p * A * B, C)),
    ]),
    verify,
  };
}

// ---------- Level 5 ----------

/**
 * Level 5 gives ln 2 ≈ 0.693 and ln 3 ≈ 1.099. A learner who uses those (as told) can land a
 * few thousandths away from the exact value: accept that too, within rounding of their constants.
 */
function checkLevel5Aware(problem: Problem, input: AnswerInput): CheckResult {
  const r = checkAnswer(problem.answer, input);
  if (r.error || r.correct || problem.level !== 5) return r;
  const typed = Number(String(input).trim().replace('−', '-'));
  if (!Number.isFinite(typed)) return r;
  const { form, a, b, u } = problem.params;
  const lnV = a * LN2 + (form === 2 ? -1 : 1) * b * LN3;
  const fromGiven = form === 1 ? lnV / (u === 2 ? LN2 : LN3) : lnV;
  return { correct: Math.abs(typed - fromGiven) <= 0.0051 };
}

const LN2 = 0.693;
const LN3 = 1.099;
const LN2_EXACT = Math.log(2);
const LN3_EXACT = Math.log(3);

function level5(rng: Rng): Body {
  // form 0: ln(2^a 3^b)   form 1: log_u(2^a 3^b)   form 2: ln(2^a / 3^b)
  let form: number, a: number, b: number, u: number;
  for (;;) {
    form = rng.int(0, 2);
    a = rng.int(0, 4);
    b = rng.int(0, 4);
    u = rng.int(2, 3);
    if (a === 0 && b === 0) continue;
    if (form === 2 && (a === 0 || b === 0)) continue;
    const sgn = form === 2 ? -1 : 1;
    const approxNum = a * LN2 + sgn * b * LN3;
    const exactNum = a * LN2_EXACT + sgn * b * LN3_EXACT;
    if (form === 1) {
      // log_u(v) must be irrational: v may not be a power of u.
      if (u === 2 && b === 0) continue;
      if (u === 3 && a === 0) continue;
      const approx = approxNum / (u === 2 ? LN2 : LN3);
      const exact = exactNum / (u === 2 ? LN2_EXACT : LN3_EXACT);
      // The learner uses the given 3-decimal values: every number they type must round the same way.
      if (approx.toFixed(2) !== exact.toFixed(2) || approxNum.toFixed(2) !== exactNum.toFixed(2)) continue;
    } else if (approxNum.toFixed(2) !== exactNum.toFixed(2)) continue;
    break;
  }
  const v = 2 ** a * 3 ** b;
  const sgn = form === 2 ? -1 : 1;
  const lnV = a * LN2_EXACT + sgn * b * LN3_EXACT;
  const t2 = a ? `${a === 1 ? '' : a}\\ln 2` : '';
  const t3 = b ? `${b === 1 ? '' : b}\\ln 3` : '';
  const sumLatex = form === 2 ? `${t2} - ${t3}` : [t2, t3].filter(Boolean).join(' + ');
  // Wrong-but-plausible rewrites for the conceptual choice step (zero terms dropped, duplicates removed).
  const term = (c: number, base: number) => (c ? `${c === 1 ? '' : c}\\ln ${base}` : '');
  const swapped = form === 2 ? `${term(b, 2)} - ${term(a, 3)}` : [term(b, 2), term(a, 3)].filter(Boolean).join(' + ');
  const distractors = [
    form === 2 ? `$${t2} + ${t3}$` : `$(${a} + ${b})\\ln 6$`,
    form === 2 ? `$\\frac{${t2}}{${t3}}$` : `$${a * b > 0 ? `${a * b}\\ln 6` : `${a + b}\\ln 6`}$`,
    form === 2 ? `$(${a} - ${b})\\ln 6$` : `$${swapped}$`,
    `$${a + b}\\ln ${form === 2 ? '2' : '3'}$`,
  ].filter((l) => l !== `$${sumLatex}$`);
  const ap = (c: number, v: string) => (c === 0 ? '' : c === 1 ? v : `${c}(${v})`);
  const approxTerms = form === 2 ? `${ap(a, '0.693')} - ${ap(b, '1.099')}` : [ap(a, '0.693'), ap(b, '1.099')].filter(Boolean).join(' + ');
  const pw = (base: number, e: number) => (e === 1 ? `${base}` : `${base}^{${e}}`);
  const factored = [a ? pw(2, a) : '', b ? pw(3, b) : ''].filter(Boolean).join('\\cdot ');
  const given = 'Use $\\ln 2 \\approx 0.693$ and $\\ln 3 \\approx 1.099$. Round to 2 decimal places.';

  if (form !== 1) {
    const value = `${a}*log(2) ${form === 2 ? '-' : '+'} ${b}*log(3)`;
    const answer = exprNumber(value, `${sumLatex} \\approx ${lnV.toFixed(2)}`);
    const argLatex = form === 2 ? `\\frac{${pw(2, a)}}{${pw(3, b)}}` : factored;
    return {
      params: { form, a, b, u },
      prompt: `${given} $$\\ln\\left(${argLatex}\\right)$$`,
      answer,
      steps: [
        {
          key: 'power-rule',
          instruction:
            form === 2
              ? 'Split the quotient into a difference of logs, then bring each exponent down in front.'
              : 'Split the product into a sum of logs, then bring each exponent down in front.',
          math: `\\ln\\left(${argLatex}\\right) = ${sumLatex}`,
          why: form === 2 ? '$\\ln\\frac{A}{B} = \\ln A - \\ln B$ and $\\ln(A^p) = p\\ln A$.' : '$\\ln(AB) = \\ln A + \\ln B$ and $\\ln(A^p) = p\\ln A$.',
          ask: {
            prompt: `Which expression equals $\\ln\\left(${argLatex}\\right)$?`,
            answer: choice(
              rng,
              `$${sumLatex}$`,
              distractors,
            ),
          },
        },
        {
          key: 'evaluate',
          instruction: 'Substitute the given values and combine.',
          math: `${sumLatex} \\approx ${approxTerms} \\approx ${lnV.toFixed(2)}`,
          why: 'Use the approximations you are given.',
          ask: { prompt: `Evaluate $${sumLatex}$. Round to 2 decimal places.`, answer, verify: { type: 'evaluate', expr: value } },
        },
      ],
      misconceptions: [],
      // The literal log of the original argument: the product/quotient rule is what's being tested.
      verify: { type: 'evaluate', expr: form === 2 ? `log(2^${a}/3^${b})` : `log(2^${a}*3^${b})` },
    };
  }

  const lnu = u === 2 ? LN2_EXACT : LN3_EXACT;
  const ans = lnV / lnu;
  const lnVAnswer = exprNumber(`log(${v})`, `\\ln ${v} \\approx ${lnV.toFixed(2)}`);
  const answer = exprNumber(`log(${v})/log(${u})`, `\\frac{\\ln ${v}}{\\ln ${u}} \\approx ${ans.toFixed(2)}`);
  return {
    params: { form, a, b, u },
    prompt: `${given} $$${lg(u)} ${v}$$`,
    answer,
    steps: [
      {
        key: 'product-rule',
        instruction: `Factor ${v} into 2s and 3s, then use the product and power rules on $\\ln ${v}$.`,
        math: `\\ln ${v} = \\ln\\left(${factored}\\right) = ${sumLatex} \\approx ${lnV.toFixed(2)}`,
        why: '$\\ln(AB) = \\ln A + \\ln B$ and $\\ln(A^p) = p\\ln A$.',
        ask: { prompt: `Find $\\ln ${v}$. Round to 2 decimal places.`, answer: lnVAnswer, verify: { type: 'evaluate', expr: `log(${v})` } },
      },
      {
        key: 'change-base',
        instruction: `Change of base: divide by $\\ln ${u}$.`,
        math: `${lg(u)} ${v} = \\frac{\\ln ${v}}{\\ln ${u}} \\approx \\frac{${lnV.toFixed(2)}}{${lnu.toFixed(2)}} \\approx ${ans.toFixed(2)}`,
        why: '$\\log_b x = \\frac{\\ln x}{\\ln b}$.',
        ask: { prompt: `So $${lg(u)} ${v} \\approx \\,?$ Round to 2 decimal places.`, answer, verify: { type: 'evaluate', expr: logb(v, u) } },
      },
    ],
    misconceptions: [],
    verify: { type: 'evaluate', expr: logb(v, u) },
  };
}
