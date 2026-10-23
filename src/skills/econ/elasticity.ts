// Price elasticity of demand. Point elasticity is verified as a LIMIT of
// (% change in quantity) / (% change in price), independently of the dQ/dP·P/Q formula taught.
// Interpretation is central: sign, units (none), and what happens to revenue.

import { choiceAnswer, numberAnswer, tupleAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'elasticity';
type Body = ReturnType<SkillDefinition['generate']>;

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}
const pct = (x: Q) => {
  const v = Number(x.abs().valueOf().toFixed(2));
  return `${v}`;
};
const demand = (a: number, b: number) => `Q = ${a} - ${b === 1 ? '' : b}P`;
/** Point elasticity as the limit of the ratio of percentage changes (independent check). */
const pointLimit = (qOfP: (P: string) => string, P0: number) => ({
  type: 'limit' as const,
  expr: `((${qOfP(`(${P0} + h)`)} - ${qOfP(`${P0}`)})/${qOfP(`${P0}`)}) / (h/${P0})`,
  variable: 'h',
  point: '0',
});

type Kind = 'elastic' | 'inelastic' | 'unit';
const kindOf = (e: Q): Kind => (e.abs().valueOf() > 1 ? 'elastic' : e.abs().valueOf() < 1 ? 'inelastic' : 'unit');
const REVENUE: Record<Kind, string> = {
  elastic: 'Revenue falls: quantity drops by a bigger percentage than the price rises',
  inelastic: 'Revenue rises: quantity drops by a smaller percentage than the price rises',
  unit: 'Revenue stays about the same: the two percentage changes cancel',
};

function revenueQuestion(rng: Rng, e: Q): InterpretationQuestion {
  const k = kindOf(e);
  const ch = choice(rng, REVENUE[k], Object.values(REVENUE));
  return {
    prompt: 'If the seller raises the price slightly, what happens to total revenue $P \\times Q$?',
    options: ch.options,
    correct: ch.correct,
    explanation: `|ε| = ${pct(e)} ${k === 'elastic' ? '> 1' : k === 'inelastic' ? '< 1' : '= 1'}. A 1% price rise changes quantity by about ${pct(e)}%. Revenue changes by about (1 − ${pct(e)})% ${k === 'unit' ? '≈ 0' : k === 'elastic' ? '< 0' : '> 0'}.`,
  };
}

function onePercentQuestion(rng: Rng, e: Q): InterpretationQuestion {
  const m = pct(e);
  const ch = choice(rng, `Quantity demanded falls by about ${m}%`, [`Quantity demanded rises by about ${m}%`, `Quantity demanded falls by about ${m} units`, `Price falls by about ${m}%`]);
  return {
    prompt: `The elasticity is $${e.toLatex()}$. If the price rises by 1%, what happens?`,
    options: ch.options,
    correct: ch.correct,
    explanation: 'Elasticity is a ratio of PERCENTAGE changes, so it has no units: it says how many percent quantity changes per 1% change in price. The minus sign means they move in opposite directions (the law of demand).',
  };
}

interface Linear {
  a: number;
  b: number;
  P0: number;
  Q0: number;
  e: Q;
}
function pickLinear(rng: Rng): Linear {
  const b = rng.int(1, 6);
  const Q0 = rng.int(2, 20);
  const P0 = rng.int(1, 30);
  return { a: Q0 + b * P0, b, P0, Q0, e: q(-b * P0, Q0) };
}

function pointSteps(L: Linear, final: Step['ask']): Step[] {
  return [
    {
      key: 'quantity',
      instruction: `Find the quantity at $P = ${L.P0}$.`,
      math: `Q = ${L.a} - ${L.b}\\cdot ${L.P0} = ${L.Q0}`,
      why: 'Elasticity depends on where you are on the curve, so you need both P and Q.',
      ask: { prompt: `$Q$ at $P = ${L.P0}$?`, answer: numberAnswer(L.Q0), verify: { type: 'evaluate', expr: `${L.a} - ${L.b}*${L.P0}` } },
    },
    {
      key: 'slope',
      instruction: 'Find the slope of demand, dQ/dP.',
      math: `\\frac{dQ}{dP} = -${L.b}`,
      why: 'For a linear demand curve the slope is the coefficient on P.',
      ask: { prompt: '$\\frac{dQ}{dP} = \\;?$', answer: numberAnswer(-L.b), verify: { type: 'limit', expr: `((${L.a} - ${L.b}*(${L.P0} + h)) - (${L.a} - ${L.b}*${L.P0}))/h`, variable: 'h', point: '0' } },
    },
    {
      key: 'formula',
      instruction: 'Multiply the slope by P/Q.',
      math: `\\varepsilon = \\frac{dQ}{dP}\\cdot\\frac{P}{Q} = -${L.b}\\cdot\\frac{${L.P0}}{${L.Q0}} = ${L.e.toLatex()}`,
      why: 'Multiplying by P/Q converts the slope (units per dollar) into percent per percent.',
      ask: final,
    },
  ];
}

const linearPrompt = (L: Linear, tail: string) =>
  `Demand for a good is $$${demand(L.a, L.b)}$$ where $P$ is the price in dollars and $Q$ is quantity. ${tail}`;

const linearMisconceptions = (L: Linear): (MisconceptionInstance | null)[] => [
  wrongNumber('inverted-ratio', () => q(-L.b * L.Q0, L.P0)),
  wrongNumber('slope-not-elasticity', () => -L.b),
  wrongNumber('sign-dropped', () => L.e.abs()),
];

function level1(rng: Rng): Body {
  const L = pickLinear(rng);
  const answer = numberAnswer(L.e);
  const verify = pointLimit((P) => `(${L.a} - ${L.b}*${P})`, L.P0);
  return {
    params: { a: L.a, b: L.b, P0: L.P0 },
    prompt: linearPrompt(L, `Find the price elasticity of demand at $P = ${L.P0}$.`),
    answer,
    steps: pointSteps(L, { prompt: '$\\varepsilon = \\;?$', answer, verify }),
    misconceptions: distinctMisconceptions(answer, linearMisconceptions(L)),
    interpretation: [onePercentQuestion(rng, L.e)],
    verify,
  };
}

const CLASSES: Record<Kind, string> = { elastic: 'Elastic (|ε| > 1)', inelastic: 'Inelastic (|ε| < 1)', unit: 'Unit elastic (|ε| = 1)' };

function level2(rng: Rng): Body {
  // Mix the three cases on purpose, including unit elasticity.
  let L = pickLinear(rng);
  if (rng.chance(0.2)) {
    const b = rng.int(1, 6);
    const P0 = rng.int(1, 20);
    L = { a: 2 * b * P0, b, P0, Q0: b * P0, e: q(-1) };
  }
  const k = kindOf(L.e);
  const options: ChoiceOption[] = (['elastic', 'inelastic', 'unit'] as Kind[]).map((id) => ({ id, label: CLASSES[id] }));
  const answer = choiceAnswer(options, k);
  // The classic slip: judging by the slope's size instead of |ε|.
  const bySlope: Kind = L.b > 1 ? 'elastic' : L.b < 1 ? 'inelastic' : 'unit';
  return {
    params: { a: L.a, b: L.b, P0: L.P0 },
    prompt: linearPrompt(L, `At $P = ${L.P0}$, is demand elastic, inelastic, or unit elastic?`),
    answer,
    steps: [
      ...pointSteps(L, { prompt: '$\\varepsilon = \\;?$', answer: numberAnswer(L.e), verify: pointLimit((P) => `(${L.a} - ${L.b}*${P})`, L.P0) }),
      {
        key: 'classify',
        instruction: 'Compare |ε| with 1.',
        math: `|\\varepsilon| = ${L.e.abs().toLatex()} ${k === 'elastic' ? '> 1' : k === 'inelastic' ? '< 1' : '= 1'}`,
        why: 'Elastic means quantity is more responsive than price in percentage terms.',
        ask: { prompt: 'So demand here is…', answer },
      },
    ],
    misconceptions: bySlope !== k ? [{ id: 'elastic-means-steep', wrong: choiceAnswer(options, bySlope) }] : [],
    interpretation: [revenueQuestion(rng, L.e)],
    verify: { type: 'choice', note: 'tests/skills/elasticity.test.ts recomputes |ε| from the raw params' },
  };
}

function level3(rng: Rng): Body {
  // Arc (midpoint) elasticity between two prices on a linear demand curve.
  for (;;) {
    const b = rng.int(1, 6);
    const P1 = rng.int(2, 20);
    const P2 = P1 + rng.int(1, 6);
    const a = b * P2 + rng.int(2, 60);
    const Q1 = a - b * P1;
    const Q2 = a - b * P2;
    const e = q(-b * (P1 + P2), Q1 + Q2);
    if (e.d > 20) continue;
    const answer = numberAnswer(e);
    const verify = { type: 'evaluate' as const, expr: `((${Q2} - ${Q1})/((${Q1} + ${Q2})/2)) / ((${P2} - ${P1})/((${P1} + ${P2})/2))` };
    return {
      params: { a, b, P1, P2 },
      prompt: `Demand is $${demand(a, b)}$. The price rises from \\$${P1} to \\$${P2}. Using the midpoint (arc) method, what is the price elasticity of demand?`,
      answer,
      steps: [
        {
          key: 'quantity',
          instruction: 'Find the quantity at each price.',
          math: `Q_1 = ${a} - ${b}\\cdot ${P1} = ${Q1}, \\qquad Q_2 = ${a} - ${b}\\cdot ${P2} = ${Q2}`,
          why: 'You need both points.',
          ask: { prompt: `Quantity at $P = ${P2}$?`, answer: numberAnswer(Q2), verify: { type: 'evaluate', expr: `${a} - ${b}*${P2}` } },
        },
        {
          key: 'percent-changes',
          instruction: 'Compute each percentage change relative to the MIDPOINT.',
          math: `\\%\\Delta Q = \\frac{${Q2 - Q1}}{${q(Q1 + Q2, 2).toLatex()}}, \\qquad \\%\\Delta P = \\frac{${P2 - P1}}{${q(P1 + P2, 2).toLatex()}}`,
          why: 'Using the midpoint gives the same answer whether the price rises or falls.',
          ask: { prompt: 'What is $\\%\\Delta P$ (as a fraction, using the midpoint)?', answer: numberAnswer(q(P2 - P1).div(q(P1 + P2, 2))), verify: { type: 'evaluate', expr: `(${P2} - ${P1})/((${P1} + ${P2})/2)` } },
        },
        {
          key: 'ratio',
          instruction: 'Divide the percentage changes.',
          math: `\\varepsilon = \\frac{\\%\\Delta Q}{\\%\\Delta P} = ${e.toLatex()}`,
          why: 'Elasticity is % change in quantity per % change in price.',
          ask: { prompt: '$\\varepsilon = \\;?$', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('arc-endpoint-base', () => q(Q2 - Q1, Q1).div(q(P2 - P1, P1))),
        wrongNumber('inverted-ratio', () => q(1).div(e)),
        wrongNumber('sign-dropped', () => e.abs()),
      ]),
      interpretation: [revenueQuestion(rng, e)],
      verify,
    };
  }
}

function level4(rng: Rng): Body {
  // Constant elasticity Q = A P^(−k): ε = −k everywhere.
  const A = rng.pick([100, 200, 500, 1000, 2000]);
  const k = rng.pick([q(1, 2), q(3, 2), q(2), q(1, 4), q(3, 4), q(5, 4), q(3)]);
  const P0 = rng.int(2, 25);
  const e = k.neg();
  const answer = numberAnswer(e);
  const kExpr = k.toString();
  const verify = pointLimit((P) => `(${A}*${P}^(-${kExpr.includes('/') ? `(${kExpr})` : kExpr}))`, P0);
  const kLatex = k.isInt() ? `${k.n}` : `${Number(k.valueOf())}`;
  return {
    params: { A, k: k.valueOf(), P0 },
    prompt: `Demand is $$Q = ${A}P^{-${kLatex}}$$ What is the price elasticity of demand at $P = ${P0}$?`,
    answer,
    steps: [
      {
        key: 'slope',
        instruction: 'Differentiate with the power rule.',
        math: `\\frac{dQ}{dP} = -${kLatex}\\cdot ${A}P^{-${kLatex} - 1}`,
        why: 'Power rule: bring the exponent down, lower it by one.',
      },
      {
        key: 'formula',
        instruction: 'Multiply by P/Q. Almost everything cancels.',
        math: `\\varepsilon = \\frac{dQ}{dP}\\cdot\\frac{P}{Q} = \\frac{-${kLatex}\\cdot ${A}P^{-${kLatex}-1}\\cdot P}{${A}P^{-${kLatex}}} = -${kLatex}`,
        why: `For $Q = AP^{-k}$ the elasticity is $-k$ at EVERY price: "constant elasticity". The price $${P0}$ doesn't matter.`,
        ask: { prompt: '$\\varepsilon = \\;?$', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('sign-dropped', () => k)]),
    interpretation: [onePercentQuestion(rng, e)],
    verify,
  };
}

function level5(rng: Rng): Body {
  // Linear demand: revenue P(a − bP) is maximized at P = a/(2b), where ε = −1.
  const b = rng.int(1, 6);
  const P = rng.int(2, 30);
  const a = 2 * b * P;
  const labels = ['Price', 'Elasticity there'];
  const disp = ['P^*', '\\varepsilon'];
  const answer = tupleAnswer(labels, [P, -1], disp);
  const verify = { type: 'solve' as const, equations: [`${a} - ${2 * b}*P = 0`, `E = -${b}*P/(${a} - ${b}*P)`], unknowns: ['P', 'E'] };
  const ch = choice(rng, 'Revenue would fall: demand is elastic above this price', ['Revenue would rise', 'Revenue would not change', 'It depends on costs']);
  return {
    params: { a, b },
    prompt: `Demand is $${demand(a, b)}$. What price maximizes total revenue, and what is the elasticity at that price?`,
    answer,
    steps: [
      {
        key: 'formula',
        instruction: 'Write revenue as a function of price and differentiate.',
        math: `R(P) = P(${a} - ${b === 1 ? '' : b}P), \\quad R'(P) = ${a} - ${2 * b}P`,
        why: 'Revenue = price × quantity, with quantity read off the demand curve.',
        ask: { prompt: 'What price makes $R\'(P) = 0$?', answer: numberAnswer(P), verify: { type: 'solve', equations: [`${a} - ${2 * b}*P = 0`], unknowns: ['P'] } },
      },
      {
        key: 'evaluate',
        instruction: 'Compute the elasticity at that price.',
        math: `Q = ${a} - ${b}\\cdot ${P} = ${a - b * P}, \\quad \\varepsilon = -${b}\\cdot\\frac{${P}}{${a - b * P}} = -1`,
        why: 'Revenue peaks exactly where demand is unit elastic: below it raising the price raises revenue, above it the opposite.',
        ask: { prompt: 'State the price and the elasticity there.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'revenue-max-at-intercept', wrong: tupleAnswer(labels, [q(a, b), q(0)], disp) }]),
    interpretation: [
      {
        prompt: `What would happen to revenue if the price were raised a bit above \\$${P}?`,
        options: ch.options,
        correct: ch.correct,
        explanation: 'On a linear demand curve |ε| grows as the price rises. Above the revenue-maximizing price demand is elastic, so the lost quantity outweighs the higher price.',
      },
    ],
    verify,
    // Working pad: the elasticity is written e (here not Euler's number), E or ε.
    working: { solutions: [{ P: String(P), e: '-1' }], names: { E: '-1', epsilon: '-1', Q: String(a - b * P), R: String(P * (a - b * P)), TR: String(P * (a - b * P)) } },
  };
}

export const elasticity: SkillDefinition = {
  id: ID,
  title: 'Elasticity',
  track: 'econ',
  unit: 'Supply & demand',
  description: 'Point and arc elasticity, elastic vs inelastic, and what it means for revenue.',
  prerequisites: ['supply-demand-equilibrium', 'derivatives-power-rule'],
  maxDenominator: 20,
  workingPad: [5],
  levels: {
    1: { description: 'Point elasticity of linear demand', ranges: { a: [3, 200], b: [1, 6], P0: [1, 30] } },
    2: { description: 'Elastic, inelastic, or unit elastic?', ranges: { a: [2, 240], b: [1, 6], P0: [1, 30] } },
    3: { description: 'Arc (midpoint) elasticity', ranges: { a: [5, 216], b: [1, 6], P1: [2, 20], P2: [3, 26] } },
    4: { description: 'Constant-elasticity demand', ranges: { A: [100, 2000], k: [0.25, 3], P0: [2, 25] } },
    5: { description: 'Revenue-maximizing price', ranges: { a: [4, 360], b: [1, 6] } },
  },
  misconceptions: {
    'inverted-ratio': { name: 'Inverted the ratio', explanation: 'Elasticity is (% change in QUANTITY) ÷ (% change in PRICE): $\\varepsilon = \\frac{dQ}{dP}\\cdot\\frac{P}{Q}$. Using $Q/P$ or flipping the fraction gives a different number.' },
    'slope-not-elasticity': { name: 'Gave the slope instead of the elasticity', explanation: 'The slope dQ/dP is in units per dollar and changes if you measure price in cents. Elasticity multiplies by P/Q to become unitless (percent per percent).' },
    'sign-dropped': { name: 'Dropped the minus sign', explanation: 'Demand elasticity is negative: price up, quantity down. Economists often quote |ε|, but when asked for ε keep the sign.' },
    'elastic-means-steep': { name: 'Judged elasticity by the slope', explanation: 'A steep or flat slope does not decide it: on the same straight line, demand is elastic at high prices and inelastic at low prices. Compare |ε| = |slope × P/Q| with 1.' },
    'arc-endpoint-base': { name: 'Used an endpoint instead of the midpoint', explanation: 'The midpoint method divides each change by the AVERAGE of the two values, so going up or down gives the same elasticity.' },
    'revenue-max-at-intercept': { name: 'Set quantity to zero', explanation: 'At the price where Q = 0, revenue is 0. Revenue P·Q peaks halfway, where $R\'(P) = 0$ (and |ε| = 1).' },
  },
  stepLabels: {
    quantity: 'Find Q at the price',
    slope: 'Find dQ/dP',
    formula: 'ε = (dQ/dP)·(P/Q)',
    classify: 'Compare |ε| with 1',
    'percent-changes': 'Percent changes (midpoint method)',
    ratio: 'Divide the percent changes',
    evaluate: 'Evaluate',
  },
  learn: {
    whyItMatters:
      'Elasticity is how economists compare responsiveness across goods, from gasoline to restaurant meals, without worrying about units. With $Q = 100 - 2P$ at $P = 20$: $Q = 60$ and $\\varepsilon = -2\\cdot\\frac{20}{60} = -\\frac13$, so demand is inelastic and a price rise would raise revenue. Elasticity decides who bears a tax, whether a price cut pays off, and how big a monopolist\'s markup is. In a log-log regression, the coefficient IS an elasticity.',
    summary:
      'Price elasticity of demand $\\varepsilon = \\frac{dQ}{dP}\\cdot\\frac{P}{Q}$ is the percentage change in quantity per 1% change in price. It is negative and unitless. If $|\\varepsilon| > 1$ demand is elastic and raising the price lowers revenue; if $|\\varepsilon| < 1$ it is inelastic and raising the price raises revenue.',
    formulas: [
      { latex: '\\varepsilon = \\frac{dQ}{dP}\\cdot\\frac{P}{Q}', note: 'Point elasticity.' },
      { latex: '\\varepsilon_{arc} = \\frac{\\Delta Q / \\bar Q}{\\Delta P / \\bar P}', note: 'Midpoint (arc) elasticity: $\\bar Q, \\bar P$ are averages.' },
      { latex: 'Q = AP^{-k} \\Rightarrow \\varepsilon = -k', note: 'Constant elasticity.' },
    ],
    example: { seed: 3, level: 1 },
    tips: ['Same straight demand line: elastic at the top (high P, low Q), inelastic at the bottom.'],
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
