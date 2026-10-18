// Derivatives of exp and ln (with the chain and product rules). Expression answers verified with
// `diff`; level 5 is the economics punchline: d/dt ln Y = growth rate of Y.

import { expressionAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'derivatives-exp-log';
type Body = ReturnType<SkillDefinition['generate']>;
const c1 = (c: number) => (c === 1 ? '' : c === -1 ? '-' : `${c}`);
const lin = (a: number, b: number) => `${c1(a)}x ${b < 0 ? `- ${-b}` : `+ ${b}`}`;
const linE = (a: number, b: number) => `(${a}*x + (${b}))`;

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

interface Spec {
  params: Record<string, number>;
  fLatex: string;
  fExpr: string;
  ansExpr: string;
  ansLatex: string;
  steps: Step[];
  wrong: (MisconceptionInstance | null)[];
}
const ex = (id: string, value: string, display: string): MisconceptionInstance => ({ id, wrong: expressionAnswer(value, display) });

function body(s: Spec): Body {
  const answer = expressionAnswer(s.ansExpr, s.ansLatex);
  const last = s.steps[s.steps.length - 1];
  last.ask = { prompt: 'So the derivative is?', answer, verify: { type: 'diff', expr: s.fExpr, variable: 'x' } };
  return {
    params: s.params,
    prompt: `Find the derivative of $$f(x) = ${s.fLatex}$$`,
    answer,
    steps: s.steps,
    misconceptions: distinctMisconceptions(answer, s.wrong),
    verify: { type: 'diff', expr: s.fExpr, variable: 'x' },
  };
}

function level1(rng: Rng): Body {
  const c = rng.nonzero(-6, 6);
  if (rng.chance(0.5)) {
    const k = rng.nonzero(-4, 4);
    return body({
      params: { form: 0, c, k },
      fLatex: `${c1(c)}e^{${c1(k)}x}`,
      fExpr: `${c}*exp(${k}*x)`,
      ansExpr: `${c * k}*exp(${k}*x)`,
      ansLatex: `${c1(c * k)}e^{${c1(k)}x}`,
      steps: [
        { key: 'exp-rule', instruction: 'The derivative of $e^u$ is $e^u$ times $u\'$.', math: `\\frac{d}{dx}e^{${c1(k)}x} = e^{${c1(k)}x}\\cdot ${k}`, why: '$e^x$ is its own derivative; the chain rule brings down the inner derivative k.' },
        { key: 'simplify', instruction: 'Multiply by the constant in front.', math: `${c}\\cdot ${k} e^{${c1(k)}x} = ${c1(c * k)}e^{${c1(k)}x}`, why: 'Constants ride along.' },
      ],
      wrong: [ex('exp-forgot-k', `${c}*exp(${k}*x)`, `${c1(c)}e^{${c1(k)}x}`), k === 1 ? ex('exp-power-rule', `${c}*x*exp(x - 1)`, `${c1(c)}xe^{x-1}`) : null],
    });
  }
  return body({
    params: { form: 1, c, k: 0 },
    fLatex: `${c1(c)}\\ln x`,
    fExpr: `${c}*log(x)`,
    ansExpr: `${c}/x`,
    ansLatex: `\\frac{${c}}{x}`,
    steps: [
      { key: 'log-rule', instruction: 'The derivative of $\\ln x$ is $\\frac1x$.', math: `\\frac{d}{dx}\\ln x = \\frac{1}{x}`, why: 'This is the one function whose derivative is 1/x (for x > 0).' },
      { key: 'simplify', instruction: 'Multiply by the constant.', math: `${c}\\cdot\\frac1x = \\frac{${c}}{x}`, why: 'Constants ride along.' },
    ],
    wrong: [],
  });
}

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  const a = rng.int(1, 6);
  const b = rng.int(1, 9); // ax + b > 0 for x > 0 keeps ln defined
  if (form === 0) {
    // ln(kx) = ln k + ln x, so its derivative is 1/x
    const k = rng.int(2, 9);
    return body({
      params: { form, a: k, b: 0 },
      fLatex: `\\ln(${k}x)`,
      fExpr: `log(${k}*x)`,
      ansExpr: `1/x`,
      ansLatex: `\\frac1x`,
      steps: [
        { key: 'log-rule', instruction: 'Use $\\frac{d}{dx}\\ln u = \\frac{u\'}{u}$.', math: `\\frac{${k}}{${k}x}`, why: 'Chain rule for ln.' },
        { key: 'simplify', instruction: 'Simplify.', math: `\\frac{${k}}{${k}x} = \\frac1x`, why: `Also: $\\ln(${k}x) = \\ln ${k} + \\ln x$, and $\\ln ${k}$ is a constant.` },
      ],
      wrong: [ex('ln-k-over-x', `${k}/x`, `\\frac{${k}}{x}`)],
    });
  }
  if (form === 1) {
    return body({
      params: { form, a, b },
      fLatex: `\\ln(${lin(a, b)})`,
      fExpr: `log(${linE(a, b)})`,
      ansExpr: `${a}/${linE(a, b)}`,
      ansLatex: `\\frac{${a}}{${lin(a, b)}}`,
      steps: [
        { key: 'inner-derivative', instruction: 'Inner function and its derivative.', math: `u = ${lin(a, b)}, \\quad u' = ${a}`, why: 'Chain rule needs u′.' },
        { key: 'log-rule', instruction: "Apply $\\frac{d}{dx}\\ln u = \\frac{u'}{u}$.", math: `\\frac{${a}}{${lin(a, b)}}`, why: 'Derivative of ln is 1/u, times u′.' },
      ],
      wrong: [ex('ln-forgot-inner', `1/${linE(a, b)}`, `\\frac{1}{${lin(a, b)}}`)],
    });
  }
  return body({
    params: { form, a, b },
    fLatex: `e^{${lin(a, b)}}`,
    fExpr: `exp(${linE(a, b)})`,
    ansExpr: `${a}*exp(${linE(a, b)})`,
    ansLatex: `${c1(a)}e^{${lin(a, b)}}`,
    steps: [
      { key: 'inner-derivative', instruction: 'Inner function and its derivative.', math: `u = ${lin(a, b)}, \\quad u' = ${a}`, why: 'Chain rule needs u′.' },
      { key: 'exp-rule', instruction: "Apply $\\frac{d}{dx}e^u = e^u u'$.", math: `${c1(a)}e^{${lin(a, b)}}`, why: 'e^u is its own derivative, times u′.' },
    ],
    wrong: [ex('exp-forgot-k', `exp(${linE(a, b)})`, `e^{${lin(a, b)}}`)],
  });
}

function level3(rng: Rng): Body {
  const a = rng.int(1, 4);
  const b = rng.int(-6, 6);
  const ax2 = `${c1(a)}x^2`;
  if (rng.chance(0.5)) {
    const u = `${ax2} ${b < 0 ? `- ${-b}` : `+ ${b}`}x`;
    const uE = `(${a}*x^2 + (${b})*x)`;
    const up = `${2 * a}x ${b < 0 ? `- ${-b}` : `+ ${b}`}`;
    const upE = `(${2 * a}*x + (${b}))`;
    return body({
      params: { form: 0, a, b, c: 0 },
      fLatex: `e^{${u}}`,
      fExpr: `exp(${uE})`,
      ansExpr: `${upE}*exp(${uE})`,
      ansLatex: `(${up})e^{${u}}`,
      steps: [
        { key: 'inner-derivative', instruction: 'Differentiate the exponent.', math: `u = ${u}, \\quad u' = ${up}`, why: 'Power rule on the exponent.' },
        { key: 'exp-rule', instruction: "Multiply: $e^u \\cdot u'$.", math: `(${up})e^{${u}}`, why: 'The exponential stays; the inner derivative comes out front.' },
      ],
      wrong: [ex('exp-forgot-k', `exp(${uE})`, `e^{${u}}`)],
    });
  }
  const c = rng.int(1, 12);
  return body({
    params: { form: 1, a, b: 0, c },
    fLatex: `\\ln(${ax2} + ${c})`,
    fExpr: `log(${a}*x^2 + ${c})`,
    ansExpr: `${2 * a}*x/(${a}*x^2 + ${c})`,
    ansLatex: `\\frac{${2 * a}x}{${ax2} + ${c}}`,
    steps: [
      { key: 'inner-derivative', instruction: 'Inner function and its derivative.', math: `u = ${ax2} + ${c}, \\quad u' = ${2 * a}x`, why: 'Chain rule needs u′.' },
      { key: 'log-rule', instruction: "Apply $\\frac{u'}{u}$.", math: `\\frac{${2 * a}x}{${ax2} + ${c}}`, why: 'Derivative of ln u.' },
    ],
    wrong: [ex('ln-forgot-inner', `1/(${a}*x^2 + ${c})`, `\\frac{1}{${ax2} + ${c}}`)],
  });
}

function level4(rng: Rng): Body {
  if (rng.chance(0.5)) {
    // (ax + b)·e^{kx}
    const a = rng.int(1, 3);
    const b = rng.int(-4, 4);
    const k = rng.nonzero(-4, 4);
    const f1 = lin(a, b);
    const f1E = linE(a, b);
    const ekx = `e^{${c1(k)}x}`;
    return body({
      params: { form: 0, a, b, k, m: 0, c: 0 },
      fLatex: `(${f1})${ekx}`,
      fExpr: `${f1E}*exp(${k}*x)`,
      ansExpr: `${a}*exp(${k}*x) + ${k}*${f1E}*exp(${k}*x)`,
      ansLatex: `${a === 1 ? '' : a}${ekx} + ${c1(k)}(${f1})${ekx}`,
      steps: [
        {
          key: 'product-rule',
          instruction: `Product rule with $f = ${f1}$ and $g = ${ekx}$.`,
          math: `${a}\\cdot ${ekx} + (${f1})\\cdot ${k}${ekx}`,
          why: `$(fg)' = f'g + fg'$, and $g' = ${k}${ekx}$ by the chain rule.`,
        },
        { key: 'simplify', instruction: 'Write it out.', math: `${a === 1 ? '' : a}${ekx} + ${c1(k)}(${f1})${ekx}`, why: `Could also factor out ${ekx}.` },
      ],
      wrong: [ex('exp-forgot-k', `${a}*exp(${k}*x) + ${f1E}*exp(${k}*x)`, `${a === 1 ? '' : a}${ekx} + (${f1})${ekx}`)],
    });
  }
  // c·x^m·ln x  →  c(m x^{m−1} ln x + x^{m−1})
  const c = rng.int(1, 5);
  const m = rng.int(1, 4);
  const xm = m === 1 ? 'x' : `x^{${m}}`;
  const xm1 = m === 1 ? '1' : m === 2 ? 'x' : `x^{${m - 1}}`;
  const coef = c === 1 ? '' : `${c}`;
  return body({
    params: { form: 1, a: 0, b: 0, k: 0, m, c },
    fLatex: `${coef}${xm}\\ln x`,
    fExpr: `${c}*x^${m}*log(x)`,
    ansExpr: `${c * m}*x^${m - 1}*log(x) + ${c}*x^${m - 1}`,
    ansLatex: `${c * m === 1 ? '' : c * m}${m === 1 ? '' : xm1}\\ln x + ${m === 1 ? `${c}` : `${coef}${xm1}`}`,
    steps: [
      {
        key: 'product-rule',
        instruction: `Product rule with $f = ${coef}${xm}$ and $g = \\ln x$.`,
        math: `${c * m}${m === 1 ? '' : xm1}\\ln x + ${coef}${xm}\\cdot\\frac{1}{x}`,
        why: "$(fg)' = f'g + fg'$, with $g' = \\frac1x$.",
      },
      { key: 'simplify', instruction: 'Simplify the second term.', math: `${coef}${xm}\\cdot\\frac1x = ${m === 1 ? `${c}` : `${coef}${xm1}`}`, why: 'Subtract exponents: $x^m / x = x^{m-1}$.' },
    ],
    wrong: [ex('ln-forgot-inner', `${c * m}*x^${m - 1}*log(x)`, `${c * m === 1 ? '' : c * m}${m === 1 ? '' : xm1}\\ln x`)],
  });
}

function level5(rng: Rng): Body {
  // GDP Y(t) = Y0·e^{g t}: d/dt ln Y = g (a growth rate). Or Y = A t^a: d/dt ln Y = a/t.
  if (rng.chance(0.5)) {
    const Y0 = rng.pick([100, 500, 1000, 2000, 5000]);
    const g = rng.pick([1, 2, 3, 4, 5, 6, 8]); // percent
    const answer = numberAnswer(q(g, 100));
    const verify = { type: 'limit' as const, expr: `(log(${Y0}*exp(${g}/100*(5 + h))) - log(${Y0}*exp(${g}/100*5)))/h`, variable: 'h', point: '0' };
    const ch = choice(rng, `Y grows about ${g}% per year`, [`Y grows by ${g} units per year`, `Y doubles every ${g} years`, `Y grows by ${g / 100}% per year`]);
    return {
      params: { form: 0, Y0, g, a: 0, t0: 0 },
      prompt: `Real GDP grows as $Y(t) = ${Y0}e^{${g / 100}t}$ (billions of dollars, $t$ in years). Find $\\frac{d}{dt}\\ln Y(t)$.`,
      answer,
      steps: [
        { key: 'log-rule', instruction: 'Simplify the log first.', math: `\\ln Y = \\ln ${Y0} + ${g / 100}t`, why: '$\\ln(ab) = \\ln a + \\ln b$ and $\\ln e^{u} = u$.' },
        { key: 'evaluate', instruction: 'Differentiate.', math: `\\frac{d}{dt}\\ln Y = ${g / 100}`, why: '$\\ln ' + Y0 + '$ is a constant.', ask: { prompt: '$\\frac{d}{dt}\\ln Y = \\;?$', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('ln-forgot-inner', () => q(1, Y0))]),
      interpretation: [{ prompt: `What does $\\frac{d}{dt}\\ln Y = ${g / 100}$ mean?`, options: ch.options, correct: ch.correct, explanation: '$\\frac{d}{dt}\\ln Y = \\frac{Y\'}{Y}$: the change in Y relative to its size. That is the growth rate, here ' + g + '% per year. This is why growth models and regressions are written in logs.' }],
      verify,
    };
  }
  const A = rng.pick([2, 5, 10, 20]);
  const a = rng.int(1, 4);
  const t0 = rng.int(1, 10);
  const answer = numberAnswer(q(a, t0));
  const verify = { type: 'limit' as const, expr: `(log(${A}*(${t0} + h)^${a}) - log(${A}*${t0}^${a}))/h`, variable: 'h', point: '0' };
  return {
    params: { form: 1, Y0: A, g: 0, a, t0 },
    prompt: `A quantity grows as $Y(t) = ${A}t^{${a}}$. Find the growth rate $\\frac{d}{dt}\\ln Y$ at $t = ${t0}$.`,
    answer,
    steps: [
      { key: 'log-rule', instruction: 'Take logs first.', math: `\\ln Y = \\ln ${A} + ${a}\\ln t`, why: 'Log rules turn the product and power into a sum.' },
      { key: 'evaluate', instruction: 'Differentiate and plug in.', math: `\\frac{d}{dt}\\ln Y = \\frac{${a}}{t} = \\frac{${a}}{${t0}}`, why: '$\\frac{d}{dt}\\ln t = \\frac1t$.', ask: { prompt: `Growth rate at $t = ${t0}$?`, answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('ln-k-over-x', () => q(a * A, t0))]),
    interpretation: [
      (() => {
        const ch = choice(rng, 'It slows down as t grows', ['It stays constant', 'It speeds up as t grows', 'It is always zero']);
        return { prompt: 'What happens to this growth rate over time?', options: ch.options, correct: ch.correct, explanation: `${a}/t shrinks as t grows: power-law growth has a falling growth rate, unlike exponential growth whose rate is constant.` };
      })(),
    ],
    verify,
  };
}

export const derivativesExpLog: SkillDefinition = {
  id: ID,
  title: 'Derivatives of exp & log',
  track: 'math',
  unit: 'Derivatives',
  description: 'Differentiate eˣ and ln x, with the chain and product rules; growth rates.',
  prerequisites: ['derivatives-chain-rule', 'logarithm-rules'],
  maxDenominator: 100,
  levels: {
    1: { description: 'c·eᵏˣ and c·ln x', ranges: { form: [0, 1], c: [-6, 6], k: [-4, 4] } },
    2: { description: 'ln(kx), ln(ax + b), eᵃˣ⁺ᵇ', ranges: { form: [0, 2], a: [1, 9], b: [0, 9] } },
    3: { description: 'Quadratic inside exp or ln', ranges: { form: [0, 1], a: [1, 4], b: [-6, 6], c: [0, 12] } },
    4: { description: 'Products: (ax + b)·eᵏˣ, c·xᵐ·ln x', ranges: { form: [0, 1], a: [0, 3], b: [-4, 4], k: [-4, 4], m: [0, 4], c: [0, 5] } },
    5: { description: 'Growth rates: d/dt ln Y', ranges: { form: [0, 1], Y0: [2, 5000], g: [0, 8], a: [0, 4], t0: [0, 10] } },
  },
  misconceptions: {
    'exp-forgot-k': { name: 'Forgot the derivative of the exponent', explanation: "$\\frac{d}{dx}e^{u} = e^{u}\\cdot u'$. For $e^{3x}$ that's $3e^{3x}$, not $e^{3x}$." },
    'ln-k-over-x': { name: 'Thought d/dx ln(kx) = k/x', explanation: '$\\ln(kx) = \\ln k + \\ln x$, and $\\ln k$ is a constant, so the derivative is just $\\frac1x$. (Chain rule agrees: $\\frac{k}{kx} = \\frac1x$.)' },
    'exp-power-rule': { name: 'Used the power rule on eˣ', explanation: 'The power rule is for $x^n$ (variable base, fixed exponent). In $e^x$ the EXPONENT varies, and $\\frac{d}{dx}e^x = e^x$.' },
    'ln-forgot-inner': { name: "Wrote 1/u without u′", explanation: "$\\frac{d}{dx}\\ln u = \\frac{u'}{u}$: the derivative of the inside goes on top." },
  },
  stepLabels: {
    'exp-rule': 'd/dx eᵘ = eᵘ·u′',
    'log-rule': 'd/dx ln u = u′/u',
    'inner-derivative': 'Differentiate the inside',
    'product-rule': 'Product rule',
    simplify: 'Simplify',
    evaluate: 'Evaluate',
  },
  learn: {
    whyItMatters:
      "In economics the derivative of $\\ln Y$ is $Y$'s growth rate: $\\frac{d}{dt}\\ln Y = \\frac{Y'}{Y}$. If GDP follows $Y = 1000e^{0.03t}$, then $\\ln Y = \\ln 1000 + 0.03t$ and its derivative is $0.03$: 3% growth per year. That's why growth models, log-linear regressions and \"log differences ≈ percent changes\" are everywhere in macro and econometrics.",
    summary: "$\\frac{d}{dx}e^x = e^x$ and $\\frac{d}{dx}\\ln x = \\frac1x$. With an inside function: $\\frac{d}{dx}e^{u} = e^{u}u'$ and $\\frac{d}{dx}\\ln u = \\frac{u'}{u}$.",
    formulas: [
      { latex: "\\frac{d}{dx}e^{u} = e^{u}\\,u'" },
      { latex: "\\frac{d}{dx}\\ln u = \\frac{u'}{u}" },
      { latex: "\\frac{d}{dt}\\ln Y(t) = \\frac{Y'(t)}{Y(t)}", note: 'The growth rate.' },
    ],
    example: { seed: 4, level: 3 },
    tips: ['Simplify logs before differentiating: ln(ab) = ln a + ln b turns hard derivatives into easy ones.'],
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

