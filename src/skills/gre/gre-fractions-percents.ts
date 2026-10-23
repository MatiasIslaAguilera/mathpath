// GRE · Fractions & percents. Formats: numeric entry (L1, L2, L4), quantitative comparison
// (L2, L3, L5), select all that apply (L3), multiple choice (L4).
// QC relations are exact: Q arithmetic when there are no variables, a proven case analysis
// (stated next to each case) when there are.

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { AnswerSpec, ChoiceOption, Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'gre-fractions-percents';
type Body = ReturnType<SkillDefinition['generate']>;

const rel = (a: number, b: number): QcRelation => (a > b ? 'a' : a < b ? 'b' : 'c');
const relQ = (a: Q, b: Q): QcRelation => rel(a.sub(b).sign(), 0);

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

const decideStep = (relation: QcRelation, why: string, math = ''): Step => ({
  key: 'decide',
  instruction: relation === 'd' ? 'Different allowed values give different relationships.' : 'Every allowed value gives the same relationship.',
  math: math || (relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B' : relation === 'b' ? 'B > A' : 'A = B'),
  why,
  ask: { prompt: 'So which is it?', answer: qcAnswer(relation) },
});

const num = (v: Q) => String(+v.valueOf().toFixed(2));

// ---------- level 1: percent change ----------

function level1(rng: Rng): Body {
  const old = 20 * rng.int(1, 12);
  const up = rng.chance(0.5);
  const p = up ? 5 * rng.int(1, 20) : 5 * rng.int(1, 16);
  const nw = (old * (up ? 100 + p : 100 - p)) / 100;
  const answer = numberAnswer(p);
  const verify = { type: 'evaluate', expr: `abs(${nw}-${old})/${old}*100` } as const;
  const ctxIdx = rng.int(0, 2);
  const verb = up ? 'rose' : 'fell';
  const ctx = [
    `The price of a share ${verb} from \\$${old} to \\$${nw}.`,
    `Monthly sales ${verb} from ${old} units to ${nw} units.`,
    `A town's population ${verb} from ${old} thousand to ${nw} thousand.`,
  ][ctxIdx];
  const change = Math.abs(nw - old);
  const ratio = Q.of(change).div(old);
  return {
    params: { old, p, up: up ? 1 : 0, nw },
    prompt: `${ctx} What was the percent ${up ? 'increase' : 'decrease'}?`,
    answer,
    steps: [
      {
        key: 'find-change',
        instruction: 'Find the amount of the change.',
        math: `|${nw} - ${old}| = ${change}`,
        why: 'Percent change starts with the actual change.',
        ask: { prompt: 'By how much did it change?', answer: numberAnswer(change), verify: { type: 'evaluate', expr: `abs(${nw}-${old})` } },
      },
      {
        key: 'divide-original',
        instruction: 'Divide the change by the ORIGINAL value, and simplify the fraction.',
        math: `\\frac{${change}}{${old}} = ${ratio.toLatex()}`,
        why: 'Percent change is always measured against the starting value, not the ending one. Simplify before converting: a small fraction like 4/5 is easy to read as a percent.',
        ask: {
          prompt: `What is $\\frac{${change}}{${old}}$ in lowest terms (or as a decimal)?`,
          answer: numberAnswer(ratio),
          verify: { type: 'evaluate', expr: `abs(${nw}-${old})/${old}` },
        },
      },
      {
        key: 'to-percent',
        instruction: 'Convert the fraction to a percent: multiply by 100.',
        math: `${ratio.toLatex()} \\times 100 = ${p}\\%`,
        why: 'A percent is a fraction out of 100: 0.8 is 80%, not 8%.',
        ask: { prompt: `What percent ${up ? 'increase' : 'decrease'} is that?`, answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('percent-change-base', () => Q.of(change).div(nw).mul(100))]),
    verify,
  };
}

// ---------- level 2: successive percent changes ----------

function level2(rng: Rng): Body {
  const form = rng.chance(0.55) ? 0 : 1;
  if (form === 0) {
    const a = 10 * rng.int(1, 6);
    const b = 10 * rng.int(1, 6);
    const s1 = rng.chance(0.5) ? 1 : -1;
    const s2 = rng.chance(0.5) ? 1 : -1;
    const m1 = 100 + s1 * a;
    const m2 = 100 + s2 * b;
    const net = (m1 * m2) / 100 - 100; // integer: m1, m2 are multiples of 10
    const answer = numberAnswer(net);
    const both = (m1 * m2) / 100;
    const verify = { type: 'evaluate', expr: `(${m1}*${m2})/100-100` } as const;
    return {
      params: { form, a, b, s1, s2, sub: 0, price: 0 },
      prompt: `A price ${s1 > 0 ? 'increases' : 'decreases'} by ${a}%, and then the new price ${s2 > 0 ? 'increases' : 'decreases'} by ${b}%. What is the net percent change from the original price? (Enter a decrease as a negative number.)`,
      answer,
      steps: [
        {
          key: 'first-multiplier',
          instruction: `After the first change the price is ${m1}% of the original.`,
          math: `${s1 > 0 ? '+' : '-'}${a}\\% \\Rightarrow \\times ${m1 / 100}`,
          why: 'A percent change is a multiplier: new = original × (100 ± p)/100.',
          ask: { prompt: 'The price is what percent of the original after the first change?', answer: numberAnswer(m1), verify: { type: 'evaluate', expr: `${m1}` } },
        },
        {
          key: 'multiply-factors',
          instruction: 'Multiply the two multipliers: the second change applies to the NEW price.',
          math: `${m1 / 100} \\times ${m2 / 100} = ${(m1 * m2) / 10000}`,
          why: 'Successive percent changes multiply; they do not add.',
          ask: { prompt: 'The final price is what percent of the original?', answer: numberAnswer(both), verify: { type: 'evaluate', expr: `${m1}*${m2}/100` } },
        },
        {
          key: 'net-change',
          instruction: 'Subtract 100% to get the net change.',
          math: `${both}\\% - 100\\% = ${net}\\%`,
          why: 'Net change = final percent of original − 100.',
          ask: { prompt: 'Net percent change?', answer, verify },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('successive-additive', () => s1 * a + s2 * b)]),
      verify,
    };
  }
  const sub = rng.int(0, 2);
  const price = 10 * rng.int(2, 20);
  // The sampling window sits inside the allowed domain, so no constraint strings are needed (they cost time per sample).
  const dom = { min: 0.5, max: 99.5 };
  let A: string, B: string, relation: QcRelation, setup: string, qa: string, qb: string;
  let vars: { name: string; min: number; max: number }[];
  let constraints: string[];
  let proof: string;
  if (sub === 0) {
    setup = `A price of \\$${price} is increased by $x\\%$ and then the new price is decreased by $x\\%$, where $0 < x < 100$.`;
    A = 'the final price';
    B = `\\$${price}`;
    qa = `${price}*(1+x/100)*(1-x/100)`;
    qb = `${price}`;
    vars = [{ name: 'x', ...dom }];
    constraints = [];
    relation = 'b'; // (1 + t)(1 - t) = 1 - t^2 < 1 for t = x/100 in (0, 1)
    proof = `(1+t)(1-t) = 1 - t^2 < 1`;
  } else if (sub === 1) {
    setup = `A price of \\$${price} is changed by $x\\%$ and then by the opposite $x\\%$, where $0 < x < 100$.`;
    A = 'the price after first increasing by $x\\%$, then decreasing by $x\\%$';
    B = 'the price after first decreasing by $x\\%$, then increasing by $x\\%$';
    qa = `${price}*(1+x/100)*(1-x/100)`;
    qb = `${price}*(1-x/100)*(1+x/100)`;
    vars = [{ name: 'x', ...dom }];
    constraints = [];
    relation = 'c'; // multiplication is commutative
    proof = `(1+t)(1-t) = (1-t)(1+t)`;
  } else {
    setup = `A price of \\$${price} is increased by $x\\%$ and then decreased by $y\\%$, where $0 < x < 100$ and $0 < y < 100$.`;
    A = 'the final price';
    B = `\\$${price}`;
    qa = `${price}*(1+x/100)*(1-y/100)`;
    qb = `${price}`;
    vars = [{ name: 'x', ...dom }, { name: 'y', ...dom }];
    constraints = [];
    relation = 'd'; // x = 10, y = 1 gives 1.089 > 1; x = 1, y = 10 gives 0.909 < 1
    proof = `(1.10)(0.99) = 1.089 > 1 \\text{ but } (1.01)(0.90) = 0.909 < 1`;
  }
  const answer = qcAnswer(relation);
  const testVal = sub === 0 ? price * 1.2 * 0.8 : sub === 1 ? price * 0.96 : price * 1.1 * 0.99;
  return {
    params: { form, a: 0, b: 0, s1: 0, s2: 0, sub, price },
    prompt: QC_PROMPT(setup, A, B),
    answer,
    steps: [
      {
        key: 'test-value',
        instruction: sub === 2 ? 'Plug in numbers: try x = 10 and y = 1.' : 'Plug in a number: try x = 20.',
        math: sub === 2 ? `${price} \\times 1.10 \\times 0.99 = ${+testVal.toFixed(2)}` : `${price} \\times 1.2 \\times 0.8 = ${+testVal.toFixed(2)}`,
        why: 'Each percent change is a multiplier on the CURRENT price.',
        ask: {
          prompt: sub === 2 ? 'What is the final price when $x = 10$ and $y = 1$?' : 'What is the price after +20% then -20%?',
          answer: numberAnswer(Q.of(Math.round(testVal * 100)).div(100)),
          verify: { type: 'evaluate', expr: sub === 2 ? `${price}*1.1*0.99` : `${price}*1.2*0.8` },
        },
      },
      decideStep(relation, relation === 'd' ? 'Test a second pair: an answer of A, B or C must hold for EVERY allowed value.' : 'Write the change as a product of multipliers (t = x/100).', `${proof}`),
    ],
    misconceptions: distinctMisconceptions(answer, [sub === 0 ? { id: 'successive-additive', wrong: qcAnswer('c') } : null]),
    verify: { type: 'qc', quantityA: qa, quantityB: qb, variables: vars, constraints },
  };
}

// ---------- level 3: fraction comparison ----------

const THRESHOLDS: [number, number][] = [[1, 3], [1, 2], [2, 3], [3, 4], [3, 5], [2, 5]];

function level3(rng: Rng): Body {
  const form = rng.int(0, 1);
  if (form === 0) {
    let n1: number, d1: number, n2: number, d2: number;
    for (;;) {
      n1 = rng.int(1, 12);
      d1 = rng.int(n1 + 1, 15);
      if (rng.chance(0.15)) {
        const k = rng.int(2, 3);
        n2 = n1 * k;
        d2 = d1 * k;
        if (n2 > 24 || d2 > 30) continue;
      } else {
        n2 = rng.int(1, 12);
        d2 = rng.int(n2 + 1, 15);
      }
      if (d1 === d2) continue;
      break;
    }
    const fa = Q.of(n1).div(d1);
    const fb = Q.of(n2).div(d2);
    const relation = relQ(fa, fb);
    const answer = qcAnswer(relation);
    const x = n1 * d2;
    const y = n2 * d1;
    return {
      params: { form, n1, d1, n2, d2, tn: 0, td: 2 },
      prompt: QC_PROMPT('', `$\\frac{${n1}}{${d1}}$`, `$\\frac{${n2}}{${d2}}$`),
      answer,
      steps: [
        {
          key: 'cross-multiply',
          instruction: 'Cross-multiply: compare the numerator of each with the other denominator.',
          math: `\\frac{${n1}}{${d1}} \\ \\square\\ \\frac{${n2}}{${d2}} \\;\\Rightarrow\\; ${n1}\\cdot ${d2} = ${x} \\ \\text{ vs } \\ ${n2}\\cdot ${d1} = ${y}`,
          why: 'For positive denominators, a/b > c/d exactly when ad > bc.',
          ask: { prompt: `What is $${n1} \\times ${d2}$?`, answer: numberAnswer(x), verify: { type: 'evaluate', expr: `${n1}*${d2}` } },
        },
        decideStep(relation, 'The larger cross-product belongs to the larger fraction. With no variables the answer is never D.', `${x} \\text{ vs } ${y}`),
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'fraction-compare-by-numerator', wrong: qcAnswer(rel(n1, n2)) }]),
      verify: { type: 'qc', quantityA: `${n1}/${d1}`, quantityB: `${n2}/${d2}`, variables: [], constraints: [] },
    };
  }
  for (;;) {
    const [tn, td] = rng.pick(THRESHOLDS);
    const t = Q.of(tn).div(td);
    const seen = new Set<string>();
    const fr: [number, number][] = [];
    while (fr.length < 5) {
      const d = rng.int(2, 16);
      const n = rng.int(1, d - 1);
      const key = `${n}/${d}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fr.push([n, d]);
    }
    const good = fr.map(([n, d]) => Q.of(n).div(d).sub(t).sign() > 0);
    const cnt = good.filter(Boolean).length;
    if (cnt < 1 || cnt > 4) continue;
    const options: ChoiceOption[] = fr.map(([n, d], i) => ({ id: `o${i}`, label: `$\\frac{${n}}{${d}}$` }));
    const correct = options.filter((_, i) => good[i]).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    const byNum = options.filter((_, i) => fr[i][0] > tn).map((o) => o.id);
    const first = good[0];
    return {
      params: { form, n1: 0, d1: 2, n2: 0, d2: 2, tn, td },
      prompt: `Which of the following fractions are greater than $\\frac{${tn}}{${td}}$? Select all that apply.`,
      answer,
      steps: [
        {
          key: 'cross-multiply',
          instruction: `Compare each fraction to ${tn}/${td} by cross-multiplying.`,
          math: `\\frac{n}{d} > \\frac{${tn}}{${td}} \\iff ${td}n > ${tn}d`,
          why: 'Cross-multiplying avoids decimals: for positive denominators a/b > c/d exactly when ad > bc.',
          ask: {
            prompt: `Is $\\frac{${fr[0][0]}}{${fr[0][1]}}$ greater than $\\frac{${tn}}{${td}}$?`,
            answer: { kind: 'choice', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], correct: first ? 'yes' : 'no' },
          },
        },
        {
          key: 'select-all',
          instruction: 'Test every option; a fraction equal to the target is NOT greater.',
          math: fr.map(([n, d], i) => `${n}\\cdot${td} ${good[i] ? '>' : '\\le'} ${tn}\\cdot${d}`).join(',\\quad '),
          why: 'Select-all questions need every correct option and no wrong ones.',
          ask: { prompt: 'Select all fractions greater than the target.', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'fraction-compare-by-numerator', wrong: multiAnswer(options, byNum.length ? byNum : ['o0']) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-fractions-percents.test.ts compares every option with the threshold exactly' },
    };
  }
}

// ---------- level 4: reverse percent, percent of a percent ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 2) {
    const PCTS = [10, 20, 25, 30, 40, 50, 60, 75, 80];
    for (;;) {
      const a = rng.pick(PCTS);
      const b = rng.pick(PCTS);
      const n = 20 * rng.int(2, 50);
      const r = Q.of(n).mul(a).mul(b).div(10000);
      if (!r.isInt()) continue;
      const answer = numberAnswer(r);
      const mid = Q.of(n).mul(b).div(100);
      const verify = { type: 'evaluate', expr: `${a}/100*(${b}/100*${n})` } as const;
      return {
        params: { form, d: 0, orig: 0, price: 0, a, b, n },
        prompt: `What is ${a}% of ${b}% of ${n}?`,
        answer,
        steps: [
          {
            key: 'inner-percent',
            instruction: `Take ${b}% of ${n} first.`,
            math: `${b}\\% \\times ${n} = ${mid.toLatex()}`,
            why: 'Work from the inside out: each "of" is a multiplication by the percent over 100.',
            ask: { prompt: `What is $${b}\\%$ of $${n}$?`, answer: numberAnswer(mid), verify: { type: 'evaluate', expr: `${b}/100*${n}` } },
          },
          {
            key: 'outer-percent',
            instruction: `Then take ${a}% of that.`,
            math: `${a}\\% \\times ${mid.toLatex()} = ${r.toLatex()}`,
            why: 'Percent of a percent multiplies the two percents; it does not add them.',
            ask: { prompt: 'So the answer is?', answer, verify },
          },
        ],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('percent-of-percent-added', () => Q.of(n).mul(a + b).div(100))]),
        verify,
      };
    }
  }
  const ds = [10, 20, 25, 30, 40, 50];
  const d = rng.pick(ds);
  const orig = 20 * rng.int(2, 20);
  const disc = form === 0;
  const price = (orig * (disc ? 100 - d : 100 + d)) / 100;
  const origQ = Q.of(orig);
  const mult = Q.of(price).mul(disc ? 100 + d : 100 - d).div(100); // the wrong "apply the percent to the final price"
  const pctOfOrig = disc ? 100 - d : 100 + d;
  const verifyExpr = `${price}/(${pctOfOrig}/100)`;
  const common = {
    step1: {
      key: 'percent-of-original',
      instruction: disc ? `A ${d}% discount means the sale price is ${pctOfOrig}% of the original.` : `A ${d}% increase means the new price is ${pctOfOrig}% of the original.`,
      math: `${pctOfOrig}\\% \\times \\text{original} = ${price}`,
      why: 'The final amount is a percent of the ORIGINAL, so divide by that percent: do not apply the percent to the final amount.',
      ask: { prompt: 'The final price is what percent of the original?', answer: numberAnswer(pctOfOrig), verify: { type: 'evaluate', expr: `${pctOfOrig}` } },
    } satisfies Step,
    step2: {
      key: 'divide-out',
      instruction: `Divide ${price} by ${pctOfOrig / 100}.`,
      math: `\\text{original} = \\frac{${price}}{${pctOfOrig / 100}} = ${orig}`,
      why: 'Undo the multiplier by dividing.',
      ask: { prompt: 'What was the original price?', answer: numberAnswer(orig), verify: { type: 'evaluate', expr: verifyExpr } },
    } satisfies Step,
  };
  const prompt = disc
    ? `After a ${d}% discount, a jacket sells for \\$${price}. What was its original price?`
    : `After a ${d}% increase, a monthly rent is \\$${price}. What was the rent before the increase?`;
  if (!disc) {
    const answer = numberAnswer(orig);
    return {
      params: { form, d, orig, price, a: 0, b: 0, n: 0 },
      prompt,
      answer,
      steps: [common.step1, { ...common.step2, ask: { ...common.step2.ask, prompt: 'So the original was?' } }],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('reverse-percent-multiplied', () => mult)]),
      verify: { type: 'evaluate', expr: verifyExpr },
    };
  }
  // multiple choice with five distinct options built from real mistakes
  const cand: { v: Q; tag: string }[] = [
    { v: origQ, tag: 'ok' },
    { v: mult, tag: 'mult' },
    { v: Q.of(price).add(d), tag: 'add' },
    { v: Q.of(price).mul(100 - d).div(100), tag: 'again' },
    { v: Q.of(price).mul(100).div(100 + d), tag: 'inc' },
  ];
  const distinct = new Set(cand.map((c) => c.v.toString()));
  if (distinct.size < 5) return level4(rng); // rare collision: redraw (deterministic given the rng state)
  const shuffled = rng.shuffle(cand);
  const options: ChoiceOption[] = shuffled.map((c, i) => ({ id: `o${i}`, label: `$\\$${num(c.v)}$` }));
  const idOf = (tag: string) => options[shuffled.findIndex((c) => c.tag === tag)].id;
  const answer: AnswerSpec = { kind: 'choice', options, correct: idOf('ok') };
  const mis: MisconceptionInstance = { id: 'reverse-percent-multiplied', wrong: { kind: 'choice', options, correct: idOf('mult') } };
  return {
    params: { form, d, orig, price, a: 0, b: 0, n: 0 },
    prompt,
    answer,
    steps: [
      common.step1,
      common.step2,
      { key: 'pick-option', instruction: 'Pick the matching option (or back-solve: take the discount off each option).', math: `${orig} \\times ${pctOfOrig / 100} = ${price}`, why: 'Back-solving checks an option in seconds.', ask: { prompt: 'Which is the original price?', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, [mis]),
    verify: { type: 'choice', note: 'tests/skills/gre-fractions-percents.test.ts: the correct option reduced by the discount gives the sale price' },
  };
}

// ---------- level 5: QC with a variable ----------

function level5(rng: Rng): Body {
  const form = rng.int(0, 2);
  if (form === 0) {
    const k = rng.pick([20, 40, 50, 60, 80, 150, 200]);
    const answer = qcAnswer('c'); // x% of k = xk/100 = k% of x
    const test = 50;
    return {
      params: { form, k, sub: 0, a: 0, b: 0 },
      prompt: QC_PROMPT('$x > 0$', `$x\\%$ of ${k}`, `${k}% of $x$`),
      answer,
      steps: [
        {
          key: 'test-value',
          instruction: 'Plug in x = 50 for Quantity A.',
          math: `50\\% \\times ${k} = ${(test * k) / 100}`,
          why: 'A quick test suggests the pattern; the algebra proves it.',
          ask: { prompt: `What is $50\\%$ of ${k}?`, answer: numberAnswer((test * k) / 100), verify: { type: 'evaluate', expr: `50/100*${k}` } },
        },
        decideStep('c', 'x% of k = xk/100 and k% of x = kx/100: always equal, whatever x is.', `\\frac{x}{100}\\cdot ${k} = \\frac{${k}}{100}\\cdot x`),
      ],
      misconceptions: distinctMisconceptions(answer, [{ id: 'percent-of-variable-d', wrong: qcAnswer('d') }]),
      verify: { type: 'qc', quantityA: `x/100*${k}`, quantityB: `${k}/100*x`, variables: [{ name: 'x', min: 0.5, max: 1000 }], constraints: [] },
    };
  }
  if (form === 1) {
    const k = 10 * rng.int(2, 20);
    const sub = rng.int(0, 2); // 0: x > 100, 1: 0 < x < 100, 2: x > 0
    const relation: QcRelation = sub === 0 ? 'a' : sub === 1 ? 'b' : 'd';
    const setup = ['$x > 100$', '$0 < x < 100$', '$x > 0$'][sub];
    const win: [number, number] = [[101, 1000], [0.5, 99.5], [0.5, 1000]][sub] as [number, number];
    const answer = qcAnswer(relation);
    return {
      params: { form, k, sub, a: 0, b: 0 },
      prompt: QC_PROMPT(setup, `$x\\%$ of ${k}`, `${k}`),
      answer,
      steps: [
        {
          key: 'test-value',
          instruction: 'More than 100% of a number is bigger than it; less than 100% is smaller. Test x = 100.',
          math: `100\\% \\text{ of } ${k} = ${k}`,
          why: '100% is the dividing line.',
          ask: { prompt: `What is $100\\%$ of ${k}?`, answer: numberAnswer(k), verify: { type: 'evaluate', expr: `${k}` } },
        },
        decideStep(relation, sub === 2 ? 'x = 50 gives B greater, x = 200 gives A greater, so it cannot be determined.' : 'Compare x with 100 to decide which side of 100% you are on.'),
      ],
      misconceptions: [],
      verify: { type: 'qc', quantityA: `x/100*${k}`, quantityB: `${k}`, variables: [{ name: 'x', min: win[0], max: win[1] }], constraints: [] },
    };
  }
  const a = 5 * rng.int(2, 8);
  const b = a + 5 * rng.int(1, 4);
  const sub = rng.int(0, 3); // 0: N > 0, 1: N < 0, 2: N != 0, 3: N >= 0
  // A = a% of N, B = b% of N, a < b: A - B = (a - b)N/100 has the sign of -N... so N>0 -> B greater, N<0 -> A greater.
  const relation: QcRelation = sub === 0 ? 'b' : sub === 1 ? 'a' : 'd';
  const setup = ['$N > 0$', '$N < 0$', '$N \\ne 0$', '$N \\ge 0$'][sub];
  const constraints = sub === 2 ? ['N != 0'] : [];
  const lo = sub === 1 ? -100 : sub === 0 ? 0.5 : sub === 3 ? 0 : -100;
  const hi = sub === 1 ? -0.5 : 100;
  const answer = qcAnswer(relation);
  const tv = sub === 1 ? -100 : 100;
  return {
    params: { form, k: 0, sub, a, b },
    prompt: QC_PROMPT(setup, `${a}% of $N$`, `${b}% of $N$`),
    answer,
    steps: [
      {
        key: 'test-value',
        instruction: `Try N = ${tv}: A is ${a}% of it.`,
        math: `${a}\\% \\times ${tv} = ${(a * tv) / 100}`,
        why: 'Percents of a negative number reverse the usual order: a bigger percent gives a smaller (more negative) value.',
        ask: { prompt: `What is Quantity A when $N = ${tv}$?`, answer: numberAnswer((a * tv) / 100), verify: { type: 'evaluate', expr: `${a}/100*(${tv})` } },
      },
      decideStep(relation, sub === 3 ? 'N = 0 makes them equal, N = 100 makes B greater: cannot be determined.' : sub === 2 ? 'Positive N favors B, negative N favors A: cannot be determined.' : 'B - A = (b - a)N/100 has the sign of N.'),
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'bigger-percent-bigger', wrong: qcAnswer(sub === 1 || sub === 2 || sub === 3 ? 'b' : 'a') }]),
    verify: { type: 'qc', quantityA: `${a}/100*N`, quantityB: `${b}/100*N`, variables: [{ name: 'N', min: lo, max: hi }], constraints },
  };
}

export const greFractionsPercents: SkillDefinition = {
  id: ID,
  title: 'Fractions & percents',
  track: 'gre',
  unit: 'GRE · Arithmetic',
  description: 'Percent change, successive percents, fraction comparison, reverse percents, and percent quantitative comparisons.',
  prerequisites: ['gre-integers'],
  maxDenominator: 100,
  levels: {
    1: { description: 'Percent increase and decrease', ranges: { old: [20, 240], p: [5, 100], up: [0, 1], nw: [1, 480] } },
    2: {
      description: 'Successive percent changes (numeric and QC)',
      ranges: { form: [0, 1], a: [0, 60], b: [0, 60], s1: [-1, 1], s2: [-1, 1], sub: [0, 2], price: [0, 200] },
    },
    3: {
      description: 'Comparing fractions (QC and select all)',
      ranges: { form: [0, 1], n1: [0, 24], d1: [0, 30], n2: [0, 24], d2: [0, 30], tn: [0, 3], td: [2, 5] },
    },
    4: {
      description: 'Reverse percents and percent of a percent',
      ranges: { form: [0, 2], d: [0, 50], orig: [0, 400], price: [0, 600], a: [0, 80], b: [0, 80], n: [0, 1000] },
    },
    5: { description: 'Percent QC with variables', ranges: { form: [0, 2], k: [0, 200], sub: [0, 3], a: [0, 40], b: [0, 60] } },
  },
  misconceptions: {
    'percent-change-base': { name: 'Divided by the new value', explanation: 'Percent change is measured against the ORIGINAL value: change ÷ original. Dividing by the new value gives a different (wrong) percent.' },
    'successive-additive': { name: 'Added successive percent changes', explanation: 'Each percent change applies to the CURRENT amount, so the multipliers multiply: $+20\\%$ then $-20\\%$ is $1.2 \\times 0.8 = 0.96$, a 4% DECREASE, not 0%.' },
    'reverse-percent-multiplied': { name: 'Applied the percent to the final amount', explanation: 'The final amount is a percent of the ORIGINAL. To go back, DIVIDE by the multiplier: $60 \\div 0.75 = 80$, not $60 \\times 1.25 = 75$.' },
    'fraction-compare-by-numerator': { name: 'Compared fractions by their numerators', explanation: 'A bigger numerator does not make a bigger fraction when the denominators differ. Cross-multiply: $\\frac{a}{b} > \\frac{c}{d}$ exactly when $ad > bc$.' },
    'percent-of-percent-added': { name: 'Added the two percents', explanation: '"$a\\%$ of $b\\%$ of $N$" multiplies: $N \\cdot \\frac{a}{100} \\cdot \\frac{b}{100}$. Adding the percents is wrong.' },
    'percent-of-variable-d': { name: 'Thought a variable means "cannot be determined"', explanation: 'Check the algebra before choosing D: $x\\%$ of $k$ is $\\frac{xk}{100}$ and $k\\%$ of $x$ is $\\frac{kx}{100}$, which are identical for every $x$.' },
    'bigger-percent-bigger': { name: 'Assumed the bigger percent is always bigger', explanation: 'A bigger percent of a positive number is bigger, but of a negative number it is SMALLER (more negative). Check the sign of the variable, and test 0.' },
  },
  stepLabels: {
    'find-change': 'Find the amount of change',
    'divide-original': 'Divide by the original',
    'to-percent': 'Convert the fraction to a percent',
    'first-multiplier': 'Write the first change as a multiplier',
    'multiply-factors': 'Multiply the multipliers',
    'net-change': 'Subtract 100% for the net change',
    'test-value': 'Plug in a test value',
    decide: 'Decide the relationship',
    'cross-multiply': 'Cross-multiply',
    'select-all': 'Test every option',
    'percent-of-original': 'Final amount as a percent of the original',
    'divide-out': 'Divide to undo the multiplier',
    'pick-option': 'Pick the matching option',
    'inner-percent': 'Take the inner percent',
    'outer-percent': 'Take the outer percent',
  },
  learn: {
    whyItMatters:
      'Percent questions appear in every GRE quant section, in word problems and in data interpretation sets, and the test loves two traps: successive percent changes do not add, and a percent change is measured against the ORIGINAL value. The same care matters in economics: if output falls 10% in a recession and then grows 10%, it has not recovered, because 0.90 × 1.10 = 0.99, so output is still 1% below where it started.',
    summary:
      'Percent change = change ÷ original × 100. A percent change is a multiplier: +p% means ×(1 + p/100). Successive changes multiply. To undo a change, divide by its multiplier. Compare fractions by cross-multiplying. In a QC with a variable, test 0, negatives, and values above and below 100%.',
    formulas: [
      { latex: '\\text{percent change} = \\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100\\%' },
      { latex: '(1 + r)(1 - r) = 1 - r^2 < 1', note: 'Up $r$ then down $r$ always loses.' },
      { latex: '\\frac{a}{b} > \\frac{c}{d} \\iff ad > bc', note: 'For positive $b, d$.' },
    ],
    example: { seed: 4, level: 2 },
    tips: [
      'Simplify change ÷ original before converting: $\\frac{144}{180} = \\frac{4}{5} = 80\\%$. Divide top and bottom by any common factor you see (here 36, or 4 then 9).',
      'Know the common fractions as percents: $\\frac15 = 20\\%$, $\\frac14 = 25\\%$, $\\frac13 \\approx 33.3\\%$, $\\frac38 = 37.5\\%$, $\\frac35 = 60\\%$.',
      'To reverse a percent change, divide by the multiplier.', '$x\\%$ of $y$ always equals $y\\%$ of $x$.'],
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
