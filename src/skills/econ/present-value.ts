// Present value & discounting (econ). Number answers in whole dollars. Every given is a short
// decimal (cents at most) and every answer is exact: choose the answer first, build the givens
// from it, reject draws that need more than 2 decimals. Rates are Q (q(1, 10)), never floats.

import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  ChoiceOption,
  InterpretationQuestion,
  MisconceptionInstance,
  SkillDefinition,
  Step,
} from '../../engine/types';

const ID = 'present-value';

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

/** Exact cents of a non-negative rational dollar amount: 2205/2 → "1102.50". */
function cents(x: Q): string {
  const c = x.abs().mul(100);
  if (!c.isInt()) throw new Error(`not a whole number of cents: ${x.toString()}`);
  const s = String(c.n).padStart(3, '0');
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** Dollars as LaTeX-safe RichText: whole dollars have no cents, otherwise exact cents. */
function money(x: Q): string {
  const sign = x.n < 0 ? '-' : '';
  return x.isInt() ? `${sign}\\$${Math.abs(x.n)}` : `${sign}\\$${cents(x)}`;
}
/** A wrong answer's display: exact when it is whole cents, rounded to the cent otherwise. */
function moneyW(x: Q): string {
  if (x.mul(100).isInt()) return money(x);
  const v = x.valueOf();
  return `${v < 0 ? '-' : ''}\\$${Math.abs(v).toFixed(2)}`;
}
const fmt2 = (v: number) => `\\$${v.toFixed(2)}`;

const moneyAnswer = (x: Q): AnswerSpec => ({ kind: 'number', value: x.toString(), display: money(x) });
const wrongAnswer = (x: Q): AnswerSpec => ({ kind: 'number', value: x.toString(), display: moneyW(x) });
/** A number answer whose display is its exact decimal. */
const decAnswer = (x: Q): AnswerSpec => ({ kind: 'number', value: x.toString(), display: decimal(x) });
/** A number answer shown as a fraction. */
const fracAnswer = (x: Q): AnswerSpec => ({ kind: 'number', value: x.toString(), display: x.toLatex() });

function pow(x: Q, t: number): Q {
  let r = q(1);
  for (let i = 0; i < t; i++) r = r.mul(x);
  return r;
}

function choice(rng: Rng, correct: string, wrong: string[]): { options: ChoiceOption[]; correct: string } {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  return { options, correct: 'o0' };
}

const years = (t: number) => `${t} year${t === 1 ? '' : 's'}`;

// ---------- finance helpers (exact) ----------

const RATES = [5, 10, 20, 25, 50];
const rate = (pct: number) => q(pct, 100);
/** The rate inside an expression string: "(1/10)". */
const rExpr = (pct: number) => rate(pct).toExpr();
const nMax = (pct: number) => (pct >= 20 ? 3 : 4);
/** (1 + r)^t */
const factorOf = (pct: number, t: number) => pow(q(1).add(rate(pct)), t);
/** Sum of discount factors 1/(1+r)^t for t = 1..n. */
function discountSum(pct: number, n: number): Q {
  let s = q(0);
  for (let t = 1; t <= n; t++) s = s.add(q(1).div(factorOf(pct, t)));
  return s;
}
/** Sum of growth factors (1+r)^k for k = 0..n-1. */
function growthSum(pct: number, n: number): Q {
  let s = q(0);
  for (let k = 0; k < n; k++) s = s.add(factorOf(pct, k));
  return s;
}
/** "1/(1+(1/10))^1 + 1/(1+(1/10))^2" as a mathjs/SymPy expression. */
const discountTerms = (pct: number, n: number, pay = '1') =>
  Array.from({ length: n }, (_, i) => `${pay}/(1+${rExpr(pct)})^${i + 1}`).join(' + ');

// ---------- interpretation: "if the rate were higher, the value would be …" ----------

function higherRateQuestion(rng: Rng, noun: string, rPct: number, valueNow: number, valueHigher: number): InterpretationQuestion {
  const r2 = 2 * rPct;
  const { options, correct } = choice(rng, 'Lower', ['Higher', 'The same', 'It cannot be determined']);
  return {
    prompt: `If the interest rate were ${r2}% instead of ${rPct}%, the ${noun} would be…`,
    options,
    correct,
    explanation: `A higher rate means each future dollar is discounted more heavily, so it is worth less today. At ${rPct}% the ${noun} is ${fmt2(valueNow)}; at ${r2}% it falls to ${fmt2(valueHigher)}.`,
  };
}

// ---------- level 1: one future sum ----------

/** Rate, years and present value, with the future sum a whole number of cents. */
function drawSingle(rng: Rng) {
  for (;;) {
    const r = rng.pick(RATES);
    const n = rng.int(1, nMax(r));
    const PV = 100 * rng.int(1, 50);
    const fac = factorOf(r, n);
    const FV = fac.mul(PV);
    if (!FV.mul(100).isInt()) continue; // a given with more than 2 decimals
    return { r, n, PV, fac, FV };
  }
}

function singleSum(rng: Rng): Generated {
  const form = rng.int(0, 1);
  return buildSingle(rng, { form, ...drawSingle(rng) });
}

/** A story's own prompt and its setup step (the plain problem has neither). */
interface SingleStory {
  prompt: string;
  setup: Step;
}

function buildSingle(
  rng: Rng,
  { form, r, n, PV, fac, FV }: { form: number; r: number; n: number; PV: number; fac: Q; FV: Q },
  story?: SingleStory,
): Generated {
  const rDec = decimal(rate(r));
  const fDec = decimal(fac);
  const answer = moneyAnswer(q(PV));
  const verify = { type: 'solve' as const, equations: [`PV*(1+${rExpr(r)})^${n} = ${FV.toString()}`], unknowns: ['PV'] };

  const prompt =
    story?.prompt ??
    (form === 0
      ? `What is the present value of ${money(FV)} to be received in ${years(n)}, if the interest rate is ${r}% per year, compounded annually?`
      : `You will need ${money(FV)} in ${years(n)}. An account pays ${r}% per year, compounded annually. How many dollars must you invest now to have exactly that?`);

  const steps: Step[] = [
    ...(story ? [story.setup] : []),
    {
      key: 'factor',
      instruction: `Find the discount factor: ${years(n)} of growth at $r = ${rDec}$ is $(1 + r)^{${n}}$.`,
      math: `(1 + ${rDec})^{${n}} = ${fDec}`,
      why: 'Money grows by the factor (1 + r) each year, so waiting n years multiplies it by (1 + r)^n. Discounting undoes that.',
      ask: {
        prompt: `$(1 + ${rDec})^{${n}} = \\;?$`,
        answer: decAnswer(fac),
        verify: { type: 'evaluate', expr: `(1+${rExpr(r)})^${n}` },
      },
    },
    {
      key: 'discount',
      instruction: `Divide ${money(FV)} by the factor ${fDec}.`,
      math: `PV = \\frac{${money(FV)}}{${fDec}} = ${money(q(PV))}`,
      why: '$PV = FV/(1+r)^n$: the amount that grows to FV if invested now at r.',
      ask: { prompt: 'How many dollars today? $PV = \\;?$', answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'compounded-not-discounted', wrong: wrongAnswer(FV.mul(fac)) },
    { id: 'simple-discount', wrong: wrongAnswer(FV.div(q(1).add(rate(r).mul(n)))) },
  ];

  // ---------- interpretation (drawn last) ----------
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const kind = rng.chance(0.5) ? 'rate' : form === 0 ? 'meaning' : 'enough';
    if (kind === 'rate') {
      const pv2 = FV.valueOf() / Math.pow(1 + (2 * r) / 100, n);
      interpretation = [higherRateQuestion(rng, 'present value', r, PV, pv2)];
    } else if (kind === 'meaning') {
      const { options, correct } = choice(
        rng,
        `${money(q(PV))} today, invested at ${r}%, grows to exactly ${money(FV)} in ${years(n)}, so the two amounts are worth the same today`,
        [
          `${money(q(PV))} is the interest you will earn`,
          `Inflation will cut the ${money(FV)} down to ${money(q(PV))}`,
          `The bank charges ${money(FV.sub(PV))} for waiting`,
        ],
      );
      interpretation = [
        {
          prompt: `${money(q(PV))} is the present value of ${money(FV)} in ${years(n)} at ${r}%. What does that mean?`,
          options,
          correct,
          explanation: `Invest ${money(q(PV))} at ${r}% for ${years(n)}: ${money(q(PV))} $\\cdot$ ${fDec} = ${money(FV)}. Present value is the amount today that is equivalent to the future sum, not an interest charge or an inflation adjustment.`,
        },
      ];
    } else {
      const choices = [-2, -1, 1, 2].filter((d) => PV + 100 * d > 0);
      const X = PV + 100 * rng.pick(choices);
      const grown = X * Math.pow(1 + r / 100, n);
      const enough = X > PV;
      const { options, correct } = choice(rng, enough ? 'Yes, it is enough' : 'No, it falls short', [
        enough ? 'No, it falls short' : 'Yes, it is enough',
        'It is exactly enough',
        'It cannot be told without the inflation rate',
      ]);
      interpretation = [
        {
          prompt: `You have only ${money(q(X))} to invest now at ${r}%. Is that enough to have ${money(FV)} in ${years(n)}?`,
          options,
          correct,
          explanation: `${money(q(X))} grows to about ${fmt2(grown)} in ${years(n)}, compared with the ${money(FV)} you need. The amount required today is the present value, ${money(q(PV))}; ${enough ? 'you have more than that' : 'you have less than that'}.`,
        },
      ];
    }
  }

  return {
    params: { form, r, n, PV },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 1 stories: write what a payment today grows to ----------

function storySingle(rng: Rng): Generated {
  const pattern = rng.int(0, 2);
  const d = drawSingle(rng);
  const { r, n, FV } = d;
  const setting = rng.int(0, 2);
  const tickets = 250 * rng.int(4, 20);
  const rDec = decimal(rate(r));
  const per = `${r}% per year, compounded annually`;
  const growth = `x(1 + ${rDec})^{${n}}`;
  const mk = (key: string, prompt: string, why: string, text: string): SingleStory => ({
    prompt: text,
    setup: {
      key,
      instruction: prompt,
      math: `\\text{value after ${years(n)}} = ${growth}`,
      why,
      ask: {
        prompt,
        answer: { kind: 'expression', value: `x*(1+${rExpr(r)})^${n}`, variables: ['x'], display: growth },
        verify: { type: 'equivalent', expr: `x*(1+${rExpr(r)})^${n}`, variables: ['x'] },
      },
    },
  });
  const GROWS_WHY = `Each year the balance is multiplied by $(1 + r)$, so ${years(n)} multiply it by $(1 + r)^{${n}}$. Setting that equal to ${money(FV)} gives the equation to solve.`;
  if (pattern === 1) {
    const noun = ['prize draw', 'raffle', 'lottery'][setting];
    return buildSingle(
      rng,
      { form: 0, ...d },
      mk(
        'setup-prize',
        `Let $x$ be what a buyer pays for the winning ticket today. Write what $x$ dollars would grow to if invested for ${years(n)}.`,
        `${GROWS_WHY} The ${tickets} tickets sold do not enter: the winning ticket is already known, so only the prize and the wait matter.`,
        `A ${noun} sold ${tickets} tickets, and the winning ticket pays ${money(FV)} in ${years(n)}. The interest rate is ${per}. What is the most a buyer should pay for the winning ticket today, in dollars?`,
      ),
    );
  }
  if (pattern === 2) {
    const text = [
      `An employer offers you a bonus of ${money(FV)}, paid in ${years(n)}. The interest rate is ${per}. What payment today is worth the same to you, in dollars?`,
      `A client offers to settle an invoice with ${money(FV)} paid in ${years(n)}, or with a smaller payment today. The interest rate is ${per}. What payment today is worth the same, in dollars?`,
      `A landlord will refund your deposit of ${money(FV)} in ${years(n)}, or pay you a lump sum today instead. The interest rate is ${per}. What lump sum today is worth the same, in dollars?`,
    ][setting];
    return buildSingle(
      rng,
      { form: 0, ...d },
      mk('setup-offers', `Let $x$ be the payment today. Write what $x$ dollars would grow to if invested for ${years(n)}.`, GROWS_WHY, text),
    );
  }
  const text = [
    `You need ${money(FV)} in ${years(n)} to pay for a course. A savings account pays ${per}. How many dollars should you put in now to have exactly that?`,
    `A neighbourhood club wants ${money(FV)} in ${years(n)} to replace its minibus. Its fund earns ${per}. How many dollars must the club deposit today?`,
    `You are saving for a trip that will cost ${money(FV)} in ${years(n)}. A deposit earns ${per}. How many dollars do you need to deposit now?`,
  ][setting];
  return buildSingle(
    rng,
    { form: 1, ...d },
    mk('setup-grows', `Let $x$ be the dollars put in now. Write what $x$ grows to in ${years(n)}.`, GROWS_WHY, text),
  );
}

// ---------- level 2: net present value of a project ----------

function projectNpv(rng: Rng): Generated {
  let r = 0;
  let T = 2;
  let C0 = 0;
  let d: number[] = [];
  let R: Q[] = [];
  for (;;) {
    r = rng.pick(RATES);
    T = r === 10 || r === 20 ? rng.int(2, 3) : 2;
    d = Array.from({ length: T }, () => 10 * rng.int(5, 60));
    R = d.map((dt, i) => factorOf(r, i + 1).mul(dt));
    if (R.some((x) => !x.mul(100).isInt())) continue;
    const sum = d.reduce((a, b) => a + b, 0);
    const delta = 10 * rng.int(1, 20) * (rng.chance(0.5) ? 1 : -1);
    C0 = sum + delta;
    if (C0 <= 0) continue;
    break;
  }
  const sumD = d.reduce((a, b) => a + b, 0);
  const NPV = q(sumD - C0);
  const rDec = decimal(rate(r));
  const fT = factorOf(r, T);
  const answer = moneyAnswer(NPV);
  const verify = {
    type: 'evaluate' as const,
    expr: `-${C0} + ${R.map((x, i) => `${x.toExpr()}/(1+${rExpr(r)})^${i + 1}`).join(' + ')}`,
  };

  const returnsText = R.map((x, i) => `${money(x)} at the end of year ${i + 1}`);
  const list = returnsText.length === 2 ? returnsText.join(' and ') : `${returnsText.slice(0, -1).join(', ')}, and ${returnsText[returnsText.length - 1]}`;
  const prompt = `A firm spends ${money(q(C0))} now on a project. It returns ${list}. The interest rate is ${r}% per year. What is the project's net present value, in dollars?`;

  const termsMath = d.map((dt, i) => `\\frac{${money(R[i])}}{${decimal(factorOf(r, i + 1))}} = ${money(q(dt))}`).join(',\\; ');
  const steps: Step[] = [
    {
      key: 'factor',
      instruction: `A return in year $t$ is divided by $(1 + r)^t$. For the last return, $t = ${T}$ and $r = ${rDec}$.`,
      math: `(1 + ${rDec})^{${T}} = ${decimal(fT)}`,
      why: 'Each year of waiting multiplies by (1 + r), so a return t years away is divided by (1 + r)^t.',
      ask: {
        prompt: `$(1 + ${rDec})^{${T}} = \\;?$`,
        answer: decAnswer(fT),
        verify: { type: 'evaluate', expr: `(1+${rExpr(r)})^${T}` },
      },
    },
    {
      key: 'discount',
      instruction: `Divide each return by its factor. The last one, ${money(R[T - 1])}, is ${T} years away.`,
      math: termsMath,
      why: 'Discounting turns each future return into its value today, so the returns can be added to the outlay.',
      ask: {
        prompt: `The last return in today's dollars: $\\dfrac{${money(R[T - 1])}}{${decimal(fT)}} = \\;?$`,
        answer: moneyAnswer(q(d[T - 1])),
        verify: { type: 'evaluate', expr: `${R[T - 1].toExpr()}/(1+${rExpr(r)})^${T}` },
      },
    },
    {
      key: 'net',
      instruction: `Add the discounted returns and subtract the outlay, ${money(q(C0))}.`,
      math: `NPV = ${d.map((x) => money(q(x))).join(' + ')} - ${money(q(C0))} = ${money(NPV)}`,
      why: 'NPV = (value of the returns today) - (cost today). Positive means the project is worth more than it costs.',
      ask: { prompt: 'Net present value in dollars: $NPV = \\;?$', answer, verify },
    },
  ];

  const undiscounted = R.reduce((a, b) => a.add(b), q(0)).sub(C0);
  const compounded = R.reduce((a, x, i) => a.add(x.mul(factorOf(r, i + 1))), q(0)).sub(C0);
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'compounded-not-discounted', wrong: wrongAnswer(compounded) },
    { id: 'undiscounted-sum', wrong: wrongAnswer(undiscounted) },
    { id: 'forgot-outlay', wrong: wrongAnswer(q(sumD)) },
  ];

  // ---------- interpretation (drawn last) ----------
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const invest = NPV.sign() > 0;
    const { options, correct } = choice(
      rng,
      invest ? 'Yes: the returns are worth more today than the outlay' : 'No: the returns are worth less today than the outlay',
      [
        invest ? 'No: the returns are worth less today than the outlay' : 'Yes: the returns are worth more today than the outlay',
        'It makes no difference',
        'Yes, because the returns add up to more than the outlay',
      ],
    );
    interpretation = [
      {
        prompt: `The project's NPV is ${money(NPV)}. Should the firm invest?`,
        options,
        correct,
        explanation: invest
          ? `The returns are worth ${money(q(sumD))} today and cost ${money(q(C0))}, so the project adds ${money(NPV)} of value. Invest.`
          : `The returns are worth only ${money(q(sumD))} today but cost ${money(q(C0))}, so the project loses ${money(NPV.neg())} of value. Do not invest.`,
      },
    ];
  }

  return {
    params: { r, T, C0, d1: d[0], d2: d[1], d3: d[2] ?? 0 },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 3: annuity ----------

function annuity(rng: Rng): Generated {
  let r = 0;
  let n = 2;
  let A = 0;
  let S = q(0);
  for (;;) {
    r = rng.pick(RATES);
    n = rng.int(2, Math.min(4, nMax(r)));
    S = discountSum(r, n);
    // A must be a multiple of the denominator of the factor sum so the present value is whole.
    const k = rng.int(1, 10);
    A = S.d * k;
    if (A > 5000) continue;
    break;
  }
  const PV = S.mul(A);
  const rDec = decimal(rate(r));
  const fn = factorOf(r, n);
  const answer = moneyAnswer(PV);
  const verify = { type: 'evaluate' as const, expr: discountTerms(r, n, `${A}`) };

  const prompt = `An investment pays ${money(q(A))} at the end of each year for ${n} years. The interest rate is ${r}% per year. What is its present value, in dollars?`;

  const termMath = Array.from({ length: n }, (_, i) => `\\frac{1}{${decimal(factorOf(r, i + 1))}}`).join(' + ');
  const steps: Step[] = [
    {
      key: 'factor',
      instruction: `The last payment is ${n} years away, so it is divided by $(1 + ${rDec})^{${n}}$.`,
      math: `(1 + ${rDec})^{${n}} = ${decimal(fn)}`,
      why: 'A payment t years away is divided by (1 + r)^t. The factors for years 1, 2, ..., n are all needed.',
      ask: {
        prompt: `$(1 + ${rDec})^{${n}} = \\;?$`,
        answer: decAnswer(fn),
        verify: { type: 'evaluate', expr: `(1+${rExpr(r)})^${n}` },
      },
    },
    {
      key: 'annuity-terms',
      instruction: 'Discount each payment: add up $1/(1+r)^t$ for each year. This is the present value of one dollar a year.',
      math: `${termMath} = ${S.toLatex()}`,
      why: 'Every payment is the same, so factor out A: the present value is A times the sum of the discount factors.',
      ask: {
        prompt: `Sum of the discount factors (a fraction is fine): $${termMath} = \\;?$`,
        answer: fracAnswer(S),
        verify: { type: 'evaluate', expr: discountTerms(r, n) },
      },
    },
    {
      key: 'annuity-sum',
      instruction: `Multiply the payment, ${money(q(A))}, by the sum of the factors.`,
      math: `PV = ${A} \\cdot ${S.toLatex()} = ${money(PV)}`,
      why: '$PV = A\\,\\frac{1 - (1+r)^{-n}}{r}$: the same sum written in closed form.',
      ask: { prompt: 'Present value in dollars: $PV = \\;?$', answer, verify },
    },
  ];

  let simple = q(0);
  for (let t = 1; t <= n; t++) simple = simple.add(q(A).div(q(1).add(rate(r).mul(t))));
  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'simple-discount', wrong: wrongAnswer(simple) },
    { id: 'undiscounted-sum', wrong: wrongAnswer(q(A * n)) },
    { id: 'off-by-one-period', wrong: wrongAnswer(PV.mul(q(1).add(rate(r)))) },
  ];

  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    let pv2 = 0;
    for (let t = 1; t <= n; t++) pv2 += A / Math.pow(1 + (2 * r) / 100, t);
    interpretation = [higherRateQuestion(rng, 'present value', r, PV.valueOf(), pv2)];
  }

  return {
    params: { r, n, A },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 4: perpetuities ----------

const PERP_RATES = [4, 5, 8, 10, 20, 25];
const GROW_RATES = [1, 2, 3, 4, 5, 8, 10];
const DEFER_RATES = [5, 10, 20];

function perpetuity(rng: Rng): Generated {
  const form = rng.int(0, 2);
  let r = 0;
  let g = 0;
  let k = 0;
  let A = 0;
  let PV = 0;
  for (;;) {
    PV = 100 * rng.int(1, 30);
    if (form === 0) {
      r = rng.pick(PERP_RATES);
      A = (PV * r) / 100;
    } else if (form === 1) {
      r = rng.pick(GROW_RATES);
      g = rng.pick(GROW_RATES);
      if (g >= r) continue;
      A = (PV * (r - g)) / 100;
    } else {
      r = rng.pick(DEFER_RATES);
      k = rng.int(1, 2);
      const a = factorOf(r, k).mul(PV).mul(rate(r));
      if (!a.isInt()) continue;
      A = a.n;
    }
    if (!Number.isInteger(A) || A < 1) continue;
    break;
  }
  const rQ = rate(r);
  const rDec = decimal(rQ);
  const answer = moneyAnswer(q(PV));

  // Verify: the limit of the n-term sum as n → oo, written as the definition (a discounted sum).
  const x = `(1/(1+${rExpr(r)}))`;
  const verifyExpr =
    form === 0
      ? `${A}*(1-${x}^n)/${rExpr(r)}`
      : form === 1
        ? `${A}/(1+${rExpr(r)})*(1-((1+${rExpr(g)})/(1+${rExpr(r)}))^n)/(1-(1+${rExpr(g)})/(1+${rExpr(r)}))`
        : `${A}/(1+${rExpr(r)})^${k}*(1-${x}^n)/${rExpr(r)}`;
  const verify = { type: 'limit' as const, expr: verifyExpr, variable: 'n', point: 'oo' };

  const prompt =
    form === 0
      ? `A bond pays ${money(q(A))} at the end of every year forever. The interest rate is ${r}% per year. What is its present value, in dollars?`
      : form === 1
        ? `A stream pays ${money(q(A))} at the end of year 1, and each later payment is ${g}% larger than the one before, forever. The interest rate is ${r}% per year. What is its present value, in dollars?`
        : `A perpetuity pays ${money(q(A))} a year forever, but the first payment comes at the end of year ${k + 1} (nothing is paid during the first ${years(k)}). The interest rate is ${r}% per year. What is its present value today, in dollars?`;

  const steps: Step[] = [];
  const oneLevel = A / (r / 100);
  if (form === 0) {
    steps.push({
      key: 'rate-gap',
      instruction: 'Write the interest rate as a decimal. It goes in the denominator.',
      math: `r = ${r}\\% = ${rDec}`,
      why: 'A payment of A every year forever is worth A divided by the rate: the principal that earns A each year at rate r.',
      ask: { prompt: `$r = ${r}\\%$ as a decimal: $r = \\;?$`, answer: decAnswer(rQ), verify: { type: 'evaluate', expr: `${r}/100` } },
    });
    steps.push({
      key: 'perpetuity',
      instruction: `Divide the payment, ${money(q(A))}, by the rate.`,
      math: `PV = \\frac{${A}}{${rDec}} = ${money(q(PV))}`,
      why: '$PV = A/r$: the sum of A/(1+r)^t over all years t = 1, 2, 3, ... is a geometric series with a finite total.',
      ask: { prompt: 'Present value in dollars: $PV = \\;?$', answer, verify },
    });
  } else if (form === 1) {
    const gap = rate(r - g);
    steps.push({
      key: 'rate-gap',
      instruction: `Subtract the growth rate from the interest rate: $${r}\\% - ${g}\\%$, as a decimal.`,
      math: `r - g = ${decimal(rQ)} - ${decimal(rate(g))} = ${decimal(gap)}`,
      why: 'Growing payments are discounted at the rate r but grow at g, so the effective rate is the gap r - g (it must be positive).',
      ask: { prompt: `$r - g = \\;?$`, answer: decAnswer(gap), verify: { type: 'evaluate', expr: `${r}/100 - ${g}/100` } },
    });
    steps.push({
      key: 'perpetuity',
      instruction: `Divide the first payment, ${money(q(A))}, by $r - g$.`,
      math: `PV = \\frac{${A}}{${decimal(gap)}} = ${money(q(PV))}`,
      why: '$PV = A/(r-g)$ where A is the first payment, when each later payment grows by g.',
      ask: { prompt: 'Present value in dollars: $PV = \\;?$', answer, verify },
    });
  } else {
    const fk = factorOf(r, k);
    steps.push({
      key: 'factor',
      instruction: `The perpetuity's payments start one year after year ${k}, so first find its value at the end of year ${k}, then discount ${years(k)}. The discount factor is $(1 + ${rDec})^{${k}}$.`,
      math: `(1 + ${rDec})^{${k}} = ${decimal(fk)}`,
      why: 'A sum at time k is worth that sum divided by (1 + r)^k today.',
      ask: {
        prompt: `$(1 + ${rDec})^{${k}} = \\;?$`,
        answer: decAnswer(fk),
        verify: { type: 'evaluate', expr: `(1+${rExpr(r)})^${k}` },
      },
    });
    steps.push({
      key: 'perpetuity',
      instruction: `At the end of year ${k}, the payments are an ordinary perpetuity (first payment one year later): divide by the rate.`,
      math: `\\frac{${A}}{${rDec}} = ${money(q(oneLevel))}`,
      why: 'A/r values a perpetuity one period before its first payment.',
      ask: { prompt: `Value at the end of year ${k}: $\\dfrac{${A}}{${rDec}} = \\;?$`, answer: moneyAnswer(q(oneLevel)), verify: { type: 'evaluate', expr: `${A}/${rExpr(r)}` } },
    });
    steps.push({
      key: 'defer',
      instruction: `Discount that value back to today: divide by ${decimal(fk)}.`,
      math: `PV = \\frac{${money(q(oneLevel))}}{${decimal(fk)}} = ${money(q(PV))}`,
      why: 'Perpetuity formula first, then discount by the number of years before it starts.',
      ask: { prompt: 'Present value today, in dollars: $PV = \\;?$', answer, verify },
    });
  }

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'perpetuity-times-r', wrong: wrongAnswer(form === 1 ? q(A * (r - g), 100) : q(A * r, 100)) },
    form === 1 ? { id: 'growing-plus-g', wrong: wrongAnswer(q(A * 100, r + g)) } : null,
    form === 2 ? { id: 'off-by-one-period', wrong: wrongAnswer(q(oneLevel).div(factorOf(r, k + 1))) } : null,
  ];

  // ---------- interpretation (drawn last) ----------
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    if (form === 0) {
      const ann50 = (A * (1 - Math.pow(1 + r / 100, -50))) / (r / 100);
      const gap = PV * Math.pow(1 + r / 100, -50);
      const { options, correct } = choice(
        rng,
        'The perpetuity also includes payments after year 50, which are worth almost nothing today',
        [
          'The interest rate falls after year 50',
          'The payments get smaller every year',
          'The annuity is taxed but the perpetuity is not',
        ],
      );
      interpretation = [
        {
          prompt: `An annuity paying ${money(q(A))} a year for 50 years at ${r}% is worth a bit less than the perpetuity's ${money(q(PV))}. Why?`,
          options,
          correct,
          explanation: `The 50-year annuity is worth about ${fmt2(ann50)}. The missing ${gap >= 0.01 ? 'about ' + fmt2(gap) : 'less than one cent'} is the value today of all payments after year 50, each discounted by $(1 + ${rDec})^{50}$ or more.`,
        },
      ];
    } else {
      let pv2: number;
      const r2 = 2 * r;
      if (form === 1) pv2 = (A * 100) / (r2 - g);
      else pv2 = (A * 100) / r2 / Math.pow(1 + r2 / 100, k);
      interpretation = [higherRateQuestion(rng, 'present value', r, PV, pv2)];
    }
  }

  return {
    params: { form, A, r, g, k },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 5: solve for the payment ----------

function solvePayment(rng: Rng): Generated {
  const form = rng.int(0, 1);
  let r = 0;
  let n = 2;
  let A = 0;
  let given = q(0);
  for (;;) {
    r = rng.pick(RATES);
    n = rng.int(2, Math.min(4, nMax(r)));
    A = 10 * rng.int(1, 300);
    given = (form === 0 ? discountSum(r, n) : growthSum(r, n)).mul(A);
    if (!given.mul(100).isInt()) continue; // a loan or target with more than 2 decimals
    break;
  }
  const factorQ = form === 0 ? discountSum(r, n) : growthSum(r, n);
  const answer = moneyAnswer(q(A));

  const eqRhs =
    form === 0
      ? discountTerms(r, n, 'A')
      : Array.from({ length: n }, (_, i) => `A*(1+${rExpr(r)})^${n - 1 - i}`).join(' + ');
  const verify = { type: 'solve' as const, equations: [`${given.toString()} = ${eqRhs}`], unknowns: ['A'] };

  const prompt =
    form === 0
      ? `You borrow ${money(given)} at ${r}% interest per year and repay it with ${n} equal payments, one at the end of each year. How much is each payment, in dollars?`
      : `You want ${money(given)} at the end of ${years(n)}. You deposit the same amount at the end of each year (the last deposit earns no interest) into an account paying ${r}% per year. How much must each deposit be, in dollars?`;

  const termMath =
    form === 0
      ? Array.from({ length: n }, (_, i) => `\\frac{1}{${decimal(factorOf(r, i + 1))}}`).join(' + ')
      : Array.from({ length: n }, (_, i) => decimal(factorOf(r, n - 1 - i))).join(' + ');
  const steps: Step[] = [
    {
      key: 'annuity-terms',
      instruction:
        form === 0
          ? 'Discount each payment: the loan equals A times the sum of the discount factors for years 1 to n.'
          : 'Grow each deposit to the end: a deposit made k years before the end grows by $(1 + r)^k$. Add the growth factors.',
      math: `${termMath} = ${form === 0 ? factorQ.toLatex() : decimal(factorQ)}`,
      why:
        form === 0
          ? 'The loan is the present value of the payments: Loan = A times (sum of 1/(1+r)^t).'
          : 'The target is the future value of the deposits: Target = A times (sum of (1+r)^k).',
      ask: {
        prompt: `${form === 0 ? 'Sum of the discount factors (a fraction is fine)' : 'Sum of the growth factors'}: $${termMath} = \\;?$`,
        answer: form === 0 ? fracAnswer(factorQ) : decAnswer(factorQ),
        verify: { type: 'evaluate', expr: form === 0 ? discountTerms(r, n) : eqRhs.replace(/A\*/g, '') + '' },
      },
    },
    {
      key: 'solve-payment',
      instruction: `Divide the ${form === 0 ? 'loan' : 'target'}, ${money(given)}, by the sum of the factors.`,
      math: `A = \\frac{${money(given)}}{${form === 0 ? factorQ.toLatex() : decimal(factorQ)}} = ${money(q(A))}`,
      why: 'Solve the equation Loan (or Target) = A times factor-sum for A: divide both sides by the factor sum.',
      ask: { prompt: 'Each payment in dollars: $A = \\;?$', answer, verify },
    },
  ];

  const candidates: (MisconceptionInstance | null)[] = [
    { id: 'payment-no-interest', wrong: wrongAnswer(given.div(n)) },
  ];

  // ---------- interpretation (drawn last) ----------
  let interpretation: InterpretationQuestion[] | undefined;
  if (rng.chance(0.5)) {
    const total = q(A * n);
    const extra = form === 0 ? total.sub(given) : given.sub(total);
    const { options, correct } =
      form === 0
        ? choice(rng, 'The extra is interest on the balance still owed', [
            'The lender adds a fee to the last payment only',
            'Part of each payment is a penalty for paying late',
            'Interest is charged only on the first year of the loan',
          ])
        : choice(rng, 'The deposits earn interest, which makes up the difference', [
            'The bank adds a bonus at the end that does not depend on the rate',
            'Money saved is always worth more than the amount deposited, regardless of the rate',
            'The last deposit is counted twice',
          ]);
    interpretation = [
      {
        prompt:
          form === 0
            ? `You repay ${n} payments of ${money(q(A))}, a total of ${money(total)}, on a loan of ${money(given)}. Why do the payments add to more than the loan?`
            : `You make ${n} deposits of ${money(q(A))}, a total of ${money(total)}, yet reach ${money(given)}. Why is the target larger than the deposits?`,
        options,
        correct,
        explanation:
          form === 0
            ? `The payments total ${money(total)}, which is ${money(extra)} more than the ${money(given)} borrowed. That ${money(extra)} is interest: each year you owe ${r}% on the balance not yet repaid.`
            : `The deposits total ${money(total)}, and the account reaches ${money(given)}. The ${money(extra)} difference is interest earned at ${r}% on the money already in the account.`,
      },
    ];
  }

  return {
    params: { form, r, n, A },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- the skill ----------

export const presentValue: SkillDefinition = {
  id: ID,
  title: 'Present value & discounting',
  track: 'econ',
  unit: 'Time & growth',
  description: 'Discount a future sum, find a project\'s net present value, and value annuities, perpetuities, loans and sinking funds.',
  prerequisites: ['exponent-rules', 'geometric-series'],
  maxDenominator: 100,
  levels: {
    1: { description: 'Present value of one future sum: PV = FV/(1 + r)^n', ranges: { form: [0, 1], r: [5, 50], n: [1, 4], PV: [100, 5000] } },
    2: {
      description: 'Net present value of a project: outlay now, returns later',
      ranges: { r: [5, 50], T: [2, 3], C0: [1, 2100], d1: [50, 600], d2: [50, 600], d3: [0, 600] },
    },
    3: { description: 'Annuity: equal payments at the end of each year', ranges: { r: [5, 50], n: [2, 3], A: [1, 5000] } },
    4: {
      description: 'Perpetuities: level, growing, and deferred',
      ranges: { form: [0, 2], A: [1, 5000], r: [2, 25], g: [0, 10], k: [0, 2] },
    },
    5: { description: 'Solve for the payment: loan repayment and sinking fund', ranges: { form: [0, 1], r: [5, 50], n: [2, 4], A: [10, 3000] } },
  },
  misconceptions: {
    'compounded-not-discounted': {
      name: 'Multiplied by (1 + r)^n instead of dividing',
      explanation:
        'A future sum is worth *less* today, so you divide by the growth factor. Multiplying by $(1+r)^n$ goes the wrong way: it gives the value n years *later*, not today.',
    },
    'simple-discount': {
      name: 'Discounted with simple interest',
      explanation:
        'Interest compounds, so the growth factor over n years is $(1+r)^n$, not $1 + nr$. Dividing by $1 + nr$ undervalues the discounting: $(1+r)^n$ is larger than $1+nr$ once n is at least 2.',
    },
    'undiscounted-sum': {
      name: 'Added the amounts without discounting',
      explanation:
        'A dollar next year or in two years is not worth a dollar today. Each payment must be divided by $(1+r)^t$ for its own year t before adding.',
    },
    'forgot-outlay': {
      name: 'Left out the outlay',
      explanation:
        'Net present value is the discounted returns *minus* what the project costs today: $NPV = \\sum \\frac{R_t}{(1+r)^t} - C_0$. Without the outlay you only know what the returns are worth.',
    },
    'off-by-one-period': {
      name: 'Discounted one period too many (or too few)',
      explanation:
        'Count the years carefully. An ordinary annuity pays at the *end* of each year, so the first payment is discounted once (not zero times). A perpetuity whose first payment is at year k+1 is worth $A/r$ at year k, so discount it k times, not k+1.',
    },
    'perpetuity-times-r': {
      name: 'Multiplied by the rate instead of dividing',
      explanation:
        'A perpetuity is worth the amount that earns the payment each year: $PV \\cdot r = A$, so $PV = A/r$. Multiplying gives a tiny number, far less than the payment itself.',
    },
    'growing-plus-g': {
      name: 'Used r + g in the denominator',
      explanation:
        'Growth in the payments makes the stream *more* valuable, so the denominator gets smaller: $r - g$, not $r + g$. This needs $g < r$.',
    },
    'payment-no-interest': {
      name: 'Spread the amount evenly, ignoring interest',
      explanation:
        'Dividing the loan (or target) by the number of payments ignores interest. A loan costs interest on the balance owed, so each payment must be larger; a savings target is helped by interest, so each deposit can be smaller.',
    },
  },
  stepLabels: {
    factor: 'Find the discount factor (1 + r)^n',
    discount: 'Divide each amount by its factor',
    net: 'Add the discounted returns, subtract the outlay',
    'annuity-terms': 'Discount (or grow) each payment',
    'annuity-sum': 'Multiply the payment by the factor sum',
    'rate-gap': 'Find the rate in the denominator',
    perpetuity: 'Divide the payment by r (or r - g)',
    defer: 'Discount back to today',
    'solve-payment': 'Divide the loan (or target) by the factor sum',
    'setup-grows': 'Write what the amount today grows to',
    'setup-prize': 'Write what the amount today grows to',
    'setup-offers': 'Write what the amount today grows to',
  },
  learn: {
    whyItMatters:
      '\\$1,210 promised in 2 years is worth \\$1,000 today at 10%, because \\$1,000 invested now grows to $1000 \\cdot 1.1^2 = 1210$. A firm uses this to compare an outlay now with returns later: with an outlay of \\$900 and returns of \\$550 and \\$605, the NPV is $500 + 500 - 900 = 100$ dollars, so it invests. A bond paying \\$50 a year forever is worth $50/0.05 = 1000$ dollars at 5%. Higher rates lower every present value.',
    summary:
      'Present value brings future money back to today by dividing by $(1+r)^t$. The net present value of a project is the discounted returns minus the outlay; invest when it is positive. A level payment A for n years is worth $A\\frac{1-(1+r)^{-n}}{r}$, a perpetuity is worth $A/r$ (or $A/(r-g)$ if payments grow at g), and a loan payment or savings deposit comes from solving the same equation for A.',
    formulas: [
      { latex: 'PV = \\frac{FV}{(1+r)^n}', note: 'One future sum.' },
      { latex: 'NPV = -C_0 + \\sum_{t=1}^{T} \\frac{R_t}{(1+r)^t}', note: 'Invest if $NPV > 0$.' },
      { latex: 'PV = A\\,\\frac{1-(1+r)^{-n}}{r}', note: 'Annuity: A at the end of each of n years.' },
      { latex: 'PV = \\frac{A}{r}, \\qquad PV = \\frac{A}{r-g}', note: 'Perpetuity, and growing perpetuity (first payment A, $g < r$).' },
      { latex: 'A = \\frac{L\\,r}{1-(1+r)^{-n}}', note: 'Loan repayment. For a sinking fund, $A = \\frac{T\\,r}{(1+r)^n - 1}$.' },
    ],
    example: { seed: 3, level: 1 },
    tips: [
      'Sanity check: a present value is always smaller than the future amount (for r > 0), and a bigger rate or a longer wait makes it smaller.',
      'Payments "at the end of each year" are discounted once for year 1, twice for year 2, and so on.',
    ],
  },

  story: {
    levels: [1],
    generate(rng) {
      return storySingle(rng);
    },
  },

  generate(rng, level) {
    switch (level) {
      case 1:
        return singleSum(rng);
      case 2:
        return projectNpv(rng);
      case 3:
        return annuity(rng);
      case 4:
        return perpetuity(rng);
      case 5:
        return solvePayment(rng);
    }
  },
};
