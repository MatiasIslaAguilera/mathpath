// GRE Data analysis: reading bar charts and tables. Every problem carries a figure built from
// its params (barChartFigure / tableFigure). Formats: numeric entry (L1-L3), multiple choice
// with far-apart estimation options (L4), select-all "can be inferred" (L5).
// All data are stored as individual params (v0.., s0..), so a problem is reproducible from them.

import { choiceAnswer, multiAnswer, numberAnswer, wrongNumber } from '../../engine/answers';
import { barChartFigure, tableFigure } from '../../engine/figures';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, MisconceptionInstance, SkillDefinition } from '../../engine/types';

const ID = 'gre-data-interpretation';
type Body = ReturnType<SkillDefinition['generate']>;

const YEAR_THEMES = [
  { title: 'Annual sales of Company X (thousands of units)', noun: 'sales' },
  { title: 'Annual enrollment at Westfield College (hundreds of students)', noun: 'enrollment' },
  { title: 'Annual output of Plant P (thousands of tons)', noun: 'output' },
];
const BUDGET_THEMES = [
  { title: 'Monthly household budget (dollars)', cats: ['Housing', 'Food', 'Transport', 'Utilities', 'Savings'] },
  { title: 'Company expenses for one quarter (dollars)', cats: ['Salaries', 'Rent', 'Marketing', 'Supplies', 'Travel'] },
  { title: 'Annual spending of a city (millions of dollars)', cats: ['Schools', 'Roads', 'Police', 'Parks', 'Health'] },
];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const keys = (prefix: string, xs: number[]) => Object.fromEntries(xs.map((v, i) => [`${prefix}${i}`, v]));
const rangeKeys = (prefix: string, count: number, r: [number, number]) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${i}`, r]));
const neighbor = (i: number, n: number) => (i < n - 1 ? i + 1 : i - 1);

/** Prompt prefix naming the chart (its title is not drawn on the chart itself). */
const intro = (theme: number) => `Chart: ${YEAR_THEMES[theme].title}. `;

function yearChart(theme: number, y0: number, vals: number[]) {
  const years = vals.map((_, i) => String(y0 + i));
  return barChartFigure({
    // The builder puts the title at the top where the tallest bar's value label collides with it,
    // so the title is given in the prompt (intro) and in the alt text instead.
    title: '',
    categories: years,
    values: vals,
    alt: `Bar chart, ${YEAR_THEMES[theme].title}: ${years.map((y, i) => `${y}: ${vals[i]}`).join('; ')}.`,
  });
}

// ---------- level 1: read a value, a difference, or a total ----------

function level1(rng: Rng): Body {
  const theme = rng.int(0, 2);
  const y0 = rng.int(2005, 2020);
  const form = rng.int(0, 2);
  const vals = Array.from({ length: 5 }, () => rng.int(20, 200));
  let i = rng.int(0, 4);
  let j = rng.int(0, 4);
  if (form !== 0) {
    while (j === i) j = rng.int(0, 4);
    if (form === 1 && vals[i] === vals[j]) vals[i] += 5;
    if (form === 1 && vals[i] < vals[j]) [i, j] = [j, i]; // i is the larger year, so the difference is positive
  } else j = 0;
  const noun = YEAR_THEMES[theme].noun;
  const yi = y0 + i;
  const yj = y0 + j;
  const ni = neighbor(i, 5);
  let value: number, wrongV: number, prompt: string, expr: string;
  if (form === 0) {
    value = vals[i];
    wrongV = vals[ni];
    prompt = `According to the bar chart, what were ${noun} in ${yi}? (Answer in the chart's units.)`;
    expr = `${vals[i]}`;
  } else if (form === 1) {
    value = vals[i] - vals[j];
    wrongV = vals[ni] - vals[j];
    prompt = `According to the bar chart, by how much did ${noun} in ${yi} exceed ${noun} in ${yj}? (Answer in the chart's units.)`;
    expr = `${vals[i]}-${vals[j]}`;
  } else {
    value = vals[i] + vals[j];
    wrongV = vals[ni] + vals[j];
    prompt = `According to the bar chart, what were the combined ${noun} in ${yi} and ${yj}? (Answer in the chart's units.)`;
    expr = `${vals[i]}+${vals[j]}`;
  }
  const answer = numberAnswer(value);
  return {
    params: { theme, y0, form, i, j, ...keys('v', vals) },
    prompt: intro(theme) + prompt,
    figure: yearChart(theme, y0, vals),
    answer,
    steps: [
      { key: 'locate-bar', instruction: `Find the bar labeled ${yi} and read its value from the label above it.`, math: `${yi}: ${vals[i]}`, why: 'Read the label of the right category; the neighboring bars are the usual trap.', ask: { prompt: `What value is shown for ${yi}?`, answer: numberAnswer(vals[i]), verify: { type: 'evaluate', expr: `${vals[i]}` } } },
      { key: 'combine-values', instruction: form === 0 ? 'That value is the answer.' : form === 1 ? `Subtract the ${yj} value (${vals[j]}).` : `Add the ${yj} value (${vals[j]}).`, math: form === 0 ? `${vals[i]}` : form === 1 ? `${vals[i]} - ${vals[j]} = ${value}` : `${vals[i]} + ${vals[j]} = ${value}`, why: 'Check the units in the chart title before answering.', ask: { prompt: 'What is the answer?', answer, verify: { type: 'evaluate', expr } } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('misread-category', () => wrongV)]),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 2: percent change between two years (exact) ----------

function level2(rng: Rng): Body {
  for (;;) {
    const theme = rng.int(0, 2);
    const y0 = rng.int(2005, 2020);
    const i = rng.int(0, 3);
    const j = rng.int(i + 1, 4);
    const old = 20 * rng.int(2, 12);
    const pct = 5 * rng.int(1, 12) * (rng.chance(0.5) ? 1 : -1);
    const nw = (old * (100 + pct)) / 100;
    if (!Number.isInteger(nw) || nw < 10) continue;
    const vals = Array.from({ length: 5 }, () => rng.int(20, 300));
    vals[i] = old;
    vals[j] = nw;
    const noun = YEAR_THEMES[theme].noun;
    const p = Math.abs(pct);
    const diff = Math.abs(nw - old);
    const answer = numberAnswer(p);
    const verify = `100*${diff}/${old}`;
    const dir = pct > 0 ? 'increase' : 'decrease';
    return {
      params: { theme, y0, i, j, ...keys('v', vals) },
      prompt: `${intro(theme)}According to the bar chart, ${noun} changed from ${y0 + i} to ${y0 + j}. What was the percent ${dir}?`,
      figure: yearChart(theme, y0, vals),
      answer,
      steps: [
        { key: 'change-amount', instruction: `Read both bars (${old} and ${nw}) and find the change.`, math: `|${nw} - ${old}| = ${diff}`, why: 'Percent change starts from the absolute change.', ask: { prompt: `By how much did ${noun} change (ignore the sign)?`, answer: numberAnswer(diff), verify: { type: 'evaluate', expr: `${diff}` } } },
        { key: 'divide-original', instruction: `Divide by the ORIGINAL (earlier) value, ${old}, and convert to a percent.`, math: `\\frac{${diff}}{${old}} \\times 100 = ${p}\\%`, why: 'Percent change is measured against the starting value, not the ending one.', ask: { prompt: `What is the percent ${dir}?`, answer, verify: { type: 'evaluate', expr: verify } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('percent-change-base', () => new Q(100 * diff, nw))]),
      verify: { type: 'evaluate', expr: verify },
    };
  }
}

// ---------- level 3: share of a total from a table ----------

function level3(rng: Rng): Body {
  for (;;) {
    const theme = rng.int(0, 2);
    const form = rng.int(0, 1);
    const t = rng.int(10, 60);
    // five shares in units of 5%, each between 5% and 40%, summing to 100%
    const units = [1, 1, 1, 1, 1];
    for (let left = 15; left > 0; left--) {
      const k = rng.int(0, 4);
      if (units[k] < 8) units[k]++;
      else left++;
    }
    const shares = units.map((u) => 5 * u);
    if (sum(shares) !== 100) continue;
    const amounts = shares.map((s) => s * t);
    const total = sum(amounts);
    const i = rng.int(0, 4);
    let j = rng.int(0, 4);
    while (j === i) j = rng.int(0, 4);
    const cats = BUDGET_THEMES[theme].cats;
    let part: number, label: string, partExpr: string, wrongPart: number;
    if (form === 0) {
      part = amounts[i];
      label = `${cats[i]}`;
      partExpr = `${amounts[i]}`;
      wrongPart = amounts[neighbor(i, 5)];
    } else {
      part = amounts[i] + amounts[j];
      label = `${cats[i]} and ${cats[j]} combined`;
      partExpr = `${amounts[i]}+${amounts[j]}`;
      wrongPart = amounts[neighbor(i, 5)] + amounts[j];
    }
    const value = (100 * part) / total;
    if (!Number.isInteger(value)) continue;
    const answer = numberAnswer(value);
    const totalExpr = amounts.join('+');
    const verify = `100*(${partExpr})/(${totalExpr})`;
    return {
      params: { theme, form, i, j: form === 0 ? 0 : j, t, ...keys('s', shares) },
      prompt: `The table shows how the budget was spent. What percent of the total budget was spent on ${label}?`,
      figure: tableFigure(BUDGET_THEMES[theme].title, ['Category', 'Amount'], cats.map((c, k) => [c, amounts[k]])),
      answer,
      steps: [
        { key: 'total', instruction: 'Add every category to get the total budget (the whole).', math: `${amounts.join(' + ')} = ${total}`, why: 'A share is part ÷ whole, so the whole must include every category in the table.', ask: { prompt: 'What is the total of all categories?', answer: numberAnswer(total), verify: { type: 'evaluate', expr: totalExpr } } },
        { key: 'part-over-whole', instruction: `Divide the part (${part}) by the total and convert to a percent.`, math: `\\frac{${part}}{${total}} \\times 100 = ${value}\\%`, why: 'Percent = part ÷ whole × 100.', ask: { prompt: `What percent is ${label}?`, answer, verify: { type: 'evaluate', expr: verify } } },
      ],
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('share-of-wrong-total', () => new Q(100 * part, total - part)),
        wrongNumber('misread-category', () => new Q(100 * wrongPart, total)),
      ]),
      verify: { type: 'evaluate', expr: verify },
    };
  }
}

// ---------- level 4: "approximately what" estimation (multiple choice, far-apart options) ----------

function level4(rng: Rng): Body {
  for (;;) {
    const theme = rng.int(0, 2);
    const y0 = rng.int(2005, 2020);
    const form = rng.int(0, 2);
    const vals = Array.from({ length: 5 }, () => rng.int(40, 300));
    const noun = YEAR_THEMES[theme].noun;
    const total = sum(vals);
    let i = rng.int(0, 4);
    let j = rng.int(0, 4);
    let exact: number, step: number, prompt: string, mistakes: [string, number][];
    let unit = '';
    if (form === 0) {
      j = 0;
      exact = (100 * vals[i]) / total;
      step = 10;
      unit = '%';
      prompt = `Approximately what percent of the five-year total of ${noun} occurred in ${y0 + i}?`;
      mistakes = [['share-of-wrong-total', (100 * vals[i]) / (total - vals[i])], ['misread-category', (100 * vals[neighbor(i, 5)]) / total]];
    } else if (form === 1) {
      while (j <= i) {
        i = rng.int(0, 3);
        j = rng.int(0, 4);
      }
      exact = (100 * (vals[j] - vals[i])) / vals[i];
      step = 20; // percent-change options are 20 points apart, so estimating suffices
      unit = '%';
      prompt = `Approximately what was the percent change in ${noun} from ${y0 + i} to ${y0 + j}?`;
      mistakes = [['percent-change-base', (100 * (vals[j] - vals[i])) / vals[j]], ['misread-category', (100 * (vals[j] - vals[neighbor(i, 5)])) / vals[neighbor(i, 5)]]];
    } else {
      j = 0;
      exact = total / 5;
      step = 50;
      prompt = `Approximately what was the average (arithmetic mean) annual ${noun} over the five years shown, in the chart's units?`;
      mistakes = [['misread-category', total / 4]];
    }
    const c = Math.round(exact / step) * step;
    const tol = form === 2 ? 10 : form === 1 ? 3 : 2;
    if (Math.abs(exact - c) > tol || c < step) continue;
    if (form === 1 && exact < 10) continue;
    const grid = (x: number) => Math.round(x / step) * step;
    const set: number[] = [c];
    const add = (x: number) => {
      if (x >= step && !set.includes(x)) set.push(x);
    };
    mistakes.forEach(([, v]) => add(grid(v)));
    for (let k = 1; set.length < 5; k++) {
      add(c + k * step);
      if (set.length < 5) add(c - k * step);
    }
    const sorted = set.slice(0, 5).sort((a, b) => a - b);
    const options: ChoiceOption[] = sorted.map((v, k) => ({ id: `o${k}`, label: `${v}${unit}` }));
    const idOf = (v: number) => options[sorted.indexOf(v)]?.id;
    const answer = choiceAnswer(options, idOf(c));
    const mis: MisconceptionInstance[] = [];
    for (const [id, v] of mistakes) {
      const oid = idOf(grid(v));
      if (oid) mis.push({ id, wrong: choiceAnswer(options, oid) });
    }
    const roundedHint = vals.map((v) => `${v}`).join(' + ');
    return {
      params: { theme, y0, form, i, j, ...keys('v', vals) },
      prompt: intro(theme) + prompt,
      figure: yearChart(theme, y0, vals),
      answer,
      steps: [
        { key: 'round-values', instruction: 'Round the bar values to easy numbers and estimate. The options are far apart, so a rough estimate is enough.', math: form === 2 ? `\\text{total} \\approx ${total} \\Rightarrow \\frac{${total}}{5} \\approx ${total / 5}` : `${roundedHint}`, why: 'On the GRE, estimate first: do not do exact arithmetic when the options are 10 or more apart.', ask: { prompt: form === 1 ? `What is ${noun} in ${y0 + j} minus ${noun} in ${y0 + i}?` : `What is the total of the five bars?`, answer: numberAnswer(form === 1 ? vals[j] - vals[i] : total), verify: { type: 'evaluate', expr: form === 1 ? `${vals[j]}-${vals[i]}` : vals.join('+') } } },
        { key: 'pick-nearest', instruction: 'Pick the option closest to your estimate.', math: `\\text{exact} \\approx ${Math.round(exact * 10) / 10}${unit === '%' ? '\\%' : ''}`, why: 'Percent change uses the starting value as the base; a share uses the whole total as the base.', ask: { prompt: 'Which option is closest?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, mis),
      verify: { type: 'choice', note: 'tests/skills/gre-data-interpretation.test.ts recomputes the exact value from the chart data and checks the nearest option' },
    };
  }
}

// ---------- level 5: select all that can be inferred from a table ----------

interface Stmt {
  text: string;
  truth: boolean;
  /** Truth value under a known misconception, if that misconception applies to this statement. */
  trap?: { id: string; truth: boolean };
}

function level5(rng: Rng): Body {
  for (;;) {
    const theme = rng.int(0, 2);
    const y0 = rng.int(2005, 2020);
    const gap = rng.int(1, 5);
    const boom = rng.chance(0.4);
    const r = Array.from({ length: 5 }, () => rng.int(40, 400));
    const s = r.map((v) => (boom ? Math.round(v * (1 + rng.int(2, 40) / 100)) : Math.max(10, Math.round(v * (rng.int(60, 150) / 100)))));
    const noun = YEAR_THEMES[theme].noun;
    const Y1 = y0;
    const Y2 = y0 + gap;
    const tot1 = sum(r);
    const tot2 = sum(s);
    const reg = () => rng.int(0, 4);
    const make: (() => Stmt | null)[] = [
      () => {
        const k = reg();
        const mx = Math.max(...s);
        if (s[k] === mx && s.filter((v) => v === mx).length > 1) return null;
        return { text: `${REGIONS[k]} had the highest ${noun} in ${Y2}.`, truth: s[k] === mx };
      },
      () => {
        const k = reg();
        const actual = (100 * (s[k] - r[k])) / r[k];
        const trapV = (100 * (s[k] - r[k])) / s[k];
        const P = 5 * rng.int(1, 14);
        if (Math.abs(actual - P) < 3 || Math.abs(trapV - P) < 3) return null;
        return { text: `${noun[0].toUpperCase()}${noun.slice(1)} in ${REGIONS[k]} increased by more than ${P}% from ${Y1} to ${Y2}.`, truth: actual > P, trap: { id: 'percent-change-base', truth: trapV > P } };
      },
      () => ({ text: `Total ${noun} across all regions was greater in ${Y2} than in ${Y1}.`, truth: tot2 > tot1 }),
      () => {
        const k = reg();
        const P = rng.pick([15, 20, 25, 30]);
        const actual = (100 * r[k]) / tot1;
        const trapV = (100 * r[k]) / (tot1 - r[k]);
        if (Math.abs(actual - P) < 2 || Math.abs(trapV - P) < 2) return null;
        return { text: `${REGIONS[k]} accounted for more than ${P}% of total ${noun} in ${Y1}.`, truth: actual > P, trap: { id: 'share-of-wrong-total', truth: trapV > P } };
      },
      () => ({ text: `${noun[0].toUpperCase()}${noun.slice(1)} increased in every region from ${Y1} to ${Y2}.`, truth: r.every((v, k) => s[k] > v) }),
      () => {
        const [a, b, c, d] = rng.shuffle([0, 1, 2, 3, 4]);
        if (s[a] + s[b] === s[c] + s[d]) return null;
        return { text: `Combined ${noun} of ${REGIONS[a]} and ${REGIONS[b]} in ${Y2} exceeded combined ${noun} of ${REGIONS[c]} and ${REGIONS[d]} in ${Y2}.`, truth: s[a] + s[b] > s[c] + s[d] };
      },
      () => {
        const a = reg();
        const b = reg();
        if (a === b || r[a] === r[b] || s[a] === s[b]) return null;
        return { text: `${REGIONS[a]} had greater ${noun} than ${REGIONS[b]} in both ${Y1} and ${Y2}.`, truth: r[a] > r[b] && s[a] > s[b] };
      },
    ];
    const picked: Stmt[] = [];
    for (const idx of rng.shuffle([0, 1, 2, 3, 4, 5, 6])) {
      if (picked.length === 5) break;
      const st = make[idx]();
      if (st) picked.push(st);
    }
    const nTrue = picked.filter((x) => x.truth).length;
    if (picked.length < 5 || nTrue < 1 || nTrue > 3) continue;
    const labels = picked.map((x) => x.text);
    if (new Set(labels).size < 5) continue;
    const order = rng.shuffle(picked);
    const options: ChoiceOption[] = order.map((x, k) => ({ id: `o${k}`, label: x.text }));
    const correct = options.filter((_, k) => order[k].truth).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    const trapSet = (id: string): string[] | null => {
      if (!order.some((x) => x.trap?.id === id)) return null;
      return options.filter((_, k) => (order[k].trap?.id === id ? order[k].trap!.truth : order[k].truth)).map((o) => o.id);
    };
    const mis: MisconceptionInstance[] = [];
    for (const id of ['percent-change-base', 'share-of-wrong-total']) {
      const ids = trapSet(id);
      if (ids && ids.length > 0) mis.push({ id, wrong: multiAnswer(options, ids) });
    }
    return {
      params: { theme, y0, gap, ...keys('r', r), ...keys('s', s) },
      prompt: `The table shows ${noun} by region in ${Y1} and ${Y2}. Which of the following statements can be inferred from the table? Select all that apply.`,
      figure: tableFigure(`${YEAR_THEMES[theme].title} by region`, ['Region', String(Y1), String(Y2)], REGIONS.map((n, k) => [n, r[k], s[k]])),
      answer,
      steps: [
        { key: 'totals', instruction: 'Find the column totals once; several statements need them.', math: `${Y1}: ${tot1},\\qquad ${Y2}: ${tot2}`, why: 'Totals and the original (earlier) values are the bases for shares and percent changes.', ask: { prompt: `What is the total for ${Y2}?`, answer: numberAnswer(tot2), verify: { type: 'evaluate', expr: s.join('+') } } },
        { key: 'check-each', instruction: 'Check each statement against the numbers. A statement is inferable only if the data prove it.', math: order.map((x, k) => `${String.fromCharCode(65 + k)}: ${x.truth ? '\\text{true}' : '\\text{false}'}`).join(',\\quad '), why: 'For percent-change statements divide by the earlier year; for shares divide by the total of that year.', ask: { prompt: 'Which statements can be inferred?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, mis),
      verify: { type: 'choice', note: 'tests/skills/gre-data-interpretation.test.ts parses each statement and re-derives it from the table figure' },
    };
  }
}

export const greDataInterpretation: SkillDefinition = {
  id: ID,
  title: 'Data interpretation (tables & charts)',
  track: 'gre',
  unit: 'GRE · Data analysis',
  description: 'Reading bar charts and tables: values, percent change, shares of a total, estimation, and what can be inferred.',
  prerequisites: ['gre-descriptive-stats', 'gre-ratios-rates'],
  maxDenominator: 1,
  levels: {
    1: { description: 'Read values and differences from a bar chart', ranges: { theme: [0, 2], y0: [2005, 2020], form: [0, 2], i: [0, 4], j: [0, 4], ...rangeKeys('v', 5, [20, 205]) } },
    2: { description: 'Percent change between two years', ranges: { theme: [0, 2], y0: [2005, 2020], i: [0, 3], j: [1, 4], ...rangeKeys('v', 5, [10, 400]) } },
    3: { description: 'Share of a total from a table', ranges: { theme: [0, 2], form: [0, 1], i: [0, 4], j: [0, 4], t: [10, 60], ...rangeKeys('s', 5, [5, 40]) } },
    4: { description: 'Approximately what: estimate (multiple choice)', ranges: { theme: [0, 2], y0: [2005, 2020], form: [0, 2], i: [0, 4], j: [0, 4], ...rangeKeys('v', 5, [40, 300]) } },
    5: { description: 'Select all that can be inferred', ranges: { theme: [0, 2], y0: [2005, 2020], gap: [1, 5], ...rangeKeys('r', 5, [40, 400]), ...rangeKeys('s', 5, [10, 700]) } },
  },
  misconceptions: {
    'percent-change-base': { name: 'Divided by the new value', explanation: 'Percent change is measured from where you START: (new − old) ÷ OLD × 100. Going from 60 to 75 is 15 ÷ 60 = 25%, not 15 ÷ 75 = 20%.' },
    'share-of-wrong-total': { name: 'Used the wrong total', explanation: 'A share is part ÷ WHOLE, and the whole includes the part itself. Dividing by the total of the other categories overstates the share.' },
    'misread-category': { name: 'Read the neighboring bar or row', explanation: 'Locate the label first, then read straight up or across from that label. Adjacent bars and rows look alike; check the label twice.' },
  },
  stepLabels: {
    'locate-bar': 'Locate the right bar',
    'combine-values': 'Combine the values',
    'change-amount': 'Find the change',
    'divide-original': 'Divide by the original',
    total: 'Add up the whole',
    'part-over-whole': 'Part over whole',
    'round-values': 'Round and estimate',
    'pick-nearest': 'Pick the nearest option',
    totals: 'Find the column totals',
    'check-each': 'Check each statement',
  },
  learn: {
    whyItMatters:
      'Every GRE includes a data-interpretation set: a bar chart or table followed by several questions. The skill is careful reading (right label, right units) and choosing the right base for a percent. This is also an economist\'s daily work: if output rose from 60 to 75, growth is 15 / 60 = 25%, and dividing by the new value (20%) would understate it. Reading charts and tables correctly is how you check any claim about GDP, prices, or employment.',
    summary:
      'Read labels and units first. Percent change = (new − old) ÷ old × 100, with the earlier value as the base. A share = part ÷ whole × 100, where the whole includes the part. When options are far apart, round the data and estimate. "Can be inferred" means the table proves the statement, so test each one with the numbers.',
    formulas: [
      { latex: '\\%\\text{ change} = \\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100' },
      { latex: '\\text{share} = \\frac{\\text{part}}{\\text{whole}} \\times 100' },
    ],
    example: { seed: 5, level: 2 },
    tips: ['Read the title and units before the numbers.', 'On "approximately" questions, round to one or two significant digits and estimate.'],
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
