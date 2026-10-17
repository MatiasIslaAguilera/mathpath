// Growth & decay (math, economics flavored). Number answers; L3 and L4 are irrational and
// shown as exact expressions ("1000*exp((3/20))", "log(2)/log(21/20)") that learners type as
// decimals. Money is exact cents wherever the answer is rational (L1, L2, L5).

import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  InterpretationQuestion,
  MisconceptionInstance,
  SkillDefinition,
  Step,
} from '../../engine/types';

const ID = 'growth-decay';

type Generated = ReturnType<SkillDefinition['generate']>;

// ---------- display helpers ----------

/** Exact decimal expansion of a rational whose denominator divides a power of 10: 21/20 → "1.05". */
function decimal(x: Q): string {
  for (let k = 0; k <= 9; k++) {
    const p = 10 ** k;
    if (p % x.d === 0) {
      const s = String(Math.abs(x.n) * (p / x.d)).padStart(k + 1, '0');
      const int = s.slice(0, s.length - k);
      const frac = s.slice(s.length - k).replace(/0+$/, '');
      return `${x.n < 0 ? '-' : ''}${int}${frac ? '.' + frac : ''}`;
    }
  }
  return x.valueOf().toFixed(6);
}

/** Exact cents of a rational dollar amount: 2205/2 → "1102.50". */
function cents(x: Q): string {
  const c = x.mul(100);
  if (!c.isInt()) throw new Error(`not a whole number of cents: ${x.toString()}`);
  const s = String(Math.abs(c.n)).padStart(3, '0');
  return `${c.n < 0 ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`;
}

const dollars = (x: Q) => `\\$${cents(x)}`;
const dollarsFloat = (v: number) => `\\$${(Math.round(v * 100) / 100).toFixed(2)}`;

/** A number answer whose display is its exact decimal (or any given LaTeX). */
const exact = (x: Q): AnswerSpec => ({ kind: 'number', value: x.toString(), display: decimal(x) });
const numberWith = (value: string, display: string): AnswerSpec => ({ kind: 'number', value, display });

function pow(x: Q, t: number): Q {
  let r = q(1);
  for (let i = 0; i < t; i++) r = r.mul(x);
  return r;
}

function choice(rng: Rng, correct: string, wrong: string[]) {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

const years = (t: number) => `${t} year${t === 1 ? '' : 's'}`;
const round2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

// ---------- parameter pools ----------

const AMOUNTS = [100, 200, 500, 1000, 2000];
const RATES = [2, 4, 5, 10, 20];
const AMOUNTS5 = [100, 200, 250, 500, 1000, 2000, 2500, 4000, 5000];
const RATES5 = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];
const CONT_RATES = [2, 3, 4, 5, 6, 8];

// ---------- levels 1-2: annual compounding / decay ----------

function compound(rng: Rng, level: 1 | 2): Generated {
  const decay = level === 2;
  let P = 0;
  let r = 0;
  let t = 0;
  let factor = q(1);
  let factorT = q(1);
  let A = q(0);
  for (;;) {
    P = rng.pick(AMOUNTS);
    r = rng.pick(RATES);
    t = rng.int(1, 3);
    factor = q(decay ? 100 - r : 100 + r, 100);
    factorT = pow(factor, t);
    A = factorT.mul(P);
    if (!A.mul(100).isInt()) continue; // must be a whole number of cents
    break;
  }
  const sign = decay ? '-' : '+';
  const rDec = decimal(q(r, 100));
  const fDec = decimal(factor);
  const verify = { type: 'evaluate' as const, expr: `${P}*(1 ${sign} ${r}/100)^${t}` };
  const answer = numberWith(A.toString(), dollars(A));

  const prompt = decay
    ? `A machine bought for \\$${P} loses ${r}% of its value each year (it depreciates). What is its value, in dollars, after ${years(t)}?`
    : `You deposit \\$${P} in an account that pays ${r}% interest per year, compounded annually. How many dollars are in the account after ${years(t)}?`;

  const steps: Step[] = [
    {
      key: 'growth-factor',
      instruction: decay
        ? `Each year the machine keeps ${100 - r}% of its value, so the yearly factor is $1 - ${rDec}$.`
        : `Each year the balance is multiplied by $1 + ${rDec}$.`,
      math: `1 ${sign} ${rDec} = ${fDec}`,
      why: decay
        ? 'Losing a fraction r of the value leaves the fraction 1 - r. Write the percent as a decimal first (5% = 0.05).'
        : 'Gaining a fraction r multiplies by 1 + r. Write the percent as a decimal first (5% = 0.05).',
      ask: {
        prompt: `$1 ${sign} ${rDec} = \\;?$`,
        answer: exact(factor),
        verify: { type: 'evaluate', expr: `1 ${sign} ${r}/100` },
      },
    },
  ];
  if (t > 1) {
    steps.push({
      key: 'raise',
      instruction: `Apply the factor ${t} times: raise it to the power ${t}.`,
      math: `${fDec}^{${t}} = ${decimal(factorT)}`,
      why: 'Each year multiplies by the factor again, so after t years the total factor is (factor)^t.',
      ask: {
        prompt: `$${fDec}^{${t}} = \\;?$`,
        answer: exact(factorT),
        verify: { type: 'evaluate', expr: `(1 ${sign} ${r}/100)^${t}` },
      },
    });
  }
  steps.push({
    key: 'multiply',
    instruction: `Multiply by the starting amount, \\$${P}.`,
    math: `A = ${P} \\cdot ${decimal(factorT)} = ${dollars(A)}`,
    why: decay ? '$A = P(1 - r)^t$: starting value times the total factor.' : '$A = P(1 + r)^t$: starting amount times the total factor.',
    ask: { prompt: `How many dollars? $A = \\;?$`, answer, verify },
  });

  // ---------- misconceptions ----------
  const rawR = q(r); // percent used as if it were a decimal: 5 instead of 0.05
  const guardFinite = (x: Q) => Math.abs(x.valueOf()) <= 1e12;
  const candidates: (MisconceptionInstance | null)[] = [];
  if (!decay) {
    candidates.push({ id: 'simple-interest', wrong: numberWith(q(P).mul(q(100 + r * t, 100)).toString(), dollars(q(P).mul(q(100 + r * t, 100)))) });
  }
  if (decay) {
    const plus = q(P).mul(pow(q(100 + r, 100), t));
    candidates.push({ id: 'decay-plus', wrong: numberWith(plus.toString(), plus.mul(100).isInt() ? dollars(plus) : decimal(plus)) });
  }
  const big = q(P).mul(pow(decay ? q(1).sub(rawR) : q(1).add(rawR), t));
  candidates.push(guardFinite(big) ? { id: 'percent-not-decimal', wrong: numberWith(big.toString(), big.toLatex()) } : null);

  const answerSpec = answer;
  // ---------- interpretation (drawn last) ----------
  let interpretation: InterpretationQuestion[] | undefined;
  if (t >= 2) {
    const S = q(P * r * t, 100); // straight-line (simple) amount
    const G = decay ? q(P).sub(A) : A.sub(q(P)); // total change in value
    if (rng.chance(0.5)) {
      const { options, correct } = decay
        ? choice(rng, 'Each year the loss is a percent of a smaller, already-reduced value', [
            'The machine is repaired each year',
            'The rate falls each year',
            'Depreciation only starts after the first year',
          ])
        : choice(rng, 'Interest earns interest (compounding)', [
            'The bank adds a fee each year',
            'Interest is paid only on the original deposit',
            'The interest rate rises each year',
          ]);
      interpretation = [
        {
          prompt: decay
            ? `Over ${t} years the machine loses \\$${cents(G)} of value, which is less than ${t} \\times ${r}\\% of \\$${P} = \\$${cents(S)}. Why is the real loss smaller?`
            : `Over ${t} years your balance grows by \\$${cents(G)}, which is more than ${t} \\times ${r}\\% of \\$${P} = \\$${cents(S)}. Why is the real gain larger?`,
          options,
          correct,
          explanation: decay
            ? `After year 1 the machine is worth less, so ${r}% of the *new* value is a smaller loss than ${r}% of \\$${P}. The losses shrink each year, so the total is less than ${t} equal losses.`
            : `After year 1 you earn interest on the interest as well as on the original \\$${P}. The extra \\$${cents(G.sub(S))} is interest on interest; simple interest would give only \\$${cents(S)}.`,
        },
      ];
    } else {
      const diff = decay ? S.sub(G) : G.sub(S);
      const { options, correct } = choice(rng, `\\$${cents(diff)}`, [`\\$${cents(S)}`, `\\$${cents(G)}`, `\\$${cents(q(P * r, 100))}`]);
      interpretation = [
        {
          prompt: decay
            ? `A straight-line estimate would say the machine loses ${r}% of \\$${P} each year, \\$${cents(S)} over ${t} years. How much *less* than that does it actually lose?`
            : `Simple interest on the original \\$${P} would give \\$${cents(S)} over ${t} years. How much of your actual gain is interest earned on earlier interest?`,
          options,
          correct,
          explanation: decay
            ? `Actual loss: \\$${P} - \\$${cents(A)} = \\$${cents(G)}. Straight-line: \\$${cents(S)}. Difference: \\$${cents(diff)}.`
            : `Actual gain: \\$${cents(A)} - \\$${P} = \\$${cents(G)}. Simple interest: \\$${cents(S)}. Interest on interest: \\$${cents(diff)}.`,
        },
      ];
    }
  }

  return {
    params: { P, r, t },
    prompt,
    answer: answerSpec,
    steps,
    misconceptions: distinctMisconceptions(answerSpec, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 3: continuous compounding ----------

function continuous(rng: Rng): Generated {
  const P = rng.pick(AMOUNTS);
  const r = rng.pick(CONT_RATES);
  const t = rng.int(1, 8);
  const rt = q(r * t, 100);
  const value = `${P}*exp(${rt.toExpr()})`;
  const amount = P * Math.exp(r * t / 100);
  const answer = numberWith(value, `${P}e^{${decimal(rt)}} \\approx \\$${round2(amount)}`);
  const verify = { type: 'evaluate' as const, expr: value };

  const steps: Step[] = [
    {
      key: 'continuous',
      instruction: `With continuous growth the exponent is $rt$, with $r = ${decimal(q(r, 100))}$ as a decimal and $t = ${t}$.`,
      math: `rt = ${decimal(q(r, 100))} \\cdot ${t} = ${decimal(rt)}`,
      why: 'Continuous compounding uses $A = Pe^{rt}$, with the rate as a decimal (5% = 0.05).',
      ask: {
        prompt: `$rt = ${decimal(q(r, 100))} \\cdot ${t} = \\;?$`,
        answer: exact(rt),
        verify: { type: 'evaluate', expr: `${r}/100*${t}` },
      },
    },
    {
      key: 'multiply',
      instruction: `Compute $e^{${decimal(rt)}}$ and multiply by \\$${P}.`,
      math: `A = ${P}\\, e^{${decimal(rt)}} \\approx ${P} \\cdot ${Math.exp(r * t / 100).toFixed(5)} \\approx \\$${round2(amount)}`,
      why: 'Evaluate the exponential with a calculator (natural exponential, the $e^x$ key), then scale by the starting amount.',
      ask: { prompt: 'Round to the nearest cent. $A = \\;?$', answer, verify },
    },
  ];

  const simple = q(P).mul(q(100 + r * t, 100));
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'simple-interest', wrong: numberWith(simple.toString(), dollars(simple)) },
    P * Math.exp(r * t) <= 1e12
      ? { id: 'percent-not-decimal', wrong: numberWith(`${P}*exp(${r * t})`, `${P}e^{${r * t}}`) }
      : null,
  ];

  // Interpretation (drawn last): continuous vs. annual compounding at the same rate.
  const annual = P * Math.pow(1 + r / 100, t);
  const cmp = Math.round(amount * 100) - Math.round(annual * 100);
  const correctLabel = cmp > 0 ? 'More money' : cmp < 0 ? 'Less money' : 'The same amount';
  const { options, correct } = choice(rng, correctLabel, ['More money', 'Less money', 'The same amount']);
  const interpretation: InterpretationQuestion[] = [
    {
      prompt: `With annual compounding at the same ${r}% rate, you would have ${dollarsFloat(annual)} after ${years(t)}. Compared with that, continuous compounding gives…`,
      options,
      correct,
      explanation: `Continuous compounding adds interest at every instant, so interest starts earning interest sooner. Here that gives ${dollarsFloat(amount)} versus ${dollarsFloat(annual)}: ${e1(cmp)}.`,
    },
  ];

  const answerSpec = answer;
  return {
    params: { P, r, t },
    prompt: `You invest \\$${P} at a ${r}% annual rate, compounded continuously. Using $A = Pe^{rt}$, how many dollars will you have after ${years(t)}? Round to the nearest cent.`,
    answer: answerSpec,
    steps,
    misconceptions: distinctMisconceptions(answerSpec, candidates),
    interpretation,
    verify,
  };
}

const e1 = (cmp: number) => (cmp > 0 ? 'slightly more' : cmp < 0 ? 'slightly less' : 'the same');

// ---------- level 4: solve for time ----------

function solveTime(rng: Rng): Generated {
  let P = 0;
  let r = 0;
  let k = 0;
  for (;;) {
    P = rng.pick(AMOUNTS);
    r = rng.int(2, 12);
    k = rng.int(2, 3);
    const exactT = Math.log(k) / Math.log(1 + r / 100);
    // Keep the rule-of-70 distinguishable from the exact doubling time at 2 decimals.
    if (k === 2 && round2(exactT) === round2(70 / r)) continue;
    break;
  }
  const f = q(100 + r, 100);
  const fDec = decimal(f);
  const exactT = Math.log(k) / Math.log(1 + r / 100);
  const value = `log(${k})/log(${f.toString()})`;
  const verify = { type: 'evaluate' as const, expr: value };
  const answer = numberWith(value, `\\frac{\\ln ${k}}{\\ln ${fDec}} \\approx ${round2(exactT)}`);
  const word = k === 2 ? 'double' : 'triple';

  const steps: Step[] = [
    {
      key: 'divide',
      instruction: `Divide both sides by \\$${P} so only the growth factor is left.`,
      math: `${P}(${fDec})^{t} = ${k * P} \\;\\Rightarrow\\; (${fDec})^{t} = ${k}`,
      why: 'The starting amount cancels: the doubling (or tripling) time does not depend on how much you start with.',
      ask: {
        prompt: `After dividing by \\$${P}: $(${fDec})^{t} = \\;?$`,
        answer: exact(q(k)),
        verify: { type: 'evaluate', expr: `${k * P}/${P}` },
      },
    },
    {
      key: 'take-log',
      instruction: 'Take the natural log of both sides to bring $t$ down from the exponent.',
      math: `t \\ln(${fDec}) = \\ln ${k}`,
      why: '$\\ln(b^t) = t\\ln b$. Logs turn an unknown exponent into an ordinary multiplication.',
      ask: {
        prompt: `$\\ln ${k} = \\;?$ (2+ decimals)`,
        answer: numberWith(`log(${k})`, `\\ln ${k} \\approx ${Math.log(k).toFixed(4)}`),
        verify: { type: 'evaluate', expr: `log(${k})` },
      },
    },
    {
      key: 'solve',
      instruction: `Divide by $\\ln(${fDec})$ to get $t$.`,
      math: `t = \\frac{\\ln ${k}}{\\ln ${fDec}} \\approx \\frac{${Math.log(k).toFixed(4)}}{${Math.log(1 + r / 100).toFixed(4)}} \\approx ${round2(exactT)}`,
      why: 'Isolate $t$ by dividing both sides by $\\ln(1+r)$.',
      ask: { prompt: `Round to 2 decimal places. $t = \\;?$ years`, answer, verify },
    },
  ];

  const rawFactor = 1 + r;
  const candidates: (MisconceptionInstance | null)[] = [
    k === 2 ? { id: 'rule-of-70-exact', wrong: numberWith(q(70, r).toString(), `\\frac{70}{${r}} \\approx ${round2(70 / r)}`) } : null,
    { id: 'percent-not-decimal', wrong: numberWith(`log(${k})/log(${rawFactor})`, `\\frac{\\ln ${k}}{\\ln ${rawFactor}} \\approx ${round2(Math.log(k) / Math.log(rawFactor))}`) },
    { id: 'simple-interest', wrong: numberWith(q((k - 1) * 100, r).toString(), `\\frac{${k - 1}}{${decimal(q(r, 100))}} \\approx ${round2((k - 1) * 100 / r)}`) },
  ];

  // Interpretation (drawn last).
  const interpretation: InterpretationQuestion[] = [];
  const useRule = k === 2 && rng.chance(0.5);
  if (useRule) {
    const est = 70 / r;
    const lower = est < exactT;
    const correctLabel = lower ? 'A little lower than the exact time' : 'A little higher than the exact time';
    const { options, correct } = choice(rng, correctLabel, [
      'A little lower than the exact time',
      'A little higher than the exact time',
      'Exactly equal to the exact time',
    ]);
    interpretation.push({
      prompt: `The rule of 70 estimates the doubling time as $70/${r} \\approx ${round2(est)}$ years. Compared with your exact answer of ${round2(exactT)} years, the rule of 70 is…`,
      options,
      correct,
      explanation: `The rule of 70 is a shortcut: it replaces $\\ln 2/\\ln(1+r)$ with $70/r$ (using $\\ln 2 \\approx 0.69$ and $\\ln(1+r) \\approx r$). Here it gives ${round2(est)} years against the exact ${round2(exactT)}, ${lower ? 'a little low' : 'a little high'}, but close enough for quick mental estimates.`,
    });
  } else {
    const newT = Math.log(k) / Math.log(1 + (2 * r) / 100);
    const { options, correct } = choice(rng, 'It would roughly halve', [
      'It would roughly double',
      'It would stay about the same',
      'It would fall to about a quarter',
    ]);
    interpretation.push({
      prompt: `Suppose the rate were ${2 * r}% instead of ${r}%. Roughly how would the time to ${word} change?`,
      options,
      correct,
      explanation: `At ${2 * r}% the exact time is $\\ln ${k}/\\ln ${decimal(q(100 + 2 * r, 100))} \\approx ${round2(newT)}$ years, about half of ${round2(exactT)}. Since $\\ln(1+r) \\approx r$, the time is roughly inversely proportional to the rate.`,
    });
  }

  const answerSpec = answer;
  return {
    params: { P, r, k },
    prompt: `An investment of \\$${P} grows at ${r}% per year, compounded annually. How many years until it ${k === 2 ? 'doubles' : 'triples'} to \\$${k * P}? Solve $${P}(${fDec})^{t} = ${k * P}$. Round to 2 decimal places.`,
    answer: answerSpec,
    steps,
    misconceptions: distinctMisconceptions(answerSpec, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 5: solve for the rate ----------

function solveRate(rng: Rng): Generated {
  let P = 0;
  let r = 0;
  let t = 0;
  let ratio = q(1);
  let A = q(0);
  for (;;) {
    P = rng.pick(AMOUNTS5);
    r = rng.pick(RATES5);
    t = rng.int(2, 3);
    ratio = pow(q(100 + r, 100), t);
    A = ratio.mul(P);
    if (!A.mul(100).isInt()) continue;
    break;
  }
  const f = q(100 + r, 100);
  const verify = { type: 'evaluate' as const, expr: `((${ratio.toString()})^(1/${t}) - 1)*100` };
  const answer = numberWith(String(r), `${r}\\%`);
  const rootExpr = `(${ratio.toString()})^(1/${t})`;

  const steps: Step[] = [
    {
      key: 'divide',
      instruction: `Divide both sides by \\$${P}.`,
      math: `(1 + r)^{${t}} = \\frac{${cents(A)}}{${P}} = ${decimal(ratio)}`,
      why: 'Get the growth factor alone on one side before undoing the exponent.',
      ask: {
        prompt: `$\\dfrac{${cents(A)}}{${P}} = \\;?$`,
        answer: exact(ratio),
        verify: { type: 'evaluate', expr: `${A.toString()}/${P}` },
      },
    },
    {
      key: 'root',
      instruction: `Undo the power ${t} by taking the ${t === 2 ? 'square' : 'cube'} root of both sides.`,
      math: `1 + r = ${decimal(ratio)}^{1/${t}} = ${decimal(f)}`,
      why: 'The $t$-th root undoes the $t$-th power: $(x^t)^{1/t} = x$.',
      ask: {
        prompt: `$1 + r = ${decimal(ratio)}^{1/${t}} = \\;?$`,
        answer: exact(f),
        verify: { type: 'evaluate', expr: rootExpr },
      },
    },
    {
      key: 'to-percent',
      instruction: 'Subtract 1 to get $r$, then write it as a percent.',
      math: `r = ${decimal(f)} - 1 = ${decimal(f.sub(1))} = ${r}\\%`,
      why: 'The factor is $1 + r$, so $r$ is the factor minus 1. Multiply by 100 to read it as a percent.',
      ask: { prompt: 'The annual rate, as a percent: $r = \\;?\\%$', answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'rate-not-subtract-one', wrong: numberWith(String(100 + r), `${100 + r}\\%`) },
    { id: 'decimal-not-percent', wrong: numberWith(q(r, 100).toString(), decimal(q(r, 100))) },
  ];

  return {
    params: { P, r, t },
    prompt: `An account starts with \\$${P} and grows to \\$${cents(A)} in ${t} years, compounded annually. What is the annual interest rate, as a percent? Solve $${P}(1 + r)^{${t}} = ${cents(A)}$ for $r$.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    verify,
  };
}

// ---------- the skill ----------

export const growthDecay: SkillDefinition = {
  id: ID,
  title: 'Growth & decay',
  track: 'math',
  unit: 'Exponents & logarithms',
  description: 'Compound growth, depreciation, continuous compounding, doubling time, and solving for the rate.',
  prerequisites: ['exp-log-equations'],
  maxDenominator: 100,
  irrationalAnswers: true,
  levels: {
    1: { description: 'Compound annually: A = P(1 + r)^t', ranges: { P: [100, 2000], r: [2, 20], t: [1, 3] } },
    2: { description: 'Decay / depreciation: A = P(1 - r)^t', ranges: { P: [100, 2000], r: [2, 20], t: [1, 3] } },
    3: { description: 'Continuous compounding: A = Pe^(rt)', ranges: { P: [100, 2000], r: [2, 8], t: [1, 8] } },
    4: { description: 'Solve for the time to double or triple', ranges: { P: [100, 2000], r: [2, 12], k: [2, 3] } },
    5: { description: 'Solve for the interest rate', ranges: { P: [100, 5000], r: [2, 25], t: [2, 3] } },
  },
  misconceptions: {
    'simple-interest': {
      name: 'Used simple interest',
      explanation:
        'Simple interest adds the same amount every year: $P(1 + rt)$. Compound interest multiplies the *whole* balance by $1 + r$ each year, so interest earns interest: $P(1 + r)^t$. For doubling time, simple interest would need $(k-1)/r$ years, far too long.',
    },
    'percent-not-decimal': {
      name: 'Used the percent as a number (5 instead of 0.05)',
      explanation:
        'In every formula the rate $r$ is a decimal: 5% is $0.05$. Using $5$ would mean 500% growth. Divide the percent by 100 before you put it in $1 + r$ or $e^{rt}$.',
    },
    'decay-plus': {
      name: 'Added the rate for a decay',
      explanation:
        'Depreciation loses value, so each year multiplies by $1 - r$, not $1 + r$. At 10% decay the yearly factor is $0.90$, not $1.10$.',
    },
    'rule-of-70-exact': {
      name: 'Treated the rule of 70 as exact',
      explanation:
        'The rule of 70 ($70/r$ years to double) is only an approximation of $\\ln 2/\\ln(1+r)$. When a problem asks for the exact answer, use logs and round at the end.',
    },
    'rate-not-subtract-one': {
      name: 'Forgot to subtract 1 from the growth factor',
      explanation:
        'Taking the $t$-th root gives the growth factor $1 + r$, not $r$. A factor of $1.10$ means a rate of $10\\%$: subtract 1, then convert to a percent.',
    },
    'decimal-not-percent': {
      name: 'Gave the rate as a decimal when a percent was asked',
      explanation:
        'You found $r = 0.10$ correctly, but the question asks for a percent. Multiply by 100: $0.10 \\to 10\\%$.',
    },
  },
  stepLabels: {
    'growth-factor': 'Find the growth factor (1 + r)',
    raise: 'Raise to the number of periods',
    multiply: 'Multiply by the starting amount',
    continuous: 'Use e^(rt) for continuous growth',
    divide: 'Divide both sides by P',
    'take-log': 'Take logs',
    solve: 'Solve',
    root: 'Take the t-th root',
    'to-percent': 'Convert to a percent',
  },
  learn: {
    whyItMatters:
      'GDP, prices, populations and investments change by a percentage each period, so they grow exponentially. Put \\$1000 in an account paying 7% a year: after 10 years it holds $1000 \\cdot 1.07^{10} \\approx \\$1967.15$, nearly double, which matches the rule of thumb that money doubles in about $70/7 = 10$ years. At 3% growth an economy doubles in about $70/3 \\approx 23$ years. Run the same formula backwards and you get present value and discounting, which later economics skills build on.',
    summary:
      'Growth by a rate $r$ per period multiplies by $1 + r$ each period: $A = P(1 + r)^t$. Decay multiplies by $1 - r$. Continuous growth uses $A = Pe^{rt}$. To find an unknown time, divide by $P$ and take logs; to find an unknown rate, take a root and subtract 1. Always write percents as decimals first.',
    formulas: [
      { latex: 'A = P(1 + r)^t', note: 'Growth. Use $1 - r$ for decay.' },
      { latex: 'A = Pe^{rt}', note: 'Continuous compounding.' },
      { latex: 't = \\frac{\\ln k}{\\ln(1 + r)}', note: 'Time for money to grow $k$ times.' },
      { latex: 'r = \\left(\\frac{A}{P}\\right)^{1/t} - 1', note: 'Solve for the rate.' },
    ],
    example: { seed: 3, level: 1 },
    tips: ['Check reasonableness: at 5% growth, 14 years is about the doubling time ($70/5$).'],
  },

  generate(rng, level) {
    switch (level) {
      case 1:
      case 2:
        return compound(rng, level);
      case 3:
        return continuous(rng);
      case 4:
        return solveTime(rng);
      case 5:
        return solveRate(rng);
    }
  },
};
