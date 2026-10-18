// GRE · Ratios, rates & work. Formats: numeric entry (L1-L5), select all that apply (L1),
// quantitative comparison (L3, L5). Every QC relation is exact: Q arithmetic for explicit
// numbers, a proven case analysis (written beside each case) when variables are involved.

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step } from '../../engine/types';

/** "a 45%" / "an 85%" / "an 8-kilometer": the article as the number is spoken. */
const a = (n: number) => (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90) ? 'an' : 'a');
/** "1 liter" / "3 liters". */
const liters = (n: number | string) => (n === 1 || n === '1' ? '1 liter' : `${n} liters`);


const ID = 'gre-ratios-rates';
type Body = ReturnType<SkillDefinition['generate']>;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const relQ = (a: Q, b: Q): QcRelation => {
  const s = a.sub(b).sign();
  return s > 0 ? 'a' : s < 0 ? 'b' : 'c';
};

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

const decideStep = (relation: QcRelation, why: string, math = ''): Step => ({
  key: 'decide',
  instruction: relation === 'd' ? 'Different allowed values give different relationships.' : 'Every allowed value gives the same relationship.',
  math: math || (relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B' : relation === 'b' ? 'B > A' : 'A = B'),
  why,
  ask: { prompt: 'So which is it?', answer: qcAnswer(relation) },
});

// ---------- level 1: split in a ratio; equivalent ratios ----------

function level1(rng: Rng): Body {
  if (rng.chance(0.65)) {
    const n = rng.int(2, 3);
    const parts = Array.from({ length: n }, () => rng.int(1, 9));
    if (new Set(parts).size === 1) parts[0] = (parts[0] % 9) + 1;
    const S = parts.reduce((s, x) => s + x, 0);
    const k = rng.int(2, 12);
    const T = S * k;
    const idx = rng.int(0, n - 1);
    const j = (idx + 1) % n;
    const [a, b, c = 0] = parts;
    const share = parts[idx] * k;
    const answer = numberAnswer(share);
    const ratioTxt = parts.join(':');
    const ordinal = ['first', 'second', 'third'][idx];
    const ctx = rng.pick([`${T} dollars are split in the ratio ${ratioTxt}. How many dollars are in the ${ordinal} part?`, `${T} liters of paint are mixed in the ratio ${ratioTxt}. How many liters are in the ${ordinal} part?`, `${T} grams of an alloy contain its metals in the ratio ${ratioTxt}. How many grams are in the ${ordinal} part?`]);
    const verify = { type: 'evaluate', expr: `${T}*${parts[idx]}/${S}` } as const;
    return {
      params: { form: 0, a, b, c, k, idx, t: T },
      prompt: ctx,
      answer,
      steps: [
        {
          key: 'sum-parts',
          instruction: 'Add the parts of the ratio to get the number of equal shares in the whole.',
          math: `${parts.join(' + ')} = ${S}`,
          why: 'A ratio compares parts to parts; the total is the sum of the parts.',
          ask: { prompt: 'How many equal shares in all?', answer: numberAnswer(S), verify: { type: 'evaluate', expr: parts.join('+') } },
        },
        {
          key: 'one-share',
          instruction: `Divide the total by ${S} to get one share, then multiply by ${parts[idx]}.`,
          math: `\\frac{${T}}{${S}} = ${k}, \\quad ${k}\\times ${parts[idx]} = ${share}`,
          why: `The ${ordinal} part is ${parts[idx]}/${S} of the whole, not ${parts[idx]}/${parts[j]}.`,
          ask: { prompt: 'So that part is?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('ratio-part-vs-whole', () => Q.of(T).mul(parts[idx]).div(parts[j]))]),
      verify,
    };
  }
  // select all: ratios equivalent to a:b
  for (;;) {
    const a = rng.int(1, 9);
    const b = rng.int(1, 9);
    if (a === b || gcd(a, b) !== 1) continue;
    const ks = rng.shuffle([2, 3, 4, 5, 6, 7]);
    const good = ks.slice(0, rng.int(1, 3)).map((k): [number, number] => [a * k, b * k]);
    const bad: [number, number][] = [[b, a], [a + 3, b + 3], [a + 1, b + 1], [a * 2, b * 2 + 1], [a * 3 + 1, b * 3]];
    const pool = rng.shuffle(bad).filter(([x, y]) => x * b !== y * a);
    const chosen = [...good, ...pool.slice(0, 5 - good.length)];
    if (chosen.length < 5) continue;
    const labels = chosen.map(([x, y]) => `$${x}:${y}$`);
    if (new Set(labels).size < 5) continue;
    const order = rng.shuffle(chosen.map((_, i) => i));
    const options: ChoiceOption[] = order.map((ci, i) => ({ id: `o${i}`, label: labels[ci] }));
    const correct = order.map((ci, i) => (ci < good.length ? `o${i}` : '')).filter(Boolean);
    const answer = multiAnswer(options, correct);
    return {
      params: { form: 1, a, b, c: 0, k: 0, idx: 0, t: 0 },
      prompt: `Which of the following ratios are equal to $${a}:${b}$? Select all that apply.`,
      answer,
      steps: [
        {
          key: 'cross-check',
          instruction: `Two ratios x:y and ${a}:${b} are equal when x·${b} = y·${a} (or when both parts are multiplied by the same number).`,
          math: `\\frac{x}{y} = \\frac{${a}}{${b}} \\iff ${b}x = ${a}y`,
          why: 'Adding the same amount to both parts changes a ratio; only multiplying or dividing keeps it.',
          ask: {
            prompt: `Is $${a + 3}:${b + 3}$ equal to $${a}:${b}$?`,
            answer: { kind: 'choice', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], correct: 'no' },
          },
        },
        { key: 'test-each', instruction: 'Test each option.', math: chosen.map(([x, y]) => `${b}\\cdot ${x} ${x * b === y * a ? '=' : '\\ne'} ${a}\\cdot ${y}`).join(',\\quad '), why: 'Select-all needs every correct option and no wrong one.', ask: { prompt: 'Select all equal ratios.', answer } },
      ],
      misconceptions: [],
      verify: { type: 'choice', note: 'tests/skills/gre-ratios-rates.test.ts cross-multiplies each option' },
    };
  }
}

// ---------- level 2: combined work ----------

function level2(rng: Rng): Body {
  for (;;) {
    const m = rng.int(1, 4);
    const n = rng.int(1, 4);
    const k = rng.int(1, 6);
    const a = k * m * (m + n);
    const b = k * n * (m + n);
    if (a > 60 || b > 60) continue;
    const t = k * m * n; // = ab/(a+b)
    const form = rng.chance(0.65) ? 0 : 1;
    if (form === 1 && a === t) continue;
    const together = form === 0;
    const answer = numberAnswer(together ? t : b);
    const verify = { type: 'evaluate', expr: together ? `${a}*${b}/(${a}+${b})` : `${a}*${t}/(${a}-${t})` } as const;
    const prompt = together
      ? `Machine A alone can finish a job in ${a} hours, and Machine B alone can finish it in ${b} hours. Working together at these rates, how many hours do they need?`
      : `Pump A alone can fill a tank in ${a} hours. Pumps A and B working together fill it in ${t} hours. How many hours would Pump B take alone?`;
    return {
      params: { form, k, m, n, a, b, t },
      prompt,
      answer,
      steps: [
        {
          key: 'rates',
          instruction: 'Turn times into rates: jobs per hour.',
          math: together ? `\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{${a + b}}{${a * b}}` : `\\frac{1}{${t}} - \\frac{1}{${a}} = \\text{rate of B}`,
          why: 'Rates add; times do not.',
          ask: together
            ? { prompt: `What is the combined rate in jobs per hour ($\\frac{1}{${a}} + \\frac{1}{${b}}$)?`, answer: numberAnswer(Q.of(1).div(t)), verify: { type: 'evaluate', expr: `1/${a}+1/${b}` } }
            : { prompt: `What is B's rate, $\\frac{1}{${t}} - \\frac{1}{${a}}$?`, answer: numberAnswer(Q.of(1).div(b)), verify: { type: 'evaluate', expr: `1/${t}-1/${a}` } },
        },
        {
          key: 'invert',
          instruction: 'Invert the rate to get the time for one job.',
          math: together ? `\\frac{${a * b}}{${a + b}} = ${t}` : `\\frac{1}{1/${b}} = ${b}`,
          why: 'Time = 1 ÷ rate.',
          ask: { prompt: 'So the time is?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('work-rates-added-times', () => (together ? a + b : t - a))]),
      verify,
    };
  }
}

// ---------- level 3: average speed (harmonic mean) ----------

function level3(rng: Rng): Body {
  const form = rng.int(0, 2);
  for (;;) {
    const m = rng.int(1, 4);
    const n = rng.int(1, 4);
    if (m === n) continue;
    const k = rng.int(1, 12);
    const u = k * m * (m + n);
    const v = k * n * (m + n);
    if (u > 100 || v > 100) continue;
    const avg = 2 * k * m * n;
    if (form === 0) {
      const answer = numberAnswer(avg);
      const L = (u * v) / gcd(u, v);
      const verify = { type: 'evaluate', expr: `2*${u}*${v}/(${u}+${v})` } as const;
      return {
        params: { form, k, m, n, u, v, sub: 0 },
        prompt: `A driver goes from town A to town B at ${u} miles per hour and returns along the same road at ${v} miles per hour. What is the average speed, in miles per hour, for the whole round trip?`,
        answer,
        steps: [
          {
            key: 'total-time',
            instruction: `Pick an easy one-way distance, such as ${L} miles (a common multiple of the speeds), and find the total time.`,
            math: `\\frac{${L}}{${u}} + \\frac{${L}}{${v}} = ${L / u} + ${L / v} = ${L / u + L / v}`,
            why: 'Average speed = total distance ÷ total TIME, not the average of the speeds.',
            ask: { prompt: `Total hours for the round trip with a one-way distance of ${L} miles?`, answer: numberAnswer(L / u + L / v), verify: { type: 'evaluate', expr: `${L}/${u}+${L}/${v}` } },
          },
          {
            key: 'total-over-time',
            instruction: 'Divide the total distance by the total time.',
            math: `\\frac{${2 * L}}{${L / u + L / v}} = ${avg}`,
            why: 'The slower speed is used for longer, so the average is pulled below the midpoint.',
            ask: { prompt: 'Average speed?', answer, verify },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('average-speed-arithmetic-mean', () => Q.of(u + v).div(2))]),
        verify,
      };
    }
    if (form === 1) {
      // explicit speeds: harmonic mean < arithmetic mean whenever u != v (exact comparison)
      const A = Q.of(2 * u * v).div(u + v);
      const B = Q.of(u + v).div(2);
      const relation = relQ(A, B);
      const answer = qcAnswer(relation);
      return {
        params: { form, k, m, n, u, v, sub: 0 },
        prompt: QC_PROMPT(`A car makes a round trip, going at ${u} mph and returning along the same road at ${v} mph.`, 'The average speed for the round trip, in mph', `$\\frac{${u} + ${v}}{2}$`),
        answer,
        steps: [
          {
            key: 'harmonic',
            instruction: 'Average speed is total distance over total time: 2uv/(u+v).',
            math: `\\frac{2(${u})(${v})}{${u}+${v}} = ${avg}`,
            why: 'Average speed over equal distances is the harmonic mean.',
            ask: { prompt: 'What is the average speed for the round trip?', answer: numberAnswer(avg), verify: { type: 'evaluate', expr: `2*${u}*${v}/(${u}+${v})` } },
          },
          decideStep(relation, 'The harmonic mean is always below the arithmetic mean unless the speeds are equal.', `${avg} \\text{ vs } ${B.toLatex()}`),
        ],
        misconceptions: distinctMisconceptions(answer, [{ id: 'average-speed-arithmetic-mean', wrong: qcAnswer('c') }]),
        verify: { type: 'qc', quantityA: `2*${u}*${v}/(${u}+${v})`, quantityB: `(${u}+${v})/2`, variables: [], constraints: [] },
      };
    }
    // variables. (u+v)/2 - 2uv/(u+v) = (u-v)^2 / (2(u+v)) >= 0, with equality only when u = v.
    const sub = rng.int(0, 1); // 0: u != v -> B; 1: u, v > 0 -> D (u = v gives equal, otherwise B)
    const relation: QcRelation = sub === 0 ? 'b' : 'd';
    const answer = qcAnswer(relation);
    return {
      params: { form, k, m, n, u, v, sub },
      prompt: QC_PROMPT(
        sub === 0 ? 'A car makes a round trip, traveling at $u$ mph one way and $v$ mph back along the same road, where $u$ and $v$ are positive and $u \\ne v$.' : 'A car makes a round trip, traveling at $u$ mph one way and $v$ mph back along the same road, where $u$ and $v$ are positive.',
        'The average speed for the round trip',
        '$\\frac{u + v}{2}$',
      ),
      answer,
      steps: [
        {
          key: 'harmonic',
          instruction: 'Test u = 40, v = 60: average speed is 2uv/(u+v).',
          math: `\\frac{2(40)(60)}{100} = 48 < 50 = \\frac{40+60}{2}`,
          why: 'Average speed over equal distances is the harmonic mean, not the average of the speeds.',
          ask: { prompt: 'Average speed when $u = 40$ and $v = 60$?', answer: numberAnswer(48), verify: { type: 'evaluate', expr: '2*40*60/(40+60)' } },
        },
        decideStep(relation, sub === 0 ? 'Algebra: (u+v)/2 - 2uv/(u+v) = (u-v)^2 / (2(u+v)) > 0 when u is not v.' : 'If u = v the two are equal; otherwise B is greater. So it cannot be determined.', sub === 0 ? '\\frac{u+v}{2} - \\frac{2uv}{u+v} = \\frac{(u-v)^2}{2(u+v)} > 0' : '\\text{u = v: equal; } u \\ne v: B'),
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'average-speed-arithmetic-mean', wrong: qcAnswer('c') }]),
      verify: {
        type: 'qc',
        quantityA: '2*u*v/(u+v)',
        quantityB: '(u+v)/2',
        variables: [{ name: 'u', min: 1, max: 100 }, { name: 'v', min: 1, max: 100 }], // window inside u, v > 0
        constraints: sub === 0 ? ['u != v'] : [],
      },
    };
  }
}

// ---------- level 4: rate x time with unit conversion ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 3);
  const P = { form, s: 0, t: 0, d: 0, x: 0, h: 0, v: 0 };
  if (form === 0) {
    const t = rng.pick([10, 12, 15, 20, 30, 40, 45, 50]);
    const unit = 60 / gcd(60, t);
    const s = unit * rng.int(1, Math.floor(120 / unit));
    const dist = (s * t) / 60;
    const answer = numberAnswer(dist);
    const verify = { type: 'evaluate', expr: `${s}*${t}/60` } as const;
    return {
      params: { ...P, s, t },
      prompt: `A train travels at a constant ${s} kilometers per hour. How many kilometers does it travel in ${t} minutes?`,
      answer,
      steps: [
        { key: 'convert-units', instruction: 'The speed is per HOUR, so convert the minutes to hours.', math: `${t}\\text{ min} = \\frac{${t}}{60}\\text{ h}`, why: 'Units must match before multiplying rate by time.', ask: { prompt: `How many hours is ${t} minutes? (as a fraction or decimal)`, answer: numberAnswer(Q.of(t).div(60)), verify: { type: 'evaluate', expr: `${t}/60` } } },
        { key: 'rate-times-time', instruction: 'Distance = rate × time.', math: `${s} \\times \\frac{${t}}{60} = ${dist}`, why: 'distance = rate × time', ask: { prompt: 'Distance in km?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('unit-conversion-missed', () => s * t)]),
      verify,
    };
  }
  if (form === 1) {
    const s = 5 * rng.int(4, 18);
    const unit = 60 / gcd(60, s);
    const mins = unit * rng.int(1, Math.floor(90 / unit));
    const d = (s * mins) / 60;
    const answer = numberAnswer(mins);
    const verify = { type: 'evaluate', expr: `60*${d}/${s}` } as const;
    return {
      params: { ...P, s, d },
      prompt: `A cyclist rides at ${s} kilometers per hour. How many MINUTES does ${a(d)} ${d}-kilometer ride take?`,
      answer,
      steps: [
        { key: 'time-hours', instruction: 'Time = distance ÷ rate, which comes out in hours.', math: `\\frac{${d}}{${s}} \\text{ hours}`, why: 'The rate is per hour, so this time is in hours.', ask: { prompt: 'How many hours (fraction or decimal)?', answer: numberAnswer(Q.of(d).div(s)), verify: { type: 'evaluate', expr: `${d}/${s}` } } },
        { key: 'to-minutes', instruction: 'Convert hours to minutes: multiply by 60.', math: `\\frac{${d}}{${s}} \\times 60 = ${mins}`, why: 'The question asks for minutes.', ask: { prompt: 'Minutes?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('unit-conversion-missed', () => Q.of(d).div(s))]),
      verify,
    };
  }
  if (form === 2) {
    const x = rng.int(2, 40);
    const h = rng.int(2, 6);
    const answer = numberAnswer(x * 60 * h);
    const verify = { type: 'evaluate', expr: `${x}*60*${h}` } as const;
    return {
      params: { ...P, x, h },
      prompt: `A pump moves ${x} liters of water per minute. How many liters does it move in ${h} hours?`,
      answer,
      steps: [
        { key: 'convert-units', instruction: 'The rate is per MINUTE, so convert the hours to minutes.', math: `${h}\\text{ h} = ${60 * h}\\text{ min}`, why: 'Units must match before multiplying rate by time.', ask: { prompt: `How many minutes is ${h} hours?`, answer: numberAnswer(60 * h), verify: { type: 'evaluate', expr: `60*${h}` } } },
        { key: 'rate-times-time', instruction: 'Amount = rate × time.', math: `${x} \\times ${60 * h} = ${x * 60 * h}`, why: 'amount = rate × time', ask: { prompt: 'Liters?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('unit-conversion-missed', () => x * h)]),
      verify,
    };
  }
  const v = 5 * rng.int(1, 6);
  const answer = numberAnswer((v * 3600) / 1000);
  const verify = { type: 'evaluate', expr: `${v}*3600/1000` } as const;
  return {
    params: { ...P, v },
    prompt: `A runner moves at ${v} meters per second. What is that speed in kilometers per hour?`,
    answer,
    steps: [
      { key: 'meters-to-km', instruction: 'Per hour there are 3600 seconds, and 1000 meters make a kilometer.', math: `${v}\\ \\frac{\\text{m}}{\\text{s}} \\times 3600\\ \\frac{\\text{s}}{\\text{h}} = ${v * 3600}\\ \\frac{\\text{m}}{\\text{h}}`, why: 'Convert one unit at a time.', ask: { prompt: 'Meters per hour?', answer: numberAnswer(v * 3600), verify: { type: 'evaluate', expr: `${v}*3600` } } },
      { key: 'to-km', instruction: 'Divide by 1000 to get kilometers.', math: `\\frac{${v * 3600}}{1000} = ${(v * 3600) / 1000}`, why: '1 km = 1000 m', ask: { prompt: 'Kilometers per hour?', answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('unit-conversion-missed', () => v * 3600)]),
    verify,
  };
}

// ---------- level 5: mixtures ----------

function level5(rng: Rng): Body {
  const form = rng.int(0, 2);
  const P = { form, x: 0, y: 0, c1: 0, c2: 0, sub: 0 };
  if (form === 0) {
    for (;;) {
      const x = rng.int(1, 30);
      const y = rng.int(1, 30);
      const c1 = 5 * rng.int(1, 18);
      const c2 = 5 * rng.int(1, 18);
      if (c1 === c2) continue;
      const conc = Q.of(x * c1 + y * c2).div(x + y);
      if (!conc.isInt()) continue;
      const answer = numberAnswer(conc);
      const verify = { type: 'evaluate', expr: `(${x}*${c1}+${y}*${c2})/(${x}+${y})` } as const;
      return {
        params: { ...P, x, y, c1, c2 },
        prompt: `${liters(x)} of ${a(c1)} ${c1}% salt solution are mixed with ${liters(y)} of ${a(c2)} ${c2}% salt solution. What is the salt concentration, in percent, of the mixture?`,
        answer,
        steps: [
          { key: 'total-volume', instruction: 'Find the total volume of the mixture.', math: `${x} + ${y} = ${x + y}`, why: 'The mixture has x + y liters.', ask: { prompt: 'Total liters?', answer: numberAnswer(x + y), verify: { type: 'evaluate', expr: `${x}+${y}` } } },
          { key: 'weighted-average', instruction: 'Weight each concentration by its volume.', math: `\\frac{${x}(${c1}) + ${y}(${c2})}{${x + y}} = \\frac{${x * c1 + y * c2}}{${x + y}} = ${conc.toString()}`, why: 'More volume means more weight; do not just average the two percents.', ask: { prompt: 'Concentration in percent?', answer, verify } },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('mixture-simple-average', () => Q.of(c1 + c2).div(2))]),
        verify,
      };
    }
  }
  if (form === 1) {
    for (;;) {
      const x = rng.int(5, 60);
      const c2 = 5 * rng.int(1, 12);
      const c1 = 5 * rng.int(Math.floor(c2 / 5) + 1, 18);
      const w = Q.of(x * (c1 - c2)).div(c2);
      if (!w.isInt()) continue;
      const answer = numberAnswer(w);
      const verify = { type: 'evaluate', expr: `${x}*(${c1}-${c2})/${c2}` } as const;
      const salt = Q.of(x * c1).div(100);
      return {
        params: { ...P, x, c1, c2 },
        prompt: `${liters(x)} of ${a(c1)} ${c1}% salt solution are diluted by adding pure water until the solution is ${c2}% salt. How many liters of water are added?`,
        answer,
        steps: [
          { key: 'salt-constant', instruction: 'Adding water does not change the amount of salt.', math: `${c1}\\% \\times ${x} = ${salt.toLatex()}\\text{ L of salt}`, why: 'Track the part that does not change.', ask: { prompt: 'Liters of salt?', answer: numberAnswer(salt), verify: { type: 'evaluate', expr: `${c1}/100*${x}` } } },
          { key: 'solve-total', instruction: `That salt must be ${c2}% of the new total, so total = salt ÷ ${c2 / 100}. Subtract the original volume.`, math: `\\frac{${salt.toLatex()}}{${c2 / 100}} - ${x} = ${w.toString()}`, why: 'New total − old volume = water added.', ask: { prompt: 'Liters of water added?', answer, verify } },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('mixture-wrong-base', () => Q.of(x * (c1 - c2)).div(c1))]),
        verify,
      };
    }
  }
  // QC: x liters of c1% mixed with y liters of c2%, c1 < c2, versus the midpoint.
  // conc - mid = (c2 - c1)(y - x) / (2(x + y)): its sign is the sign of y - x.
  const c1 = 10 * rng.int(1, 4);
  const c2 = c1 + 10 * rng.int(1, 5);
  const mid = (c1 + c2) / 2;
  const sub = rng.int(0, 3); // 0: explicit amounts, 1: no constraint (D), 2: x > y (B), 3: y > x (A)
  const aExpr = (x: string, y: string) => `(${x}*${c1}+${y}*${c2})/(${x}+${y})`;
  if (sub === 0) {
    const x = rng.int(1, 30);
    const y = rng.chance(0.2) ? x : rng.int(1, 30);
    const relation = relQ(Q.of(x * c1 + y * c2).div(x + y), Q.of(mid));
    const conc = Q.of(x * c1 + y * c2).div(x + y);
    const answer = qcAnswer(relation);
    return {
      params: { ...P, x, y, c1, c2, sub },
      prompt: QC_PROMPT(`${liters(x)} of ${a(c1)} ${c1}% solution are mixed with ${liters(y)} of ${a(c2)} ${c2}% solution.`, 'The concentration of the mixture, in percent', `${mid}`),
      answer,
      steps: [
        { key: 'weighted-average', instruction: 'Compute the weighted average.', math: `\\frac{${x}(${c1}) + ${y}(${c2})}{${x + y}} = ${conc.toLatex()}`, why: 'The mixture leans toward the solution you have more of.', ask: { prompt: 'Concentration of the mixture?', answer: numberAnswer(conc), verify: { type: 'evaluate', expr: aExpr(String(x), String(y)) } } },
        decideStep(relation, `The midpoint ${mid} is the answer only when the two volumes are equal.`, `${conc.toLatex()} \\text{ vs } ${mid}`),
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'mixture-simple-average', wrong: qcAnswer('c') }]),
      verify: { type: 'qc', quantityA: aExpr(String(x), String(y)), quantityB: `${mid}`, variables: [], constraints: [] },
    };
  }
  const relation: QcRelation = sub === 1 ? 'd' : sub === 2 ? 'b' : 'a';
  const setup = `$x$ liters of ${a(c1)} ${c1}% solution are mixed with $y$ liters of ${a(c2)} ${c2}% solution${sub === 1 ? ', where $x > 0$ and $y > 0$.' : sub === 2 ? ', where $x > y > 0$.' : ', where $y > x > 0$.'}`;
  const answer = qcAnswer(relation);
  return {
    params: { ...P, c1, c2, sub },
    prompt: QC_PROMPT(setup, 'The concentration of the mixture, in percent', `${mid}`),
    answer,
    steps: [
      { key: 'weighted-average', instruction: 'Test equal volumes, x = y = 10.', math: `\\frac{10(${c1}) + 10(${c2})}{20} = ${mid}`, why: 'Equal volumes land exactly on the midpoint; more of one side pulls it that way.', ask: { prompt: `Concentration when $x = y = 10$?`, answer: numberAnswer(mid), verify: { type: 'evaluate', expr: aExpr('10', '10') } } },
      decideStep(relation, sub === 1 ? 'x > y gives B greater, y > x gives A greater: cannot be determined.' : 'More of the weaker solution pulls the mixture below the midpoint; more of the stronger pulls it above.'),
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'mixture-simple-average', wrong: qcAnswer('c') }]),
    verify: {
      type: 'qc',
      quantityA: aExpr('x', 'y'),
      quantityB: `${mid}`,
      variables: [{ name: 'x', min: 0.5, max: 50 }, { name: 'y', min: 0.5, max: 50 }], // window inside x, y > 0
      constraints: sub === 1 ? [] : sub === 2 ? ['x > y'] : ['y > x'],
    },
  };
}

export const greRatiosRates: SkillDefinition = {
  id: ID,
  title: 'Ratios, rates & work',
  track: 'gre',
  unit: 'GRE · Arithmetic',
  description: 'Splitting in a ratio, combined work, average speed, rate-time problems with unit conversion, and mixtures.',
  prerequisites: ['gre-fractions-percents'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Ratios: split a total; equal ratios (select all)', ranges: { form: [0, 1], a: [1, 9], b: [1, 9], c: [0, 9], k: [0, 12], idx: [0, 2], t: [0, 324] } },
    2: { description: 'Combined work', ranges: { form: [0, 1], k: [1, 6], m: [1, 4], n: [1, 4], a: [1, 60], b: [1, 60], t: [1, 30] } },
    3: { description: 'Average speed (numeric and QC)', ranges: { form: [0, 2], k: [1, 12], m: [1, 4], n: [1, 4], u: [1, 100], v: [1, 100], sub: [0, 1] } },
    4: { description: 'Rate × time with unit conversion', ranges: { form: [0, 3], s: [0, 120], t: [0, 50], d: [0, 200], x: [0, 40], h: [0, 6], v: [0, 30] } },
    5: { description: 'Mixtures (numeric and QC)', ranges: { form: [0, 2], x: [0, 60], y: [0, 30], c1: [0, 90], c2: [0, 90], sub: [0, 3] } },
  },
  misconceptions: {
    'ratio-part-vs-whole': { name: 'Read a:b as a/b of the total', explanation: 'In a ratio $a:b$ the whole is $a + b$ shares, so the first part is $\\frac{a}{a+b}$ of the total. $\\frac{a}{b}$ compares the parts to each other.' },
    'work-rates-added-times': { name: 'Added the times instead of the rates', explanation: 'Times do not add when people work together; RATES do: $\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{t}$. Together they must be faster than either alone.' },
    'average-speed-arithmetic-mean': { name: 'Averaged the two speeds', explanation: 'Average speed = total distance ÷ total time. You spend longer at the slower speed, so the average is below $\\frac{u+v}{2}$ unless $u = v$. For equal distances it is $\\frac{2uv}{u+v}$.' },
    'unit-conversion-missed': { name: 'Mixed minutes and hours', explanation: 'Make the units agree BEFORE multiplying or dividing: a rate per hour needs time in hours, a rate per minute needs time in minutes.' },
    'mixture-simple-average': { name: 'Averaged the two concentrations', explanation: 'A mixture\'s concentration is a WEIGHTED average: each concentration counts in proportion to its volume. Only equal volumes give the plain average.' },
    'mixture-wrong-base': { name: 'Divided by the original percent', explanation: 'After diluting, the salt is a percent of the NEW total, so divide the salt by the target percent: $\\text{total} = \\frac{\\text{salt}}{c_2}$.' },
  },
  stepLabels: {
    'sum-parts': 'Add the parts of the ratio',
    'one-share': 'Find one share, then scale',
    'cross-check': 'Cross-multiply to compare ratios',
    'test-each': 'Test each option',
    rates: 'Write times as rates',
    invert: 'Invert the rate to get time',
    'total-time': 'Find the total time',
    'total-over-time': 'Total distance over total time',
    harmonic: 'Average speed for equal distances',
    decide: 'Decide the relationship',
    'convert-units': 'Convert the units',
    'rate-times-time': 'Rate × time',
    'time-hours': 'Distance ÷ rate',
    'to-minutes': 'Convert hours to minutes',
    'meters-to-km': 'Convert meters per second to meters per hour',
    'to-km': 'Convert meters to kilometers',
    'total-volume': 'Total volume',
    'weighted-average': 'Weighted average of concentrations',
    'salt-constant': 'Find the amount that stays constant',
    'solve-total': 'Solve for the new total',
  },
  learn: {
    whyItMatters:
      'Rate and ratio problems are a staple of GRE word problems, and the test sets traps: work times do not add, and average speed is not the average of two speeds. The same weighted-average idea runs through economics: if a firm sells 30 units at \\$10 and 10 units at \\$20, its average price is (30 × 10 + 10 × 20) / 40 = \\$12.50, not \\$15, because more units sold at the lower price.',
    summary:
      'A ratio $a:b$ splits a total into $a + b$ shares. Work rates add: $\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{t}$. Average speed is total distance over total time; over equal distances it is the harmonic mean $\\frac{2uv}{u+v}$. Convert units before multiplying. A mixture\'s concentration is the volume-weighted average.',
    formulas: [
      { latex: '\\frac{1}{t} = \\frac{1}{a} + \\frac{1}{b} \\;\\Rightarrow\\; t = \\frac{ab}{a+b}' },
      { latex: '\\bar v = \\frac{2uv}{u+v} \\le \\frac{u+v}{2}', note: 'Equal only when $u = v$.' },
      { latex: 'c = \\frac{x c_1 + y c_2}{x + y}', note: 'Mixture concentration.' },
    ],
    example: { seed: 7, level: 3 },
    tips: ['Convert to the units the question asks for FIRST.', 'Sanity check: together is faster than either alone; a mixture lies between its parts.'],
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
