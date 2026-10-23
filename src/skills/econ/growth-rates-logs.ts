// Growth rates & logs (econ). Growth rates add where levels multiply; a log difference is a
// growth rate; the rule of 70; products, ratios and powers (approximate); average growth and
// time in logs; index numbers and real values. Every answer is rational and exact. Logs are never
// asked for: the prompt GIVES them to 3 decimals (computed from real levels, then rounded) and the
// answer is computed from the printed values. Percent answers are typed as the percent number.

import { choiceAnswer } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  InterpretationQuestion,
  Level,
  MisconceptionInstance,
  SkillDefinition,
  Step,
  VerifySpec,
} from '../../engine/types';

const ID = 'growth-rates-logs';

type Generated = ReturnType<SkillDefinition['generate']>;

// ---------- display helpers ----------

function terminating(x: Q): boolean {
  for (let k = 0; k <= 9; k++) if (10 ** k % x.d === 0) return true;
  return false;
}

/** Exact decimal expansion of a rational whose denominator divides a power of 10 (else 3 places). */
function dec(x: Q): string {
  for (let k = 0; k <= 9; k++) {
    const p = 10 ** k;
    if (p % x.d === 0) {
      const s = String(Math.abs(x.n) * (p / x.d)).padStart(k + 1, '0');
      const int = s.slice(0, s.length - k);
      const frac = s.slice(s.length - k).replace(/0+$/, '');
      return `${x.n < 0 ? '-' : ''}${int}${frac ? '.' + frac : ''}`;
    }
  }
  return x.valueOf().toFixed(3);
}

/** LaTeX for a value that may not terminate (misconception answers). */
const disp = (x: Q): string => (terminating(x) ? dec(x) : `\\approx ${x.valueOf().toFixed(2)}`);
const dispPct = (x: Q): string => (terminating(x) ? `${dec(x)}\\%` : `\\approx ${x.valueOf().toFixed(2)}\\%`);

/** A number answer shown as its exact decimal. */
const num = (x: Q, display?: string): AnswerSpec => ({ kind: 'number', value: x.toString(), display: display ?? disp(x) });
const pctAns = (x: Q): AnswerSpec => num(x, dispPct(x));

/** Natural log of a level, rounded to 3 decimals, as an integer number of thousandths. */
const lnTh = (x: number): number => Math.round(Math.log(x) * 1000);
/** Thousandths as a 3-decimal string: 10030 -> "10.030". */
function th(n: number): string {
  const s = String(Math.abs(n)).padStart(4, '0');
  return `${n < 0 ? '-' : ''}${s.slice(0, -3)}.${s.slice(-3)}`;
}

/** One-decimal rate from tenths: 35 -> "3.5". */
const tenths = (t: number): string => dec(q(t, 10));

function choice(rng: Rng, correct: string, wrong: string[]) {
  const labels = [correct, ...wrong.filter((w, i, all) => w !== correct && all.indexOf(w) === i)];
  const options = rng.shuffle(labels.map((label, i) => ({ id: `o${i}`, label })));
  const correctId = options.find((o) => o.label === correct)!.id;
  return { options, correct: correctId };
}

/** All params present at every level (unused = 0). */
const P = (o: { form: number; a?: number; b?: number; c?: number; d?: number }) => ({
  form: o.form,
  a: o.a ?? 0,
  b: o.b ?? 0,
  c: o.c ?? 0,
  d: o.d ?? 0,
});

const ev = (expr: string): VerifySpec => ({ type: 'evaluate', expr });

// ---------- level 1: growth from levels and from logs ----------

const SUBJECTS: [string, string][] = [
  ["A town's population", 'thousand people'],
  ["A firm's output", 'thousand units'],
  ["A small economy's real GDP", 'billion dollars'],
];
const LEVELS_FOR_LOGS = [800, 1200, 2500, 4000, 6500, 9000, 15000, 24000];

function level1(rng: Rng): Generated {
  const form = rng.int(0, 1);
  const steps: Step[] = [];
  let prompt = '';
  let answer: AnswerSpec;
  let verify: VerifySpec;
  let params: ReturnType<typeof P>;
  let ans: Q;
  let candidates: (MisconceptionInstance | null)[];
  let exactP = 0;

  if (form === 0) {
    const [subj, unit] = rng.pick(SUBJECTS);
    const k = rng.int(1, 20);
    const X0 = 10 * k;
    const p = rng.nonzero(-30, 50);
    const X1t = k * (100 + p); // tenths
    const X1 = q(X1t, 10);
    const diff = X1.sub(X0);
    ans = q(p);
    answer = pctAns(ans);
    verify = ev(`100*(${X1t}/10 - ${X0})/${X0}`);
    params = P({ form, a: X0, b: X1t, c: p });
    prompt = `${subj} went from ${X0} to ${dec(X1)} ${unit}. What was the percent change? A fall is negative; type 7 for 7%.`;
    steps.push(
      {
        key: 'difference',
        instruction: 'Subtract the starting value from the new value.',
        math: `${dec(X1)} - ${X0} = ${dec(diff)}`,
        why: 'The change is new minus old; it is negative when the value falls.',
        ask: { prompt: `$${dec(X1)} - ${X0} = \\;?$`, answer: num(diff), verify: ev(`${X1t}/10 - ${X0}`) },
      },
      {
        key: 'to-percent',
        instruction: `Divide by the starting value, ${X0}, and multiply by 100.`,
        math: `100 \\cdot \\frac{${dec(diff)}}{${X0}} = ${p}\\%`,
        why: 'A percent change is measured against where you started, not where you ended.',
        ask: { prompt: 'The percent change: $?\\%$ (type the number)', answer, verify },
      },
    );
    candidates = [{ id: 'divided-by-new', wrong: pctAns(q(100).mul(diff).div(X1)) }];
  } else {
    const X0 = rng.pick(LEVELS_FOR_LOGS);
    const p = rng.int(1, 12);
    const L0 = lnTh(X0);
    const L1 = lnTh((X0 * (100 + p)) / 100);
    const d = L1 - L0;
    ans = q(d, 10);
    exactP = p;
    answer = pctAns(ans);
    verify = ev(`100*(${L1}/1000 - ${L0}/1000)`);
    params = P({ form, a: X0, c: p });
    const lead = rng.pick(['a country\u2019s GDP', 'a firm\u2019s sales', 'a price index']);
    prompt = `The natural log of ${lead} was $\\ln X_0 = ${th(L0)}$ last year and $\\ln X_1 = ${th(L1)}$ this year. Using the log approximation, about what percent did it grow? Type 3 for 3%.`;
    steps.push(
      {
        key: 'difference',
        instruction: 'Subtract the starting log from the new log.',
        math: `${th(L1)} - ${th(L0)} = ${th(d)}`,
        why: 'The difference of logs is $\\ln(X_1/X_0)$, which is close to the growth rate when the change is small.',
        ask: { prompt: `$${th(L1)} - ${th(L0)} = \\;?$`, answer: num(q(d, 1000)), verify: ev(`${L1}/1000 - ${L0}/1000`) },
      },
      {
        key: 'to-percent',
        instruction: 'Multiply the log change by 100 to read it as a percent.',
        math: `100 \\cdot ${th(d)} = ${dec(ans)}\\%`,
        why: 'A log change of 0.03 is a growth rate of about 3%: multiply by 100.',
        ask: { prompt: 'The growth rate: $?\\%$ (type the number)', answer, verify },
      },
    );
    candidates = [{ id: 'log-no-100', wrong: num(q(d, 1000)) }];
  }

  // interpretation (drawn last)
  let interpretation: InterpretationQuestion[] | undefined;
  if (form === 1 && rng.chance(0.5)) {
    const { options, correct } = choice(rng, 'Large changes', ['Small changes', 'Changes from a small starting level', 'Every change: the two never differ']);
    interpretation = [
      {
        prompt: `The log approximation says ${dec(ans)}%. The exact change in the level is ${exactP}%. For which kind of change does the log approximation become a poor estimate?`,
        options,
        correct,
        explanation: `$\\ln(1+x) \\approx x$ only when $x$ is small. Here the exact change is ${exactP}% and the logs say ${dec(ans)}%, close. But from 100 to 150 the exact change is 50% while $100\\ln 1.5 \\approx 40.5\\%$: the gap grows with the size of the change.`,
      },
    ];
  }

  return { params, prompt, answer, steps, misconceptions: distinctMisconceptions(answer, candidates), interpretation, verify };
}

// ---------- level 2: the rule of 70 ----------

const G_TENTHS = [10, 20, 35, 50, 70, 100, 140]; // 1, 2, 3.5, 5, 7, 10, 14 percent
const T_YEARS = [7, 10, 14, 20, 35];

const RULE_CHOICE = (rng: Rng) =>
  choice(rng, 'Years to double is about 70 divided by the growth rate (in percent)', [
    'Years to double is about 70 times the growth rate',
    'Years to double is about the growth rate divided by 70',
    'Years to double is about 100 divided by the growth rate',
  ]);

function level2(rng: Rng): Generated {
  const form = rng.int(0, 2);
  const steps: Step[] = [];
  let prompt = '';
  let answer: AnswerSpec;
  let verify: VerifySpec;
  let params: ReturnType<typeof P>;
  let candidates: (MisconceptionInstance | null)[];
  let interpretation: InterpretationQuestion[] | undefined;

  if (form === 1) {
    const T = rng.pick(T_YEARS);
    const ans = q(70, T);
    answer = pctAns(ans);
    verify = ev(`70/${T}`);
    params = P({ form, b: T });
    prompt = `How fast must an economy grow, in percent per year, to double its output in ${T} years? Use the rule of 70. Type 5 for 5%.`;
    const rc = RULE_CHOICE(rng);
    steps.push(
      {
        key: 'recall-rule',
        instruction: 'Recall the rule of 70.',
        math: '\\text{years to double} \\approx \\frac{70}{g}',
        why: 'Doubling takes $\\ln 2 / \\ln(1+g) \\approx 0.69/g$, and with $g$ in percent that is about $70/g$.',
        ask: { prompt: 'Which statement is the rule of 70?', answer: choiceAnswer(rc.options, rc.correct) },
      },
      {
        key: 'rule-70',
        instruction: `Rearrange: the growth rate is 70 divided by the years, ${T}.`,
        math: `g \\approx \\frac{70}{${T}} = ${dec(ans)}\\%`,
        why: 'Years $\\times$ rate is about 70, so either one gives the other.',
        ask: { prompt: `$70 \\div ${T} = \\;?$ (percent per year)`, answer, verify },
      },
    );
    candidates = [{ id: 'rule-70-multiplied', wrong: pctAns(q(70 * T)) }];
    // interpretation (drawn last)
    if (rng.chance(0.5)) {
      const c = choice(rng, `${dec(q(35, T))}%`, [`${dec(ans)}%`, `${dec(q(140, T))}%`, `${dec(q(175, 10 * T))}%`]);
      interpretation = [
        {
          prompt: `Doubling in ${T} years needs about ${dec(ans)}% growth. To take twice as long, ${2 * T} years, the growth rate needed would be about…`,
          options: c.options,
          correct: c.correct,
          explanation: `Years $\\times$ rate $\\approx 70$, so doubling the years halves the rate: $70/${2 * T} = ${dec(q(35, T))}\\%$, half of ${dec(ans)}%.`,
        },
      ];
    }
  } else {
    const a = rng.pick(G_TENTHS);
    const g = q(a, 10);
    const D = q(700, a); // 70 / g
    params = P({ form, a });
    if (form === 0) {
      answer = num(D, `${dec(D)}`);
      verify = ev(`70/(${a}/10)`);
      prompt = `An economy grows at ${dec(g)}% a year. Using the rule of 70, about how many years until its output doubles?`;
      const rc = RULE_CHOICE(rng);
      steps.push(
        {
          key: 'recall-rule',
          instruction: 'Recall the rule of 70.',
          math: '\\text{years to double} \\approx \\frac{70}{g}',
          why: 'Doubling takes $\\ln 2 / \\ln(1+g) \\approx 0.69/g$, and with $g$ in percent that is about $70/g$.',
          ask: { prompt: 'Which statement is the rule of 70?', answer: choiceAnswer(rc.options, rc.correct) },
        },
        {
          key: 'rule-70',
          instruction: `Divide 70 by the growth rate, ${dec(g)}.`,
          math: `\\frac{70}{${dec(g)}} = ${dec(D)} \\text{ years}`,
          why: 'The higher the growth rate, the shorter the doubling time.',
          ask: { prompt: `$70 \\div ${dec(g)} = \\;?$ years`, answer, verify },
        },
      );
      candidates = [{ id: 'rule-70-multiplied', wrong: num(q(7 * a)) }];
    } else {
      const k = rng.int(1, 3);
      const Y = D.mul(k); // whole years
      const big = q(2 ** k);
      answer = num(big, `${2 ** k}`);
      verify = ev(`2^(${Y.toString()}/(70/(${a}/10)))`);
      params = P({ form, a, c: k });
      prompt = `Income per person grows at ${dec(g)}% a year. Using the rule of 70, about how many times larger is it after ${dec(Y)} years?`;
      steps.push(
        {
          key: 'rule-70',
          instruction: `Find the doubling time: 70 divided by ${dec(g)}.`,
          math: `\\frac{70}{${dec(g)}} = ${dec(D)} \\text{ years per doubling}`,
          why: 'The rule of 70 gives the time for one doubling.',
          ask: { prompt: `$70 \\div ${dec(g)} = \\;?$ years`, answer: num(D), verify: ev(`70/(${a}/10)`) },
        },
        {
          key: 'doublings',
          instruction: `Count the doublings: ${dec(Y)} years divided by ${dec(D)} years each.`,
          math: `\\frac{${dec(Y)}}{${dec(D)}} = ${k}`,
          why: 'Each doubling takes the same time, so the number of doublings is total time over doubling time.',
          ask: { prompt: `${dec(Y)} years $\\div$ ${dec(D)} years $= \\;?$ doublings`, answer: num(q(k)), verify: ev(`${Y.toString()}/(70/(${a}/10))`) },
        },
        {
          key: 'times-larger',
          instruction: `Double ${k} time${k === 1 ? '' : 's'}: the level is multiplied by $2^{${k}}$.`,
          math: `2^{${k}} = ${2 ** k}`,
          why: 'Doublings multiply: after $k$ of them the level is $2^k$ times larger, not $2k$ times.',
          ask: { prompt: `$2^{${k}} = \\;?$`, answer, verify },
        },
      );
      candidates = [{ id: 'doublings-linear', wrong: num(q(2 * k)) }];
    }
    // interpretation (drawn last)
    if (rng.chance(0.5)) {
      const c = choice(rng, `${dec(D.div(2))} years`, [`${dec(D)} years`, `${dec(D.mul(2))} years`, `${dec(D.div(4))} years`]);
      interpretation = [
        {
          prompt: `At ${dec(g)}% growth the rule of 70 gives a doubling time of ${dec(D)} years. If the economy grew at ${dec(g.mul(2))}% instead, doubling would take about…`,
          options: c.options,
          correct: c.correct,
          explanation: `$70/${dec(g.mul(2))} = ${dec(D.div(2))}$ years: twice the growth rate halves the doubling time.`,
        },
      ];
    }
  }

  return { params, prompt, answer, steps, misconceptions: distinctMisconceptions(answer, candidates), interpretation, verify };
}

// ---------- level 3: growth of products, ratios and powers ----------

const POWERS: [number, number][] = [
  [2, 1],
  [1, 2],
  [1, 3],
  [-1, 1],
];
const COMBINE_LABELS = ['Add the growth rates', 'Subtract the growth rates', 'Multiply the growth rate by the power'];
const move = (x: Q): string => (x.sign() >= 0 ? `Rises by about ${dec(x)}%` : `Falls by about ${dec(x.abs())}%`);

function level3(rng: Rng): Generated {
  const form = rng.int(0, 3);
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  let ans = q(0);
  for (;;) {
    if (form === 0) {
      a = rng.int(5, 80);
      b = rng.int(2, 30);
      ans = q(a - b, 10);
    } else if (form === 1) {
      a = rng.int(20, 120);
      b = rng.int(5, 80);
      ans = q(a - b, 10);
    } else if (form === 2) {
      a = rng.nonzero(-30, 80);
      b = rng.int(5, 60);
      ans = q(a + b, 10);
    } else {
      const [num_, den] = rng.pick(POWERS);
      c = num_;
      d = den;
      a = rng.int(10, 90);
      ans = q(a, 10).mul(q(c, d));
      if (!ans.mul(10).isInt()) continue;
    }
    if (ans.isZero()) continue;
    break;
  }
  const gA = tenths(a);
  const gB = tenths(b);
  const correctOp = [1, 1, 0, 2][form];
  const powerLatex = c === 2 ? 'X^{2}' : c === -1 ? 'X^{-1}' : d === 2 ? 'X^{1/2}' : 'X^{1/3}';
  const aLatex = c === 2 ? '2' : c === -1 ? '-1' : d === 2 ? '\\tfrac{1}{2}' : '\\tfrac{1}{3}';

  let prompt: string;
  let verify: VerifySpec;
  let computeMath: string;
  let candidates: (MisconceptionInstance | null)[];
  let opInstr: string;
  let opWhy: string;
  if (form === 0) {
    prompt = `Real GDP grows at ${gA}% a year and population at ${gB}%. Approximately how fast does GDP per person grow? Answer in percent per year (type 2 for 2%).`;
    verify = ev(`${a}/10 - ${b}/10`);
    computeMath = `g_{Y/N} \\approx ${gA} - ${gB} = ${dec(ans)}\\%`;
    opInstr = 'A ratio\u2019s growth rate is the numerator\u2019s minus the denominator\u2019s.';
    opWhy = '$Y/N$ divides levels, so the growth rates subtract: $g_{Y/N} \\approx g_Y - g_N$.';
    candidates = [{ id: 'ratio-added', wrong: pctAns(q(a + b, 10)) }];
  } else if (form === 1) {
    prompt = `Nominal wages grow ${gA}% a year while prices rise ${gB}% a year (inflation). Approximately how fast do real wages grow? Answer in percent per year (type 2 for 2%).`;
    verify = ev(`${a}/10 - ${b}/10`);
    computeMath = `g_{real} \\approx ${gA} - ${gB} = ${dec(ans)}\\%`;
    opInstr = 'Real wages are nominal wages divided by prices, so subtract inflation from nominal growth.';
    opWhy = 'Real $=$ nominal $/$ prices, a ratio, so $g_{real} \\approx g_{nominal} - \\pi$.';
    candidates = [{ id: 'ratio-added', wrong: pctAns(q(a + b, 10)) }];
  } else if (form === 2) {
    prompt = `The price of a good changes by ${gA}% a year and the quantity sold by ${gB}% a year. Approximately how fast does revenue $PQ$ grow? Answer in percent per year (negative if it falls).`;
    verify = ev(`${a}/10 + ${b}/10`);
    computeMath = `g_{PQ} \\approx ${gA} + ${gB} = ${dec(ans)}\\%`;
    opInstr = 'Revenue is a product, so the growth rates add.';
    opWhy = '$PQ$ multiplies levels, so the growth rates add: $g_{PQ} \\approx g_P + g_Q$.';
    candidates = [{ id: 'product-subtracted', wrong: pctAns(q(a - b, 10)) }];
  } else {
    prompt = `A quantity $X$ grows at ${gA}% a year. Using $g_{X^a} \\approx a\\,g_X$, approximately how fast does $${powerLatex}$ grow? Answer in percent per year (negative if it falls).`;
    verify = ev(`(${c}/${d})*(${a}/10)`);
    computeMath = `g_{${powerLatex}} \\approx ${aLatex} \\cdot ${gA} = ${dec(ans)}\\%`;
    opInstr = 'For a power, multiply the growth rate by the exponent.';
    opWhy = '$\\ln(X^a) = a\\ln X$, so the growth rate scales with the power: $g_{X^a} \\approx a\\,g_X$.';
    candidates = [{ id: 'power-ignored', wrong: pctAns(q(a, 10)) }];
  }

  const ch = choice(rng, COMBINE_LABELS[correctOp], COMBINE_LABELS.filter((_, i) => i !== correctOp));
  const answer = pctAns(ans);
  const steps: Step[] = [
    {
      key: 'combine',
      instruction: opInstr,
      math: form === 3 ? `g_{X^a} \\approx a \\, g_X` : form === 2 ? 'g_{PQ} \\approx g_P + g_Q' : form === 1 ? 'g_{real} \\approx g_{nominal} - \\pi' : 'g_{Y/N} \\approx g_Y - g_N',
      why: opWhy,
      ask: { prompt: 'Which operation gives the approximate growth rate?', answer: choiceAnswer(ch.options, ch.correct) },
    },
    {
      key: 'compute',
      instruction: 'Put in the rates from the problem.',
      math: computeMath,
      why: 'These are approximations: good for small rates, increasingly rough for large ones.',
      ask: { prompt: 'The growth rate in percent: $?\\%$ (type the number)', answer, verify },
    },
  ];

  // interpretation (drawn last), forms 0-2
  let interpretation: InterpretationQuestion[] | undefined;
  if (form < 3 && rng.chance(0.5)) {
    const wrongVals = form === 2 ? [q(a, 10), q(a - b, 10), q(b, 10)] : [q(a, 10), q(a + b, 10), ans.neg()];
    const c2 = choice(rng, move(ans), wrongVals.map(move));
    const stem =
      form === 0
        ? `GDP grows ${gA}% a year and population ${gB}%. What happens to income per person?`
        : form === 1
          ? `Nominal wages grow ${gA}% and prices rise ${gB}%. What happens to the purchasing power of wages?`
          : `The price rises ${gA}% and the quantity sold rises ${gB}%. What happens to revenue?`;
    interpretation = [
      {
        prompt: stem,
        options: c2.options,
        correct: c2.correct,
        explanation:
          form === 2
            ? `Revenue is price times quantity, so the growth rates add: ${gA} + ${gB} = ${dec(ans)}%.`
            : `A ratio\u2019s growth rate is the difference of the two growth rates: ${gA} - ${gB} = ${dec(ans)}%. Output growth alone (${gA}%) overstates it because the denominator grows too.`,
      },
    ];
  }

  return {
    params: P({ form, a, b, c, d }),
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, candidates),
    interpretation,
    verify,
  };
}

// ---------- level 4: average growth and time in logs ----------

const LOG_BASES = [1200, 3000, 7500, 18000, 45000];
const N_YEARS = [2, 4, 5, 8, 10];
const G_CONT = [10, 20, 25, 30, 40, 50, 60, 80]; // tenths of a percent

function level4(rng: Rng): Generated {
  const form = rng.int(0, 1);
  const X0 = rng.pick(LOG_BASES);
  const L0 = lnTh(X0);
  const steps: Step[] = [];
  let prompt = '';
  let answer: AnswerSpec;
  let verify: VerifySpec;
  let params: ReturnType<typeof P>;
  let candidates: (MisconceptionInstance | null)[];
  let interpretation: InterpretationQuestion[] | undefined;

  if (form === 0) {
    const n = rng.pick(N_YEARS);
    const gt = rng.int(5, 60); // average growth in tenths of a percent
    const L1 = L0 + gt * n;
    const d = L1 - L0;
    const ans = q(d, 10 * n);
    answer = pctAns(ans);
    verify = ev(`100*(${L1}/1000 - ${L0}/1000)/${n}`);
    params = P({ form, a: X0, b: n, c: gt });
    prompt = `The natural log of a country\u2019s GDP was $\\ln X_0 = ${th(L0)}$ in 2000 and $\\ln X_n = ${th(L1)}$ in ${2000 + n}. What was the average annual growth rate over those ${n} years, in percent per year? Type 3 for 3%.`;
    steps.push(
      {
        key: 'difference',
        instruction: 'Subtract the starting log from the ending log.',
        math: `${th(L1)} - ${th(L0)} = ${th(d)}`,
        why: 'The log difference is the total (continuous) growth over the whole period.',
        ask: { prompt: `$${th(L1)} - ${th(L0)} = \\;?$`, answer: num(q(d, 1000)), verify: ev(`${L1}/1000 - ${L0}/1000`) },
      },
      {
        key: 'to-percent',
        instruction: 'Multiply by 100 for the total growth in percent.',
        math: `100 \\cdot ${th(d)} = ${dec(q(d, 10))}\\%`,
        why: 'A log change of 0.1 is about 10% of growth in total.',
        ask: { prompt: 'Total growth over the period: $?\\%$', answer: pctAns(q(d, 10)), verify: ev(`100*(${L1}/1000 - ${L0}/1000)`) },
      },
      {
        key: 'per-year',
        instruction: `Divide by the number of years, ${n}.`,
        math: `\\frac{${dec(q(d, 10))}\\%}{${n}} = ${dec(ans)}\\%`,
        why: 'Log growth adds up year by year, so the average per year is the total divided by the years.',
        ask: { prompt: 'Average growth per year: $?\\%$ (type the number)', answer, verify },
      },
    );
    candidates = [
      { id: 'total-not-average', wrong: pctAns(q(d, 10)) },
      { id: 'log-no-100', wrong: num(q(d, 1000 * n)) },
    ];
    if (rng.chance(0.5)) {
      const c = choice(rng, `${(70 / ans.valueOf()).toFixed(1)} years`, [
        `${(70 * ans.valueOf()).toFixed(1)} years`,
        `${(100 / ans.valueOf()).toFixed(1)} years`,
        `${(35 / ans.valueOf()).toFixed(1)} years`,
      ]);
      interpretation = [
        {
          prompt: `GDP grew ${dec(ans)}% a year on average. If that pace continued, about how long would GDP take to double? (Rule of 70.)`,
          options: c.options,
          correct: c.correct,
          explanation: `$70 / ${dec(ans)} \\approx ${(70 / ans.valueOf()).toFixed(1)}$ years. A higher average growth rate means a shorter doubling time.`,
        },
      ];
    }
  } else {
    const gt = rng.pick(G_CONT);
    const t = rng.int(2, 30);
    const LT = L0 + gt * t;
    const d = LT - L0;
    const ans = q(d, gt); // = t, from the printed values
    answer = num(ans, `${dec(ans)}`);
    verify = { type: 'solve', equations: [`${L0}/1000 + (${gt}/1000)*t = ${LT}/1000`], unknowns: ['t'] };
    params = P({ form, a: X0, b: gt, c: t });
    prompt = `Output grows continuously at ${tenths(gt)}% a year, so $\\ln X_t = \\ln X_0 + g\\,t$. Today $\\ln X_0 = ${th(L0)}$, and a target level has $\\ln X_T = ${th(LT)}$. After how many years does output reach the target?`;
    steps.push(
      {
        key: 'difference',
        instruction: 'Find the log gap: target log minus today\u2019s log.',
        math: `${th(LT)} - ${th(L0)} = ${th(d)}`,
        why: 'The gap in logs is how much total growth is still needed.',
        ask: { prompt: `$${th(LT)} - ${th(L0)} = \\;?$`, answer: num(q(d, 1000)), verify: ev(`${LT}/1000 - ${L0}/1000`) },
      },
      {
        key: 'solve-t',
        instruction: `Divide the log gap by the growth rate, written as a decimal: $g = ${dec(q(gt, 1000))}$.`,
        math: `t = \\frac{${th(d)}}{${dec(q(gt, 1000))}} = ${dec(ans)}`,
        why: 'Each year adds $g$ to the log, so the years needed are the gap divided by $g$.',
        ask: { prompt: 'Years: $t = \\;?$', answer, verify },
      },
    );
    candidates = [{ id: 'log-no-100', wrong: num(q(d, 100 * gt)) }];
    if (rng.chance(0.5)) {
      const c = choice(rng, `${dec(ans.div(2))} years`, [`${dec(ans)} years`, `${dec(ans.mul(2))} years`, `${dec(ans.div(4))} years`]);
      interpretation = [
        {
          prompt: `At ${tenths(gt)}% growth the target is reached in ${dec(ans)} years. If growth were ${tenths(2 * gt)}% instead, it would take…`,
          options: c.options,
          correct: c.correct,
          explanation: `$t = \\text{gap}/g$, so doubling $g$ halves $t$: ${dec(ans)} / 2 = ${dec(ans.div(2))} years.`,
        },
      ];
    }
  }

  return { params, prompt, answer, steps, misconceptions: distinctMisconceptions(answer, candidates), interpretation, verify };
}

// ---------- level 5: index numbers ----------

const I_BASES = [80, 125, 160, 200, 250];
const P_LEVELS = [110, 120, 125, 150, 160, 200, 250];
const P0_LEVELS = [100, 110, 120, 125, 150];
const P1_LEVELS = [105, 110, 125, 130, 150, 160, 175, 200, 250];
const withCommas = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const dollars = (n: number) => `\\$${withCommas(n)}`;

function level5(rng: Rng): Generated {
  const form = rng.int(0, 2);
  const steps: Step[] = [];
  let prompt = '';
  let answer: AnswerSpec;
  let verify: VerifySpec;
  let params: ReturnType<typeof P>;
  let candidates: (MisconceptionInstance | null)[];
  let interpretation: InterpretationQuestion[] | undefined;

  if (form === 0) {
    let Is = 0;
    let It = 0;
    let ans = q(0);
    for (;;) {
      Is = rng.pick(I_BASES);
      It = rng.int(60, 400);
      ans = q(100 * It, Is);
      if (It === Is || !ans.mul(10).isInt()) continue;
      break;
    }
    const ys = rng.int(2012, 2016);
    const yt = ys + rng.int(3, 8);
    answer = num(ans);
    verify = ev(`100*${It}/${Is}`);
    params = P({ form, a: Is, b: It });
    prompt = `A price index has base year 2010 = 100. It reads ${Is} in ${ys} and ${It} in ${yt}. Rebase the index so that ${ys} = 100. What does the rebased index read in ${yt}? (One decimal at most.)`;
    steps.push(
      {
        key: 'ratio',
        instruction: `Divide the ${yt} reading by the ${ys} reading.`,
        math: `\\frac{${It}}{${Is}} = ${dec(q(It, Is))}`,
        why: 'The ratio says how many times the new base-year level the later year is.',
        ask: { prompt: `$${It} \\div ${Is} = \\;?$`, answer: num(q(It, Is)), verify: ev(`${It}/${Is}`) },
      },
      {
        key: 'rebase',
        instruction: 'Multiply by 100 so the new base year reads 100.',
        math: `100 \\cdot ${dec(q(It, Is))} = ${dec(ans)}`,
        why: 'Rebasing divides by the new base-year index, then scales by 100. Subtracting would not work: indexes are ratios.',
        ask: { prompt: `The rebased index in ${yt}: $?$`, answer, verify },
      },
    );
    candidates = [{ id: 'rebase-subtract', wrong: num(q(It - Is + 100)) }];
  } else if (form === 1) {
    let R = 0;
    let Pn = 0;
    let V = 0;
    let V0 = 0;
    for (;;) {
      R = rng.int(5, 30) * 100;
      Pn = rng.pick(P_LEVELS);
      const u = rng.pick([8, 9, 10, 11, 12, 13]);
      V = (R * Pn) / 100;
      V0 = (R * u) / 10;
      if (!Number.isInteger(V) || !Number.isInteger(V0) || V0 >= V) continue;
      break;
    }
    const ans = q(R);
    answer = num(ans, dollars(R));
    verify = ev(`100*${V}/${Pn}`);
    params = P({ form, a: V, b: Pn, c: V0 });
    prompt = `In the base year (price index = 100) a household spent ${dollars(V0)}. This year it spends ${dollars(V)} and the price index is ${Pn}. What is this year\u2019s spending in base-year dollars (real spending)? Answer in dollars.`;
    steps.push(
      {
        key: 'ratio',
        instruction: `Divide this year\u2019s spending by the price index, ${Pn}.`,
        math: `\\frac{${V}}{${Pn}} = ${dec(q(V, Pn))}`,
        why: 'Deflating divides out the price level. Dividing by 125 means dividing by 1.25 in disguise.',
        ask: { prompt: `$${V} \\div ${Pn} = \\;?$`, answer: num(q(V, Pn)), verify: ev(`${V}/${Pn}`) },
      },
      {
        key: 'deflate',
        instruction: 'Multiply by 100 to express it in base-year dollars.',
        math: `100 \\cdot ${dec(q(V, Pn))} = ${R}`,
        why: 'Real value $= 100 \\times$ nominal $/$ price index. The base-year index is 100, so the base year needs no adjustment.',
        ask: { prompt: 'Real spending, in dollars: $?$', answer, verify },
      },
    );
    candidates = [{ id: 'deflate-inverted', wrong: num(q(V * Pn, 100)) }];
    // interpretation (drawn last)
    if (rng.chance(0.5)) {
      let correctLabel: string;
      let expl: string;
      if (R < V0) {
        correctLabel = 'Prices rose faster than spending';
        expl = `Nominal spending rose from ${dollars(V0)} to ${dollars(V)}, but prices rose by ${Pn - 100}%, more than the ${dec(q(100 * (V - V0), V0))}% rise in spending, so real spending fell from ${dollars(V0)} to ${dollars(R)}.`;
      } else if (R === V0) {
        correctLabel = 'Prices rose exactly as fast as spending';
        expl = `Real spending is ${dollars(R)}, the same as ${dollars(V0)} in the base year: the whole nominal rise was price increases.`;
      } else {
        correctLabel = 'Real spending rose less than nominal because prices rose';
        expl = `Nominal spending rose from ${dollars(V0)} to ${dollars(V)}, but part of that is higher prices; in base-year dollars it is ${dollars(R)}, a smaller rise.`;
      }
      const c = choice(rng, correctLabel, [
        'Prices rose faster than spending',
        'Prices rose exactly as fast as spending',
        'Real spending rose less than nominal because prices rose',
        'Prices fell',
      ]);
      interpretation = [
        {
          prompt: `Nominal spending rose from ${dollars(V0)} to ${dollars(V)}, and the price index went from 100 to ${Pn}. Comparing real spending with the base year, which statement is right?`,
          options: c.options,
          correct: c.correct,
          explanation: expl,
        },
      ];
    }
  } else {
    let R0 = 0;
    let p = 0;
    let R1 = 0;
    let P0 = 0;
    let P1 = 0;
    let V0 = 0;
    let V1 = 0;
    for (;;) {
      R0 = rng.int(2, 20) * 100;
      p = rng.nonzero(-25, 40);
      R1 = (R0 * (100 + p)) / 100;
      P0 = rng.pick(P0_LEVELS);
      P1 = rng.pick(P1_LEVELS);
      V0 = (R0 * P0) / 100;
      V1 = (R1 * P1) / 100;
      if (P1 <= P0 || !Number.isInteger(V0) || !Number.isInteger(V1) || !Number.isInteger(R1)) continue;
      break;
    }
    const ans = q(p);
    answer = pctAns(ans);
    verify = ev(`100*((${V1}/${P1})/(${V0}/${P0}) - 1)`);
    params = P({ form, a: V0, b: P0, c: V1, d: P1 });
    prompt = `Nominal consumption was ${dollars(V0)} million when the price index was ${P0}, and ${dollars(V1)} million when it was ${P1}. By what percent did real consumption change? Type 5 for 5%; a fall is negative.`;
    steps.push(
      {
        key: 'deflate-start',
        instruction: `Deflate the first value: ${V0} divided by ${P0}, times 100.`,
        math: `100 \\cdot \\frac{${V0}}{${P0}} = ${R0}`,
        why: 'Real value $= 100 \\times$ nominal $/$ price index.',
        ask: { prompt: `Real value in the first year: $?$`, answer: num(q(R0)), verify: ev(`100*${V0}/${P0}`) },
      },
      {
        key: 'deflate-end',
        instruction: `Deflate the second value: ${V1} divided by ${P1}, times 100.`,
        math: `100 \\cdot \\frac{${V1}}{${P1}} = ${R1}`,
        why: 'Both values must be in the same prices before you compare them.',
        ask: { prompt: `Real value in the second year: $?$`, answer: num(q(R1)), verify: ev(`100*${V1}/${P1}`) },
      },
      {
        key: 'real-growth',
        instruction: `Percent change in the real values, from ${R0} to ${R1}.`,
        math: `100 \\cdot \\frac{${R1} - ${R0}}{${R0}} = ${p}\\%`,
        why: 'Real growth compares real values, divided by the real starting value.',
        ask: { prompt: 'Real growth: $?\\%$ (type the number)', answer, verify },
      },
    );
    candidates = [
      { id: 'divided-by-new', wrong: pctAns(q(100 * (R1 - R0), R1)) },
      { id: 'nominal-growth', wrong: pctAns(q(100 * (V1 - V0), V0)) },
    ];
  }

  return { params, prompt, answer, steps, misconceptions: distinctMisconceptions(answer, candidates), interpretation, verify };
}

// ---------- the skill ----------

export const growthRatesLogs: SkillDefinition = {
  id: ID,
  title: 'Growth rates & logs',
  track: 'econ',
  unit: 'Time & growth',
  description: 'Percent change, log differences, the rule of 70, growth of products and ratios, average growth in logs, index numbers and real values.',
  prerequisites: ['logarithm-rules'],
  maxDenominator: 100,
  levels: {
    1: {
      description: 'Growth from levels and from log differences',
      ranges: { form: [0, 1], a: [0, 24000], b: [0, 3000], c: [-30, 50], d: [0, 0] },
    },
    2: {
      description: 'The rule of 70',
      ranges: { form: [0, 2], a: [0, 140], b: [0, 35], c: [0, 3], d: [0, 0] },
    },
    3: {
      description: 'Growth of ratios, products and powers (approximate)',
      ranges: { form: [0, 3], a: [-30, 120], b: [0, 80], c: [-1, 2], d: [0, 3] },
    },
    4: {
      description: 'Average growth and time to a target, in logs',
      ranges: { form: [0, 1], a: [0, 45000], b: [0, 80], c: [0, 60], d: [0, 0] },
    },
    5: {
      description: 'Index numbers: rebasing, deflating, real growth',
      ranges: { form: [0, 2], a: [0, 8000], b: [0, 400], c: [0, 8000], d: [0, 250] },
    },
  },
  misconceptions: {
    'divided-by-new': {
      name: 'Divided the change by the new value',
      explanation:
        'A percent change is measured against the starting value: $100(X_1 - X_0)/X_0$. Dividing by the new value understates a rise and overstates a fall.',
    },
    'log-no-100': {
      name: 'Left the log change as a decimal',
      explanation:
        'A log difference of $0.03$ is a growth rate of $3\\%$: multiply by 100 for a percent, or divide by the rate as a decimal ($0.03$, not $3$) when solving for years.',
    },
    'rule-70-multiplied': {
      name: 'Multiplied 70 by the rate (or the years)',
      explanation:
        'Years to double and the growth rate are inversely related: years $\\times$ rate $\\approx 70$. So divide: $70/g$ for years, $70/T$ for the rate.',
    },
    'doublings-linear': {
      name: 'Multiplied by 2k instead of 2^k',
      explanation:
        'Each doubling multiplies the level by 2, so $k$ doublings multiply it by $2 \\cdot 2 \\cdots 2 = 2^k$. Three doublings give 8 times, not 6.',
    },
    'ratio-added': {
      name: 'Added the rates for a ratio',
      explanation:
        'A ratio divides levels, so its growth rate is a difference: $g_{Y/N} \\approx g_Y - g_N$ and $g_{real} \\approx g_{nominal} - \\pi$. Faster population growth lowers income per person.',
    },
    'product-subtracted': {
      name: 'Subtracted the rates for a product',
      explanation:
        'A product multiplies levels, so its growth rate is a sum: $g_{PQ} \\approx g_P + g_Q$. Subtract only for ratios.',
    },
    'power-ignored': {
      name: 'Ignored the power',
      explanation:
        'Since $\\ln(X^a) = a\\ln X$, the growth rate of $X^a$ is $a$ times the growth rate of $X$. A square grows twice as fast, a square root half as fast, a reciprocal falls as fast as $X$ rises.',
    },
    'total-not-average': {
      name: 'Gave the total growth, not the yearly average',
      explanation:
        'The log difference covers the whole period. Divide by the number of years to get the average per year.',
    },
    'rebase-subtract': {
      name: 'Shifted the index instead of dividing',
      explanation:
        'Index numbers are ratios, so rebasing divides by the new base-year reading and multiplies by 100: $100\\, I_t / I_s$. Adding or subtracting changes the ratios between years.',
    },
    'nominal-growth': {
      name: 'Used nominal growth, not real',
      explanation:
        'Nominal growth includes price increases. Deflate both values to the same prices first, then compute the percent change of the real values.',
    },
    'deflate-inverted': {
      name: 'Multiplied by the price index instead of dividing',
      explanation:
        'Real value $= 100 \\times$ nominal $/$ price index. When prices have risen (index above 100), real value is smaller than nominal, not larger.',
    },
  },
  stepLabels: {
    difference: 'Subtract the start (or its log) from the end',
    'to-percent': 'Convert to a percent',
    'recall-rule': 'Recall the rule of 70',
    'rule-70': 'Apply the rule of 70',
    doublings: 'Count the doublings',
    'times-larger': 'Raise 2 to the number of doublings',
    combine: 'Choose add, subtract or multiply by the power',
    compute: 'Combine the growth rates',
    'per-year': 'Divide by the number of years',
    'solve-t': 'Divide the log gap by the rate',
    ratio: 'Divide by the base-year index',
    rebase: 'Rebase: times 100',
    deflate: 'Deflate: times 100',
    'deflate-start': 'Deflate the first value',
    'deflate-end': 'Deflate the second value',
    'real-growth': 'Percent change of the real values',
  },
  learn: {
    whyItMatters:
      'GDP growing 3% a year while population grows 1% means income per person grows about 3 \u2212 1 = 2%, and at 2% it doubles in about 70/2 = 35 years. Growth rates add where levels multiply, which is why economists work in logs: when $\\ln$ GDP rises from 10.000 to 10.030, GDP grew about 3% (exactly 3.05%). Growth accounting, inflation adjustments and log regressions all read changes this way. The approximation is good for small changes and drifts for large ones: from 100 to 150 is exactly 50%, but the log difference says 40.5%.',
    summary:
      'A log difference is a growth rate: $g \\approx 100(\\ln X_1 - \\ln X_0)$ percent, accurate for small changes. Products add growth rates, ratios subtract them, and a power multiplies the rate. The rule of 70 says doubling takes about $70/g$ years. Index numbers are ratios: rebase by dividing, deflate by dividing by the price index.',
    formulas: [
      { latex: 'g \\approx 100(\\ln X_1 - \\ln X_0)', note: 'Log approximation of percent change.' },
      { latex: 'g_{XY} \\approx g_X + g_Y, \\quad g_{X/Y} \\approx g_X - g_Y', note: 'Products add, ratios subtract.' },
      { latex: 'g_{X^a} \\approx a\\,g_X', note: 'Powers multiply the rate.' },
      { latex: '\\text{years to double} \\approx \\frac{70}{g}', note: '$g$ in percent.' },
      { latex: '\\text{real} = \\frac{100 \\cdot \\text{nominal}}{\\text{price index}}', note: 'Deflating.' },
    ],
    example: { seed: 1, level: 3 },
    tips: ['Check the sign: faster population growth lowers income per person, and inflation lowers real wages.'],
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
