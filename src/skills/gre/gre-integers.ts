// REFERENCE GRE SKILL. Shows all four GRE formats:
//   numeric entry (number answer), select-all (multi answer + skill test),
//   quantitative comparison (QC: qcAnswer + a `qc` verify the harness re-derives by sampling),
//   and multiple choice. GRE skills live in src/skills/gre/ with track 'gre'.
// QC relations are computed EXACTLY by the generator: on a small integer domain, by checking
// every allowed value (that's a proof, and it doubles as the "test cases" solution steps).

import { multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step } from '../../engine/types';

const ID = 'gre-integers';
type Body = ReturnType<SkillDefinition['generate']>;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const primeFactors = (n: number) => {
  const out: Record<number, number> = {};
  let m = n;
  for (let p = 2; m > 1; p++) {
    while (m % p === 0) {
      out[p] = (out[p] ?? 0) + 1;
      m /= p;
    }
  }
  return out;
};

/** Compare two numbers exactly: the QC option letter. */
const rel = (a: number, b: number): QcRelation => (a > b ? 'a' : a < b ? 'b' : 'c');
/** Over a set of cases, all the same → that relation; any disagreement → 'd'. */
const relOver = (cases: [number, number][]): QcRelation => {
  const set = new Set(cases.map(([a, b]) => rel(a, b)));
  return set.size === 1 ? [...set][0] : 'd';
};

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

function shuffleOptions(rng: Rng, labels: string[], correctIdx: number[]): { options: ChoiceOption[]; correct: string[] } {
  const tagged = labels.map((label, i) => ({ label, good: correctIdx.includes(i) }));
  const shuffled = rng.shuffle(tagged);
  const options = shuffled.map((t, i) => ({ id: `o${i}`, label: t.label }));
  return { options, correct: options.filter((_, i) => shuffled[i].good).map((o) => o.id) };
}

// ---------- level 1: remainders (numeric entry) ----------

function level1(rng: Rng): Body {
  const d = rng.int(3, 12);
  const q = rng.int(3, 40);
  const r = rng.int(1, d - 1);
  const n = d * q + r;
  const answer = numberAnswer(r);
  const steps: Step[] = [
    {
      key: 'largest-multiple',
      instruction: `Find the largest multiple of ${d} that is at most ${n}.`,
      math: `${d} \\times ${q} = ${d * q} \\le ${n} < ${d * (q + 1)} = ${d} \\times ${q + 1}`,
      why: 'The quotient is how many whole times the divisor fits.',
      ask: { prompt: `What is the largest multiple of $${d}$ that is $\\le ${n}$?`, answer: numberAnswer(d * q), verify: { type: 'evaluate', expr: `${d}*floor(${n}/${d})` } },
    },
    {
      key: 'subtract',
      instruction: 'The remainder is what is left over.',
      math: `${n} - ${d * q} = ${r}`,
      why: `A remainder is always between 0 and ${d - 1} (less than the divisor).`,
      ask: { prompt: `So the remainder is?`, answer, verify: { type: 'evaluate', expr: `mod(${n}, ${d})` } },
    },
  ];
  return {
    params: { n, d, q, r },
    prompt: `What is the remainder when ${n} is divided by ${d}?`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, [wrongNumber('gave-quotient', () => q), wrongNumber('remainder-complement', () => d - r)]),
    verify: { type: 'evaluate', expr: `mod(${n}, ${d})` },
  };
}

// ---------- level 2: factors (select all that apply) ----------

function level2(rng: Rng): Body {
  for (;;) {
    const n = rng.int(24, 200);
    const ds = divisors(n).filter((d) => d > 1 && d < n);
    if (ds.length < 4) continue; // needs enough factors to make a real select-all
    const factors = rng.shuffle(ds).slice(0, rng.int(2, 3));
    const nonFactors = rng.shuffle(Array.from({ length: n - 2 }, (_, i) => i + 2).filter((x) => n % x !== 0 && x < n)).slice(0, 4 - factors.length);
    const multiple = n * rng.int(2, 3); // a multiple, not a factor: the classic confusion
    const labels = [...factors, ...nonFactors, multiple].map(String);
    const { options, correct } = shuffleOptions(rng, labels, factors.map((_, i) => i));
    const multipleId = options.find((o) => o.label === String(multiple))!.id;
    const answer = multiAnswer(options, correct);
    const steps: Step[] = [
      {
        key: 'factor-definition',
        instruction: `A factor of ${n} divides ${n} with no remainder.`,
        math: `${n} = ${factors.map((f) => `${f} \\times ${n / f}`).join(' = ')}`,
        why: 'Factors are the numbers that go INTO n; multiples are what n goes into.',
        ask: {
          prompt: `Is $${multiple}$ a factor of $${n}$?`,
          answer: { kind: 'choice', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: `No, it's a multiple of ${n}` }], correct: 'no' },
        },
      },
      {
        key: 'test-each',
        instruction: 'Test each option by dividing.',
        math: labels.map((l) => `${n} \\div ${l} ${n % Number(l) === 0 ? `= ${n / Number(l)}` : '\\text{ not whole}'}`).join(',\\quad '),
        why: 'On the GRE, select-all questions need every correct option and no wrong ones.',
        ask: { prompt: `Select all the factors of $${n}$.`, answer },
      },
    ];
    return {
      params: { n, multiple },
      prompt: `Which of the following are factors of ${n}?`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, [{ id: 'factor-multiple-confusion', wrong: multiAnswer(options, [...correct, multipleId]) }]),
      verify: { type: 'choice', note: 'tests/skills/gre-integers.test.ts checks divisibility of every option' },
    };
  }
}

// ---------- level 3: quantitative comparison on a small integer domain ----------

function level3(rng: Rng): Body {
  const form = rng.int(0, 1);
  if (form === 0) {
    // n integer in [lo, hi]: A = n², B = k·n. Exhaustive check over the domain is a proof.
    const lo = rng.int(-3, 3);
    const hi = lo + rng.int(2, 5);
    const k = rng.int(1, 6);
    const cases: [number, number][] = [];
    for (let n = lo; n <= hi; n++) cases.push([n * n, k * n]);
    const relation = relOver(cases);
    const answer = qcAnswer(relation);
    const show = cases.map(([a, b], i) => `n = ${lo + i}: ${a} \\text{ vs } ${b}`);
    const steps: Step[] = [
      {
        key: 'test-cases',
        instruction: 'There are only a few possible values of n. Try each one (on the GRE, try the extremes and anything special like 0 or negatives).',
        math: show.join(',\\quad '),
        why: 'If two allowed values give different relationships, the answer is "cannot be determined".',
        ask: { prompt: `What is Quantity A minus Quantity B when $n = ${lo}$?`, answer: numberAnswer(lo * lo - k * lo), verify: { type: 'evaluate', expr: `(${lo})^2 - ${k}*(${lo})` } },
      },
      {
        key: 'decide',
        instruction: relation === 'd' ? 'Different values give different relationships.' : 'Every allowed value gives the same relationship.',
        math: relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B \\text{ always}' : relation === 'b' ? 'B > A \\text{ always}' : 'A = B \\text{ always}',
        why: 'An answer of A, B or C must hold for EVERY allowed value.',
        ask: { prompt: 'So which is it?', answer },
      },
    ];
    return {
      params: { form, lo, hi, k, a: 0, b: 0, d: 0 },
      prompt: QC_PROMPT(`$n$ is an integer and $${lo} \\le n \\le ${hi}$.`, '$n^2$', `$${k === 1 ? '' : k}n$`),
      answer,
      steps,
      misconceptions: relation === 'd' ? distinctMisconceptions(answer, [{ id: 'tested-one-case', wrong: qcAnswer(rel(...cases[cases.length - 1])) }]) : [],
      verify: {
        type: 'qc',
        quantityA: 'n^2',
        quantityB: `${k}*n`,
        variables: [{ name: 'n', min: lo, max: hi, integer: true }],
        constraints: [],
      },
    };
  }
  // Two remainders with the same divisor, no variables.
  const d = rng.int(4, 11);
  const a = rng.int(30, 300);
  const b = rng.int(30, 300);
  const relation = rel(a % d, b % d);
  const answer = qcAnswer(relation);
  return {
    params: { form, lo: 0, hi: 0, k: 0, a, b, d },
    prompt: QC_PROMPT('', `The remainder when ${a} is divided by ${d}`, `The remainder when ${b} is divided by ${d}`),
    answer,
    steps: [
      {
        key: 'compute-a',
        instruction: `Find the remainder of ${a} ÷ ${d}.`,
        math: `${a} = ${d}\\times ${Math.floor(a / d)} + ${a % d}`,
        why: 'Remainder = number − (largest multiple of the divisor below it).',
        ask: { prompt: `Remainder of $${a} \\div ${d}$?`, answer: numberAnswer(a % d), verify: { type: 'evaluate', expr: `mod(${a}, ${d})` } },
      },
      {
        key: 'compute-b',
        instruction: `Find the remainder of ${b} ÷ ${d}.`,
        math: `${b} = ${d}\\times ${Math.floor(b / d)} + ${b % d}`,
        why: 'Same method. Don\'t compare the original numbers: a bigger number can have a smaller remainder.',
        ask: { prompt: `Remainder of $${b} \\div ${d}$?`, answer: numberAnswer(b % d), verify: { type: 'evaluate', expr: `mod(${b}, ${d})` } },
      },
      {
        key: 'decide',
        instruction: 'Compare the two remainders.',
        math: `${a % d} \\text{ vs } ${b % d}`,
        why: 'With no variables, the relationship is always determined (never D).',
        ask: { prompt: 'So which is it?', answer },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [{ id: 'compared-dividends', wrong: qcAnswer(rel(a, b)) }]),
    verify: { type: 'qc', quantityA: `mod(${a}, ${d})`, quantityB: `mod(${b}, ${d})`, variables: [], constraints: [] },
  };
}

// ---------- level 4: LCM / GCD word problems (numeric entry) ----------

function level4(rng: Rng): Body {
  for (;;) {
    const a = rng.int(4, 30);
    const b = rng.int(4, 30);
    if (a === b || gcd(a, b) === 1 || a % b === 0 || b % a === 0) continue; // product ≠ LCM: the trap is live
    const form = rng.int(0, 1);
    const L = lcm(a, b);
    const G = gcd(a, b);
    const isLcm = form === 0;
    const answer = numberAnswer(isLcm ? L : G);
    const prompt = isLcm
      ? `Two lights blink every ${a} seconds and every ${b} seconds. They just blinked together. In how many seconds will they next blink together?`
      : `A teacher has ${a} pencils and ${b} erasers and wants identical kits using all of them, with no leftovers. What is the greatest number of kits she can make?`;
    const fa = primeFactors(a);
    const fb = primeFactors(b);
    const fact = (f: Record<number, number>) => Object.entries(f).map(([p, e]) => (e > 1 ? `${p}^{${e}}` : p)).join(' \\cdot ');
    return {
      params: { a, b, form },
      prompt,
      answer,
      steps: [
        {
          key: 'which-tool',
          instruction: isLcm ? '"Next time together" means the least common multiple.' : '"Greatest number of identical groups" means the greatest common divisor.',
          math: isLcm ? `\\text{LCM}(${a}, ${b})` : `\\text{GCD}(${a}, ${b})`,
          why: isLcm ? 'Both events repeat; they coincide at common multiples, and the first one is the least.' : 'Each kit count must divide both totals evenly.',
          ask: {
            prompt: 'Which do you need?',
            answer: { kind: 'choice', options: [{ id: 'lcm', label: 'Least common multiple' }, { id: 'gcd', label: 'Greatest common divisor' }, { id: 'prod', label: 'The product' }], correct: isLcm ? 'lcm' : 'gcd' },
          },
        },
        {
          key: 'prime-factorize',
          instruction: 'Prime-factorize both numbers.',
          math: `${a} = ${fact(fa)}, \\qquad ${b} = ${fact(fb)}`,
          why: isLcm ? 'LCM: take each prime to its HIGHEST power.' : 'GCD: take each shared prime to its LOWEST power.',
          ask: { prompt: `What is $\\text{GCD}(${a}, ${b})$?`, answer: numberAnswer(G), verify: { type: 'evaluate', expr: `gcd(${a}, ${b})` } },
        },
        {
          key: 'combine',
          instruction: isLcm ? 'LCM = a × b ÷ GCD.' : 'That GCD is the number of kits.',
          math: isLcm ? `\\frac{${a} \\times ${b}}{${G}} = ${L}` : `\\text{GCD} = ${G}`,
          why: isLcm ? 'Multiplying counts the shared factor twice; dividing by the GCD removes the double count.' : `Each kit gets ${a / G} pencils and ${b / G} erasers.`,
          ask: { prompt: 'So the answer is?', answer, verify: { type: 'evaluate', expr: isLcm ? `lcm(${a}, ${b})` : `gcd(${a}, ${b})` } },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [
        wrongNumber('product-not-lcm', () => a * b),
        wrongNumber(isLcm ? 'lcm-gcd-swap' : 'lcm-gcd-swap', () => (isLcm ? G : L)),
      ]),
      verify: { type: 'evaluate', expr: isLcm ? `lcm(${a}, ${b})` : `gcd(${a}, ${b})` },
    };
  }
}

// ---------- level 5: counting divisors from a prime factorization (numeric entry) ----------

function level5(rng: Rng): Body {
  const e2 = rng.int(1, 4);
  const e3 = rng.int(0, 3);
  const e5 = rng.int(0, 2);
  const e7 = rng.int(0, 1);
  const n = 2 ** e2 * 3 ** e3 * 5 ** e5 * 7 ** e7;
  const exps = [
    [2, e2],
    [3, e3],
    [5, e5],
    [7, e7],
  ].filter(([, e]) => e > 0);
  const count = exps.reduce((m, [, e]) => m * (e + 1), 1);
  const answer = numberAnswer(count);
  const factored = exps.map(([p, e]) => (e > 1 ? `${p}^{${e}}` : `${p}`)).join(' \\cdot ');
  return {
    params: { n, e2, e3, e5, e7 },
    prompt: `How many positive divisors does ${n} have?`,
    answer,
    steps: [
      {
        key: 'prime-factorize',
        instruction: `Write ${n} as a product of prime powers.`,
        math: `${n} = ${factored}`,
        why: 'Every divisor is built by choosing how many of each prime to use.',
        ask: { prompt: `What is the exponent of 2 in the prime factorization of $${n}$?`, answer: numberAnswer(e2), verify: { type: 'evaluate', expr: `${e2}` } },
      },
      {
        key: 'add-one-multiply',
        instruction: 'Add 1 to each exponent and multiply.',
        math: exps.map(([, e]) => `(${e}+1)`).join('') + ` = ${count}`,
        why: 'For a prime to the power e you can use it 0, 1, …, e times: that is e + 1 choices, and choices multiply.',
        ask: { prompt: 'How many positive divisors?', answer, verify: { type: 'evaluate', expr: exps.map(([, e]) => `(${e}+1)`).join('*') } },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [
      wrongNumber('multiplied-exponents', () => exps.reduce((m, [, e]) => m * e, 1)),
      wrongNumber('added-exponents', () => exps.reduce((s, [, e]) => s + e, 0)),
    ]),
    verify: { type: 'evaluate', expr: exps.map(([, e]) => `(${e}+1)`).join('*') },
  };
}

export const greIntegers: SkillDefinition = {
  id: ID,
  title: 'Integer properties',
  track: 'gre',
  unit: 'GRE · Arithmetic',
  description: 'Remainders, factors and multiples, LCM/GCD, and counting divisors: GRE number properties.',
  prerequisites: [],
  maxDenominator: 1,
  levels: {
    1: { description: 'Remainders', ranges: { n: [10, 500], d: [3, 12], q: [3, 40], r: [1, 11] } },
    2: { description: 'Factors (select all that apply)', ranges: { n: [24, 200], multiple: [48, 600] } },
    3: {
      description: 'Quantitative comparison with integers',
      ranges: { form: [0, 1], lo: [-3, 3], hi: [-1, 8], k: [0, 6], a: [0, 300], b: [0, 300], d: [0, 11] },
    },
    4: { description: 'LCM and GCD word problems', ranges: { a: [4, 30], b: [4, 30], form: [0, 1] } },
    5: { description: 'Counting divisors', ranges: { n: [2, 75600], e2: [1, 4], e3: [0, 3], e5: [0, 2], e7: [0, 1] } },
  },
  misconceptions: {
    'gave-quotient': { name: 'Gave the quotient instead of the remainder', explanation: 'Dividing $n$ by $d$ gives a quotient (how many times $d$ fits) and a remainder (what is left over). The remainder is always smaller than $d$.' },
    'remainder-complement': { name: 'Found how far to the NEXT multiple', explanation: 'The remainder counts up from the multiple BELOW $n$, not down from the next one. For $23 \\div 5$: $23 - 20 = 3$, not $25 - 23 = 2$.' },
    'factor-multiple-confusion': { name: 'Picked a multiple as a factor', explanation: 'Factors go INTO $n$ (they divide it). Multiples are what $n$ goes into: $2n$, $3n$, … are multiples of $n$, never factors (except $n$ itself).' },
    'tested-one-case': { name: 'Decided from a single test case', explanation: 'For A, B or C the relationship must hold for EVERY allowed value. Try the extremes, 0, 1 and negatives; if any two cases disagree, the answer is D.' },
    'compared-dividends': { name: 'Compared the numbers instead of their remainders', explanation: 'A larger number can have a smaller remainder: $21 \\div 5$ leaves 1 but $19 \\div 5$ leaves 4. Compute both remainders.' },
    'product-not-lcm': { name: 'Multiplied instead of taking the LCM', explanation: '$a \\times b$ is a common multiple, but not the least one when $a$ and $b$ share a factor. $\\text{LCM} = \\frac{a \\times b}{\\text{GCD}}$.' },
    'lcm-gcd-swap': { name: 'Mixed up LCM and GCD', explanation: '"Next time together" or "smallest number both divide" → LCM. "Largest group size" or "largest number dividing both" → GCD.' },
    'multiplied-exponents': { name: 'Multiplied the exponents', explanation: 'Each prime $p^e$ can appear 0 to $e$ times: $e + 1$ choices. Multiply the $(e+1)$s, not the $e$s.' },
    'added-exponents': { name: 'Added the exponents', explanation: 'Choices for different primes are independent, so they MULTIPLY, and each prime has $e + 1$ choices (including using it 0 times).' },
  },
  stepLabels: {
    'largest-multiple': 'Find the largest multiple below the number',
    subtract: 'Subtract to get the remainder',
    'factor-definition': 'Factor vs multiple',
    'test-each': 'Test each option',
    'test-cases': 'Try the allowed values',
    decide: 'Decide the relationship',
    'compute-a': 'Compute Quantity A',
    'compute-b': 'Compute Quantity B',
    'which-tool': 'LCM or GCD?',
    'prime-factorize': 'Prime-factorize',
    combine: 'Combine the factors',
    'add-one-multiply': 'Add 1 to each exponent and multiply',
  },
  learn: {
    whyItMatters:
      'Number properties are the most common GRE arithmetic topic, and many are quantitative-comparison traps: a question looks like it needs calculation but really tests whether the relationship holds for EVERY allowed value. The habit it builds (test the extremes, 0, 1, negatives and fractions before committing) is the same one that catches sign errors in economics, like assuming a derivative is positive everywhere because it was positive at one point.',
    summary:
      'A remainder is what is left after removing the largest multiple of the divisor. Factors divide a number; multiples are divided by it. The LCM uses each prime to its highest power, the GCD each shared prime to its lowest. A number $p^a q^b$ has $(a+1)(b+1)$ positive divisors. In quantitative comparison, A, B or C must hold for every allowed value; two disagreeing cases mean D.',
    formulas: [
      { latex: 'n = dq + r, \\quad 0 \\le r < d', note: 'Division with remainder.' },
      { latex: '\\text{LCM}(a,b) = \\frac{ab}{\\text{GCD}(a,b)}' },
      { latex: 'n = p_1^{e_1}\\cdots p_k^{e_k} \\;\\Rightarrow\\; \\#\\text{divisors} = (e_1+1)\\cdots(e_k+1)' },
    ],
    example: { seed: 4, level: 3 },
    tips: [
      'Quantitative comparison: try 0, 1, a negative, a fraction, and the extremes of the allowed range.',
      'No variables in a comparison means the answer is never D.',
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

