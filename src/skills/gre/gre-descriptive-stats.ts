// GRE Data analysis: mean, median, mode, range, weighted averages, SD comparisons, and the
// effect of adding a value. Formats: numeric entry (L1-3), quantitative comparison (L4),
// select-all (L5). Every statistic is computed exactly with Q (population SD via the variance).

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step } from '../../engine/types';

const ID = 'gre-descriptive-stats';
type Body = ReturnType<SkillDefinition['generate']>;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sortedAsc = (xs: number[]) => [...xs].sort((a, b) => a - b);
const meanQ = (xs: number[]) => new Q(sum(xs), xs.length);
const medianQ = (xs: number[]): Q => {
  const s = sortedAsc(xs);
  const n = s.length;
  return n % 2 ? new Q(s[(n - 1) / 2]) : new Q(s[n / 2 - 1] + s[n / 2], 2);
};
const varQ = (xs: number[]): Q => {
  const m = meanQ(xs);
  let acc = new Q(0);
  for (const x of xs) acc = acc.add(Q.of(x).sub(m).mul(Q.of(x).sub(m)));
  return acc.div(xs.length);
};
const pad = (xs: number[], len: number) => [...xs, ...Array(len - xs.length).fill(0)];
const listKeys = (prefix: string, xs: number[], len: number) => Object.fromEntries(pad(xs, len).map((v, i) => [`${prefix}${i}`, v]));
const cmp = (a: Q, b: Q): QcRelation => (a.sub(b).sign() > 0 ? 'a' : a.sub(b).sign() < 0 ? 'b' : 'c');

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

/** Mathjs/SymPy-safe expression for a sum of explicit numbers. */
const sumExpr = (xs: number[]) => `(${xs.map((x) => (x < 0 ? `(${x})` : `${x}`)).join('+')})`;
/** Sum of squared deviations from an integer mean m, as an explicit expression. */
const ssdExpr = (xs: number[], m: number) => `(${xs.map((x) => `(${x}-${m})^2`).join('+')})`;

// ---------- level 1: mean, median, mode or range of a list ----------

function level1(rng: Rng): Body {
  for (;;) {
    const n = rng.int(5, 9);
    const stat = rng.int(0, 3); // 0 mean, 1 median, 2 mode, 3 range
    const modeValue = rng.int(1, 30);
    const modeCount = rng.int(2, 3);
    const others: number[] = [];
    while (others.length < n - modeCount) {
      const v = rng.int(1, 30);
      if (v !== modeValue && !others.includes(v)) others.push(v);
    }
    const xs = rng.shuffle([...others, ...Array(modeCount).fill(modeValue)]);
    if (stat === 0 && sum(xs) % n !== 0) continue;
    const s = sortedAsc(xs);
    const list = xs.join(', ');
    const sortedList = s.join(', ');
    let answer, prompt: string, verify: string, steps: Step[];
    let wrong: Q | null = null;
    if (stat === 0) {
      const total = sum(xs);
      answer = numberAnswer(total / n);
      prompt = `What is the mean (average) of the numbers ${list}?`;
      verify = `${sumExpr(xs)}/${n}`;
      steps = [
        { key: 'sum', instruction: 'Add up all the numbers.', math: `${xs.join(' + ')} = ${total}`, why: 'Mean = total ÷ count, so you need the total first.', ask: { prompt: 'What is the sum of the list?', answer: numberAnswer(total), verify: { type: 'evaluate', expr: sumExpr(xs) } } },
        { key: 'divide-count', instruction: `Divide by how many numbers there are (${n}).`, math: `\\frac{${total}}{${n}} = ${total / n}`, why: 'The mean is the value each number would have if the total were shared equally.', ask: { prompt: 'What is the mean?', answer, verify: { type: 'evaluate', expr: verify } } },
      ];
    } else if (stat === 1) {
      const med = medianQ(xs);
      answer = numberAnswer(med);
      prompt = `What is the median of the numbers ${list}?`;
      verify = n % 2 ? `${s[(n - 1) / 2]}` : `(${s[n / 2 - 1]}+${s[n / 2]})/2`;
      wrong = n % 2 ? new Q(xs[(n - 1) / 2]) : new Q(xs[n / 2 - 1] + xs[n / 2], 2);
      steps = [
        { key: 'sort', instruction: 'Put the numbers in order first.', math: sortedList, why: 'The median is the middle of the ORDERED list. The order you are given means nothing.', ask: { prompt: `Which position (counting from 1) is the middle of ${n} numbers? For an even count give the halfway position, like 4.5.`, answer: numberAnswer(new Q(n + 1, 2)), verify: { type: 'evaluate', expr: `(${n}+1)/2` } } },
        { key: 'middle', instruction: n % 2 ? 'Take the middle number.' : 'Average the two middle numbers.', math: n % 2 ? `\\text{median} = ${s[(n - 1) / 2]}` : `\\frac{${s[n / 2 - 1]} + ${s[n / 2]}}{2} = ${med.toLatex()}`, why: 'With an even count there is no single middle, so the median is halfway between the two middle values.', ask: { prompt: 'What is the median?', answer, verify: { type: 'evaluate', expr: verify } } },
      ];
    } else if (stat === 2) {
      answer = numberAnswer(modeValue);
      prompt = `What is the mode of the numbers ${list}?`;
      verify = `${modeValue}`;
      steps = [
        { key: 'tally', instruction: 'Count how often each value appears.', math: sortedList, why: 'The mode is the most frequent value. Sorting puts repeats side by side.', ask: { prompt: 'How many times does the most frequent value appear?', answer: numberAnswer(modeCount), verify: { type: 'evaluate', expr: `${modeCount}` } } },
        { key: 'name-mode', instruction: 'The mode is the value itself, not its count.', math: `\\text{mode} = ${modeValue}`, why: 'Report the number that repeats, not how many times it repeats.', ask: { prompt: 'What is the mode?', answer, verify: { type: 'evaluate', expr: verify } } },
      ];
    } else {
      answer = numberAnswer(s[n - 1] - s[0]);
      prompt = `What is the range of the numbers ${list}?`;
      verify = `${s[n - 1]}-${s[0]}`;
      steps = [
        { key: 'extremes', instruction: 'Find the largest and smallest numbers.', math: `\\max = ${s[n - 1]},\\quad \\min = ${s[0]}`, why: 'Range only depends on the two extremes.', ask: { prompt: 'What is the largest number in the list?', answer: numberAnswer(s[n - 1]), verify: { type: 'evaluate', expr: `${s[n - 1]}` } } },
        { key: 'subtract', instruction: 'Subtract smallest from largest.', math: `${s[n - 1]} - ${s[0]} = ${s[n - 1] - s[0]}`, why: 'Range = max − min.', ask: { prompt: 'What is the range?', answer, verify: { type: 'evaluate', expr: verify } } },
      ];
    }
    return {
      params: { stat, n, ...listKeys('v', xs, 9) },
      prompt,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [wrong ? wrongNumber('median-unsorted', () => wrong!) : null]),
      verify: { type: 'evaluate', expr: verify },
    };
  }
}

// ---------- level 2: a missing value given the mean ----------

function level2(rng: Rng): Body {
  for (;;) {
    const n = rng.int(4, 7);
    const m = rng.int(8, 60);
    const known = Array.from({ length: n - 1 }, () => rng.int(Math.max(1, m - 15), m + 15));
    const x = n * m - sum(known);
    if (x < 1 || x > 80) continue;
    const answer = numberAnswer(x);
    const kn = known.join(', ');
    const verify = `${n}*${m}-${sumExpr(known)}`;
    return {
      params: { n, m, x, ...listKeys('k', known, 6) },
      prompt: `The average (arithmetic mean) of ${n} numbers is ${m}. If ${n - 1} of the numbers are ${kn}, what is the remaining number?`,
      answer,
      steps: [
        { key: 'total', instruction: 'Turn the average into a total.', math: `${n} \\times ${m} = ${n * m}`, why: 'Total = average × count. Work with totals, never with averages, when something is missing.', ask: { prompt: `What is the total of all ${n} numbers?`, answer: numberAnswer(n * m), verify: { type: 'evaluate', expr: `${n}*${m}` } } },
        { key: 'known-sum', instruction: 'Add the numbers you know.', math: `${known.join(' + ')} = ${sum(known)}`, why: 'The missing number is whatever is left of the total.', ask: { prompt: 'What do the known numbers add to?', answer: numberAnswer(sum(known)), verify: { type: 'evaluate', expr: sumExpr(known) } } },
        { key: 'subtract-total', instruction: 'Subtract.', math: `${n * m} - ${sum(known)} = ${x}`, why: 'Missing = total − known sum.', ask: { prompt: 'What is the remaining number?', answer, verify: { type: 'evaluate', expr: verify } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('mean-missing-total', () => m - sum(known))]),
      verify: { type: 'evaluate', expr: verify },
    };
  }
}

// ---------- level 3: weighted average ----------

function level3(rng: Rng): Body {
  for (;;) {
    const n1 = rng.int(5, 40);
    const n2 = rng.int(5, 40);
    const a1 = rng.int(50, 95);
    const a2 = rng.int(50, 95);
    if (n1 === n2 || a1 === a2 || (n1 * a1 + n2 * a2) % (n1 + n2) !== 0) continue;
    const total = n1 * a1 + n2 * a2;
    const ans = total / (n1 + n2);
    const answer = numberAnswer(ans);
    const verify = `(${n1}*${a1}+${n2}*${a2})/(${n1}+${n2})`;
    return {
      params: { n1, a1, n2, a2 },
      prompt: `In one section, ${n1} students had an average score of ${a1}. In another section, ${n2} students had an average score of ${a2}. What is the average score of all ${n1 + n2} students together?`,
      answer,
      steps: [
        { key: 'group-totals', instruction: 'Find each group\'s total points.', math: `${n1}\\times ${a1} = ${n1 * a1},\\qquad ${n2}\\times ${a2} = ${n2 * a2}`, why: 'Averages can only be combined through totals, weighted by group size.', ask: { prompt: 'What is the combined total of points?', answer: numberAnswer(total), verify: { type: 'evaluate', expr: `${n1}*${a1}+${n2}*${a2}` } } },
        { key: 'divide-all', instruction: 'Divide by the total number of students.', math: `\\frac{${total}}{${n1 + n2}} = ${ans}`, why: 'The larger group pulls the combined average toward its own average.', ask: { prompt: 'What is the overall average?', answer, verify: { type: 'evaluate', expr: verify } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('weighted-simple-average', () => new Q(a1 + a2, 2))]),
      verify: { type: 'evaluate', expr: verify },
    };
  }
}

// ---------- level 4: QC on standard deviation (exact, no variables) ----------

function level4(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 3);
    const mk = (): number[] => {
      for (;;) {
        const xs = Array.from({ length: 4 }, () => rng.int(0, 20));
        if (sum(xs) % 4 === 0 && new Set(xs).size > 1) return xs;
      }
    };
    const zeroSum = (): number[] => {
      for (;;) {
        const d = Array.from({ length: 3 }, () => rng.int(-8, 8));
        const last = -sum(d);
        if (Math.abs(last) <= 8) return [...d, last];
      }
    };
    let A: number[];
    let B: number[];
    if (form === 0) {
      A = mk();
      const k = rng.int(5, 40);
      B = A.map((x) => x + k);
    } else if (form === 1) {
      A = mk();
      const s = rng.int(2, 3);
      B = A.map((x) => x * s);
    } else if (form === 2) {
      const cA = rng.int(10, 30);
      const cB = rng.chance(0.5) ? cA : rng.int(10, 30);
      A = zeroSum().map((d) => cA + d);
      B = zeroSum().map((d) => cB + d);
    } else {
      A = mk();
      B = rng.shuffle([...A, ...A]);
    }
    if (rng.chance(0.5)) [A, B] = [B, A];
    const vA = varQ(A);
    const vB = varQ(B);
    if (vA.isZero() || vB.isZero()) continue;
    if (form === 2 && vA.eq(vB) && !rng.chance(0.1)) continue; // equal SDs only occasionally here
    const relation = cmp(vA, vB);
    const answer = qcAnswer(relation);
    const mA = meanQ(A);
    const mB = meanQ(B);
    const byMeans = cmp(mA, mB);
    const mAi = mA.n;
    const mBi = mB.n;
    const hint =
      form === 0 ? 'One list is the other with the same number added to every value: that slides the list without changing its spread.'
      : form === 1 ? 'One list is the other multiplied by a constant: the spread is multiplied by that constant too.'
      : form === 3 ? 'One list is the other written twice: the average distance from the mean is the same, since every value is repeated equally.'
      : 'Compare how far the numbers sit from their own mean, not how big the numbers are.';
    const ssd = (xs: number[], m: number) => sum(xs.map((x) => (x - m) * (x - m)));
    return {
      params: { form, na: A.length, nb: B.length, ...listKeys('a', A, 8), ...listKeys('b', B, 8) },
      prompt: QC_PROMPT('Standard deviation here means the standard deviation of the listed numbers, treated as the whole population. You should not need to compute it.', `The standard deviation of the numbers ${A.join(', ')}`, `The standard deviation of the numbers ${B.join(', ')}`),
      answer,
      steps: [
        { key: 'deviations', instruction: `Idea: ${hint} Check by measuring spread around each list's mean (A has mean ${mAi}).`, math: `\\text{mean}_A = ${mAi},\\quad \\text{mean}_B = ${mBi}`, why: 'SD measures spread around the mean. A shift does not change it; a stretch does.', ask: { prompt: `What is the sum of the squared deviations of A's numbers from A's mean?`, answer: numberAnswer(ssd(A, mAi)), verify: { type: 'evaluate', expr: ssdExpr(A, mAi) } } },
        { key: 'variance-a', instruction: 'Divide by the count to get the variance of A.', math: `\\sigma_A^2 = \\frac{${ssd(A, mAi)}}{${A.length}} = ${vA.toLatex()}`, why: 'Variance = average squared deviation; SD is its square root, so comparing variances compares SDs.', ask: { prompt: 'What is the variance of A?', answer: numberAnswer(vA), verify: { type: 'evaluate', expr: `${ssdExpr(A, mAi)}/${A.length}` } } },
        { key: 'variance-b', instruction: 'Same for B.', math: `\\sigma_B^2 = \\frac{${ssd(B, mBi)}}{${B.length}} = ${vB.toLatex()}`, why: 'Divide by B\'s own count: a longer list has a larger sum of squares but not necessarily a larger variance.', ask: { prompt: 'What is the variance of B?', answer: numberAnswer(vB), verify: { type: 'evaluate', expr: `${ssdExpr(B, mBi)}/${B.length}` } } },
        { key: 'decide', instruction: 'Compare the variances (the larger variance means the larger SD).', math: `${vA.toLatex()} \\text{ vs } ${vB.toLatex()}`, why: 'With no variables, the relationship is always determined (never D).', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'shift-changes-sd', wrong: qcAnswer(byMeans) }]),
      verify: { type: 'qc', quantityA: `sqrt(${vA.toExpr()})`, quantityB: `sqrt(${vB.toExpr()})`, variables: [], constraints: [] },
    };
  }
}

// ---------- level 5: effect of adding a value (select all) ----------

function level5(rng: Rng): Body {
  for (;;) {
    const n = rng.chance(0.5) ? 5 : 7;
    const xs = Array.from({ length: n }, () => rng.int(1, 30));
    if (sum(xs) % n !== 0) continue;
    const add = rng.int(1, 40);
    const ys = [...xs, add];
    const oldMean = meanQ(xs);
    const stats: { label: string; up: boolean }[] = [
      { label: 'The mean', up: meanQ(ys).sub(oldMean).sign() > 0 },
      { label: 'The median', up: medianQ(ys).sub(medianQ(xs)).sign() > 0 },
      { label: 'The range', up: Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs) },
      { label: 'The sum of the numbers', up: sum(ys) > sum(xs) },
      { label: 'The smallest number', up: Math.min(...ys) > Math.min(...xs) },
    ];
    const tagged = rng.shuffle(stats);
    const options: ChoiceOption[] = tagged.map((t, i) => ({ id: `o${i}`, label: t.label }));
    const correct = options.filter((_, i) => tagged[i].up).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    const meanOpt = options.find((o) => o.label === 'The mean')!.id;
    const medOpt = options.find((o) => o.label === 'The median')!.id;
    const meanUp = correct.includes(meanOpt);
    const wrongSet = correct.filter((id) => id !== medOpt).concat(meanUp ? [medOpt] : []);
    const side = add > oldMean.n ? 'above' : add < oldMean.n ? 'below' : 'equal to';
    return {
      params: { n, add, ...listKeys('v', xs, 7) },
      prompt: `A list of numbers is ${xs.join(', ')}. The number ${add} is added to the list. Which of the following increase? Select all that apply.`,
      answer,
      steps: [
        { key: 'old-mean', instruction: 'Find the current mean.', math: `\\frac{${sum(xs)}}{${n}} = ${oldMean.n}`, why: 'A new value moves the mean up only if it is above the current mean.', ask: { prompt: 'What is the mean of the original list?', answer: numberAnswer(oldMean), verify: { type: 'evaluate', expr: `${sumExpr(xs)}/${n}` } } },
        { key: 'compare-new', instruction: `Compare ${add} with the old mean ${oldMean.n}: it is ${side} the mean.`, math: `${add} \\text{ vs } ${oldMean.n}`, why: 'Above the mean pulls it up, below pulls it down, equal leaves it unchanged. The median only changes if the new value crosses the middle.', ask: { prompt: `Is ${add} above, below, or equal to the old mean?`, answer: { kind: 'choice', options: [{ id: 'above', label: 'Above' }, { id: 'below', label: 'Below' }, { id: 'equal to', label: 'Equal' }], correct: side } } },
        { key: 'check-each', instruction: 'Recompute each statistic with the new list and compare.', math: `\\text{sorted: } ${sortedAsc(ys).join(', ')}`, why: 'Test each option separately; mean and median do not always move together.', ask: { prompt: 'Which of the following increase?', answer } },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'mean-median-move-together', wrong: multiAnswer(options, wrongSet) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-descriptive-stats.test.ts recomputes every statistic from the list' },
    };
  }
}

export const greDescriptiveStats: SkillDefinition = {
  id: ID,
  title: 'Mean, median, range & SD',
  track: 'gre',
  unit: 'GRE · Data analysis',
  description: 'Mean, median, mode, range, missing values, weighted averages, and comparing standard deviations.',
  prerequisites: ['gre-fractions-percents'],
  maxDenominator: 4,
  levels: {
    1: { description: 'Mean, median, mode or range of a list', ranges: { stat: [0, 3], n: [5, 9], ...rangeKeys('v', 9, [0, 30]) } },
    2: { description: 'Missing value given the mean', ranges: { n: [4, 7], m: [8, 60], x: [1, 80], ...rangeKeys('k', 6, [0, 75]) } },
    3: { description: 'Weighted average of two groups', ranges: { n1: [5, 40], a1: [50, 95], n2: [5, 40], a2: [50, 95] } },
    4: { description: 'Compare standard deviations (quantitative comparison)', ranges: { form: [0, 3], na: [4, 8], nb: [4, 8], ...rangeKeys('a', 8, [0, 60]), ...rangeKeys('b', 8, [0, 60]) } },
    5: { description: 'Effect of adding a value (select all)', ranges: { n: [5, 7], add: [1, 40], ...rangeKeys('v', 7, [0, 30]) } },
  },
  misconceptions: {
    'median-unsorted': { name: 'Took the middle of the unsorted list', explanation: 'The median is the middle value AFTER sorting. Reorder the numbers from smallest to largest first, then pick the middle (or average the two middle values).' },
    'mean-missing-total': { name: 'Subtracted from the mean instead of the total', explanation: 'An average cannot be subtracted from directly. Convert to totals first: total = mean × count, subtract the known numbers from that total, and the leftover is the missing value.' },
    'shift-changes-sd': { name: 'Thought bigger numbers mean a bigger SD', explanation: 'SD measures spread around the mean, not size. Adding the same constant to every number moves the whole list but leaves the SD unchanged; compare how tightly each list clusters around its own mean.' },
    'weighted-simple-average': { name: 'Averaged the two group averages', explanation: 'Groups of different sizes carry different weight. Multiply each average by its group size, add the totals, and divide by the combined count.' },
    'mean-median-move-together': { name: 'Assumed the median moves whenever the mean does', explanation: 'The mean reacts to how far a new value is from the mean, while the median only reacts to where the new value falls in the order. A value can raise the mean and leave the median unchanged.' },
  },
  stepLabels: {
    sum: 'Add the numbers',
    'divide-count': 'Divide by the count',
    sort: 'Sort and find the middle position',
    middle: 'Take the middle value',
    tally: 'Tally the repeats',
    'name-mode': 'Name the mode',
    extremes: 'Find the largest and smallest',
    subtract: 'Subtract min from max',
    total: 'Convert the average to a total',
    'known-sum': 'Add the known numbers',
    'subtract-total': 'Subtract from the total',
    'group-totals': 'Find each group total',
    'divide-all': 'Divide by the combined count',
    deviations: 'Measure deviations from the mean',
    'variance-a': 'Variance of A',
    'variance-b': 'Variance of B',
    decide: 'Decide the relationship',
    'old-mean': 'Find the old mean',
    'compare-new': 'Compare the new value with the mean',
    'check-each': 'Check each statistic',
  },
  learn: {
    whyItMatters:
      'The GRE tests mean, median, range and standard deviation constantly, usually by asking what changes, not by asking for a big calculation. In economics the same ideas separate a typical household from a skewed average: if five households earn 30, 32, 35, 38 and 200 (thousand dollars), the mean is 335 / 5 = 67 but the median is 35, so the median describes the typical family far better. Standard deviation is the basic measure of risk in finance and of noise in every regression.',
    summary:
      'Mean = total ÷ count; work with totals whenever a value is missing or groups are combined. The median is the middle of the SORTED list (average the two middle values for an even count). The mode is the most frequent value and the range is max − min. Standard deviation measures spread around the mean: shifting every value leaves it unchanged, scaling every value scales it, and repeating the whole list leaves it unchanged.',
    formulas: [
      { latex: '\\text{mean} = \\frac{\\text{sum}}{\\text{count}}' },
      { latex: '\\text{weighted mean} = \\frac{n_1 a_1 + n_2 a_2}{n_1 + n_2}' },
      { latex: '\\sigma^2 = \\frac{1}{n}\\sum (x_i - \\bar{x})^2', note: 'SD is the square root of this variance.' },
    ],
    example: { seed: 3, level: 4 },
    tips: [
      'Average problems: convert to totals first.',
      'SD questions: shift = no change, scale = scales, same shape and spread = equal. Do not compute unless you must.',
      'A new value above the mean raises the mean; the median only moves if the value lands on the other side of the middle.',
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
      case 5:
        return level5(rng);
    }
  },
};

function rangeKeys(prefix: string, count: number, r: [number, number]): Record<string, [number, number]> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${i}`, r]));
}
