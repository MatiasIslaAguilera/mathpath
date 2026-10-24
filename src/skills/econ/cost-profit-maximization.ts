// Costs & profit maximization. Marginal cost is verified as a LIMIT (the cost of a tiny extra
// amount of output per unit), independently of the derivative rule the steps teach.

import { numberAnswer, tupleAnswer, wrongNumber } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, InterpretationQuestion, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'cost-profit-maximization';
type Body = ReturnType<SkillDefinition['generate']>;

function choice(rng: Rng, correctLabel: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correctLabel, ...wrong.filter((w, i, a) => w !== correctLabel && a.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}
const money = (x: Q | number) => {
  const v = Q.of(x);
  return v.isInt() ? `\\$${v.n}` : `\\$${Number(v.valueOf().toFixed(2))}`;
};
const coef = (c: number, v = 'q') => (c === 1 ? v : `${c}${v}`);
const tcLatex = (F: number, v: number, w: number) => `TC(q) = ${F} + ${coef(v)} + ${coef(w)}^2`.replace('+ 1q', '+ q');
const tcExpr = (F: number, v: number, w: number, at = 'q') => `(${F} + ${v}*(${at}) + ${w}*(${at})^2)`;

function drawL1(rng: Rng) {
  const F = rng.int(20, 500);
  const v = rng.int(2, 20);
  const w = rng.int(1, 5);
  const q0 = rng.int(3, 30);
  return { F, v, w, q0 };
}

function level1(rng: Rng): Body {
  return buildL1(rng, drawL1(rng));
}

function buildL1(rng: Rng, { F, v, w, q0 }: { F: number; v: number; w: number; q0: number }): Body {
  const mc = v + 2 * w * q0;
  const answer = numberAnswer(mc);
  const tc = F + v * q0 + w * q0 * q0;
  const ac = q(tc, q0);
  const ch = choice(rng, `About ${money(mc)}`, [`About ${money(tc)}`, `About ${money(ac)}`, `About ${money(F)}`]);
  const limitVerify = { type: 'limit' as const, expr: `(${tcExpr(F, v, w, `${q0} + h`)} - ${tcExpr(F, v, w, `${q0}`)})/h`, variable: 'h', point: '0' };
  return {
    params: { F, v, w, q0 },
    prompt: `A firm's total cost (in dollars) of producing $q$ units is $$${tcLatex(F, v, w)}$$ What is the marginal cost at $q = ${q0}$?`,
    answer,
    steps: [
      {
        key: 'mc',
        instruction: 'Marginal cost is the derivative of total cost.',
        math: `MC(q) = TC'(q) = ${v} + ${2 * w}q`,
        why: 'The fixed cost F does not change with output, so it drops out of MC.',
        ask: { prompt: "What is $MC(q)$?", answer: { kind: 'expression', value: `${v} + ${2 * w}*q`, variables: ['q'], display: `${v} + ${2 * w}q` }, verify: { type: 'diff', expr: tcExpr(F, v, w), variable: 'q' } },
      },
      {
        key: 'evaluate',
        instruction: `Evaluate at $q = ${q0}$.`,
        math: `MC(${q0}) = ${v} + ${2 * w}\\cdot ${q0} = ${mc}`,
        why: 'Units: dollars per unit of output.',
        ask: { prompt: `$MC(${q0}) = \\;?$`, answer, verify: limitVerify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('mc-as-ac', () => ac), wrongNumber('tc-as-mc', () => tc)]),
    interpretation: [
      {
        prompt: `What does $MC(${q0}) = ${mc}$ tell you?`,
        options: ch.options.map((o) => ({ ...o, label: o.label === `About ${money(mc)}` ? `Producing unit number ${q0 + 1} costs about ${money(mc)} more` : o.label.replace('About', 'Producing one more unit costs about') })),
        correct: ch.correct,
        explanation: `MC is the extra cost of the next unit, in dollars per unit. It is not the total cost (${money(tc)}) or the average cost (${money(ac)}). The derivative gives it exactly for a tiny change; for a whole extra unit it is a close approximation: $TC(${q0 + 1}) - TC(${q0}) = ${mc + w}$.`,
      },
    ],
    verify: limitVerify,
  };
}

function level2(rng: Rng): Body {
  const q0 = rng.int(2, 20);
  const F = q0 * rng.int(5, 40); // AC comes out whole
  const v = rng.int(2, 20);
  const w = rng.int(1, 4);
  const avc = v + w * q0;
  const ac = F / q0 + avc;
  const mc = v + 2 * w * q0;
  const labels = ['Average cost', 'Average variable cost'];
  const disp = ['AC', 'AVC'];
  const answer = tupleAnswer(labels, [ac, avc], disp);
  return {
    params: { F, v, w, q0 },
    prompt: `Total cost is $$${tcLatex(F, v, w)}$$ (dollars). At $q = ${q0}$, find average cost and average variable cost.`,
    answer,
    steps: [
      {
        key: 'ac',
        instruction: 'Average cost = total cost ÷ output.',
        math: `AC(${q0}) = \\frac{TC(${q0})}{${q0}} = \\frac{${F + v * q0 + w * q0 * q0}}{${q0}} = ${ac}`,
        why: 'Cost per unit, including the fixed cost spread over all units.',
        ask: { prompt: `$AC(${q0}) = \\;?$`, answer: numberAnswer(ac), verify: { type: 'evaluate', expr: `${tcExpr(F, v, w, `${q0}`)}/${q0}` } },
      },
      {
        key: 'avc',
        instruction: 'Average variable cost leaves out the fixed cost.',
        math: `AVC(${q0}) = \\frac{${v}\\cdot ${q0} + ${w}\\cdot ${q0}^2}{${q0}} = ${avc}`,
        why: 'Variable cost is the part of cost that changes with output.',
        ask: { prompt: `State $AC$ and $AVC$ at $q = ${q0}$.`, answer, verify: { type: 'solve', equations: [`A = ${tcExpr(F, v, w, `${q0}`)}/${q0}`, `B = (${tcExpr(F, v, w, `${q0}`)} - ${F})/${q0}`], unknowns: ['A', 'B'] } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      { id: 'fixed-in-avc', wrong: tupleAnswer(labels, [ac, ac], disp) },
      { id: 'mc-as-ac', wrong: tupleAnswer(labels, [mc, avc], disp) },
    ]),
    verify: { type: 'solve', equations: [`A = ${tcExpr(F, v, w, `${q0}`)}/${q0}`, `B = (${tcExpr(F, v, w, `${q0}`)} - ${F})/${q0}`], unknowns: ['A', 'B'] },
    // Working pad: the cost names at q0, as the learner writes them.
    working: { solutions: [{ AC: String(ac), AVC: String(avc) }], names: { q: String(q0), TC: String(ac * q0), VC: String(avc * q0), FC: String(F), MC: String(mc) } },
  };
}

function drawL3(rng: Rng) {
  let w: number, k: number, F: number;
  do {
    w = rng.int(1, 5);
    k = rng.int(3, 25);
    F = rng.int(10, 300);
  } while (w * k * k <= F);
  const v = rng.int(2, 30);
  return { w, k, F, v };
}

function level3(rng: Rng): Body {
  return buildL3(rng, drawL3(rng));
}

function buildL3(rng: Rng, { w, k, F, v }: { w: number; k: number; F: number; v: number }): Body {
  const p = v + 2 * w * k;
  const profit = p * k - (F + v * k + w * k * k);
  const labels = ['Quantity', 'Profit'];
  const disp = ['q^*', '\\pi^*'];
  const answer = tupleAnswer(labels, [k, profit], disp);
  const verify = { type: 'solve' as const, equations: [`${p} = ${v} + ${2 * w}*q`, `R = ${p}*q - ${tcExpr(F, v, w)}`], unknowns: ['q', 'R'] };
  const ch = choice(rng, "Below q*, the next unit's price exceeds its marginal cost, so producing it adds profit", [
    'Price = AC guarantees zero profit, which is the goal',
    'MC is always lower than AC',
    'Setting price = MC minimizes cost',
  ]);
  return {
    params: { p, v, w, F },
    prompt: `A competitive firm can sell any amount at \\$${p} per unit. Its total cost is $$${tcLatex(F, v, w)}$$ Find the profit-maximizing output and the profit.`,
    answer,
    steps: [
      { key: 'mc', instruction: 'Find marginal cost.', math: `MC(q) = ${v} + ${2 * w}q`, why: 'MC = TC′(q).', ask: { prompt: '$MC(q) = \\;?$', answer: { kind: 'expression', value: `${v} + ${2 * w}*q`, variables: ['q'], display: `${v} + ${2 * w}q` }, verify: { type: 'diff', expr: tcExpr(F, v, w), variable: 'q' } } },
      {
        key: 'p-equals-mc',
        instruction: 'A competitive firm produces where price = marginal cost.',
        math: `${p} = ${v} + ${2 * w}q \\;\\Rightarrow\\; q^* = ${k}`,
        why: 'Price is the marginal revenue of a price-taker; profit peaks where MR = MC.',
        ask: { prompt: '$q^* = \\;?$', answer: numberAnswer(k), verify: { type: 'solve', equations: [`${p} = ${v} + ${2 * w}*q`], unknowns: ['q'] } },
      },
      {
        key: 'profit',
        instruction: 'Profit = revenue − total cost (including the fixed cost).',
        math: `\\pi^* = ${p}\\cdot ${k} - (${F} + ${v}\\cdot ${k} + ${w}\\cdot ${k}^2) = ${profit}`,
        why: 'Fixed cost does not move q*, but it is still a cost.',
        ask: { prompt: 'State $q^*$ and the profit.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'profit-forgot-fixed', wrong: tupleAnswer(labels, [k, profit + F], disp) }]),
    interpretation: [
      { prompt: 'Why does the firm set price = marginal cost (not price = average cost)?', options: ch.options, correct: ch.correct, explanation: 'Profit grows as long as the next unit brings in more (the price) than it costs (MC). Beyond q*, MC exceeds the price and each extra unit loses money. Average cost decides whether profit is positive at all, not where it peaks.' },
    ],
    verify,
    // Working pad: P = MC at q*; profit is pi (π), revenue R = TR.
    working: { solutions: [{ q: String(k), pi: String(profit) }], names: { MC: String(p), P: String(p), R: String(p * k), TR: String(p * k), TC: String(F + v * k + w * k * k) } },
  };
}

function level4(rng: Rng): Body {
  const w = rng.int(1, 5);
  const s = rng.int(2, 15);
  const F = w * s * s;
  const v = rng.int(2, 20);
  const minAc = v + 2 * w * s;
  const labels = ['Quantity', 'Minimum average cost'];
  const disp = ['q', 'AC_{min}'];
  const answer = tupleAnswer(labels, [s, minAc], disp);
  const verify = { type: 'solve' as const, equations: [`${v} + ${2 * w}*q = ${F}/q + ${v} + ${w}*q`, `M = ${F}/q + ${v} + ${w}*q`], unknowns: ['q', 'M'], positive: true };
  return {
    params: { F, v, w },
    prompt: `Total cost is $$${tcLatex(F, v, w)}$$ At what output is average cost lowest (the efficient scale), and what is that minimum average cost?`,
    answer,
    steps: [
      { key: 'ac', instruction: 'Write average cost.', math: `AC(q) = \\frac{${F}}{q} + ${v} + ${coef(w)}`, why: 'TC ÷ q.' },
      { key: 'mc', instruction: 'Write marginal cost.', math: `MC(q) = ${v} + ${2 * w}q`, why: 'TC′(q).' },
      {
        key: 'mc-equals-ac',
        instruction: 'AC is lowest where MC crosses it: set MC = AC.',
        math: `${v} + ${2 * w}q = \\frac{${F}}{q} + ${v} + ${coef(w)} \\;\\Rightarrow\\; ${coef(w)} = \\frac{${F}}{q} \\;\\Rightarrow\\; q = ${s}`,
        why: 'If the next unit costs less than the average, the average falls; if more, it rises. So AC bottoms out exactly where MC = AC.',
        ask: { prompt: 'Efficient scale $q = \\;?$', answer: numberAnswer(s), verify: { type: 'solve', equations: [`${v} + ${2 * w}*q = ${F}/q + ${v} + ${w}*q`], unknowns: ['q'], positive: true } },
      },
      {
        key: 'min-ac',
        instruction: 'Evaluate AC there.',
        math: `AC(${s}) = \\frac{${F}}{${s}} + ${v} + ${w}\\cdot ${s} = ${minAc}`,
        why: 'This is the lowest cost per unit the firm can reach; in long-run competitive equilibrium, price is driven down to it.',
        ask: { prompt: 'State the efficient scale and minimum AC.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'forgot-sqrt-scale', wrong: tupleAnswer(labels, [q(F, w), q(F).div(q(F, w)).add(v).add(q(F, w).mul(w))], disp) }]),
    verify,
    // Working pad: at the efficient scale MC = AC.
    working: { solutions: [{ q: String(s), AC: String(minAc) }], names: { MC: String(minAc), TC: String(F + v * s + w * s * s), AVC: String(v + w * s) } },
  };
}

function level5(rng: Rng): Body {
  // TC = F + a q − b q² + c q³; AVC = a − b q + c q² is lowest at q = b/(2c).
  for (;;) {
    const c = rng.int(1, 3);
    const m = rng.int(2, 10);
    const b = 2 * c * m;
    const a = c * m * m + rng.int(2, 40); // minimum AVC is positive
    const F = rng.int(20, 400);
    const minAvc = a - b * m + c * m * m;
    if (minAvc <= 0) continue;
    const labels = ['Output at minimum AVC', 'Shutdown price'];
    const disp = ['q', 'P_{shutdown}'];
    const answer = tupleAnswer(labels, [m, minAvc], disp);
    const verify = { type: 'solve' as const, equations: [`${a} - ${2 * b}*q + ${3 * c}*q^2 = ${a} - ${b}*q + ${c}*q^2`, `S = ${a} - ${b}*q + ${c}*q^2`], unknowns: ['q', 'S'], positive: true };
    const mcMinQ = q(b, 3 * c);
    const mcMin = q(a).sub(mcMinQ.mul(2 * b)).add(mcMinQ.mul(mcMinQ).mul(3 * c));
    const ch = choice(rng, 'Shut down: produce nothing, and lose only the fixed cost', [
      'Keep producing as long as price covers marginal cost',
      'Raise its price above the market price',
      'Produce more to spread the fixed cost',
    ]);
    const steps: Step[] = [
      { key: 'avc', instruction: 'Average variable cost: drop the fixed cost and divide by q.', math: `AVC(q) = ${a} - ${b}q + ${coef(c)}^2`, why: 'In the short run the fixed cost is paid whether or not the firm produces, so only variable cost matters for the shutdown decision.' },
      {
        key: 'min-avc',
        instruction: "Minimize AVC: set its derivative to zero.",
        math: `AVC'(q) = -${b} + ${2 * c}q = 0 \\;\\Rightarrow\\; q = ${m}`,
        why: '(Equivalently, MC crosses AVC at its minimum.)',
        ask: { prompt: 'At what $q$ is AVC lowest?', answer: numberAnswer(m), verify: { type: 'solve', equations: [`-${b} + ${2 * c}*q = 0`], unknowns: ['q'] } },
      },
      {
        key: 'evaluate',
        instruction: 'The shutdown price is that minimum AVC.',
        math: `AVC(${m}) = ${a} - ${b}\\cdot ${m} + ${c}\\cdot ${m}^2 = ${minAvc}`,
        why: 'Below this price, revenue cannot even cover variable costs, so producing loses more than shutting down.',
        ask: { prompt: 'State the output and the shutdown price.', answer, verify },
      },
    ];
    const mis: (MisconceptionInstance | null)[] = [
      { id: 'fixed-in-avc', wrong: tupleAnswer(labels, [m, q(F, m).add(minAvc)], disp) },
      { id: 'min-mc-instead', wrong: tupleAnswer(labels, [mcMinQ, mcMin], disp) },
    ];
    const interp: InterpretationQuestion = {
      prompt: `If the market price falls below \\$${minAvc}, what should the firm do in the short run?`,
      options: ch.options,
      correct: ch.correct,
      explanation: `Below minimum AVC (\\$${minAvc}), every unit sold loses money on top of the fixed cost. Shutting down limits the loss to the fixed cost (\\$${F}). Above it, producing covers the variable costs and some of the fixed cost, so it's better than shutting down, even at a loss.`,
    };
    return {
      params: { F, a, b, c },
      prompt: `A firm's total cost is $$TC(q) = ${F} + ${a}q - ${b}q^2 + ${coef(c)}^3$$ Find the output where average variable cost is lowest, and the shutdown price.`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, mis),
      interpretation: [interp],
      verify,
      // Working pad: at minimum AVC, MC = AVC, and that value is the shutdown price.
      working: { solutions: [{ q: String(m), P: String(minAvc) }], names: { AVC: String(minAvc), MC: String(minAvc), S: String(minAvc) } },
    };
  }
}

// ---------- story variants: the cost function from a description ----------

interface Setting {
  firm: string;
  many: string;
  one: string;
  mat: string;
  place: string;
}
const SETTINGS: Setting[] = [
  { firm: 'A print shop', many: 'posters', one: 'poster', mat: 'Paper and ink', place: 'shop' },
  { firm: 'A pottery studio', many: 'mugs', one: 'mug', mat: 'Clay and glaze', place: 'studio' },
  { firm: 'A small bakery', many: 'loaves', one: 'loaf', mat: 'Flour and yeast', place: 'kitchen' },
];

/** The cost function in words: rent, materials per unit, a crowding cost on the square of output. */
const costWords = (s: Setting, F: number, v: number, w: number) =>
  `${s.firm} pays ${money(F)} a month in rent whatever it makes. ${s.mat} cost ${money(v)} per ${s.one}, and crowding the ${s.place} adds ${money(w)} times the square of the number of ${s.many} made.`;

/** The cost function when the story gives rent and average variable cost. */
const avgWords = (s: Setting, F: number, v: number, w: number) =>
  `${s.firm} pays ${money(F)} a month in rent whatever it makes. Its average variable cost is $${v} + ${coef(w)}$ dollars per ${s.one} when $q$ ${s.many} are made in a month.`;

function setupQ(key: string, prompt: string, math: string, display: string, value: string, why: string): Step {
  return {
    key,
    instruction: prompt,
    math,
    why,
    ask: { prompt, answer: { kind: 'expression', value, variables: ['q'], display }, verify: { type: 'equivalent', expr: value, variables: ['q'] } },
  };
}

/** A story's setup steps, then the level's own steps; misreadings go before the body's. */
function tell(body: Body, prompt: string, setup: Step[], mis: (MisconceptionInstance | null)[]): Body {
  return {
    ...body,
    prompt,
    steps: [...setup, ...body.steps],
    misconceptions: distinctMisconceptions(body.answer, [...mis, ...body.misconceptions]),
  };
}

const TC_WHY = 'Total cost adds the fixed cost, the cost per unit times $q$, and the crowding term: $w$ times $q^2$.';

function storyL1(rng: Rng): Body {
  const pattern = rng.int(0, 2);
  const d = drawL1(rng);
  const { F, v, w, q0 } = d;
  const s = rng.pick(SETTINGS);
  const body = buildL1(rng, d);
  const tcRhs = `${F} + ${coef(v)} + ${coef(w)}^2`;
  const tcValue = `${F} + ${v}*q + ${w}*q^2`;
  const letQ = `Let $q$ be the number of ${s.many} made in a month.`;
  if (pattern === 2) {
    const value = `${F} + q*(${v} + ${w}*q)`;
    const display = `${F} + q(${v} + ${coef(w)})`;
    return tell(
      body,
      `${avgWords(s, F, v, w)} What is the marginal cost when ${q0} ${s.many} are made in a month?`,
      [setupQ('setup-average', `${letQ} Write the total cost, in dollars, in terms of $q$.`, `TC(q) = ${display}`, display, value, 'Total variable cost is the average variable cost times the quantity, $q(v + wq)$. Add the fixed rent. The result is the same cost function, so marginal cost is its derivative.')],
      [wrongNumber('avc-as-tvc', () => w)],
    );
  }
  if (pattern === 1) {
    return tell(
      body,
      `${costWords(s, F, v, w)} The ${s.place} now makes ${q0} ${s.many} a month. About how much does it cost to make one more ${s.one}?`,
      [setupQ('setup-next', `${letQ} Write the total cost, in dollars, in terms of $q$.`, `TC(q) = ${tcRhs}`, tcRhs, tcValue, TC_WHY)],
      [],
    );
  }
  return tell(
    body,
    `${costWords(s, F, v, w)} What is the marginal cost when ${q0} ${s.many} are made in a month?`,
    [setupQ('setup-words', `${letQ} Write the total cost, in dollars, in terms of $q$.`, `TC(q) = ${tcRhs}`, tcRhs, tcValue, TC_WHY)],
    [],
  );
}

function storyL3(rng: Rng): Body {
  const pattern = rng.int(0, 2);
  const d = drawL3(rng);
  const { w, k, F, v } = d;
  const p = v + 2 * w * k;
  const s = rng.pick(SETTINGS);
  const S = rng.int(40, 400);
  const body = buildL3(rng, d);
  const tcRhs = `${F} + ${coef(v)} + ${coef(w)}^2`;
  const tcValue = `${F} + ${v}*q + ${w}*q^2`;
  const letQ = `Let $q$ be the number of ${s.many} made in a month.`;
  const sell = `It can sell any number of ${s.many} at ${money(p)} each.`;
  const ask = 'Find the profit-maximizing output and the profit.';
  if (pattern === 2) {
    const profit = p * k - (F + v * k + w * k * k);
    const labels = ['Quantity', 'Profit'];
    const disp = ['q^*', '\\pi^*'];
    const value = `${p}*q - (${F} + ${v}*q + ${w}*q^2)`;
    const display = `${p}q - (${tcRhs})`;
    return tell(
      body,
      `${costWords(s, F, v, w)} ${sell} Last year it spent ${money(S)} on a market study. ${ask}`,
      [setupQ('setup-sunk', `${letQ} Write this month's profit, in dollars, in terms of $q$.`, `\\pi(q) = ${display}`, display, value, `Profit is revenue minus cost. The ${money(S)} market study was paid last year and cannot be undone, so it does not enter this month's profit or the choice of $q$.`)],
      [{ id: 'sunk-cost-counted', wrong: tupleAnswer(labels, [k, profit - S], disp) }],
    );
  }
  if (pattern === 1) {
    return tell(
      body,
      `${avgWords(s, F, v, w)} ${sell} ${ask}`,
      [setupQ('setup-average', `${letQ} Write the total cost, in dollars, in terms of $q$.`, `TC(q) = ${F} + q(${v} + ${coef(w)})`, `${F} + q(${v} + ${coef(w)})`, `${F} + q*(${v} + ${w}*q)`, 'Total variable cost is the average variable cost times the quantity, $q(v + wq)$. Add the fixed rent.')],
      [],
    );
  }
  return tell(
    body,
    `${costWords(s, F, v, w)} ${sell} ${ask}`,
    [setupQ('setup-words', `${letQ} Write the total cost, in dollars, in terms of $q$.`, `TC(q) = ${tcRhs}`, tcRhs, tcValue, TC_WHY)],
    [],
  );
}

export const costProfitMaximization: SkillDefinition = {
  id: ID,
  title: 'Costs & profit maximization',
  track: 'econ',
  unit: 'Firms',
  description: 'Marginal and average cost, price = MC, efficient scale, and the shutdown rule.',
  prerequisites: ['derivatives-power-rule', 'optimization'],
  maxDenominator: 4,
  workingPad: [2, 3, 4, 5],
  levels: {
    1: { description: 'Marginal cost', ranges: { F: [20, 500], v: [2, 20], w: [1, 5], q0: [3, 30] } },
    2: { description: 'Average and average variable cost', ranges: { F: [10, 800], v: [2, 20], w: [1, 4], q0: [2, 20] } },
    3: { description: 'Competitive firm: price = MC', ranges: { p: [8, 280], v: [2, 30], w: [1, 5], F: [10, 300] } },
    4: { description: 'Efficient scale: MC = AC', ranges: { F: [4, 1125], v: [2, 20], w: [1, 5] } },
    5: { description: 'Shutdown price: minimum AVC', ranges: { F: [20, 400], a: [6, 340], b: [4, 60], c: [1, 3] } },
  },
  misconceptions: {
    'mc-as-ac': { name: 'Used average cost as marginal cost', explanation: 'Average cost is total cost per unit; marginal cost is the cost of the NEXT unit (the derivative of total cost). They are equal only at the bottom of the AC curve.' },
    'tc-as-mc': { name: 'Gave total cost instead of marginal cost', explanation: 'TC(q) is the cost of all q units. Marginal cost is how much TC rises for one more unit: $MC = TC\'(q)$.' },
    'fixed-in-avc': { name: 'Included the fixed cost in AVC', explanation: 'Average VARIABLE cost leaves out the fixed cost. AC = AVC + F/q.' },
    'profit-forgot-fixed': { name: 'Left the fixed cost out of profit', explanation: "The fixed cost doesn't change the best quantity (its derivative is zero), but profit = revenue − ALL costs." },
    'forgot-sqrt-scale': { name: 'Forgot the square root', explanation: '$wq = \\frac{F}{q}$ gives $q^2 = F/w$, so $q = \\sqrt{F/w}$.' },
    'avc-as-tvc': { name: 'Treated average variable cost as total variable cost', explanation: 'An average is per unit. If average variable cost is $v + wq$ dollars per unit, total variable cost is that times $q$: $q(v + wq)$. Differentiate the total, not the average.' },
    'sunk-cost-counted': { name: 'Subtracted a sunk cost from profit', explanation: 'Money already spent on the market study is gone whatever the firm does now. It is not a cost of producing this month, so it does not change profit or the best quantity.' },
    'min-mc-instead': { name: 'Used the minimum of MC instead of the minimum of AVC', explanation: 'The shutdown point is the bottom of the AVC curve, where MC crosses AVC from below. MC bottoms out earlier, at a lower output and a lower cost.' },
  },
  stepLabels: {
    mc: 'Marginal cost = TC′(q)',
    evaluate: 'Evaluate',
    ac: 'Average cost = TC/q',
    avc: 'Average variable cost = VC/q',
    'p-equals-mc': 'Set price = MC',
    profit: 'Profit = revenue − cost',
    'mc-equals-ac': 'MC = AC at the bottom of AC',
    'min-ac': 'Evaluate minimum AC',
    'min-avc': 'Find minimum AVC',
    'setup-words': 'Write the cost function from the description',
    'setup-next': 'Write the cost function from the description',
    'setup-average': 'Write total cost from average variable cost',
    'setup-sunk': 'Write profit (leaving out the sunk cost)',
  },
  learn: {
    whyItMatters:
      '"Produce until marginal revenue equals marginal cost" is the most-used rule in micro theory. With $TC(q) = 100 + 10q + q^2$, marginal cost is $MC = 10 + 2q$; a competitive firm selling at \\$50 sets $50 = 10 + 2q$, so $q = 20$, earning $50\\cdot 20 - (100 + 200 + 400) = 300$ dollars. Monopoly, Cournot competition and cost minimization all build on these same curves.',
    summary:
      'Marginal cost is the derivative of total cost; average cost is total cost per unit; average variable cost leaves out fixed cost. A price-taking firm produces where price = MC. AC is lowest where MC = AC. In the short run a firm shuts down if the price is below minimum AVC.',
    formulas: [
      { latex: "MC(q) = TC'(q), \\quad AC(q) = \\frac{TC(q)}{q}, \\quad AVC(q) = \\frac{VC(q)}{q}" },
      { latex: 'P = MC(q^*)', note: 'Competitive profit maximization.' },
      { latex: 'MC = AC \\text{ at the minimum of } AC', note: 'Efficient scale.' },
      { latex: 'P < \\min AVC \\Rightarrow \\text{shut down}', note: 'Short-run shutdown rule.' },
    ],
    example: { seed: 6, level: 3 },
    tips: ['Fixed cost never appears in marginal cost and never changes the optimal quantity.'],
  },
  story: {
    levels: [1, 3],
    generate(rng, level) {
      return level === 1 ? storyL1(rng) : storyL3(rng);
    },
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
