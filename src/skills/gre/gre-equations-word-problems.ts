// GRE · Equations & word problems. Formats: numeric entry (L1, L2, L3), tuple entry (L3),
// quantitative comparison (L4), select all that apply (L5). The QC relation at L4 is exact:
// the system is solved with Q arithmetic and x, y are compared exactly.

import { multiAnswer, numberAnswer, qcAnswer, tupleAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { coefLatex, joinTerms } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { ChoiceOption, Level, SkillDefinition, Step, VerifySpec } from '../../engine/types';

const ID = 'gre-equations-word-problems';
type Body = ReturnType<SkillDefinition['generate']>;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const relQ = (a: Q, b: Q): QcRelation => {
  const s = a.sub(b).sign();
  return s > 0 ? 'a' : s < 0 ? 'b' : 'c';
};
const flip = (r: QcRelation): QcRelation => (r === 'a' ? 'b' : r === 'b' ? 'a' : r);

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

const yesNo = (correct: boolean) => ({ kind: 'choice' as const, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], correct: correct ? 'yes' : 'no' });

// ---------- level 1: translate a sentence ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 2);
  const m = rng.int(2, 6);
  const x = rng.int(1, 15);
  const k = rng.int(1, form === 1 ? Math.min(15, m * x - 1) : 15); // keeps "k less than mx" positive
  const r = form === 0 ? m * x + k : form === 1 ? m * x - k : m * (x + k);
  const phrase = [
    `${k} more than ${m} times a number is ${r}`,
    `${k} less than ${m} times a number is ${r}`,
    `${m} times the sum of a number and ${k} is ${r}`,
  ][form];
  const eq = [`${m}x + ${k} = ${r}`, `${m}x - ${k} = ${r}`, `${m}(x + ${k}) = ${r}`][form];
  const verifyEq = [`${m}*x + ${k} = ${r}`, `${m}*x - ${k} = ${r}`, `${m}*(x+${k}) = ${r}`][form];
  const verify: VerifySpec = { type: 'solve', equations: [verifyEq], unknowns: ['x'] };
  const answer = numberAnswer(x);
  const wrongX =
    form === 0 ? null : form === 1 ? Q.of(k - r).div(m) /* wrote k - mx = r */ : Q.of(r - k).div(m); /* wrote mx + k = r */
  const decoys = [`${m}x - ${k} = ${r}`, `${k} - ${m}x = ${r}`, `${m}(x + ${k}) = ${r}`, `${m}x + ${k} = ${r}`, `${m}x + ${k}x = ${r}`].filter((d) => d !== eq);
  const labels = [eq, decoys[0], decoys[1]];
  const order = rng.shuffle([0, 1, 2]);
  const options: ChoiceOption[] = order.map((ci, i) => ({ id: `o${i}`, label: `$${labels[ci]}$` }));
  const correctId = `o${order.indexOf(0)}`;
  return {
    params: { form, m, k, r, x },
    prompt: `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}. What is the number?`,
    answer,
    steps: [
      {
        key: 'translate',
        instruction: 'Translate word by word. "Is" becomes =, "times" becomes ×, and "k less than y" means y − k.',
        math: eq,
        why: '"5 less than x" is x − 5, not 5 − x: the quantity you start from comes first.',
        ask: { prompt: 'Which equation matches the sentence?', answer: { kind: 'choice', options, correct: correctId } },
      },
      {
        key: 'solve',
        instruction: 'Solve the equation.',
        math: form === 2 ? `x + ${k} = ${r / m} \\;\\Rightarrow\\; x = ${x}` : form === 0 ? `${m}x = ${r - k} \\;\\Rightarrow\\; x = ${x}` : `${m}x = ${r + k} \\;\\Rightarrow\\; x = ${x}`,
        why: 'Undo the operations in reverse order.',
        ask: { prompt: 'What is the number?', answer, verify },
      },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongX ? wrongNumber('translation-order', () => wrongX) : null]),
    verify,
  };
}

// ---------- level 2: consecutive integers, ages, coins ----------

function level2(rng: Rng): Body {
  const form = rng.int(0, 2);
  const P = { form, k: 0, step: 0, n: 0, m: 0, t: 0, p: 0, q: 0, y: 0, x: 0 };
  if (form === 0) {
    const k = rng.pick([3, 5]);
    const step = rng.int(1, 2);
    const n = rng.int(1, 20) * step + (step === 2 ? rng.int(0, 1) * 1 : 0);
    // step 2: n may be even or odd, both fine ("consecutive even" needs n even, "odd" needs n odd)
    const S = k * n + (step * k * (k - 1)) / 2;
    const largest = n + step * (k - 1);
    const kind = step === 1 ? 'consecutive integers' : n % 2 === 0 ? 'consecutive even integers' : 'consecutive odd integers';
    const word = k === 3 ? 'three' : 'five';
    const answer = numberAnswer(largest);
    const verify: VerifySpec = { type: 'evaluate', expr: `${S}/${k} + ${step}*(${k}-1)/2` };
    const terms = Array.from({ length: k }, (_, i) => (i === 0 ? 'x' : `x + ${i * step}`)).join(') + (');
    return {
      params: { ...P, k, step, n },
      prompt: `The sum of ${word} ${kind} is ${S}. What is the largest of them?`,
      answer,
      steps: [
        {
          key: 'set-up',
          instruction: `Call the smallest x. The others are ${Array.from({ length: k - 1 }, (_, i) => `x + ${(i + 1) * step}`).join(', ')}.`,
          math: `(${terms}) = ${S} \\;\\Rightarrow\\; ${k}x + ${(step * k * (k - 1)) / 2} = ${S}`,
          why: `${word} terms means ${k - 1} gaps of ${step}: the largest is x + ${step * (k - 1)}, not x + ${step * k}.`,
          ask: { prompt: 'What is the smallest number, $x$?', answer: numberAnswer(n), verify: { type: 'evaluate', expr: `(${S} - ${(step * k * (k - 1)) / 2})/${k}` } },
        },
        { key: 'largest', instruction: 'Add the gaps to the smallest.', math: `${n} + ${step * (k - 1)} = ${largest}`, why: 'Shortcut: the middle term is the average, S ÷ k.', ask: { prompt: 'The largest is?', answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('consecutive-off-by-one', () => n + step * k)]),
      verify,
    };
  }
  if (form === 1) {
    const m = rng.int(2, 4);
    const x = rng.int(3, 15);
    const t = rng.int(2, 10);
    const S = x + m * x + 2 * t;
    const answer = numberAnswer(x);
    const verify: VerifySpec = { type: 'solve', equations: [`x + ${m}*x + 2*${t} = ${S}`], unknowns: ['x'] };
    return {
      params: { ...P, m, t, x },
      prompt: `Maria is ${m} times as old as Tom. In ${t} years the sum of their ages will be ${S}. How old is Tom now?`,
      answer,
      steps: [
        { key: 'set-up', instruction: `Let Tom's age be x, so Maria's is ${m}x. In ${t} years each is ${t} older.`, math: `(x + ${t}) + (${m}x + ${t}) = ${S}`, why: 'EACH person ages t years, so the sum grows by 2t.', ask: { prompt: `What is $${m + 1}x$ equal to? (the sum now)`, answer: numberAnswer(S - 2 * t), verify: { type: 'evaluate', expr: `${S}-2*${t}` } } },
        { key: 'solve', instruction: 'Solve for x, and answer the question that was asked (Tom).', math: `${m + 1}x = ${S - 2 * t} \\;\\Rightarrow\\; x = ${x}`, why: 'Re-read the question: x is Tom, not Maria.', ask: { prompt: "Tom's age now?", answer, verify } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('solved-for-wrong-variable', () => m * x)]),
      verify,
    };
  }
  const [p, q] = rng.pick([[5, 10], [5, 25], [10, 25]]);
  const n = rng.int(8, 30);
  const y = rng.int(2, n - 2);
  if (y === n - y) return level2(rng);
  const V = p * (n - y) + q * y;
  const answer = numberAnswer(y);
  const verify: VerifySpec = { type: 'solve', equations: [`${p}*(${n} - y) + ${q}*y = ${V}`], unknowns: ['y'] };
  const nm = (c: number) => (c === 5 ? 'nickels' : c === 10 ? 'dimes' : 'quarters');
  return {
    params: { ...P, n, p, q, y },
    prompt: `A jar holds ${n} coins, all ${nm(p)} and ${nm(q)}, worth ${V} cents in all. How many ${nm(q)} are in the jar?`,
    answer,
    steps: [
      { key: 'set-up', instruction: `Let y be the number of ${nm(q)}. Then there are ${n} − y ${nm(p)}.`, math: `${p}(${n} - y) + ${q}y = ${V}`, why: 'Value = (value per coin) × (number of coins), added over the coin types.', ask: { prompt: `What is $${V} - ${p} \\cdot ${n}$?`, answer: numberAnswer(V - p * n), verify: { type: 'evaluate', expr: `${V}-${p}*${n}` } } },
      { key: 'solve', instruction: `Simplify to ${q - p}y = ${V - p * n}.`, math: `${q - p}y = ${V - p * n} \\;\\Rightarrow\\; y = ${y}`, why: 'Answer the question asked: the number of the HIGHER coin.', ask: { prompt: `How many ${nm(q)}?`, answer, verify } },
    ],
    misconceptions: distinctMisconceptions(answer, [wrongNumber('solved-for-wrong-variable', () => n - y)]),
    verify,
  };
}

// ---------- level 3: systems from words ----------

function level3(rng: Rng): Body {
  for (;;) {
    const p = rng.int(6, 20);
    const q = rng.int(2, p - 2);
    const x = rng.int(5, 40);
    const y = rng.int(5, 40);
    if (x === y) continue;
    const N = x + y;
    const R = p * x + q * y;
    const form = rng.int(0, 1);
    const base = `Tickets to a concert cost \\$${p} for adults and \\$${q} for children. A total of ${N} tickets were sold for \\$${R}.`;
    const stepA: Step = {
      key: 'substitute',
      instruction: `Let a = adults and c = children. Then c = ${N} − a. Substitute into the money equation.`,
      math: `${p}a + ${q}(${N} - a) = ${R} \\;\\Rightarrow\\; ${p - q}a = ${R - q * N}`,
      why: 'Two unknowns need two equations: one for the count, one for the money.',
      ask: { prompt: `What is $${R} - ${q} \\cdot ${N}$?`, answer: numberAnswer(R - q * N), verify: { type: 'evaluate', expr: `${R}-${q}*${N}` } },
    };
    if (form === 0) {
      const answer = numberAnswer(x);
      const verify: VerifySpec = { type: 'solve', equations: [`${p}*a + ${q}*(${N} - a) = ${R}`], unknowns: ['a'] };
      return {
        params: { form, p, q, x, y },
        prompt: `${base} How many adult tickets were sold?`,
        answer,
        steps: [stepA, { key: 'solve', instruction: 'Divide to find a.', math: `a = \\frac{${R - q * N}}{${p - q}} = ${x}`, why: 'Check: the adult and child counts must sum to the total.', ask: { prompt: 'Adult tickets?', answer, verify } }],
        misconceptions: distinctMisconceptions(answer, [wrongNumber('solved-for-wrong-variable', () => y)]),
        verify,
      };
    }
    const answer = tupleAnswer(['a', 'c'], [x, y]);
    const verify: VerifySpec = { type: 'solve', equations: [`a + c = ${N}`, `${p}*a + ${q}*c = ${R}`], unknowns: ['a', 'c'] };
    return {
      params: { form, p, q, x, y },
      prompt: `${base} How many adult tickets (a) and how many child tickets (c) were sold?`,
      answer,
      steps: [stepA, { key: 'solve', instruction: 'Find a, then c = total − a.', math: `a = ${x}, \\quad c = ${N} - ${x} = ${y}`, why: 'Check: the money equation should give the total.', ask: { prompt: 'Enter a and c.', answer, verify } }],
      misconceptions: distinctMisconceptions(answer, [{ id: 'solved-for-wrong-variable', wrong: tupleAnswer(['a', 'c'], [y, x]) }]),
      verify,
    };
  }
}

// ---------- level 4: QC from a solved system ----------

const eqLatex = (a: number, b: number, c: number) => `${joinTerms([`${coefLatex(Q.of(a))}x`, `${coefLatex(Q.of(b))}y`])} = ${c}`;

function level4(rng: Rng): Body {
  for (;;) {
    const x = rng.int(-8, 12);
    const y = rng.int(-8, 12);
    const pick = () => rng.pick([-3, -2, -1, 1, 2, 3, 4]);
    const a1 = pick();
    const b1 = pick();
    const a2 = pick();
    const b2 = pick();
    if (a1 * b2 - a2 * b1 === 0) continue;
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    const form = rng.int(0, 1);
    const A = form === 0 ? Q.of(x) : Q.of(x + y);
    const B = form === 0 ? Q.of(y) : Q.of(x - y);
    const relation = relQ(A, B);
    if (form === 1 && x === y) continue;
    const answer = qcAnswer(relation);
    const sol = tupleAnswer(['x', 'y'], [x, y]);
    const verify: VerifySpec = { type: 'solve', equations: [`${a1}*x + (${b1})*y = ${c1}`, `${a2}*x + (${b2})*y = ${c2}`], unknowns: ['x', 'y'] };
    return {
      params: { form, a1, b1, a2, b2, x, y },
      prompt: QC_PROMPT(`$${eqLatex(a1, b1, c1)}$\n\n$${eqLatex(a2, b2, c2)}$`, form === 0 ? '$x$' : '$x + y$', form === 0 ? '$y$' : '$x - y$'),
      answer,
      steps: [
        {
          key: 'solve-system',
          instruction: 'The two equations pin down x and y exactly, so solve them (elimination or substitution). No variable is left, so the answer is never D.',
          math: `x = ${x}, \\quad y = ${y}`,
          why: 'Check both values in BOTH equations before comparing.',
          ask: { prompt: 'Enter $x$ and $y$.', answer: sol, verify },
        },
        {
          key: 'decide',
          instruction: 'Compare the two quantities using the solved values.',
          math: `${A.toLatex()} \\text{ vs } ${B.toLatex()}`,
          why: 'With a fully determined system, the relationship is always determined.',
          ask: { prompt: 'So which is it?', answer },
        },
      ],
      misconceptions: distinctMisconceptions(answer, [relation === 'a' || relation === 'b' ? { id: 'solved-for-wrong-variable', wrong: qcAnswer(flip(relation)) } : null]),
      verify: { type: 'choice', note: 'tests/skills/gre-equations-word-problems.test.ts brute-forces the integer solution of the system and compares the quantities' },
    };
  }
}

// ---------- level 5: "which could be n?" (select all) ----------

function level5(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    let a = 0, b = 0, d = 0, r = 0;
    let setup: string;
    let ok: (n: number) => boolean;
    let hint: string;
    if (form === 0) {
      a = rng.pick([1, 3, 5, 7]);
      b = rng.int(1, 9);
      d = 2;
      ok = (n) => (a * n + b) % 2 === 0;
      setup = `$n$ is an integer and $${a === 1 ? '' : a}n + ${b}$ is even`;
      hint = `${a}n + ${b} is even exactly when n is ${b % 2 === 0 ? 'even' : 'odd'} (a is odd)`;
    } else if (form === 1) {
      d = rng.int(3, 9);
      r = rng.int(1, d - 1);
      ok = (n) => n > 0 && n % d === r;
      setup = `$n$ is a positive integer that leaves a remainder of ${r} when divided by ${d}`;
      hint = `n = ${d}k + ${r} for some whole number k`;
    } else {
      d = rng.int(3, 6);
      a = rng.int(2, 9);
      if (gcd(a, d) !== 1) continue;
      b = rng.int(1, 9);
      ok = (n) => (a * n + b) % d === 0;
      setup = `$n$ is a positive integer and $${a}n + ${b}$ is divisible by ${d}`;
      hint = `${a}n + ${b} must be a multiple of ${d}`;
    }
    const goods: number[] = [];
    const bads: number[] = [];
    for (let n = 1; n <= 60; n++) (ok(n) ? goods : bads).push(n);
    const nGood = rng.int(1, 3);
    const chosenGood = rng.shuffle(goods).slice(0, nGood);
    const chosenBad = rng.shuffle(bads).slice(0, 5 - nGood);
    const order = rng.shuffle([...chosenGood, ...chosenBad]);
    const options: ChoiceOption[] = order.map((v, i) => ({ id: `o${i}`, label: `$${v}$` }));
    const correct = options.filter((_, i) => ok(order[i])).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    const first = order[0];
    return {
      params: { form, a, b, d, r },
      prompt: `${setup[0].toUpperCase()}${setup.slice(1)}. Which of the following could be the value of $n$? Select all that apply.`,
      answer,
      steps: [
        {
          key: 'condition',
          instruction: 'Turn the words into a condition on n.',
          math: `\\text{${hint}}`,
          why: 'Describe ALL values that work first, then test the options (or test each option directly).',
          ask: { prompt: `Does $n = ${first}$ satisfy the condition?`, answer: yesNo(ok(first)) },
        },
        { key: 'test-each', instruction: 'Test every option; "could be" means at least one valid case.', math: order.map((v) => `${v}: ${ok(v) ? '\\checkmark' : '\\times'}`).join(',\\quad '), why: 'Select-all needs every correct option and no wrong ones.', ask: { prompt: 'Select all that could be $n$.', answer } },
      ],
      misconceptions: [],
      verify: { type: 'choice', note: 'tests/skills/gre-equations-word-problems.test.ts re-evaluates the condition for every option' },
    };
  }
}

export const greEquationsWordProblems: SkillDefinition = {
  id: ID,
  title: 'Equations & word problems',
  track: 'gre',
  unit: 'GRE · Algebra',
  description: 'Translating words to equations: sentences, consecutive integers, ages, coins, systems, and "which could be n?" questions.',
  prerequisites: ['gre-fractions-percents'],
  maxDenominator: 3,
  workingPad: [1, 3],
  levels: {
    1: { description: 'Translate a sentence into an equation', ranges: { form: [0, 2], m: [2, 6], k: [1, 15], r: [0, 200], x: [1, 15] } },
    2: {
      description: 'Consecutive integers, ages, coins',
      ranges: { form: [0, 2], k: [0, 5], step: [0, 2], n: [0, 41], m: [0, 4], t: [0, 10], p: [0, 25], q: [0, 25], y: [0, 28], x: [0, 15] },
    },
    3: { description: 'Systems from words (numeric and tuple)', ranges: { form: [0, 1], p: [6, 20], q: [2, 18], x: [5, 40], y: [5, 40] } },
    4: { description: 'QC from a solved system', ranges: { form: [0, 1], a1: [-3, 4], b1: [-3, 4], a2: [-3, 4], b2: [-3, 4], x: [-8, 12], y: [-8, 12] } },
    5: { description: '"Which could be n?" (select all)', ranges: { form: [0, 2], a: [0, 9], b: [0, 9], d: [2, 9], r: [0, 8] } },
  },
  misconceptions: {
    'translation-order': { name: 'Reversed the order of "less than" (or misplaced the grouping)', explanation: '"5 less than $y$" is $y - 5$, not $5 - y$. And "$m$ times the SUM of a number and $k$" needs parentheses: $m(x + k)$.' },
    'solved-for-wrong-variable': { name: 'Gave the other unknown', explanation: 'After solving, re-read the question. If $x$ is one quantity and you were asked for the other, finish with the substitution (for example $c = \\text{total} - a$).' },
    'consecutive-off-by-one': { name: 'Misindexed consecutive integers', explanation: 'Three consecutive integers are $x$, $x+1$, $x+2$: the largest is $x + 2$, ONE LESS than the count. In general, $k$ terms have $k - 1$ gaps.' },
  },
  stepLabels: {
    translate: 'Translate the sentence',
    solve: 'Solve the equation',
    'set-up': 'Set up the equation',
    largest: 'Find the largest term',
    substitute: 'Substitute to one unknown',
    'solve-system': 'Solve the system',
    decide: 'Decide the relationship',
    condition: 'State the condition on n',
    'test-each': 'Test each option',
  },
  learn: {
    whyItMatters:
      'GRE algebra problems are mostly word problems: translate carefully, set up one or two equations, solve, and answer the question that was ASKED. Many QCs hide a system of equations whose solution settles the comparison. The same translation skill is the first step of every economics model: if demand is Q = 100 − 2P and supply is Q = 20 + 3P, setting them equal gives 80 = 5P, so the equilibrium price is 16.',
    summary:
      'Translate word by word ("is" is =, "k less than y" is y − k). For k consecutive integers use x, x+1, …, x+k−1. For two unknowns write a count equation and a value equation, substitute, solve, then answer for the variable the question names. When a system pins down every variable, a quantitative comparison is never D.',
    formulas: [
      { latex: '\\text{sum of } k \\text{ consecutive integers} = k \\cdot (\\text{middle term})', note: 'For odd $k$.' },
      { latex: 'pa + qc = R,\\ a + c = N \\;\\Rightarrow\\; (p - q)a = R - qN' },
    ],
    example: { seed: 5, level: 3 },
    tips: ['Underline what the question asks for before you start.', 'Check your solution in the original words, not just the equation.'],
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
