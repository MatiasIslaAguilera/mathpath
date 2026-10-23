// Utility maximization with Cobb-Douglas utility U = x^a y^b (a, b positive integers).
// L1 the budget line, L2 the tangency condition, L3 full demand, L4 budget shares and a price
// change (the cross-price property), L5 a raise plus a price change together.
// Demands x* = a/(a+b) * m/px, y* = b/(a+b) * m/py. Incomes are chosen so demands are integers.

import { choiceAnswer, expressionAnswer, numberAnswer, tupleAnswer } from '../../engine/answers';
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
} from '../../engine/types';

const ID = 'utility-maximization';
type Body = ReturnType<SkillDefinition['generate']>;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

// ---------- display helpers ----------
const co = (c: number) => (c === 1 ? '' : `${c}`);
const pw = (v: string, e: number) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);
const utilityLatex = (a: number, b: number) => `x^{${a}}y^{${b}}`.replace(/\^\{1\}/g, '');
const lat = (v: Q) => v.toLatex();
const coefX = (c: Q) => (c.eq(1) ? 'x' : `${lat(c)}x`);

const mrsLatex = (a: number, b: number) =>
  `MRS = \\frac{MU_x}{MU_y} = \\frac{${a}\\,${pw('x', a - 1)}${pw('y', b)}}{${b}\\,${pw('x', a)}${pw('y', b - 1)}} = \\frac{${co(a)}y}{${co(b)}x}`;

function mrsStep(a: number, b: number): Step {
  return {
    key: 'mrs',
    instruction: 'Find the marginal rate of substitution: $MU_x / MU_y$.',
    math: mrsLatex(a, b),
    why: 'The MRS is how many units of $y$ the consumer would give up for one more $x$. It is the ratio of marginal utilities.',
    ask: {
      prompt: 'Write the MRS $= MU_x / MU_y$ as an expression in $x$ and $y$.',
      answer: expressionAnswer(`(${a}*y)/(${b}*x)`, `\\frac{${co(a)}y}{${co(b)}x}`, ['x', 'y']),
      verify: { type: 'equivalent', expr: `(${a}*x^(${a - 1})*y^${b})/(${b}*x^${a}*y^(${b - 1}))`, variables: ['x', 'y'] },
    },
  };
}

function tangencyStep(a: number, b: number, px: number, py: number): Step {
  const c = q(b * px, a * py);
  return {
    key: 'tangency',
    instruction: 'Set the MRS equal to the price ratio $p_x / p_y$ and solve for $y$ in terms of $x$.',
    math: `\\frac{${co(a)}y}{${co(b)}x} = \\frac{${px}}{${py}} \\;\\Rightarrow\\; y = ${coefX(c)}`,
    why: 'At the optimum the rate the consumer is willing to trade equals the rate the market allows: MRS $= p_x/p_y$.',
    ask: {
      prompt: 'Solve the tangency condition for $y$ in terms of $x$.',
      answer: expressionAnswer(`${c.toExpr()}*x`, coefX(c), ['x']),
      verify: { type: 'equivalent', expr: `(${b}*${px}*x)/(${a}*${py})`, variables: ['x'] },
    },
  };
}

/** Both-unknown verify of the demand problem: tangency and budget. */
const demandEqs = (a: number, b: number, px: number, py: number, m: number) => [
  `${a}*y*${py} = ${b}*x*${px}`,
  `${px}*x + ${py}*y = ${m}`,
];

function shareStep(a: number, b: number, good: 'x' | 'y'): Step {
  const num = good === 'x' ? a : b;
  const s = q(num, a + b);
  return {
    key: 'share',
    instruction: `Find the share of income spent on $${good}$: the exponent of $${good}$ over the sum of the exponents.`,
    math: `\\text{share of } ${good} = \\frac{${num}}{${a} + ${b}} = ${lat(s)}`,
    why: `With $U = x^{a}y^{b}$ the consumer spends the fraction $\\frac{${good === 'x' ? 'a' : 'b'}}{a+b}$ of income on $${good}$, whatever the prices.`,
    ask: {
      prompt: `What fraction of income is spent on $${good}$?`,
      answer: numberAnswer(s),
      verify: { type: 'evaluate', expr: `${num}/(${a}+${b})` },
    },
  };
}

/** Spending on `good` out of income m, verified against tangency + budget in spending form. */
function spendStep(a: number, b: number, m: number, good: 'x' | 'y'): Step {
  const total = a + b;
  const s = q((good === 'x' ? a : b) * m, total);
  const other = q((good === 'x' ? b : a) * m, total);
  const eqs =
    good === 'x'
      ? [`${b}*S = ${a}*${other.toExpr()}`, `S + ${other.toExpr()} = ${m}`]
      : [`${a}*S = ${b}*${other.toExpr()}`, `${other.toExpr()} + S = ${m}`];
  return {
    key: 'spend',
    instruction: `Multiply the share by income to get the dollars spent on $${good}$.`,
    math: `${lat(q(good === 'x' ? a : b, total))} \\cdot ${m} = ${lat(s)}`,
    why: 'Income is split in fixed shares, so spending on a good is its share times income.',
    ask: {
      prompt: `How many dollars are spent on $${good}$?`,
      answer: numberAnswer(s),
      verify: { type: 'solve', equations: eqs, unknowns: ['S'] },
    },
  };
}

// ---------- interpretation questions (drawn last) ----------

function interpretation(rng: Rng, a: number, b: number, px: number, py: number, allowMrs: boolean): InterpretationQuestion[] | undefined {
  if (!rng.chance(0.5)) return undefined;
  const kinds = allowMrs ? ['mrs', 'cross', 'share'] : ['cross', 'share'];
  const kind = rng.pick(kinds);
  const mk = (rows: { label: string; ok: boolean }[]) => {
    const sh = rng.shuffle(rows.map((r, i) => ({ id: `o${i}`, label: r.label, ok: r.ok })));
    return { options: sh.map(({ id, label }): ChoiceOption => ({ id, label })), correct: sh.find((o) => o.ok)!.id };
  };
  if (kind === 'mrs') {
    const R = q(px, py);
    return [
      {
        prompt: `At the optimum the consumer's MRS equals $\\frac{p_x}{p_y} = ${lat(R)}$. What does that mean?`,
        ...mk([
          { label: 'The rate at which she is willing to trade y for x equals the rate at which the market lets her trade', ok: true },
          { label: 'She spends the same amount of money on each good', ok: false },
          { label: 'She buys the same quantity of x and y', ok: false },
          { label: 'The two goods give her the same total utility', ok: false },
        ]),
        explanation: `At the optimum $MRS = \\frac{${co(a)}y}{${co(b)}x} = \\frac{p_x}{p_y} = ${lat(R)}$: she would give up ${lat(R)} units of y for one more x, and the market asks exactly that. If the MRS were higher she would swap more y for x; if lower, the other way.`,
      },
    ];
  }
  if (kind === 'cross') {
    return [
      {
        prompt: 'Suppose only the price of $x$ rises (income and $p_y$ stay the same). With this Cobb-Douglas utility, what happens to the quantity of $y$ demanded?',
        ...mk([
          { label: 'It does not change: a fixed share of income still goes to y', ok: true },
          { label: 'It rises: y is now relatively cheaper, so she switches toward it', ok: false },
          { label: 'It falls: she is poorer, so she buys less of everything', ok: false },
          { label: 'It falls by the same percentage as x', ok: false },
        ]),
        explanation: `$y^* = \\frac{${b}}{${a + b}}\\cdot\\frac{m}{p_y}$ has no $p_x$ in it. Spending on y is always the fraction $\\frac{${b}}{${a + b}}$ of income, so the price of x does not move it.`,
      },
    ];
  }
  const cand: Q[] = [q(a, a + b), q(b, a + b), q(a, b), q(1, 2), q(a + b, a), q(a, a + b + 1), q(1, a + b)];
  const uniq: Q[] = [];
  for (const c of cand) if (!uniq.some((u) => u.eq(c))) uniq.push(c);
  const take = uniq.slice(0, 4);
  const sh = rng.shuffle(take.map((v, i) => ({ id: `o${i}`, label: `$${lat(v)}$`, ok: i === 0 })));
  return [
    {
      prompt: `This consumer has $U = ${utilityLatex(a, b)}$. What fraction of her income does she spend on $x$ at the optimum?`,
      options: sh.map(({ id, label }) => ({ id, label })),
      correct: sh.find((o) => o.ok)!.id,
      explanation: `The share spent on x is $\\frac{a}{a+b} = \\frac{${a}}{${a + b}} = ${lat(q(a, a + b))}$, independent of prices and income.`,
    },
  ];
}

// ---------- levels ----------

function drawBase(rng: Rng) {
  return { a: rng.int(1, 4), b: rng.int(1, 4), px: rng.int(1, 5), py: rng.int(1, 4), k: rng.int(1, 3) };
}

function level1(rng: Rng): Body {
  for (;;) {
    const { a, b, px, py, k } = drawBase(rng);
    const m = k * (a + b) * px * py;
    const form = rng.int(0, 2);
    const intro = `A consumer has income \\$${m}. Good $x$ costs \\$${px} per unit and good $y$ costs \\$${py} per unit.`;
    const budgetLine = `${px}x + ${py}y = ${m}`;
    const yInt = q(m, py);
    if (form === 0) {
      const xInt = q(m, px);
      const answer = numberAnswer(xInt);
      const verify = { type: 'solve' as const, equations: [`${px}*x = ${m}`], unknowns: ['x'] };
      return {
        params: { a, b, px, py, m, form, qx: 0, qy: 0 },
        prompt: `${intro} What is the most $x$ she can buy?`,
        answer,
        steps: [
          {
            key: 'budget-line',
            instruction: 'Write the budget line and find how much $y$ she could buy if she bought no $x$.',
            math: `${budgetLine}, \\quad x = 0 \\;\\Rightarrow\\; y = \\frac{${m}}{${py}} = ${lat(yInt)}`,
            why: 'The budget line says spending on x plus spending on y equals income.',
            ask: {
              prompt: 'How many units of $y$ can she afford with $x = 0$?',
              answer: numberAnswer(yInt),
              verify: { type: 'solve', equations: [`${py}*y = ${m}`], unknowns: ['y'] },
            },
          },
          {
            key: 'intercept',
            instruction: 'Spend everything on $x$: set $y = 0$ in the budget line.',
            math: `${px}x = ${m} \\;\\Rightarrow\\; x = \\frac{${m}}{${px}} = ${lat(xInt)}`,
            why: 'The $x$-intercept of the budget line is income divided by the price of $x$.',
            ask: { prompt: 'What is the most $x$ she can buy?', answer, verify },
          },
        ],
        misconceptions: [],
        verify,
      };
    }
    if (form === 1) {
      const slope = q(-px, py);
      const answer = numberAnswer(slope);
      const wrong: MisconceptionInstance = { id: 'slope-inverted', wrong: numberAnswer(q(-py, px)) };
      const verify = { type: 'solve' as const, equations: [`${py}*s = -${px}`], unknowns: ['s'] };
      return {
        params: { a, b, px, py, m, form, qx: 0, qy: 0 },
        prompt: `${intro} Draw the budget line with $x$ on the horizontal axis and $y$ on the vertical axis. What is its slope?`,
        answer,
        steps: [
          {
            key: 'budget-line',
            instruction: 'Write the budget line and solve it for $y$.',
            math: `${budgetLine} \\;\\Rightarrow\\; y = \\frac{${m}}{${py}} - \\frac{${px}}{${py}}x`,
            why: 'Solving for $y$ puts the line in $y = \\text{intercept} + \\text{slope}\\cdot x$ form.',
            ask: {
              prompt: 'How many units of $y$ can she afford with $x = 0$ (the intercept)?',
              answer: numberAnswer(yInt),
              verify: { type: 'solve', equations: [`${py}*y = ${m}`], unknowns: ['y'] },
            },
          },
          {
            key: 'slope',
            instruction: 'Read off the coefficient of $x$.',
            math: `\\text{slope} = -\\frac{p_x}{p_y} = -\\frac{${px}}{${py}} = ${lat(slope)}`,
            why: 'Each extra unit of $x$ costs $p_x$ dollars, which is $p_x/p_y$ units of $y$ given up.',
            ask: { prompt: 'What is the slope?', answer, verify },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [wrong]),
        verify,
      };
    }
    // form 2: is a bundle affordable?
    const qx = rng.int(1, Math.max(1, Math.floor(m / px / 2)));
    const rem = m - px * qx;
    const qy = Math.max(1, Math.floor(rem / py) + rng.int(-1, 1));
    const cost = px * qx + py * qy;
    const swapped = px * qy + py * qx;
    if (cost === m || swapped === cost || swapped === m) continue;
    const verdict = (c: number) => (c <= m ? 'Affordable' : 'Not affordable');
    const flip = (c: number) => (c <= m ? 'Not affordable' : 'Affordable');
    const rows = [
      { label: `${verdict(cost)}: it costs \\$${cost}`, key: 'ok' },
      { label: `${flip(cost)}: it costs \\$${cost}`, key: 'verdict' },
      { label: `${verdict(swapped)}: it costs \\$${swapped}`, key: 'swap' },
      { label: `${flip(swapped)}: it costs \\$${swapped}`, key: 'both' },
    ];
    const sh = rng.shuffle(rows.map((r, i) => ({ ...r, id: `o${i}` })));
    const options = sh.map(({ id, label }) => ({ id, label }));
    const idOf = (key: string) => sh.find((r) => r.key === key)!.id;
    const answer = choiceAnswer(options, idOf('ok'));
    const wrong: MisconceptionInstance = { id: 'swapped-prices', wrong: choiceAnswer(options, idOf('swap')) };
    return {
      params: { a, b, px, py, m, form, qx, qy },
      prompt: `${intro} She is considering the bundle $(x, y) = (${qx}, ${qy})$. Is it affordable, and what does it cost?`,
      answer,
      steps: [
        {
          key: 'cost',
          instruction: 'Add the cost of each part of the bundle: price times quantity.',
          math: `${px}\\cdot ${qx} + ${py}\\cdot ${qy} = ${px * qx} + ${py * qy} = ${cost}`,
          why: 'A bundle costs $p_x x + p_y y$. Each price goes with its own good.',
          ask: { prompt: 'What does the bundle cost, in dollars?', answer: numberAnswer(cost), verify: { type: 'evaluate', expr: `${px}*${qx} + ${py}*${qy}` } },
        },
        {
          key: 'compare',
          instruction: `Compare the cost with her income of \\$${m}.`,
          math: `${cost} ${cost <= m ? '\\le' : '>'} ${m}`,
          why: 'A bundle is affordable when it costs no more than income.',
          ask: { prompt: 'Is it affordable, and what does it cost?', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrong]),
      verify: { type: 'choice', note: `cost = ${px}*${qx} + ${py}*${qy} = ${cost}; affordable iff cost <= ${m}` },
    };
  }
}

function level2(rng: Rng): Body {
  const { a, b, px, py } = drawBase(rng);
  const t = rng.int(1, 3);
  const x0 = a * py * t;
  const c = q(b * px, a * py);
  const y = c.mul(x0);
  const answer = numberAnswer(y);
  const eqs = [`${a}*y*${py} = ${b}*${x0}*${px}`];
  const cw = q(b * py, a * px);
  return {
    params: { a, b, px, py, x0 },
    prompt: `A consumer maximizes $U = ${utilityLatex(a, b)}$ and faces prices $p_x = ${px}$, $p_y = ${py}$. At her optimum she buys $x = ${x0}$ units of $x$. How many units of $y$ does she buy?`,
    answer,
    steps: [
      mrsStep(a, b),
      tangencyStep(a, b, px, py),
      {
        key: 'substitute',
        instruction: `Put $x = ${x0}$ into $y = ${coefX(c)}$.`,
        math: `y = ${lat(c)}\\cdot ${x0} = ${lat(y)}`,
        why: 'The optimum lies on the tangency line, so once you know $x$ the condition gives $y$.',
        ask: { prompt: 'How many units of $y$?', answer, verify: { type: 'solve', equations: eqs, unknowns: ['y'] } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'mrs-inverted', wrong: numberAnswer(cw.mul(x0)) }]),
    verify: { type: 'solve', equations: eqs, unknowns: ['y'] },
  };
}

function level3(rng: Rng): Body {
  const { a, b, px, py, k } = drawBase(rng);
  const m = k * (a + b) * px * py;
  const x = q(a * m, (a + b) * px);
  const y = q(b * m, (a + b) * py);
  const c = q(b * px, a * py);
  const answer = tupleAnswer(['x', 'y'], [x, y]);
  const cw = q(b * py, a * px);
  const xw = q(m).div(q(px).add(cw.mul(py)));
  const wrong = [
    { id: 'mrs-inverted', wrong: tupleAnswer(['x', 'y'], [xw, cw.mul(xw)]) },
    { id: 'equal-split', wrong: tupleAnswer(['x', 'y'], [q(m, 2 * px), q(m, 2 * py)]) },
    { id: 'share-over-other', wrong: tupleAnswer(['x', 'y'], [q(a * m, b * px), q(b * m, a * py)]) },
    { id: 'forgot-price', wrong: tupleAnswer(['x', 'y'], [q(a * m, (a + b) * py), q(b * m, (a + b) * px)]) },
  ];
  const tot = q(px * (a + b), a);
  return {
    params: { a, b, px, py, m },
    prompt: `A consumer with utility $U = ${utilityLatex(a, b)}$ has income \\$${m} and faces prices $p_x = ${px}$ and $p_y = ${py}$. Find her utility-maximizing bundle $(x^*, y^*)$.`,
    answer,
    steps: [
      mrsStep(a, b),
      tangencyStep(a, b, px, py),
      {
        key: 'budget',
        instruction: `Substitute $y = ${coefX(c)}$ into the budget line and solve for $x$.`,
        math: `${px}x + ${py}\\left(${coefX(c)}\\right) = ${m} \\;\\Rightarrow\\; ${tot.eq(1) ? '' : lat(tot)}x = ${m} \\;\\Rightarrow\\; x = ${lat(x)}`,
        why: 'The optimum must be on the budget line and satisfy tangency: two equations, two unknowns.',
        ask: {
          prompt: 'What is $x^*$?',
          answer: numberAnswer(x),
          verify: { type: 'solve', equations: [`${a}*${y.toExpr()}*${py} = ${b}*x*${px}`, `${px}*x + ${py}*${y.toExpr()} = ${m}`], unknowns: ['x'] },
        },
      },
      {
        key: 'demand',
        instruction: 'Use the tangency line to find $y^*$.',
        math: `y^* = ${lat(c)}\\cdot ${lat(x)} = ${lat(y)}, \\qquad (x^*, y^*) = (${lat(x)}, ${lat(y)})`,
        why: 'Check: $p_x x^* + p_y y^*$ should equal income.',
        ask: { prompt: 'State $(x^*, y^*)$.', answer, verify: { type: 'solve', equations: demandEqs(a, b, px, py, m), unknowns: ['x', 'y'] } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, wrong),
    interpretation: interpretation(rng, a, b, px, py, true),
    verify: { type: 'solve', equations: demandEqs(a, b, px, py, m), unknowns: ['x', 'y'] },
  };
}

function level4(rng: Rng): Body {
  for (;;) {
    const { a, b, px, py, k } = drawBase(rng);
    const form = rng.int(0, 2);
    let npx = 0;
    if (form > 0) {
      npx = rng.int(1, 5);
      if (npx === px) continue;
    }
    const m = k * (a + b) * lcm(lcm(px, py), npx || 1);
    if (m > 400) continue;
    const tot = a + b;
    const rise = npx > px ? 'rises' : 'falls';
    const base = `A consumer with $U = ${utilityLatex(a, b)}$ has income \\$${m}. Prices are $p_x = ${px}$ and $p_y = ${py}$.`;
    if (form === 0) {
      const S = q(b * m, tot);
      const answer = numberAnswer(S);
      const wrong = [
        { id: 'share-over-other', wrong: numberAnswer(q(b * m, a)) },
        { id: 'equal-split', wrong: numberAnswer(q(m, 2)) },
      ];
      const spend = spendStep(a, b, m, 'y');
      return {
        params: { a, b, px, py, m, form, npx },
        prompt: `${base} At her optimum, how many dollars does she spend on $y$?`,
        answer,
        steps: [shareStep(a, b, 'y'), spend],
        misconceptions: distinctMisconceptions(answer, wrong),
        interpretation: interpretation(rng, a, b, px, py, false),
        verify: spend.ask!.verify!,
      };
    }
    const x2 = q(a * m, tot * npx);
    const y1 = q(b * m, tot * py);
    const prompt = `${base} The price of $x$ ${rise} to \\$${npx} (income and $p_y$ unchanged).`;
    if (form === 1) {
      const answer = numberAnswer(x2);
      const wrong = [
        { id: 'share-over-other', wrong: numberAnswer(q(a * m, b * npx)) },
        { id: 'equal-split', wrong: numberAnswer(q(m, 2 * npx)) },
        { id: 'forgot-price', wrong: numberAnswer(q(a * m, tot * py)) },
      ];
      const verify = {
        type: 'solve' as const,
        equations: [`${a}*${py}*${y1.toExpr()} = ${b}*${npx}*x`, `${npx}*x + ${py}*${y1.toExpr()} = ${m}`],
        unknowns: ['x'],
      };
      return {
        params: { a, b, px, py, m, form, npx },
        prompt: `${prompt} How many units of $x$ does she now buy?`,
        answer,
        steps: [
          shareStep(a, b, 'x'),
          spendStep(a, b, m, 'x'),
          {
            key: 'demand',
            instruction: `Divide spending on $x$ by the new price of $x$, $${npx}$.`,
            math: `x^* = \\frac{${lat(q(a * m, tot))}}{${npx}} = ${lat(x2)}`,
            why: 'Units bought = dollars spent divided by price. The share of income stays the same; only the price changes.',
            ask: { prompt: 'How many units of $x$ now?', answer, verify },
          },
        ],
        misconceptions: distinctMisconceptions(answer, wrong),
        interpretation: interpretation(rng, a, b, px, py, false),
        verify,
      };
    }
    const answer = numberAnswer(y1);
    const wrong = [
      { id: 'cross-price-effect', wrong: numberAnswer(y1.mul(q(px, npx))) },
      { id: 'share-over-other', wrong: numberAnswer(q(b * m, a * py)) },
      { id: 'equal-split', wrong: numberAnswer(q(m, 2 * py)) },
      { id: 'forgot-price', wrong: numberAnswer(q(b * m, tot * npx)) },
    ];
    const verify = {
      type: 'solve' as const,
      equations: [`${a}*${py}*y = ${b}*${npx}*${x2.toExpr()}`, `${npx}*${x2.toExpr()} + ${py}*y = ${m}`],
      unknowns: ['y'],
    };
    return {
      params: { a, b, px, py, m, form, npx },
      prompt: `${prompt} How many units of $y$ does she buy after the change?`,
      answer,
      steps: [
        shareStep(a, b, 'y'),
        spendStep(a, b, m, 'y'),
        {
          key: 'demand',
          instruction: `Divide spending on $y$ by the price of $y$, which has not changed: $${py}$.`,
          math: `y^* = \\frac{${lat(q(b * m, tot))}}{${py}} = ${lat(y1)}`,
          why: "Spending on $y$ is a fixed share of income and $p_y$ did not move, so $y^*$ is unchanged. Cobb-Douglas demand does not respond to the other good's price.",
          ask: { prompt: 'How many units of $y$ now?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, wrong),
      interpretation: interpretation(rng, a, b, px, py, false),
      verify,
    };
  }
}

function level5(rng: Rng): Body {
  for (;;) {
    const { a, b, px, py } = drawBase(rng);
    const which = rng.int(0, 1);
    const old = which === 0 ? px : py;
    const pnew = old + rng.int(1, 3);
    const ppx = which === 0 ? pnew : px;
    const ppy = which === 1 ? pnew : py;
    const tot = a + b;
    const m2 = rng.int(2, 8) * tot * lcm(ppx, ppy);
    if (m2 > 600 || m2 < 4) continue;
    const m = m2 - rng.int(1, Math.floor(m2 / 2));
    const form = rng.int(0, 1);
    const x = q(a * m2, tot * ppx);
    const y = q(b * m2, tot * ppy);
    const answer = tupleAnswer(['x', 'y'], [x, y]);
    const good = which === 0 ? 'x' : 'y';
    const wrong = [
      { id: 'cross-price-effect', wrong: which === 0 ? tupleAnswer(['x', 'y'], [x, y.mul(q(px, ppx))]) : tupleAnswer(['x', 'y'], [x.mul(q(py, ppy)), y]) },
      { id: 'old-income', wrong: tupleAnswer(['x', 'y'], [q(a * m, tot * ppx), q(b * m, tot * ppy)]) },
      { id: 'equal-split', wrong: tupleAnswer(['x', 'y'], [q(m2, 2 * ppx), q(m2, 2 * ppy)]) },
      { id: 'share-over-other', wrong: tupleAnswer(['x', 'y'], [q(a * m2, b * ppx), q(b * m2, a * ppy)]) },
      { id: 'forgot-price', wrong: tupleAnswer(['x', 'y'], [q(a * m2, tot * ppy), q(b * m2, tot * ppx)]) },
    ];
    const utility = form === 0 ? `$U = ${utilityLatex(a, b)}$` : `$U = ${a === 1 ? "" : a}\\ln x + ${b === 1 ? "" : b}\\ln y$`;
    const other = which === 0 ? `$p_y = ${py}$` : `$p_x = ${px}$`;
    const verify = { type: 'solve' as const, equations: demandEqs(a, b, ppx, ppy, m2), unknowns: ['x', 'y'] };
    return {
      params: { a, b, px, py, m, m2, which, pnew, form },
      prompt: `A consumer has utility ${utility}. She gets a raise: income rises from \\$${m} to \\$${m2}. At the same time the price of $${good}$ rises from \\$${old} to \\$${pnew}, while ${other} stays the same. Find her new optimal bundle $(x^*, y^*)$.`,
      answer,
      steps: [
        shareStep(a, b, 'x'),
        spendStep(a, b, m2, 'x'),
        {
          key: 'demand',
          instruction: `Divide each good's spending by its new price: $p_x = ${ppx}$, $p_y = ${ppy}$.`,
          math: `x^* = \\frac{${lat(q(a * m2, tot))}}{${ppx}} = ${lat(x)}, \\qquad y^* = \\frac{${lat(q(b * m2, tot))}}{${ppy}} = ${lat(y)}`,
          why: 'Shares stay fixed, so a new income changes dollars spent and a new price changes units bought. Use the new numbers for both.',
          ask: { prompt: 'State $(x^*, y^*)$.', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, wrong),
      interpretation: interpretation(rng, a, b, ppx, ppy, true),
      verify,
    };
  }
}

export const utilityMaximization: SkillDefinition = {
  id: ID,
  title: 'Utility maximization',
  track: 'econ',
  unit: 'Production & utility',
  description: 'Choose the best bundle on a budget: tangency, Cobb-Douglas demand, and budget shares.',
  prerequisites: ['cobb-douglas-production'],
  maxDenominator: 4,
  levels: {
    1: {
      description: 'The budget line: intercept, slope, or whether a bundle is affordable',
      ranges: { a: [1, 4], b: [1, 4], px: [1, 5], py: [1, 4], m: [2, 480], form: [0, 2], qx: [0, 240], qy: [0, 480] },
    },
    2: {
      description: 'The tangency condition: find y from x on the optimal path',
      ranges: { a: [1, 4], b: [1, 4], px: [1, 5], py: [1, 4], x0: [1, 48] },
    },
    3: {
      description: 'Full demand (x*, y*) for Cobb-Douglas utility',
      ranges: { a: [1, 4], b: [1, 4], px: [1, 5], py: [1, 4], m: [2, 480] },
    },
    4: {
      description: 'Budget shares, and what a price change does to each good',
      ranges: { a: [1, 4], b: [1, 4], px: [1, 5], py: [1, 4], m: [2, 400], form: [0, 2], npx: [0, 5] },
    },
    5: {
      description: 'A raise and a price change together; utility may be written in logs',
      ranges: { a: [1, 4], b: [1, 4], px: [1, 5], py: [1, 4], m: [1, 600], m2: [4, 600], which: [0, 1], pnew: [2, 8], form: [0, 1] },
    },
  },
  misconceptions: {
    'slope-inverted': {
      name: 'Used the price ratio upside down for the slope',
      explanation: 'Solving $p_x x + p_y y = m$ for $y$ gives $y = m/p_y - (p_x/p_y)x$. The slope is $-p_x/p_y$: giving up $p_x/p_y$ units of $y$ buys one more $x$.',
    },
    'swapped-prices': {
      name: 'Paired each price with the wrong good',
      explanation: 'The cost of a bundle is $p_x \\cdot x + p_y \\cdot y$: the price of $x$ times the quantity of $x$, and the price of $y$ times the quantity of $y$.',
    },
    'mrs-inverted': {
      name: 'Set the inverted MRS equal to the price ratio',
      explanation: 'The MRS is $MU_x / MU_y = \\frac{ay}{bx}$, and it equals $p_x/p_y$. Flipping it to $\\frac{bx}{ay}$ puts $y$ on the wrong side of the tangency condition.',
    },
    'equal-split': {
      name: 'Split income equally between the goods',
      explanation: 'The split is by the exponents: $\\frac{a}{a+b}$ of income on $x$ and $\\frac{b}{a+b}$ on $y$. It is half and half only when $a = b$.',
    },
    'share-over-other': {
      name: 'Used a/b as the share instead of a/(a+b)',
      explanation: 'The share spent on $x$ is $a$ divided by the sum $a + b$, not by $b$. The two shares must add up to 1.',
    },
    'cross-price-effect': {
      name: 'Changed the demand for a good whose price did not move',
      explanation: "With Cobb-Douglas utility, spending on a good is a fixed share of income, so its quantity depends only on income and its own price. The other good's price drops out.",
    },
    'forgot-price': {
      name: 'Divided spending by the wrong price',
      explanation: 'Dollars spent on $x$ are divided by $p_x$ to get units of $x$, and dollars spent on $y$ by $p_y$. Check which good you are counting.',
    },
    'old-income': {
      name: 'Used the old income',
      explanation: 'Shares apply to the income she has now. After the raise, use the new income when you work out the dollars spent on each good.',
    },
  },
  stepLabels: {
    'budget-line': 'Write the budget line',
    intercept: 'Find the x-intercept',
    slope: 'Read off the slope',
    cost: 'Cost of the bundle',
    compare: 'Compare cost with income',
    mrs: 'Find the MRS',
    tangency: 'Set MRS equal to the price ratio',
    substitute: 'Substitute x into the tangency line',
    budget: 'Substitute into the budget line',
    share: 'Find the budget share',
    spend: 'Dollars spent on the good',
    demand: 'Divide spending by price',
  },
  learn: {
    whyItMatters:
      'A consumer with utility $U = x^{1/3}y^{2/3}$, income \\$90, and prices $p_x = 3$, $p_y = 2$ spends a fixed share of income on each good: one third on $x$ and two thirds on $y$. That is \\$30 on $x$, so $x^* = 30/3 = 10$, and \\$60 on $y$, so $y^* = 60/2 = 30$. Check: $3(10) + 2(30) = 90$. This one rule gives demand curves, shows that the price of $x$ never moves demand for $y$, and underlies the price indices and welfare comparisons of micro theory.',
    summary:
      'Maximize $U = x^{a}y^{b}$ subject to $p_x x + p_y y = m$. At the optimum the indifference curve touches the budget line: MRS $= \\frac{ay}{bx} = \\frac{p_x}{p_y}$. Combined with the budget line this gives demand: spend the fraction $\\frac{a}{a+b}$ of income on $x$ and $\\frac{b}{a+b}$ on $y$.',
    formulas: [
      { latex: 'MRS = \\frac{MU_x}{MU_y} = \\frac{ay}{bx} = \\frac{p_x}{p_y}', note: 'The tangency condition.' },
      { latex: 'x^* = \\frac{a}{a+b}\\cdot\\frac{m}{p_x}, \\quad y^* = \\frac{b}{a+b}\\cdot\\frac{m}{p_y}', note: "Cobb-Douglas demand. Neither depends on the other good's price." },
      { latex: 'p_x x + p_y y = m', note: 'The budget line, with slope $-p_x/p_y$.' },
    ],
    example: { seed: 1, level: 3 },
    tips: [
      'Spending first, units second: dollars on $x$ are $\\frac{a}{a+b}m$, then divide by $p_x$.',
      'Check every answer: $p_x x^* + p_y y^*$ must equal $m$, and $ay\\,p_y = bx\\,p_x$.',
      'The utility $\\alpha\\ln x + \\beta\\ln y$ gives the same demands as $x^{\\alpha}y^{\\beta}$.',
    ],
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
      default:
        return level5(rng);
    }
  },
};
