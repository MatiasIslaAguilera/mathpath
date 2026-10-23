// Two-period consumption and the Solow model.
// L1 the intertemporal budget (present value, future value, slope), L2 optimal consumption with
// U = c1·c2, L3 saving and borrowing with U = c1^a c2^(1-a), L4 the Solow steady state with
// y = A k^α, L5 steady-state consumption and the golden rule.
// Every answer is chosen first and the givens are built from it, so all arithmetic is exact.

import { numberAnswer, tupleAnswer } from '../../engine/answers';
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

const ID = 'intertemporal-solow';
type Body = ReturnType<SkillDefinition['generate']>;

/** Interest rates: 5%, 10%, 20%, 25%, 50%. */
const RATES: Q[] = [q(1, 20), q(1, 10), q(1, 5), q(1, 4), q(1, 2)];
/** Cobb-Douglas shares a for U = c1^a c2^(1-a). */
const SHARES: Q[] = [q(1, 5), q(1, 4), q(1, 3), q(1, 2), q(2, 3), q(3, 4)];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

// ---------- helpers ----------

const lat = (v: Q) => v.toLatex();
const money = (n: number | Q) => `\\$${typeof n === 'number' ? n : n.toLatex()}`;
const pct = (n: number) => `${n}\\%`;
const one = (r: Q) => q(1).add(r);
const rPctOf = (r: Q) => Math.round(r.valueOf() * 100);
const coefA = (A: number) => (A === 1 ? '' : `${A}`);

/** Integer r-th root, or null. */
function iroot(n: number, r: number): number | null {
  if (n < 0) return null;
  const x = Math.round(Math.pow(n, 1 / r));
  for (const c of [x - 1, x, x + 1]) if (c >= 0 && c ** r === n) return c;
  return null;
}
/** x^(p/r) exactly, or null when the root is irrational. */
function qPow(x: Q, p: number, r: number): Q | null {
  const nn = iroot(x.n, r);
  const dd = iroot(x.d, r);
  if (nn === null || dd === null || dd === 0) return null;
  return q(nn ** p, dd ** p);
}

function mkChoice(rng: Rng, rows: { label: string; ok: boolean }[]): { options: ChoiceOption[]; correct: string } {
  const sh = rng.shuffle(rows.map((r, i) => ({ id: `o${i}`, label: r.label, ok: r.ok })));
  return { options: sh.map(({ id, label }): ChoiceOption => ({ id, label })), correct: sh.find((o) => o.ok)!.id };
}

const pvOf = (m1: number, m2: number, r: Q) => q(m1).add(q(m2).div(one(r)));

// ---------- two-period steps ----------

function pvEndowmentStep(m2: number, r: Q): Step {
  const d = q(m2).div(one(r));
  return {
    key: 'pv-endowment',
    instruction: `Put next period's income in today's dollars: divide $${m2}$ by $1 + r = ${lat(one(r))}$.`,
    math: `\\frac{m_2}{1+r} = \\frac{${m2}}{${lat(one(r))}} = ${lat(d)}`,
    why: 'A dollar next period is worth only $1/(1+r)$ of a dollar today, because a dollar today grows to $1+r$.',
    ask: {
      prompt: "What is next period's income worth today?",
      answer: numberAnswer(d),
      verify: { type: 'evaluate', expr: `${m2}/(1+${r.toExpr()})` },
    },
  };
}

// ---------- interpretation (drawn last) ----------

function pvMeaning(rng: Rng, pv: Q): InterpretationQuestion {
  const { options, correct } = mkChoice(rng, [
    { label: 'The most she could spend today by borrowing against next period\'s income', ok: true },
    { label: 'Her total income, adding the two periods with no interest', ok: false },
    { label: "Next period's income", ok: false },
    { label: 'The amount she will save', ok: false },
  ]);
  return {
    prompt: `The present value of her endowment is ${money(pv)}. What does that mean?`,
    options,
    correct,
    explanation: `Present value puts both incomes in today's dollars: $m_1 + \\frac{m_2}{1+r} = ${lat(pv)}$. It is the most she can consume today, by borrowing against next period's income and repaying with interest. It is not the plain sum of the incomes, and it says nothing about how much she chooses to save.`,
  };
}

function borrowerQuestion(rng: Rng, m1: number, c1: Q): InterpretationQuestion {
  const diff = q(m1).sub(c1);
  const kind = diff.sign() > 0 ? 'saver' : diff.sign() < 0 ? 'borrower' : 'neither';
  const { options, correct } = mkChoice(rng, [
    { label: 'A saver: she consumes less than her income today', ok: kind === 'saver' },
    { label: 'A borrower: she consumes more than her income today', ok: kind === 'borrower' },
    { label: 'Neither: she consumes exactly her income today', ok: kind === 'neither' },
  ]);
  const why =
    kind === 'saver'
      ? `Her income today is ${money(m1)} but she consumes ${money(c1)}, so she saves ${money(diff)}.`
      : kind === 'borrower'
        ? `Her income today is ${money(m1)} but she consumes ${money(c1)}, so she borrows ${money(diff.neg())}.`
        : `Her income today is ${money(m1)} and she consumes exactly ${money(c1)}, so she neither saves nor borrows.`;
  return {
    prompt: 'Is this consumer a borrower or a saver in period 1?',
    options,
    correct,
    explanation: `Compare $c_1^*$ with $m_1$. ${why}`,
  };
}

function rateRiseQuestion(rng: Rng, a: Q, m1: number, m2: number, r: Q): InterpretationQuestion {
  const c1Now = a.mul(pvOf(m1, m2, r));
  const hi = q(1);
  const c1Hi = a.mul(pvOf(m1, m2, hi));
  const kind = m2 === 0 ? 'same' : 'fall';
  const { options, correct } = mkChoice(rng, [
    { label: 'Fall', ok: kind === 'fall' },
    { label: 'Stay the same', ok: kind === 'same' },
    { label: 'Rise', ok: false },
  ]);
  return {
    prompt: `The interest rate rises. For this consumer, $c_1^*$ will...`,
    options,
    correct,
    explanation: `With these preferences $c_1^* = a\\left(m_1 + \\frac{m_2}{1+r}\\right)$. A higher $r$ makes next period's income worth less today, so lifetime wealth and $c_1^*$ fall (for example, at $r = ${pct(rPctOf(r))}$, $c_1^* = ${lat(c1Now)}$; at $r = 100\\%$, $c_1^* = ${lat(c1Hi)}$). If $m_2$ were zero nothing would change.`,
  };
}

// ---------- L1 ----------

function level1(rng: Rng): Body {
  const r = rng.pick(RATES);
  const g = one(r);
  const rP = rPctOf(r);
  const disc = 100 * rng.int(3, 20);
  const m2 = q(disc).mul(g).n; // 100·g is an integer for every rate in the set
  const m1 = 100 * rng.int(5, 30);
  const form = rng.int(0, 2);
  const pv = pvOf(m1, m2, r);
  const fv = q(m1).mul(g).add(m2);
  const intro = `A consumer earns ${money(m1)} now (period 1) and ${money(m2)} next period (period 2). She can borrow or lend at an interest rate of $${pct(rP)}$ per period.`;
  const params = { m1, m2, rPct: rP, form };
  const rE = r.toExpr();

  if (form === 0) {
    const answer = numberAnswer(pv);
    const verify: VerifySpec = { type: 'evaluate', expr: `${m1} + ${m2}/(1+${rE})` };
    return {
      params,
      prompt: `${intro} What is the present value of her endowment?`,
      answer,
      steps: [
        pvEndowmentStep(m2, r),
        {
          key: 'budget',
          instruction: 'Add this period\'s income to the discounted future income.',
          math: `PV = m_1 + \\frac{m_2}{1+r} = ${m1} + ${lat(q(m2).div(g))} = ${lat(pv)}`,
          why: 'Present value measures everything in period-1 dollars, so every amount is converted to today before adding.',
          ask: { prompt: 'What is the present value of her endowment?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        { id: 'compounded-m2', wrong: numberAnswer(q(m1).add(q(m2).mul(g))) },
        { id: 'ignored-interest', wrong: numberAnswer(q(m1 + m2)) },
      ]),
      interpretation: rng.chance(0.5) ? [pvMeaning(rng, pv)] : undefined,
      verify,
    };
  }
  if (form === 1) {
    const answer = numberAnswer(fv);
    const verify: VerifySpec = { type: 'evaluate', expr: `${m1}*(1+${rE}) + ${m2}` };
    return {
      params,
      prompt: `${intro} What is the most she can consume in period 2 (the future value of her endowment)?`,
      answer,
      steps: [
        {
          key: 'grow-m1',
          instruction: `Grow this period's income to next period: multiply $${m1}$ by $1 + r = ${lat(g)}$.`,
          math: `m_1(1+r) = ${m1}\\cdot ${lat(g)} = ${lat(q(m1).mul(g))}`,
          why: 'If she saves all of this period\'s income, it grows by the factor $1 + r$ by next period.',
          ask: {
            prompt: "What is this period's income worth next period?",
            answer: numberAnswer(q(m1).mul(g)),
            verify: { type: 'evaluate', expr: `${m1}*(1+${rE})` },
          },
        },
        {
          key: 'budget',
          instruction: "Add next period's own income.",
          math: `FV = m_1(1+r) + m_2 = ${lat(q(m1).mul(g))} + ${m2} = ${lat(fv)}`,
          why: 'Future value measures everything in period-2 dollars: grow what you have now, then add what arrives then.',
          ask: { prompt: 'What is the future value of her endowment?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        { id: 'compounded-m2', wrong: numberAnswer(q(m1).div(g).add(m2)) },
        { id: 'ignored-interest', wrong: numberAnswer(q(m1 + m2)) },
      ]),
      interpretation: rng.chance(0.5) ? [pvMeaning(rng, pv)] : undefined,
      verify,
    };
  }
  // form 2: slope of the budget line
  const slope = g.neg();
  const answer = numberAnswer(slope);
  const verify: VerifySpec = { type: 'evaluate', expr: `(${m2} - (${m1}*(1+${rE}) + ${m2}))/${m1}` };
  return {
    params,
    prompt: `${intro} Draw her budget line with $c_1$ on the horizontal axis and $c_2$ on the vertical axis. What is its slope?`,
    answer,
    steps: [
      {
        key: 'fv-intercept',
        instruction: 'Find the vertical intercept: consume nothing now and everything next period.',
        math: `c_2 = m_1(1+r) + m_2 = ${lat(fv)}`,
        why: 'Consuming nothing today means saving all of $m_1$, which grows to $m_1(1+r)$ and is added to $m_2$.',
        ask: {
          prompt: 'What is the most she can consume in period 2?',
          answer: numberAnswer(fv),
          verify: { type: 'evaluate', expr: `${m1}*(1+${rE}) + ${m2}` },
        },
      },
      {
        key: 'slope',
        instruction: 'The line runs from the endowment $(m_1, m_2)$ to the intercept $(0, FV)$. Divide the rise by the run.',
        math: `\\text{slope} = \\frac{m_2 - FV}{m_1 - 0} = -(1+r) = ${lat(slope)}`,
        why: 'Each dollar of period-1 consumption given up buys $1 + r$ dollars of period-2 consumption, so the line slopes down at $-(1+r)$.',
        ask: { prompt: 'What is the slope of the budget line?', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      { id: 'slope-inverted', wrong: numberAnswer(q(-1).div(g)) },
      { id: 'ignored-interest', wrong: numberAnswer(q(-1)) },
    ]),
    interpretation: rng.chance(0.5) ? [pvMeaning(rng, pv)] : undefined,
    verify,
  };
}

// ---------- L2 ----------

function level2(rng: Rng): Body {
  const r = rng.pick(RATES);
  const g = one(r);
  const rP = rPctOf(r);
  const j = rng.int(3, 15);
  const i = rng.int(1, 2 * j - 1);
  const c1 = q(100 * j);
  const c2 = c1.mul(g);
  const m1 = 100 * i;
  const disc = 100 * (2 * j - i);
  const m2 = q(disc).mul(g).n;
  const pv = pvOf(m1, m2, r);
  const rE = r.toExpr();
  const answer = tupleAnswer(['c1', 'c2'], [c1, c2]);
  const eqs = [`c2 = (1+${rE})*c1`, `c1 + c2/(1+${rE}) = ${m1} + ${m2}/(1+${rE})`];
  const verify: VerifySpec = { type: 'solve', equations: eqs, unknowns: ['c1', 'c2'] };

  const pvW = q(m1).add(q(m2).mul(g)); // compounded-m2
  const pvI = q(m1 + m2); // ignored-interest
  const eq = pv.mul(g).div(q(2).add(r)); // equal-consumption: c + c/(1+r) = PV
  const wrong: MisconceptionInstance[] = [
    { id: 'compounded-m2', wrong: tupleAnswer(['c1', 'c2'], [pvW.div(2), pvW.div(2).mul(g)]) },
    { id: 'ignored-interest', wrong: tupleAnswer(['c1', 'c2'], [pvI.div(2), pvI.div(2).mul(g)]) },
    { id: 'equal-consumption', wrong: tupleAnswer(['c1', 'c2'], [eq, eq]) },
  ];
  const interp = rng.chance(0.5) ? [borrowerQuestion(rng, m1, c1), rateRiseQuestion(rng, q(1, 2), m1, m2, r)] : undefined;
  return {
    params: { m1, m2, rPct: rP },
    prompt: `A consumer has utility $U = c_1 c_2$ over consumption today and next period. She earns ${money(m1)} now and ${money(m2)} next period, and can borrow or lend at $${pct(rP)}$ interest. Find her optimal consumption $(c_1^*, c_2^*)$.`,
    answer,
    steps: [
      pvEndowmentStep(m2, r),
      {
        key: 'mrs',
        instruction: 'At the optimum the MRS equals the price of period-1 consumption in period-2 goods, $1 + r$. For $U = c_1c_2$ the MRS is $c_2/c_1$.',
        math: `MRS = \\frac{c_2}{c_1} = 1 + r = ${lat(g)}`,
        why: 'Giving up one dollar today buys $1 + r$ dollars next period. The consumer trades until her willingness to trade matches that rate.',
        ask: {
          prompt: 'What is $c_2 / c_1$ at the optimum?',
          answer: numberAnswer(g),
          verify: { type: 'evaluate', expr: `1+${rE}` },
        },
      },
      {
        key: 'split',
        instruction: `Spend half of lifetime wealth ($PV = ${lat(pv)}$) today: with $U = c_1c_2$ the exponents are equal.`,
        math: `c_1^* = \\frac{PV}{2} = \\frac{${lat(pv)}}{2} = ${lat(c1)}`,
        why: 'Substituting $c_2 = (1+r)c_1$ into the budget $c_1 + \\frac{c_2}{1+r} = PV$ gives $2c_1 = PV$.',
        ask: {
          prompt: 'What is $c_1^*$?',
          answer: numberAnswer(c1),
          verify: { type: 'solve', equations: [`c1 + ${c2.toExpr()}/(1+${rE}) = ${m1} + ${m2}/(1+${rE})`, `${c2.toExpr()} = (1+${rE})*c1`], unknowns: ['c1'] },
        },
      },
      {
        key: 'c2',
        instruction: 'Use the tangency line to find next-period consumption.',
        math: `c_2^* = (1+r)\\,c_1^* = ${lat(g)}\\cdot ${lat(c1)} = ${lat(c2)}`,
        why: 'Check: $c_1 + c_2/(1+r)$ should equal the present value of the endowment.',
        ask: { prompt: 'State $(c_1^*, c_2^*)$.', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, wrong),
    interpretation: interp,
    verify,
  };
}

// ---------- L3 ----------

function level3(rng: Rng): Body {
  for (;;) {
    const r = rng.pick(RATES);
    const g = one(r);
    const rP = rPctOf(r);
    const a = rng.pick(SHARES);
    const b = q(1).sub(a);
    const form = rng.int(0, 2);
    const step = lcm(a.d, b.mul(g).d);
    const tMin = Math.ceil(600 / step);
    const tMax = Math.floor(4000 / step);
    const pvN = step * rng.int(tMin, tMax);
    const disc = 20 * rng.int(5, Math.floor((pvN - 100) / 20));
    const m1 = pvN - disc;
    if (m1 < 100 || disc < 100) continue;
    const m2 = q(disc).mul(g).n;
    const pv = pvOf(m1, m2, r);
    if (!pv.eq(pvN)) continue;
    const c1 = a.mul(pv);
    const sav = q(m1).sub(c1);
    const c2 = b.mul(g).mul(pv);
    const rE = r.toExpr();
    const aE = a.toExpr();
    const bE = `(1-${aE})`;
    const gE = `(1+${rE})`;
    const wealth = `${m1} + ${m2}/${gE}`;
    const util = `U = c_1^{${lat(a)}}\\,c_2^{${lat(b)}}`;
    const intro = `A consumer has utility $${util}$. She earns ${money(m1)} now and ${money(m2)} next period, and can borrow or lend at $${pct(rP)}$ interest.`;
    const params = { m1, m2, rPct: rP, aN: a.n, aD: a.d, form };

    // Substituting the tangency c2 = (1-a)(1+r) c1 / a into the budget, one unknown at a time.
    const vC1: VerifySpec = { type: 'solve', equations: [`c1 + (${bE}*${gE}*c1/${aE})/${gE} = ${wealth}`], unknowns: ['c1'] };
    const vS: VerifySpec = { type: 'solve', equations: [`(${m1} - s) + (${bE}*${gE}*(${m1} - s)/${aE})/${gE} = ${wealth}`], unknowns: ['s'] };
    const vC2: VerifySpec = { type: 'solve', equations: [`c2*${aE}/(${bE}*${gE}) + c2/${gE} = ${wealth}`], unknowns: ['c2'] };

    const pvW = q(m1).add(q(m2).mul(g)); // compounded-m2
    const pvI = q(m1 + m2); // ignored-interest
    const c1W = a.mul(pvW);
    const c1I = a.mul(pvI);
    const sav1 = (c: Q) => q(m1).sub(c);
    const c2from = (p: Q) => b.mul(g).mul(p);

    const splitStep: Step = {
      key: 'split',
      instruction: `Spend the share $a = ${lat(a)}$ of lifetime wealth ($PV = ${lat(pv)}$) today.`,
      math: `c_1^* = a\\cdot PV = ${lat(a)}\\cdot ${lat(pv)} = ${lat(c1)}`,
      why: 'With $U = c_1^{a}c_2^{1-a}$ the consumer spends the fraction $a$ of lifetime wealth on period-1 consumption, whatever the interest rate.',
      ask: { prompt: 'What is $c_1^*$?', answer: numberAnswer(c1), verify: vC1 },
    };

    let answer;
    let prompt;
    let steps: Step[];
    let wrong: MisconceptionInstance[];
    let verify: VerifySpec;
    if (form === 0) {
      answer = numberAnswer(c1);
      prompt = `${intro} What is her optimal consumption today, $c_1^*$?`;
      steps = [pvEndowmentStep(m2, r), splitStep];
      verify = vC1;
      wrong = [
        { id: 'compounded-m2', wrong: numberAnswer(c1W) },
        { id: 'ignored-interest', wrong: numberAnswer(c1I) },
        { id: 'share-of-m1', wrong: numberAnswer(a.mul(m1)) },
      ];
    } else if (form === 1) {
      answer = numberAnswer(sav);
      prompt = `${intro} How much does she save in period 1? Give a negative number if she borrows.`;
      verify = vS;
      steps = [
        pvEndowmentStep(m2, r),
        splitStep,
        {
          key: 'save',
          instruction: `Subtract consumption from income: $s = m_1 - c_1^* = ${m1} - ${lat(c1)}$.`,
          math: `s = ${m1} - ${lat(c1)} = ${lat(sav)}`,
          why: 'Saving is income not consumed. A negative value means she consumes more than she earns, which is borrowing.',
          ask: { prompt: 'How much does she save (negative if she borrows)?', answer, verify: vS },
        },
      ];
      wrong = [
        { id: 'compounded-m2', wrong: numberAnswer(sav1(c1W)) },
        { id: 'ignored-interest', wrong: numberAnswer(sav1(c1I)) },
        { id: 'share-of-m1', wrong: numberAnswer(sav1(a.mul(m1))) },
        { id: 'saving-sign', wrong: numberAnswer(sav.neg()) },
      ];
    } else {
      answer = numberAnswer(c2);
      prompt = `${intro} What is her optimal consumption next period, $c_2^*$?`;
      verify = vC2;
      steps = [
        pvEndowmentStep(m2, r),
        splitStep,
        {
          key: 'saving-amount',
          instruction: `Find what she saves: $s = m_1 - c_1^* = ${m1} - ${lat(c1)}$ (negative if she borrows).`,
          math: `s = ${m1} - ${lat(c1)} = ${lat(sav)}`,
          why: 'What she does not consume today is carried to next period (or, if negative, borrowed and repaid).',
          ask: {
            prompt: 'How much does she save (negative if she borrows)?',
            answer: numberAnswer(sav),
            verify: { type: 'evaluate', expr: `${m1} - ${c1.toExpr()}` },
          },
        },
        {
          key: 'save',
          instruction: `Grow the saving by $1 + r = ${lat(g)}$ and add next period's income.`,
          math: `c_2^* = s(1+r) + m_2 = ${lat(sav)}\\cdot ${lat(g)} + ${m2} = ${lat(c2)}`,
          why: 'Next-period consumption is the grown-up saving (or minus the repayment of the loan) plus income that arrives then.',
          ask: { prompt: 'What is $c_2^*$?', answer, verify: vC2 },
        },
      ];
      wrong = [
        { id: 'compounded-m2', wrong: numberAnswer(c2from(pvW)) },
        { id: 'ignored-interest', wrong: numberAnswer(c2from(pvI)) },
        { id: 'share-of-m1', wrong: numberAnswer(b.mul(g).mul(m1)) },
      ];
    }
    const interp = rng.chance(0.5) ? [borrowerQuestion(rng, m1, c1), rateRiseQuestion(rng, a, m1, m2, r)] : undefined;
    return { params, prompt, answer, steps, misconceptions: distinctMisconceptions(answer, wrong), interpretation: interp, verify };
  }
}

// ---------- Solow ----------

interface SolowDraw {
  S: number;
  A: number;
  N: number;
  D: number;
  an: number;
  ad: number;
  Z: Q;
}

/** s, A, n, δ with sA/(n+δ) a whole number (a perfect square when α = 1/3). */
function drawSolow(rng: Rng, ads: number[]): SolowDraw {
  for (;;) {
    const ad = rng.pick(ads);
    const Z = ad === 2 ? rng.int(2, 8) : rng.int(2, 4) ** 2;
    const A = rng.int(1, 5);
    const N = rng.int(1, 4);
    const D = rng.int(2, 9);
    const num = Z * (N + D);
    if (num % A !== 0) continue;
    const S = num / A;
    if (S < 5 || S > 60) continue;
    return { S, A, N, D, an: 1, ad, Z: q(Z) };
  }
}

const sQ = (S: number) => q(S, 100);
const nd = (N: number, D: number) => q(N + D, 100);
const alphaOf = (an: number, ad: number) => q(an, ad);
/** k* = Z^(1/(1-α)), y* = A·Z^(α/(1-α)). Null when irrational. */
const kStar = (Z: Q, an: number, ad: number) => qPow(Z, ad, ad - an);
const yStar = (Z: Q, A: number, an: number, ad: number) => {
  const p = qPow(Z, an, ad - an);
  return p ? p.mul(A) : null;
};

function modelText(A: number, an: number, ad: number, S: number, N: number, D: number): string {
  return `Output per worker is $y = ${coefA(A)}k^{${lat(alphaOf(an, ad))}}$. Workers save a fraction $s = ${pct(S)}$ of output, the population grows at $n = ${pct(N)}$ and capital depreciates at $\\delta = ${pct(D)}$.`;
}

/** Steady-state equation s·A·k^α = (n+δ)·k as a verify string. */
const steadyEq = (S: number, A: number, an: number, ad: number, N: number, D: number, kExpr = 'k') =>
  `${sQ(S).toExpr()}*${A}*${kExpr}^${alphaOf(an, ad).toExpr()} = (${q(N, 100).toExpr()}+${q(D, 100).toExpr()})*${kExpr}`;

function steadyConditionStep(S: number, A: number, N: number, D: number, Z: Q): Step {
  return {
    key: 'steady-condition',
    instruction: 'In the steady state saving equals break-even investment: $sAk^{\\alpha} = (n+\\delta)k$. Divide to get the ratio $\\frac{sA}{n+\\delta}$.',
    math: `\\frac{sA}{n+\\delta} = \\frac{${lat(sQ(S))}\\cdot ${A}}{${lat(nd(N, D))}} = ${lat(Z)}`,
    why: 'Investment $sAk^{\\alpha}$ adds capital per worker; $(n+\\delta)k$ is what must be replaced as workers are added and machines wear out. Steady state is where they match.',
    ask: {
      prompt: 'What is $\\frac{sA}{n+\\delta}$?',
      answer: numberAnswer(Z),
      verify: { type: 'evaluate', expr: `${sQ(S).toExpr()}*${A}/(${q(N, 100).toExpr()}+${q(D, 100).toExpr()})` },
    },
  };
}

function solveKStep(S: number, A: number, an: number, ad: number, N: number, D: number, Z: Q, k: Q): Step {
  const e = q(ad, ad - an);
  return {
    key: 'solve-k',
    instruction: `Cancel one $k$ from both sides: $k^{${lat(q(1).sub(alphaOf(an, ad)))}} = \\frac{sA}{n+\\delta}$. Raise the ratio to the power $\\frac{1}{1-\\alpha} = ${lat(e)}$.`,
    math: `k^* = \\left(\\frac{sA}{n+\\delta}\\right)^{\\frac{1}{1-\\alpha}} = ${lat(Z)}^{${lat(e)}} = ${lat(k)}`,
    why: 'Dividing $sAk^{\\alpha} = (n+\\delta)k$ by $k^{\\alpha}$ leaves $k^{1-\\alpha}$ on the right. Undo that power with its reciprocal.',
    ask: {
      prompt: 'What is $k^*$?',
      answer: numberAnswer(k),
      verify: { type: 'solve', equations: [steadyEq(S, A, an, ad, N, D)], unknowns: ['k'], positive: true },
    },
  };
}

function outputStep(S: number, A: number, an: number, ad: number, N: number, D: number, k: Q, y: Q): Step {
  return {
    key: 'output',
    instruction: `Plug $k^* = ${lat(k)}$ into $y = ${coefA(A)}k^{${lat(alphaOf(an, ad))}}$.`,
    math: `y^* = ${coefA(A)}\\left(${lat(k)}\\right)^{${lat(alphaOf(an, ad))}} = ${lat(y)}`,
    why: 'Output per worker follows from capital per worker through the production function. Check: $s y^*$ should equal $(n+\\delta)k^*$.',
    ask: {
      prompt: 'What is $y^*$?',
      answer: numberAnswer(y),
      verify: {
        type: 'solve',
        equations: [`${sQ(S).toExpr()}*y = (${q(N, 100).toExpr()}+${q(D, 100).toExpr()})*(y/${A})^${ad}`],
        unknowns: ['y'],
        positive: true,
      },
    },
  };
}

function constantQuestion(rng: Rng, N: number): InterpretationQuestion {
  const { options, correct } = mkChoice(rng, [
    { label: 'Capital per worker and output per worker', ok: true },
    { label: 'Total output', ok: false },
    { label: 'Total capital', ok: false },
    { label: 'Saving (in dollars) each period', ok: false },
  ]);
  return {
    prompt: 'In the steady state, what stays constant?',
    options,
    correct,
    explanation: `In the steady state $k$ and $y$ (per worker) stop changing: new saving exactly replaces depreciation and equips the new workers. Totals still grow, because the number of workers grows at $n = ${pct(N)}$ per period, so total output and total capital grow at that rate and so does total saving.`,
  };
}

function savingRateQuestion(rng: Rng, d: SolowDraw): InterpretationQuestion {
  const { S, A, N, D, an, ad } = d;
  const y0 = yStar(q(S * A, N + D), A, an, ad);
  const y1 = yStar(q((S + 10) * A, N + D), A, an, ad);
  const num = y0 && y1 ? ` (for example, raising $s$ from ${pct(S)} to ${pct(S + 10)} moves $y^*$ from ${lat(y0)} to ${lat(y1)})` : '';
  const { options, correct } = mkChoice(rng, [
    { label: 'False: it raises the steady-state level of output per worker, but growth per worker returns to zero', ok: true },
    { label: 'True: more saving means faster growth forever', ok: false },
    { label: 'True, but only if the population stops growing', ok: false },
    { label: 'False: a higher saving rate always lowers output per worker in the long run', ok: false },
  ]);
  return {
    prompt: 'True or false: a higher saving rate raises the long-run growth rate of output per worker (here, with no technology growth).',
    options,
    correct,
    explanation: `A higher $s$ moves the economy to a higher steady state${num}, but once it is there $k$ and $y$ stop growing. Saving changes the level, not the long-run growth rate.`,
  };
}

// ---------- L4 ----------

function level4(rng: Rng): Body {
  const d = drawSolow(rng, [2, 3]);
  const { S, A, N, D, an, ad, Z } = d;
  const form = rng.int(0, 1);
  const k = kStar(Z, an, ad)!;
  const y = yStar(Z, A, an, ad)!;
  const answer = numberAnswer(form === 0 ? k : y);
  // wrong answers: leave δ out of break-even investment (Z' = sA/n)
  const Zn = q(S * A, N);
  const kn = kStar(Zn, an, ad);
  const yn = yStar(Zn, A, an, ad);
  const verify: VerifySpec =
    form === 0
      ? { type: 'solve', equations: [steadyEq(S, A, an, ad, N, D)], unknowns: ['k'], positive: true }
      : { type: 'solve', equations: [`${sQ(S).toExpr()}*y = (${q(N, 100).toExpr()}+${q(D, 100).toExpr()})*(y/${A})^${ad}`], unknowns: ['y'], positive: true };
  const wrong: MisconceptionInstance[] =
    form === 0
      ? [
          { id: 'forgot-depreciation', wrong: kn ? numberAnswer(kn) : (null as never) },
          { id: 'no-power', wrong: numberAnswer(Z) },
        ]
      : [{ id: 'forgot-depreciation', wrong: yn ? numberAnswer(yn) : (null as never) }];
  const steps: Step[] = [steadyConditionStep(S, A, N, D, Z), solveKStep(S, A, an, ad, N, D, Z, k)];
  if (form === 1) steps.push(outputStep(S, A, an, ad, N, D, k, y));
  return {
    params: { s: S, A, n: N, d: D, an, ad, form },
    prompt: `Consider a Solow economy. ${modelText(A, an, ad, S, N, D)} Find steady-state ${form === 0 ? 'capital per worker $k^*$' : 'output per worker $y^*$'}.`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, wrong.filter((w) => w.wrong)),
    interpretation: rng.chance(0.5) ? [constantQuestion(rng, N)] : undefined,
    verify,
  };
}

// ---------- L5 ----------

function level5(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 0) {
    const d = drawSolow(rng, [2, 3]);
    const { S, A, N, D, an, ad, Z } = d;
    const k = kStar(Z, an, ad)!;
    const y = yStar(Z, A, an, ad)!;
    const c = q(1).sub(sQ(S)).mul(y);
    const answer = numberAnswer(c);
    const Zn = q(S * A, N);
    const yn = yStar(Zn, A, an, ad);
    const wrong: MisconceptionInstance[] = [{ id: 'consumed-saving', wrong: numberAnswer(sQ(S).mul(y)) }];
    if (yn) wrong.push({ id: 'forgot-depreciation', wrong: numberAnswer(q(1).sub(sQ(S)).mul(yn)) });
    const verify: VerifySpec = {
      type: 'solve',
      equations: [steadyEq(S, A, an, ad, N, D, k.toExpr()), `c = ${A}*${k.toExpr()}^${alphaOf(an, ad).toExpr()} - (${q(N, 100).toExpr()}+${q(D, 100).toExpr()})*${k.toExpr()}`],
      unknowns: ['c'],
    };
    // golden-rule comparison (second question): needs an exact golden-rule output
    const Zg = alphaOf(an, ad).mul(A).div(nd(N, D));
    const yg = yStar(Zg, A, an, ad);
    const interp: InterpretationQuestion[] = [savingRateQuestion(rng, d)];
    if (yg) {
      const cNow = c;
      const cGold = q(1).sub(alphaOf(an, ad)).mul(yg);
      const kind = cGold.valueOf() > cNow.valueOf() + 1e-12 ? 'rise' : cGold.valueOf() < cNow.valueOf() - 1e-12 ? 'fall' : 'same';
      const { options, correct } = mkChoice(rng, [
        { label: 'Rise', ok: kind === 'rise' },
        { label: 'Fall', ok: kind === 'fall' },
        { label: 'Stay the same', ok: kind === 'same' },
      ]);
      interp.push({
        prompt: `If the saving rate were changed to the golden-rule rate $s = \\alpha = ${lat(alphaOf(an, ad))}$, steady-state consumption $c^*$ would...`,
        options,
        correct,
        explanation: `Consumption is highest at $s = \\alpha$. Here $c^* = ${lat(cNow)}$ at $s = ${pct(S)}$ and $c^* = ${lat(cGold)}$ at $s = \\alpha$, so it would ${kind === 'rise' ? 'rise' : kind === 'fall' ? 'fall' : 'stay the same'}. The golden rule is the saving rate that maximizes steady-state consumption, so moving to it can never lower $c^*$. It raises $c^*$ unless the economy already saves exactly $\\alpha$.`,
      });
    }
    return {
      params: { s: S, A, n: N, d: D, an, ad, form },
      prompt: `Consider a Solow economy. ${modelText(A, an, ad, S, N, D)} Find steady-state consumption per worker $c^*$.`,
      answer,
      steps: [
        steadyConditionStep(S, A, N, D, Z),
        solveKStep(S, A, an, ad, N, D, Z, k),
        outputStep(S, A, an, ad, N, D, k, y),
        {
          key: 'consume',
          instruction: `Consume what is not saved: $c^* = (1 - s)\\,y^* = ${lat(q(1).sub(sQ(S)))}\\cdot ${lat(y)}$.`,
          math: `c^* = (1-s)\\,y^* = ${lat(q(1).sub(sQ(S)))}\\cdot ${lat(y)} = ${lat(c)}`,
          why: 'Output per worker is either saved (and invested) or consumed, so consumption is the share $1 - s$ of output.',
          ask: { prompt: 'What is $c^*$?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, wrong),
      interpretation: rng.chance(0.5) ? interp : undefined,
      verify,
    };
  }

  // forms 1 and 2: golden rule. Pick W = αA/(n+δ) whole and small.
  for (;;) {
    const ad = form === 1 ? 2 : rng.pick([2, 4]);
    const an = ad === 2 ? 1 : 3;
    const alpha = alphaOf(an, ad);
    const A = rng.int(1, 6);
    const N = rng.int(1, 4);
    const D = rng.int(2, 9);
    const W = alpha.mul(A * 100).div(N + D); // αA/(n+δ)
    if (!W.isInt() || W.n < 1 || W.n > 6) continue;
    const S = form === 1 ? 5 * rng.int(2, 10) : 5 * rng.int(2, 18);
    if (S === rPctOf(alpha)) continue;
    const kg = qPow(W, ad, ad - an)!; // W^(1/(1-α))
    const ndE = `(${q(N, 100).toExpr()}+${q(D, 100).toExpr()})`;
    const alE = alpha.toExpr();
    const common = `${modelText(A, an, ad, S, N, D)}`;
    if (form === 1) {
      const answer = numberAnswer(kg);
      const verify: VerifySpec = { type: 'solve', equations: [`${alE}*${A}*k^(${alE}-1) = ${ndE}`], unknowns: ['k'], positive: true };
      const kn = qPow(q(A * 100, 2 * N), 2, 1); // (A/(2n))^2 with δ left out
      const wrong: MisconceptionInstance[] = kn ? [{ id: 'forgot-depreciation', wrong: numberAnswer(kn) }] : [];
      return {
        params: { s: S, A, n: N, d: D, an, ad, form },
        prompt: `Consider a Solow economy. ${common} What level of capital per worker, $k_{gold}$, maximizes steady-state consumption (the golden rule)?`,
        answer,
        steps: [
          {
            key: 'golden-ratio',
            instruction: 'The golden rule sets the marginal product of capital equal to $n + \\delta$: $\\alpha A k^{\\alpha-1} = n + \\delta$. Isolate $k^{\\alpha-1}$ by finding $\\frac{\\alpha A}{n+\\delta}$.',
            math: `\\frac{\\alpha A}{n+\\delta} = \\frac{${lat(alpha)}\\cdot ${A}}{${lat(nd(N, D))}} = ${lat(W)}`,
            why: 'Consumption is largest where one more unit of capital adds exactly what it costs to maintain, $f\'(k) = n + \\delta$.',
            ask: {
              prompt: 'What is $\\frac{\\alpha A}{n+\\delta}$?',
              answer: numberAnswer(W),
              verify: { type: 'evaluate', expr: `${alE}*${A}/${ndE}` },
            },
          },
          {
            key: 'golden',
            instruction: `Since $k^{\\alpha-1} = 1/k^{${lat(q(1).sub(alpha))}}$, raise to the power $\\frac{1}{1-\\alpha} = ${lat(q(ad, ad - an))}$: $k_{gold} = \\left(\\frac{\\alpha A}{n+\\delta}\\right)^{\\frac{1}{1-\\alpha}}$.`,
            math: `k_{gold} = ${lat(W)}^{${lat(q(ad, ad - an))}} = ${lat(kg)}`,
            why: 'Solving $\\alpha A k^{\\alpha-1} = n+\\delta$ for $k$ gives $k^{1-\\alpha} = \\frac{\\alpha A}{n+\\delta}$.',
            ask: { prompt: 'What is $k_{gold}$?', answer, verify },
          },
        ],
        misconceptions: distinctMisconceptions(answer, wrong),
        interpretation: rng.chance(0.5) ? [savingRateQuestion(rng, { S, A, N, D, an, ad, Z: q(S * A, N + D) })] : undefined,
        verify,
      };
    }
    // form 2: golden-rule saving rate = α (as a percent)
    const sGold = alpha.mul(100);
    const answer = numberAnswer(sGold);
    const verify: VerifySpec = {
      type: 'solve',
      equations: [`${alE}*${A}*${kg.toExpr()}^(${alE}-1) = ${ndE}`, `(s/100)*${A}*${kg.toExpr()}^${alE} = ${ndE}*${kg.toExpr()}`],
      unknowns: ['s'],
    };
    const wrong: MisconceptionInstance[] = [{ id: 'golden-is-s', wrong: numberAnswer(q(S)) }];
    return {
      params: { s: S, A, n: N, d: D, an, ad, form },
      prompt: `Consider a Solow economy. ${common} What saving rate (type the percent number) maximizes steady-state consumption (the golden rule)?`,
      answer,
      steps: [
        {
          key: 'golden-share',
          instruction: 'At the golden rule $f\'(k) = n + \\delta$. Compare the capital income $k f\'(k)$ with output $y = f(k)$: what share of output is it?',
          math: `\\frac{k f'(k)}{f(k)} = \\frac{\\alpha A k^{\\alpha}}{A k^{\\alpha}} = \\alpha = ${lat(alpha)}`,
          why: 'For $y = Ak^{\\alpha}$, the marginal product times $k$ is always the fraction $\\alpha$ of output.',
          ask: {
            prompt: 'What fraction of output is $k f\'(k)$?',
            answer: numberAnswer(alpha),
            verify: { type: 'evaluate', expr: `${alE}*${A}*16^(${alE}-1)*16/(${A}*16^${alE})` },
          },
        },
        {
          key: 'golden',
          instruction: 'In the steady state saving equals break-even investment: $s\\,y = (n+\\delta)k$. At the golden rule $(n+\\delta)k = k f\'(k) = \\alpha y$, so $s = \\alpha$. Give it as a percent.',
          math: `s_{gold} = \\alpha = ${lat(alpha)} = ${lat(sGold)}\\%`,
          why: 'The saving rate that maximizes steady-state consumption equals capital\'s share of output. It does not depend on $A$, $n$ or $\\delta$.',
          ask: { prompt: 'What saving rate (as a percent number) is the golden rule?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, wrong),
      interpretation: rng.chance(0.5) ? [savingRateQuestion(rng, { S, A, N, D, an, ad, Z: q(S * A, N + D) })] : undefined,
      verify,
    };
  }
}

// ---------- the skill ----------

export const intertemporalSolow: SkillDefinition = {
  id: ID,
  title: 'Two-period consumption & Solow',
  track: 'econ',
  unit: 'Time & growth',
  description: 'Lifetime budgets and optimal saving over two periods, then the Solow steady state and the golden rule.',
  prerequisites: ['present-value', 'optimization'],
  maxDenominator: 100,
  levels: {
    1: {
      description: 'The two-period budget: present value, future value and slope',
      ranges: { m1: [500, 3000], m2: [315, 3000], rPct: [5, 50], form: [0, 2] },
    },
    2: {
      description: 'Optimal consumption over two periods with U = c1·c2',
      ranges: { m1: [100, 2900], m2: [105, 4350], rPct: [5, 50] },
    },
    3: {
      description: 'Saving and borrowing with Cobb-Douglas preferences over two periods',
      ranges: { m1: [100, 3900], m2: [105, 6000], rPct: [5, 50], aN: [1, 3], aD: [2, 5], form: [0, 2] },
    },
    4: {
      description: 'The Solow steady state: capital and output per worker',
      ranges: { s: [5, 60], A: [1, 5], n: [1, 4], d: [2, 9], an: [1, 1], ad: [2, 3], form: [0, 1] },
    },
    5: {
      description: 'Steady-state consumption and the golden rule',
      ranges: { s: [5, 90], A: [1, 6], n: [1, 4], d: [2, 9], an: [1, 3], ad: [2, 4], form: [0, 2] },
    },
  },
  misconceptions: {
    'compounded-m2': {
      name: 'Grew future income instead of discounting it',
      explanation:
        'Future income is worth less today: divide $m_2$ by $1 + r$ to put it in period-1 dollars. Multiplying by $1 + r$ moves it the wrong way in time. (To compare in period-2 dollars, grow $m_1$ instead.)',
    },
    'slope-inverted': {
      name: 'Gave the slope as -1/(1+r)',
      explanation:
        'With $c_2$ on the vertical axis, one dollar of $c_1$ given up buys $1 + r$ dollars of $c_2$. The slope is rise over run, $-(1+r)$, not its reciprocal.',
    },
    'ignored-interest': {
      name: 'Added the incomes without interest',
      explanation:
        'A dollar today and a dollar next period are not the same good: money today can earn interest. Convert one to the other\'s date with $1 + r$ before adding or comparing.',
    },
    'equal-consumption': {
      name: 'Set c1 equal to c2',
      explanation:
        'The consumer equates her MRS to $1 + r$, not to 1. Because saving earns interest she picks $c_2 = (1+r)c_1$ with $U = c_1c_2$, so next period\'s consumption is larger.',
    },
    'share-of-m1': {
      name: "Applied the share to this period's income only",
      explanation:
        'The share $a$ applies to lifetime wealth, $PV = m_1 + \\frac{m_2}{1+r}$, because she can borrow against next period\'s income. Using only $m_1$ leaves out the discounted future income.',
    },
    'saving-sign': {
      name: 'Reported borrowing as saving',
      explanation:
        'Saving is $m_1 - c_1^*$. If she consumes more than she earns the result is negative: she is borrowing. Check the sign against whether $c_1^*$ is above or below $m_1$.',
    },
    'forgot-depreciation': {
      name: 'Left depreciation out of break-even investment',
      explanation:
        'Break-even investment must replace worn-out capital as well as equip new workers: it is $(n + \\delta)k$, not $nk$. Use the sum $n + \\delta$ in the denominator.',
    },
    'no-power': {
      name: 'Stopped at the ratio',
      explanation:
        'The ratio $\\frac{sA}{n+\\delta}$ equals $k^{1-\\alpha}$, not $k$. Raise it to the power $\\frac{1}{1-\\alpha}$ to get capital per worker.',
    },
    'consumed-saving': {
      name: 'Gave saving, not consumption',
      explanation:
        'Saving per worker is $s\\,y^*$. Consumption is what is left: $(1 - s)\\,y^*$.',
    },
    'golden-is-s': {
      name: 'Gave the current saving rate',
      explanation:
        'The golden-rule saving rate is capital\'s share of output, $\\alpha$, not the economy\'s current $s$. They are equal only if the economy already saves the golden-rule amount.',
    },
  },
  stepLabels: {
    'pv-endowment': "Discount next period's income",
    budget: 'Add the two incomes in one date',
    'grow-m1': "Grow this period's income",
    'fv-intercept': 'Find the period-2 intercept',
    slope: 'Read off the slope',
    mrs: 'Set the MRS equal to 1 + r',
    split: 'Spend a share of lifetime wealth',
    c2: 'Find next-period consumption',
    'saving-amount': 'Find saving (income minus consumption)',
    save: 'Carry saving to next period',
    'steady-condition': 'Set saving equal to break-even investment',
    'solve-k': 'Solve for capital per worker',
    output: 'Evaluate output per worker',
    consume: 'Consume what is not saved',
    'golden-ratio': 'Set the marginal product equal to n + δ',
    'golden-share': "Find capital's share of output",
    golden: 'Apply the golden rule',
  },
  learn: {
    whyItMatters:
      'Earning \\$2,000 now and \\$1,100 next year at 10% interest is worth $2000 + 1100/1.1 = \\$3,000$ today. With $U = c_1 c_2$ you spend half of that now (\\$1,500), save \\$500, and consume $500 \\cdot 1.1 + 1100 = \\$1,650$ next year. In the Solow model with $s = 30\\%$, $y = 2\\sqrt{k}$ and $n + \\delta = 10\\%$, capital per worker settles at 36, where saving $0.3 \\cdot 12 = 3.6$ exactly covers $0.1 \\cdot 36$.',
    summary:
      'Two periods: lifetime wealth is $PV = m_1 + \\frac{m_2}{1+r}$ and the consumer equates her MRS to $1 + r$. With $U = c_1^{a}c_2^{1-a}$ she spends the fraction $a$ of $PV$ today and saves the rest. Solow: capital per worker settles where saving $sAk^{\\alpha}$ equals break-even investment $(n+\\delta)k$; consumption is highest at the golden rule $s = \\alpha$.',
    formulas: [
      { latex: 'PV = m_1 + \\frac{m_2}{1+r}, \\quad FV = m_1(1+r) + m_2', note: 'Lifetime wealth in period-1 and period-2 dollars. The budget line has slope $-(1+r)$.' },
      { latex: 'c_1^* = a\\,PV, \\quad c_2^* = (1-a)(1+r)\\,PV', note: 'Optimal consumption for $U = c_1^{a}c_2^{1-a}$. Saving is $m_1 - c_1^*$ (negative means borrowing).' },
      { latex: 'k^* = \\left(\\frac{sA}{n+\\delta}\\right)^{\\frac{1}{1-\\alpha}}, \\quad y^* = A\\,k^{*\\alpha}', note: 'Solow steady state from $sAk^{\\alpha} = (n+\\delta)k$.' },
      { latex: 'c^* = (1-s)\\,y^*, \\quad f\'(k_{gold}) = n + \\delta, \\quad s_{gold} = \\alpha', note: 'Steady-state consumption and the golden rule.' },
    ],
    example: { seed: 1, level: 3 },
    tips: [
      "Always move money to one date before adding: divide by $1+r$ to go back a period, multiply to go forward.",
      'Check a two-period answer: $c_1 + \\frac{c_2}{1+r}$ must equal $PV$.',
      'In Solow, solve for the ratio $\\frac{sA}{n+\\delta}$ first, then take the power $\\frac{1}{1-\\alpha}$. Check by confirming $s\\,y^* = (n+\\delta)k^*$.',
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
