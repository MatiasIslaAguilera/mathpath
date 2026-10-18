// GRE Data analysis: counting and probability. Formats: numeric entry (L1-L4),
// multiple choice with computed distractors (L3), select-all (L2) and QC (L5).
// QC relations are exact: integer arithmetic for combinations/permutations, or exhaustive
// enumeration over a small integer domain when n is a variable.

import { choiceAnswer, multiAnswer, numberAnswer, qcAnswer, wrongNumber, type QcRelation } from '../../engine/answers';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import { tableFigure } from '../../engine/figures';
import type { AnswerSpec, ChoiceOption, Level, MisconceptionInstance, SkillDefinition, Step, StepAsk } from '../../engine/types';

const ID = 'gre-counting-probability';
type Body = ReturnType<SkillDefinition['generate']>;

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const perm = (n: number, k: number) => fact(n) / fact(n - k);
const comb = (n: number, k: number) => perm(n, k) / fact(k);
/** Plain product expression n(n-1)...(n-k+1), parseable by mathjs and SymPy. */
const prodExpr = (n: number, k: number) => Array.from({ length: k }, (_, i) => n - i).join('*');
const permExpr = (n: number, k: number) => `(${prodExpr(n, k)})`;
const combExpr = (n: number, k: number) => `(${prodExpr(n, k)})/(${prodExpr(k, k)})`;
const rel = (a: number, b: number): QcRelation => (a > b ? 'a' : a < b ? 'b' : 'c');
const relOver = (cases: [number, number][]): QcRelation => {
  const set = new Set(cases.map(([a, b]) => rel(a, b)));
  return set.size === 1 ? [...set][0] : 'd';
};

const QC_PROMPT = (setup: string, A: string, B: string) =>
  `${setup ? `${setup}\n\n` : ''}**Quantity A:** ${A}\n\n**Quantity B:** ${B}\n\nCompare Quantity A and Quantity B.`;

// ---------- level 1: fundamental counting principle (numeric) ----------

function level1(rng: Rng): Body {
  const form = rng.int(0, 2);
  let a = 0, b = 0, c = 0;
  let prompt: string, value: number, expr: string, wrong: [string, number][], steps: Step[];
  if (form === 0) {
    a = rng.int(2, 8);
    b = rng.int(2, 8);
    c = rng.int(2, 6);
    value = a * b * c;
    expr = `${a}*${b}*${c}`;
    prompt = `An outfit is one shirt, one pair of pants and one pair of shoes. How many different outfits can be made from ${a} shirts, ${b} pairs of pants and ${c} pairs of shoes?`;
    wrong = [['counting-added', a + b + c]];
    steps = [
      { key: 'choices-per-slot', instruction: 'Count the choices for each slot.', math: `${a} \\text{ shirts},\\; ${b} \\text{ pants},\\; ${c} \\text{ shoes}`, why: 'Each independent choice multiplies the number of outcomes.', ask: { prompt: 'How many shirt-and-pants pairings are there?', answer: numberAnswer(a * b), verify: { type: 'evaluate', expr: `${a}*${b}` } } },
      { key: 'multiply', instruction: 'Multiply the choices.', math: `${a}\\times ${b}\\times ${c} = ${value}`, why: 'Fundamental counting principle: "and" means multiply, "or" means add.', ask: { prompt: 'How many outfits?', answer: numberAnswer(value), verify: { type: 'evaluate', expr } } },
    ];
  } else if (form === 1) {
    a = rng.int(3, 6); // digits available 1..a
    b = rng.int(3, 4); // positions
    value = a ** b;
    expr = `${a}^${b}`;
    prompt = `A code has ${b} positions. Each position is filled with one of the digits 1 through ${a}, and digits may repeat. How many different codes are possible?`;
    wrong = [['counting-added', a * b]];
    steps = [
      { key: 'choices-per-slot', instruction: 'Each position has the same number of choices.', math: `\\underbrace{${a}\\cdot ${a}\\cdots ${a}}_{${b} \\text{ positions}}`, why: 'Repeats allowed means the choices do not shrink from slot to slot.', ask: { prompt: 'How many choices does each position have?', answer: numberAnswer(a), verify: { type: 'evaluate', expr: `${a}` } } },
      { key: 'multiply', instruction: 'Multiply across the positions.', math: `${a}^{${b}} = ${value}`, why: 'Independent slots multiply.', ask: { prompt: 'How many codes?', answer: numberAnswer(value), verify: { type: 'evaluate', expr } } },
    ];
  } else {
    a = rng.int(2, 5);
    b = rng.int(2, 5);
    c = rng.int(2, 5);
    value = a * b * (c + 1);
    expr = `${a}*${b}*(${c}+1)`;
    prompt = `A meal is one of ${a} appetizers, one of ${b} main courses, and optionally one of ${c} desserts (or no dessert). How many different meals are possible?`;
    wrong = [['forgot-skip-option', a * b * c], ['counting-added', a + b + c + 1]];
    steps = [
      { key: 'choices-per-slot', instruction: 'Skipping dessert is one more choice.', math: `\\text{dessert options} = ${c} + 1 = ${c + 1}`, why: 'Count "none" as an option whenever a slot may be left empty.', ask: { prompt: 'How many dessert options (including none)?', answer: numberAnswer(c + 1), verify: { type: 'evaluate', expr: `${c}+1` } } },
      { key: 'multiply', instruction: 'Multiply the choices.', math: `${a}\\times ${b}\\times ${c + 1} = ${value}`, why: 'Fundamental counting principle.', ask: { prompt: 'How many meals?', answer: numberAnswer(value), verify: { type: 'evaluate', expr } } },
    ];
  }
  const answer = numberAnswer(value);
  return {
    params: { form, a, b, c },
    prompt,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, wrong.map(([id, v]) => wrongNumber(id, () => v))),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 2: permutations vs combinations ----------

type Cand = { label: string; value: number };

function level2(rng: Rng): Body {
  const form = rng.int(0, 3);
  if (form === 0) {
    const n = rng.int(5, 10);
    const r = rng.int(2, 4);
    const value = comb(n, r);
    const answer = numberAnswer(value);
    return {
      params: { form, n, r },
      prompt: `A committee of ${r} people is to be chosen from a group of ${n} people. How many different committees are possible?`,
      answer,
      steps: [
        { key: 'order-matters', instruction: 'A committee has no order: choosing Ann, Bo, Cy is the same committee as Cy, Ann, Bo.', math: `\\binom{${n}}{${r}} = \\frac{{}_{${n}}P_{${r}}}{${r}!}`, why: 'Order does not matter: use combinations, which divide the ordered count by r!.', ask: { prompt: `How many ORDERED ways are there to pick ${r} of ${n} people?`, answer: numberAnswer(perm(n, r)), verify: { type: 'evaluate', expr: permExpr(n, r) } } },
        { key: 'divide-orderings', instruction: `Divide by the ${fact(r)} orderings of the same ${r} people.`, math: `\\frac{${perm(n, r)}}{${fact(r)}} = ${value}`, why: 'Each committee was counted r! times in the ordered count.', ask: { prompt: 'How many committees?', answer, verify: { type: 'evaluate', expr: combExpr(n, r) } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('permutation-for-combination', () => perm(n, r))]),
      verify: { type: 'evaluate', expr: combExpr(n, r) },
    };
  }
  if (form === 1) {
    const n = rng.int(5, 10);
    const r = rng.int(2, 3);
    const value = perm(n, r);
    const answer = numberAnswer(value);
    const places = r === 2 ? 'first and second places' : 'first, second and third places';
    return {
      params: { form, n, r },
      prompt: `${n} runners enter a race. In how many different ways can the ${places} be awarded?`,
      answer,
      steps: [
        { key: 'order-matters', instruction: 'Gold, silver and bronze are different prizes, so order matters.', math: `{}_{${n}}P_{${r}} = ${prodExpr(n, r).replace(/\*/g, '\\times ')}`, why: 'When positions are distinct, multiply the shrinking number of choices (no repeats).', ask: { prompt: `How many choices are there for first place?`, answer: numberAnswer(n), verify: { type: 'evaluate', expr: `${n}` } } },
        { key: 'multiply-shrinking', instruction: 'Multiply the choices, reducing by one each time.', math: `${prodExpr(n, r).replace(/\*/g, '\\times ')} = ${value}`, why: 'After one runner is placed, one fewer remains.', ask: { prompt: 'How many ways?', answer, verify: { type: 'evaluate', expr: permExpr(n, r) } } },
      ],
      misconceptions: distinctMisconceptions(answer, [wrongNumber('combination-for-permutation', () => comb(n, r))]),
      verify: { type: 'evaluate', expr: permExpr(n, r) },
    };
  }
  if (form === 2) {
    const n = rng.int(4, 7);
    const value = fact(n);
    const answer = numberAnswer(value);
    return {
      params: { form, n, r: 0 },
      prompt: `In how many different orders can ${n} different books be arranged on a shelf?`,
      answer,
      steps: [
        { key: 'order-matters', instruction: 'Every position on the shelf is different, so order matters and nothing repeats.', math: `${n}! = ${prodExpr(n, n).replace(/\*/g, '\\times ')}`, why: 'Arranging n different items: n! orderings.', ask: { prompt: 'How many books can go in the first spot?', answer: numberAnswer(n), verify: { type: 'evaluate', expr: `${n}` } } },
        { key: 'multiply-shrinking', instruction: 'Multiply down to 1.', math: `${n}! = ${value}`, why: 'Each spot has one fewer choice than the last.', ask: { prompt: 'How many arrangements?', answer, verify: { type: 'evaluate', expr: `(${prodExpr(n, n)})` } } },
      ],
      misconceptions: [],
      verify: { type: 'evaluate', expr: `(${prodExpr(n, n)})` },
    };
  }
  // form 3: select all expressions equal to C(n, r)
  for (;;) {
    const n = rng.int(5, 10);
    const r = rng.int(2, 4);
    const target = comb(n, r);
    const P = `{}_{${n}}P_{${r}}`;
    const uniq: Cand[] = [
      { label: `$\\binom{${n}}{${n - r}}$`, value: comb(n, n - r) },
      { label: `$\\frac{${P}}{${r}!}$`, value: perm(n, r) / fact(r) },
      { label: `$\\binom{${n}}{${r - 1}}$`, value: comb(n, r - 1) },
      { label: `$\\binom{${n + 1}}{${r}}$`, value: comb(n + 1, r) },
      { label: `$\\frac{${P}}{${r}}$`, value: perm(n, r) / r },
      { label: `$\\binom{${n}}{${r + 1}}$`, value: comb(n, r + 1) },
      { label: `$${P}$`, value: perm(n, r) },
    ];
    const picked = rng.shuffle(uniq).slice(0, 5);
    const good = picked.filter((c) => c.value === target);
    if (good.length < 1 || good.length > 3) continue;
    const options: ChoiceOption[] = picked.map((c, i) => ({ id: `o${i}`, label: c.label }));
    const correct = options.filter((_, i) => picked[i].value === target).map((o) => o.id);
    const answer = multiAnswer(options, correct);
    const permOpt = options.find((o) => o.label === `$${P}$`);
    return {
      params: { form, n, r },
      prompt: `Which of the following are equal to $\\binom{${n}}{${r}}$? Select all that apply.`,
      answer,
      steps: [
        { key: 'value-first', instruction: `Compute the target value first.`, math: `\\binom{${n}}{${r}} = \\frac{${perm(n, r)}}{${fact(r)}} = ${target}`, why: 'Evaluate the target once, then test each option against it. Remember the symmetry C(n, r) = C(n, n − r).', ask: { prompt: `What is $\\binom{${n}}{${r}}$?`, answer: numberAnswer(target), verify: { type: 'evaluate', expr: combExpr(n, r) } } },
        { key: 'test-each', instruction: 'Evaluate every option and keep the ones equal to the target.', math: picked.map((c) => `${c.label.replace(/\$/g, '')} = ${c.value}`).join(',\\quad '), why: 'Select-all needs every correct option and no wrong ones.', ask: { prompt: `Select all that equal $\\binom{${n}}{${r}}$.`, answer } },
      ],
      misconceptions: distinctMisconceptions(answer, permOpt ? [{ id: 'permutation-for-combination', wrong: multiAnswer(options, [...correct, permOpt.id]) }] : []),
      verify: { type: 'choice', note: 'tests/skills/gre-counting-probability.test.ts evaluates every option' },
    };
  }
}

// ---------- level 3: probability (numeric fraction or multiple choice) ----------

function level3(rng: Rng): Body {
  for (;;) {
    const form = rng.int(0, 2);
    const fmt = rng.chance(0.4) ? 1 : 0; // 1 = multiple choice
    let a = 0, b = 0, c = 0, d = 0, k = 0;
    let prompt: string, value: Q, expr: string;
    let mistakes: [string, Q][];
    let steps: Omit<Step, 'ask'>[];
    let askA: StepAsk;
    if (form === 0) {
      a = rng.int(2, 9);
      b = rng.int(2, 9);
      c = rng.int(2, 9);
      const total = a + b + c;
      value = new Q(b + c, total);
      expr = `(${b}+${c})/${total}`;
      prompt = `A bag holds ${a} red, ${b} blue and ${c} green marbles. One marble is drawn at random. What is the probability that it is NOT red?`;
      mistakes = [['probability-odds', new Q(b + c, a)]];
      steps = [{ key: 'total-outcomes', instruction: 'Count all equally likely outcomes.', math: `${a} + ${b} + ${c} = ${total}`, why: 'Probability = favorable ÷ total.' }, { key: 'favorable', instruction: 'Count the favorable outcomes (blue or green).', math: `\\frac{${b + c}}{${total}} = ${value.toLatex()}`, why: 'Not red = blue or green; or compute 1 − P(red).' }];
      askA = { prompt: 'How many marbles are in the bag?', answer: numberAnswer(total), verify: { type: 'evaluate', expr: `${a}+${b}+${c}` } };
    } else if (form === 1) {
      b = rng.int(3, 9);
      a = rng.int(1, b - 1);
      d = rng.int(3, 9);
      c = rng.int(1, d - 1);
      value = new Q(a, b).mul(new Q(c, d));
      expr = `(${a}/${b})*(${c}/${d})`;
      prompt = `Bag 1 has ${a} red marbles out of ${b} marbles. Bag 2 has ${c} red marbles out of ${d} marbles. One marble is drawn at random from each bag. What is the probability that both are red?`;
      mistakes = [['added-independent-probabilities', new Q(a, b).add(new Q(c, d))]];
      steps = [{ key: 'single-probs', instruction: 'Find each probability on its own.', math: `P_1 = \\frac{${a}}{${b}},\\quad P_2 = \\frac{${c}}{${d}}`, why: 'The two draws do not affect each other: they are independent.' }, { key: 'multiply-independent', instruction: 'Both happen ("and"): multiply.', math: `\\frac{${a}}{${b}}\\cdot\\frac{${c}}{${d}} = ${value.toLatex()}`, why: 'Independent "and" multiplies; adding is for "or" of mutually exclusive events.' }];
      askA = { prompt: 'What is the probability of red from Bag 1?', answer: numberAnswer(new Q(a, b)), verify: { type: 'evaluate', expr: `${a}/${b}` } };
    } else {
      a = rng.int(4, 6);
      k = rng.int(2, 3);
      value = new Q(1).sub(new Q(a - 1, a).mul(new Q(a - 1, a)).mul(k === 3 ? new Q(a - 1, a) : 1));
      expr = `1-((${a}-1)/${a})^${k}`;
      prompt = `A fair ${a}-sided die (faces 1 through ${a}) is rolled ${k} times. What is the probability that at least one roll shows a 1?`;
      mistakes = [['at-least-one-direct', new Q(k, a)]];
      steps = [{ key: 'complement', instruction: '"At least one" is easiest as 1 − P(none).', math: `P(\\text{no 1 on a roll}) = \\frac{${a - 1}}{${a}}`, why: 'The only way to fail is to get NO 1s, which is a single product.' }, { key: 'one-minus-none', instruction: `Raise to the power ${k} and subtract from 1.`, math: `1 - \\left(\\frac{${a - 1}}{${a}}\\right)^{${k}} = ${value.toLatex()}`, why: 'Adding single-roll probabilities double counts rolls where several show a 1.' }];
      askA = { prompt: 'What is the probability that one roll is NOT a 1?', answer: numberAnswer(new Q(a - 1, a)), verify: { type: 'evaluate', expr: `(${a}-1)/${a}` } };
    }
    // Answer format.
    let answer: AnswerSpec;
    const mis: MisconceptionInstance[] = [];
    if (fmt === 0) {
      answer = numberAnswer(value);
      for (const [id, v] of mistakes) mis.push({ id, wrong: numberAnswer(v) });
    } else {
      const set: Q[] = [value];
      const push = (q: Q) => {
        if (q.sign() > 0 && q.sub(1).sign() <= 0 && !set.some((s) => s.eq(q))) set.push(q);
      };
      mistakes.forEach(([, v]) => push(v));
      push(new Q(1).sub(value));
      push(value.mul(new Q(1, 2)));
      push(value.mul(2));
      for (let i = 1; set.length < 5 && i <= value.d + 5; i++) push(new Q(i, value.d));
      if (set.length < 5) continue;
      const sorted = set.slice(0, 5).sort((x, y) => x.sub(y).sign());
      const options: ChoiceOption[] = sorted.map((q, i) => ({ id: `o${i}`, label: `$${q.toLatex()}$` }));
      const idOf = (q: Q) => options[sorted.findIndex((s) => s.eq(q))]?.id;
      answer = choiceAnswer(options, idOf(value));
      for (const [id, v] of mistakes) {
        const oid = idOf(v);
        if (oid) mis.push({ id, wrong: choiceAnswer(options, oid) });
      }
    }
    const verify = fmt === 0 ? ({ type: 'evaluate', expr } as const) : ({ type: 'choice', note: 'tests/skills/gre-counting-probability.test.ts recomputes the probability from the params' } as const);
    return {
      params: { form, fmt, a, b, c, d, k },
      prompt: prompt + (fmt === 1 ? ' Choose the correct value.' : ' Give your answer as a fraction.'),
      answer,
      steps: [
        { ...steps[0], ask: askA },
        { ...steps[1], ask: { prompt: 'What is the probability?', answer, ...(fmt === 0 ? { verify: { type: 'evaluate' as const, expr } } : {}) } },
      ],
      misconceptions: distinctMisconceptions(answer, mis),
      verify,
    };
  }
}

// ---------- level 4: Venn diagrams (numeric, with a table) ----------

function level4(rng: Rng): Body {
  const form = rng.int(0, 2);
  const onlyA = rng.int(3, 25);
  const onlyB = rng.int(3, 25);
  const both = rng.int(3, 20);
  const neither = rng.int(2, 15);
  const N = onlyA + onlyB + both + neither;
  const A = onlyA + both;
  const B = onlyB + both;
  const rows: (string | number)[][] = [['All students surveyed', N], ['Play chess', A], ['Play checkers', B]];
  let prompt: string, value: number, expr: string, wrong: [string, number][], steps: Step[];
  if (form === 0) {
    rows.push(['Play both games', both]);
    value = neither;
    expr = `${N}-(${A}+${B}-${both})`;
    prompt = `Of ${N} students surveyed, ${A} play chess, ${B} play checkers and ${both} play both (see the table). How many students play neither game?`;
    wrong = [['venn-double-count', N - (A + B)]];
    steps = [
      { key: 'union', instruction: 'Count students who play at least one game, without double counting.', math: `${A} + ${B} - ${both} = ${A + B - both}`, why: 'Adding the two groups counts the students in both circles twice; subtract the overlap once.', ask: { prompt: 'How many students play at least one game?', answer: numberAnswer(A + B - both), verify: { type: 'evaluate', expr: `${A}+${B}-${both}` } } },
      { key: 'complement', instruction: 'Subtract from the total.', math: `${N} - ${A + B - both} = ${neither}`, why: 'Neither = total − (at least one).', ask: { prompt: 'How many play neither game?', answer: numberAnswer(neither), verify: { type: 'evaluate', expr } } },
    ];
  } else if (form === 1) {
    rows.push(['Play neither game', neither]);
    value = both;
    expr = `${A}+${B}-(${N}-${neither})`;
    prompt = `Of ${N} students surveyed, ${A} play chess, ${B} play checkers and ${neither} play neither (see the table). How many students play both games?`;
    wrong = [];
    steps = [
      { key: 'union', instruction: 'First count students who play at least one game.', math: `${N} - ${neither} = ${N - neither}`, why: 'At least one = total − neither.', ask: { prompt: 'How many students play at least one game?', answer: numberAnswer(N - neither), verify: { type: 'evaluate', expr: `${N}-${neither}` } } },
      { key: 'overlap', instruction: 'The overlap is how much A + B exceeds that union.', math: `${A} + ${B} - ${N - neither} = ${both}`, why: 'Both = A + B − (at least one): the overlap is exactly what A + B double counts.', ask: { prompt: 'How many play both games?', answer: numberAnswer(both), verify: { type: 'evaluate', expr } } },
    ];
  } else {
    rows.push(['Play neither game', neither]);
    value = onlyA + onlyB;
    expr = `${A}+${B}-2*(${A}+${B}-(${N}-${neither}))`;
    prompt = `Of ${N} students surveyed, ${A} play chess, ${B} play checkers and ${neither} play neither (see the table). How many students play exactly one of the two games?`;
    wrong = [['venn-double-count', A + B]];
    steps = [
      { key: 'overlap', instruction: 'Find the overlap, then remove it from both circles.', math: `\\text{both} = ${A} + ${B} - ${N - neither} = ${both}`, why: 'A + B counts each student in both games twice.', ask: { prompt: 'How many play both games?', answer: numberAnswer(both), verify: { type: 'evaluate', expr: `${A}+${B}-(${N}-${neither})` } } },
      { key: 'exactly-one', instruction: 'Exactly one = A + B − 2·(both).', math: `${A} + ${B} - 2(${both}) = ${value}`, why: 'Students in both are removed twice: once from each circle count.', ask: { prompt: 'How many play exactly one game?', answer: numberAnswer(value), verify: { type: 'evaluate', expr } } },
    ];
  }
  const answer = numberAnswer(value);
  return {
    params: { form, N, A, B, both, neither },
    prompt,
    figure: tableFigure('Club survey results', ['Group', 'Number of students'], rows),
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, wrong.map(([id, v]) => wrongNumber(id, () => v))),
    verify: { type: 'evaluate', expr },
  };
}

// ---------- level 5: QC with combinations ----------

function level5(rng: Rng): Body {
  const form = (rng.chance(0.15) ? 3 : rng.int(0, 2));
  const base = { n: 0, k: 0, lo: 0, hi: 0, g: 0 };
  if (form === 3) {
    const g = rng.int(0, 1);
    const lo = g === 0 ? rng.int(4, 6) : rng.int(2, 5);
    const hi = lo + rng.int(1, 4);
    const f = (n: number): [number, number] => (g === 0 ? [comb(n, 2), comb(n, n - 2)] : [n, comb(n, 2)]);
    const cases: [number, number][] = [];
    for (let n = lo; n <= hi; n++) cases.push(f(n));
    const relation = relOver(cases);
    const answer = qcAnswer(relation);
    const qa = g === 0 ? '$\\binom{n}{2}$' : '$\\binom{n}{1}$';
    const qb = g === 0 ? '$\\binom{n}{n-2}$' : '$\\binom{n}{2}$';
    return {
      params: { ...base, form, g, lo, hi },
      prompt: QC_PROMPT(`$n$ is an integer and $${lo} \\le n \\le ${hi}$.`, qa, qb),
      answer,
      steps: [
        { key: 'test-values', instruction: 'There are only a few allowed values of n. Evaluate both quantities at each.', math: cases.map(([x, y], i) => `n=${lo + i}: ${x}\\text{ vs }${y}`).join(',\\quad '), why: 'For A, B or C the relationship must hold for EVERY allowed n; one disagreement means D.', ask: { prompt: `What is Quantity A minus Quantity B when $n = ${lo}$?`, answer: numberAnswer(cases[0][0] - cases[0][1]), verify: { type: 'evaluate', expr: `${cases[0][0]}-${cases[0][1]}` } } },
        { key: 'decide', instruction: relation === 'd' ? 'Different values of n give different relationships.' : 'Every allowed n gives the same relationship.', math: relation === 'd' ? '\\text{cannot be determined}' : relation === 'a' ? 'A > B' : relation === 'b' ? 'B > A' : 'A = B', why: 'Combinations are symmetric: C(n, r) = C(n, n − r).', ask: { prompt: 'So which is it?', answer } },
      ],
      misconceptions: relation === 'd' ? distinctMisconceptions(answer, [{ id: 'tested-one-case', wrong: qcAnswer(rel(...cases[0])) }]) : [],
      verify: {
        type: 'qc',
        quantityA: g === 0 ? 'combinations(n,2)' : 'combinations(n,1)',
        quantityB: g === 0 ? 'combinations(n,n-2)' : 'combinations(n,2)',
        variables: [{ name: 'n', min: lo, max: hi, integer: true }],
        constraints: [],
      },
    };
  }
  let n: number, k: number, A: number, B: number, qa: string, qb: string, ea: string, eb: string, why: string, wrongRel: QcRelation | null = null;
  if (form === 0) {
    n = rng.int(6, 12);
    k = rng.int(2, n - 2);
    if (n === 2 * k) k = k - 1;
    A = comb(n, k);
    B = comb(n, n - k);
    qa = `$\\binom{${n}}{${k}}$`;
    qb = `$\\binom{${n}}{${n - k}}$`;
    ea = `combinations(${n},${k})`;
    eb = `combinations(${n},${n - k})`;
    why = 'Choosing k to include is the same as choosing n − k to leave out: C(n, k) = C(n, n − k).';
  } else if (form === 1) {
    n = rng.int(6, 12);
    k = rng.int(1, n - 2);
    A = comb(n, k);
    B = comb(n, k + 1);
    qa = `$\\binom{${n}}{${k}}$`;
    qb = `$\\binom{${n}}{${k + 1}}$`;
    ea = `combinations(${n},${k})`;
    eb = `combinations(${n},${k + 1})`;
    why = 'The row of combinations rises up to the middle and falls after it; do not assume bigger r means more ways.';
  } else {
    n = rng.int(5, 10);
    k = rng.int(2, 4);
    A = perm(n, k);
    B = comb(n, k);
    qa = `the number of ways to choose and arrange ${k} of ${n} people in a line`;
    qb = `the number of ways to choose a ${k}-person committee from ${n} people`;
    ea = `permutations(${n},${k})`;
    eb = `combinations(${n},${k})`;
    why = 'The ordered count is the unordered count times k!, which is more than 1 for k ≥ 2.';
    wrongRel = 'c';
  }
  if (rng.chance(0.5) && form !== 0) {
    [A, B] = [B, A];
    [qa, qb] = [qb, qa];
    [ea, eb] = [eb, ea];
    if (wrongRel) wrongRel = 'c';
  }
  const relation = rel(A, B);
  const answer = qcAnswer(relation);
  return {
    params: { ...base, form, n, k },
    prompt: QC_PROMPT('', qa, qb),
    answer,
    steps: [
      { key: 'value-a', instruction: 'Compute Quantity A.', math: `A = ${A}`, why, ask: { prompt: 'What is Quantity A?', answer: numberAnswer(A), verify: { type: 'evaluate', expr: ea.startsWith('perm') ? permExpr(n, k) : ea.startsWith('comb') ? combExprFromCall(ea) : '0' } } },
      { key: 'value-b', instruction: 'Compute Quantity B.', math: `B = ${B}`, why: 'With no variables, the relationship is always determined (never D).', ask: { prompt: 'What is Quantity B?', answer: numberAnswer(B), verify: { type: 'evaluate', expr: eb.startsWith('perm') ? permExpr(n, k) : combExprFromCall(eb) } } },
      { key: 'decide', instruction: 'Compare.', math: `${A} \\text{ vs } ${B}`, why: 'Look for symmetry or an ordering shortcut before multiplying anything out.', ask: { prompt: 'So which is it?', answer } },
    ],
    misconceptions: distinctMisconceptions(answer, wrongRel ? [{ id: 'permutation-for-combination', wrong: qcAnswer(wrongRel) }] : []),
    verify: { type: 'qc', quantityA: ea, quantityB: eb, variables: [], constraints: [] },
  };
}

/** "combinations(7,3)" → a plain product expression SymPy can read. */
function combExprFromCall(call: string): string {
  const [n, k] = call.replace(/^combinations\(|\)$/g, '').split(',').map(Number);
  return combExpr(n, k);
}

export const greCountingProbability: SkillDefinition = {
  id: ID,
  title: 'Counting & probability',
  track: 'gre',
  unit: 'GRE · Data analysis',
  description: 'The counting principle, permutations vs combinations, simple and compound probability, and Venn diagrams.',
  prerequisites: ['gre-integers'],
  maxDenominator: 216,
  levels: {
    1: { description: 'Fundamental counting principle', ranges: { form: [0, 2], a: [2, 8], b: [2, 8], c: [0, 6] } },
    2: { description: 'Permutations, combinations and select-all', ranges: { form: [0, 3], n: [4, 10], r: [0, 4] } },
    3: { description: 'Probability (numeric or multiple choice)', ranges: { form: [0, 2], fmt: [0, 1], a: [0, 9], b: [0, 9], c: [0, 9], d: [0, 9], k: [0, 3] } },
    4: { description: 'Venn diagrams', ranges: { form: [0, 2], N: [12, 100], A: [6, 60], B: [6, 60], both: [3, 20], neither: [2, 15] } },
    5: { description: 'Quantitative comparison with combinations', ranges: { form: [0, 3], n: [0, 12], k: [0, 10], lo: [0, 6], hi: [0, 10], g: [0, 1] } },
  },
  misconceptions: {
    'permutation-for-combination': { name: 'Counted order when it did not matter', explanation: 'If swapping two chosen items gives the same outcome (a committee, a hand of cards), divide the ordered count by $r!$: use $\\binom{n}{r}$, not $_nP_r$.' },
    'combination-for-permutation': { name: 'Ignored order when it mattered', explanation: 'When positions are different (first, second, third place), swapping two people gives a different outcome, so multiply the shrinking choices instead of dividing by $r!$.' },
    'counting-added': { name: 'Added the choices instead of multiplying', explanation: 'Independent choices multiply: 3 shirts and 4 pants make $3 \\times 4 = 12$ outfits, not 7. Add only when you pick ONE thing from separate lists ("or").' },
    'forgot-skip-option': { name: 'Forgot that "none" is a choice', explanation: 'If a slot may be left empty, "none" counts as one more option. Dessert from 3 flavors or none is 4 choices, not 3.' },
    'added-independent-probabilities': { name: 'Added probabilities for "and"', explanation: 'For independent events, "A and B" multiplies: $P(A)P(B)$. Adding would even exceed 1 for likely events.' },
    'at-least-one-direct': { name: 'Summed the single-trial probabilities', explanation: 'Adding $P$ for each trial double counts outcomes where several succeed. Use $1 - P(\\text{none})$.' },
    'venn-double-count': { name: 'Counted the overlap twice', explanation: 'Adding the two group sizes counts everyone in both groups twice. Subtract the overlap once: $|A \\cup B| = |A| + |B| - |A \\cap B|$.' },
    'probability-odds': { name: 'Divided favorable by unfavorable', explanation: 'Probability is favorable ÷ TOTAL outcomes, not favorable ÷ unfavorable (that is odds).' },
    'tested-one-case': { name: 'Decided from a single test case', explanation: 'For A, B or C the relationship must hold for EVERY allowed value. If two allowed values disagree, the answer is D.' },
  },
  stepLabels: {
    'choices-per-slot': 'Count the choices per slot',
    multiply: 'Multiply the choices',
    'order-matters': 'Does order matter?',
    'divide-orderings': 'Divide by the orderings',
    'multiply-shrinking': 'Multiply the shrinking choices',
    'value-first': 'Evaluate the target',
    'test-each': 'Test each option',
    'total-outcomes': 'Count the total outcomes',
    favorable: 'Count the favorable outcomes',
    'single-probs': 'Find each single probability',
    'multiply-independent': 'Multiply independent events',
    complement: 'Use the complement',
    'one-minus-none': 'One minus none',
    union: 'Count at least one',
    overlap: 'Find the overlap',
    'exactly-one': 'Count exactly one',
    'test-values': 'Try the allowed values',
    'value-a': 'Compute Quantity A',
    'value-b': 'Compute Quantity B',
    decide: 'Decide the relationship',
  },
  learn: {
    whyItMatters:
      'Counting and probability questions reward choosing the right model: multiply for independent choices, divide by $r!$ when order does not matter, and use "1 minus none" for "at least one". In economics, probability is the language of risk: a gamble paying \\$100 with probability 1/4 and \\$0 otherwise has expected value $\\frac14 \\cdot 100 = 25$, which is what a risk-neutral person would pay for it. Counting also shows up in game theory, where the number of strategy profiles is a product of each player\'s choices.',
    summary:
      'Independent choices multiply (the counting principle). Order matters: $_nP_r = n(n-1)\\cdots(n-r+1)$; order does not: $\\binom{n}{r} = \\frac{_nP_r}{r!}$, with $\\binom{n}{r} = \\binom{n}{n-r}$. Probability is favorable ÷ total; independent "and" multiplies; "at least one" is 1 − P(none). For two overlapping groups, $|A \\cup B| = |A| + |B| - |A \\cap B|$.',
    formulas: [
      { latex: '\\binom{n}{r} = \\frac{n!}{r!\\,(n-r)!}' },
      { latex: '_nP_r = \\frac{n!}{(n-r)!}' },
      { latex: 'P(\\text{at least one}) = 1 - P(\\text{none})' },
      { latex: '|A \\cup B| = |A| + |B| - |A \\cap B|' },
    ],
    example: { seed: 2, level: 2 },
    tips: ['Ask: does swapping two chosen items give a different outcome? If yes, order matters.', 'In a QC with combinations, look for the symmetry C(n, r) = C(n, n − r) before computing.'],
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
