// Linear inequalities (math). The final answer is a choice among four solution sets built from
// (relation, boundary) pairs: the correct one, the sets each named mistake would give, and fillers.
// Relation codes: 0 '<', 1 '>', 2 '≤', 3 '≥'. Level 5 is the compound form c1 ⊏ ax + b ⊏ c2.

import { numberAnswer } from '../../engine/answers';
import { coefLatex, linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type {
  AnswerSpec,
  ChoiceOption,
  InterpretationQuestion,
  Level,
  MisconceptionInstance,
  SkillDefinition,
  Step,
} from '../../engine/types';

const ID = 'linear-inequalities';

const REL = ['<', '>', '\\le', '\\ge'] as const;
const flipRel = (r: number) => [1, 0, 3, 2][r];
const strictToggle = (r: number) => [2, 3, 0, 1][r];
/** Compound strictness: 0 '<', 1 '≤'. */
const CREL = ['<', '\\le'] as const;

// ---------- solution-set options ----------

interface Opt {
  key: string; // identity of the set (relation + boundary), used for deduplication
  label: string;
}
const single = (rel: number, v: Q): Opt => ({ key: `s|${rel}|${v.toString()}`, label: `$x ${REL[rel]} ${v.toLatex()}$` });
/** lo ⊏ x ⊏ hi with strictness codes 0 ('<') / 1 ('≤'). */
const compound = (lo: Q, loS: number, hi: Q, hiS: number): Opt => ({
  key: `c|${lo.toString()}|${loS}|${hi.toString()}|${hiS}`,
  label: `$${lo.toLatex()} ${CREL[loS]} x ${CREL[hiS]} ${hi.toLatex()}$`,
});

/**
 * Four distinct options: the correct set first, then up to three named mistakes, then fillers.
 * Returns the options (shuffled) and, for each named mistake, the id of its option (null if it
 * duplicated an earlier set, or was the correct set).
 */
function buildChoice(
  rng: Rng,
  correct: Opt,
  named: { id: string; opt: Opt | null }[],
  fillers: Opt[],
): { answer: AnswerSpec; mis: MisconceptionInstance[] } {
  const chosen: { opt: Opt; id?: string }[] = [{ opt: correct }];
  const has = (o: Opt) => chosen.some((c) => c.opt.key === o.key);
  for (const n of named) {
    if (!n.opt || has(n.opt) || chosen.length >= 4) continue;
    chosen.push({ opt: n.opt, id: n.id });
  }
  for (const f of fillers) {
    if (chosen.length >= 4) break;
    if (!has(f)) chosen.push({ opt: f });
  }
  if (chosen.length < 4) throw new Error(`${ID}: could not build four options`);
  const order = rng.shuffle(chosen);
  const options: ChoiceOption[] = order.map((c, i) => ({ id: `o${i}`, label: c.opt.label }));
  const idOfKey = (key: string) => options[order.findIndex((c) => c.opt.key === key)].id;
  const answer: AnswerSpec = { kind: 'choice', options, correct: idOfKey(correct.key) };
  const mis: MisconceptionInstance[] = chosen
    .filter((c) => c.id)
    .map((c) => ({ id: c.id!, wrong: { kind: 'choice', options, correct: idOfKey(c.opt.key) } }));
  return { answer, mis };
}

// ---------- problem set-up ----------

interface Built {
  params: Record<string, number>;
  rel: number;
  /** Left side as shown, and in mathjs syntax. */
  leftLatex: string;
  leftExpr: string;
  rightLatex: string;
  rightExpr: string;
  /** After expanding: A x + B ⊏ C x + D. */
  A: number;
  B: number;
  C: number;
  D: number;
  expand: boolean;
}

function pick(rng: Rng, level: Level): Built {
  for (;;) {
    const rel = rng.int(0, 3);
    switch (level) {
      case 1:
      case 2: {
        const a = level === 1 ? rng.int(2, 9) : rng.int(-9, -2);
        const t = rng.int(-10, 10);
        const b = rng.nonzero(-20, 20);
        const c = a * t + b;
        return {
          params: { a, b, c, t, rel },
          rel,
          leftLatex: linLatex(a, b),
          leftExpr: `${a}*x + (${b})`,
          rightLatex: `${c}`,
          rightExpr: `(${c})`,
          A: a, B: b, C: 0, D: c, expand: false,
        };
      }
      case 3: {
        const a = rng.nonzero(-9, 9);
        const c = rng.nonzero(-9, 9);
        if (a === c) continue;
        const t = rng.int(-10, 10);
        const b = rng.nonzero(-20, 20);
        const d = a * t + b - c * t;
        return {
          params: { a, b, c, d, t, rel },
          rel,
          leftLatex: linLatex(a, b),
          leftExpr: `${a}*x + (${b})`,
          rightLatex: linLatex(c, d),
          rightExpr: `${c}*x + (${d})`,
          A: a, B: b, C: c, D: d, expand: false,
        };
      }
      case 4: {
        const a = rng.nonzero(-9, 9);
        if (Math.abs(a) === 1) continue;
        const b = rng.nonzero(-9, 9);
        const c = rng.nonzero(-9, 9);
        if (c === a) continue;
        const d = rng.int(-40, 40);
        const t = q(d - a * b, a - c);
        if (t.d > 6 || Math.abs(t.valueOf()) > 25) continue;
        return {
          params: { a, b, c, d, rel },
          rel,
          leftLatex: `${a}(${linLatex(1, b)})`,
          leftExpr: `${a}*(x + (${b}))`,
          rightLatex: linLatex(c, d),
          rightExpr: `${c}*x + (${d})`,
          A: a, B: a * b, C: c, D: d, expand: true,
        };
      }
      default:
        throw new Error('level 5 has its own builder');
    }
  }
}

// ---------- interpretation: break-even framing (levels 1 and 4) ----------

const holds = (rel: number, l: Q, r: Q): boolean => {
  const s = l.sub(r).sign();
  return rel === 0 ? s < 0 : rel === 1 ? s > 0 : rel === 2 ? s <= 0 : s >= 0;
};

function profitQuestion(rng: Rng, b: Built, solutionLatex: string, boundary: number): InterpretationQuestion | null {
  const at = (n: number) => ({ l: q(b.A * n + b.B), r: q(b.C * n + b.D) });
  const sat: number[] = [];
  const unsat: number[] = [];
  for (let n = 0; n <= 40; n++) (holds(b.rel, at(n).l, at(n).r) ? sat : unsat).push(n);
  if (sat.length === 0 || unsat.length < 3) return null;
  const nearest = (xs: number[], k: number) => [...xs].sort((u, v) => Math.abs(u - boundary) - Math.abs(v - boundary)).slice(0, k);
  const good = rng.pick(nearest(sat, 4));
  const bad = rng.shuffle(nearest(unsat, 6)).slice(0, 3);
  const order = rng.shuffle([good, ...bad]);
  const options: ChoiceOption[] = order.map((n, i) => ({ id: `o${i}`, label: `$${n}$ units` }));
  const { l, r } = at(good);
  const ineq = `${b.leftLatex} ${REL[b.rel]} ${b.rightLatex}`;
  return {
    prompt: `A firm earns a profit exactly when $${ineq}$, where $x$ is the number of units it sells. Which quantity earns a profit?`,
    options,
    correct: options[order.indexOf(good)].id,
    explanation: `Solving gives $${solutionLatex}$. Check $x = ${good}$: the left side is $${l.toLatex()}$ and the right side is $${r.toLatex()}$, so $${l.toLatex()} ${REL[b.rel]} ${r.toLatex()}$ is true. The other quantities fall on the wrong side of the break-even point, so they fail the inequality.`,
  };
}

// ---------- the skill ----------

export const linearInequalities: SkillDefinition = {
  id: ID,
  title: 'Linear inequalities',
  track: 'math',
  unit: 'Linear equations & systems',
  description: 'Solve inequalities like 3 − 2x ≥ 9 and know when the sign flips.',
  prerequisites: ['linear-equations'],
  maxDenominator: 6,
  levels: {
    1: {
      description: 'Two-step, positive coefficient: ax + b < c',
      ranges: { a: [2, 9], b: [-20, 20], c: [-110, 110], t: [-10, 10], rel: [0, 3] },
    },
    2: {
      description: 'Negative coefficient: the sign flips',
      ranges: { a: [-9, -2], b: [-20, 20], c: [-110, 110], t: [-10, 10], rel: [0, 3] },
    },
    3: {
      description: 'x on both sides',
      ranges: { a: [-9, 9], b: [-20, 20], c: [-9, 9], d: [-200, 200], t: [-10, 10], rel: [0, 3] },
    },
    4: {
      description: 'Parentheses, fractional boundaries',
      ranges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-40, 40], rel: [0, 3] },
    },
    5: {
      description: 'Compound: c₁ < ax + b ≤ c₂',
      ranges: { a: [-6, 6], b: [-10, 10], c1: [-60, 60], c2: [-60, 60], rel: [0, 3] },
    },
  },
  misconceptions: {
    'no-flip': {
      name: "Didn't flip the sign when dividing by a negative",
      explanation:
        'Multiplying or dividing both sides of an inequality by a negative number reverses it: $-2x > 6$ gives $x < -3$, not $x > -3$. Check by testing a number from your answer in the original inequality.',
    },
    'flip-positive': {
      name: 'Flipped the sign when dividing by a positive',
      explanation:
        'Only a negative divisor flips the sign. Look at the coefficient you actually divide by after collecting terms, not at the coefficients you started with: if $-3x > -9$ becomes $3x < 9$ (after moving terms), you divide by $+3$ and the sign stays.',
    },
    'sign-constant': {
      name: 'Moved a number without changing its sign',
      explanation:
        'Moving a term across the inequality sign is subtracting it (or adding it) on both sides, so its sign changes. From $3x + 4 < 10$ you get $3x < 6$, not $3x < 14$.',
    },
    'compound-one-side': {
      name: 'Subtracted from only one part of the compound inequality',
      explanation:
        'In $c_1 < ax + b \\le c_2$, whatever you do to the middle you must do to all three parts. Subtract $b$ from the left and right parts too, then divide all three by $a$.',
    },
  },
  stepLabels: {
    expand: 'Expand the parentheses',
    collect: 'Collect x-terms and numbers',
    flip: 'Decide whether the sign flips',
    divide: 'Divide by the coefficient of x',
    answer: 'State the solution set',
    setup: 'Set up: write the situation as an expression',
    'setup-right': 'Set up the other side',
    'subtract-all': 'Subtract from all three parts',
    'divide-all': 'Divide all three parts',
  },
  learn: {
    whyItMatters:
      'Break-even and budget constraints are inequalities, not equations. A firm with revenue $12q$ and cost $300 + 7q$ earns a profit when $12q > 300 + 7q$, so $5q > 300$ and it needs more than 60 units. A budget $4x + 10y \\le 100$ is also an inequality: it says which bundles you can afford. Constraints like these appear in every optimization problem you will meet in micro theory.',
    summary:
      'Solve an inequality like an equation, with one new rule: multiplying or dividing both sides by a **negative** number reverses the sign. Collect x-terms on one side and numbers on the other, look at the sign of the coefficient you divide by, then write the solution set. A compound inequality $c_1 < ax + b \\le c_2$ is solved by doing every step to all three parts.',
    formulas: [
      { latex: 'ax < c \\;\\Rightarrow\\; x < \\tfrac{c}{a} \\quad (a > 0)', note: 'Dividing by a positive keeps the direction.' },
      { latex: 'ax < c \\;\\Rightarrow\\; x > \\tfrac{c}{a} \\quad (a < 0)', note: 'Dividing by a negative reverses it.' },
      { latex: 'c_1 < ax + b \\le c_2 \\;\\Rightarrow\\; c_1 - b < ax \\le c_2 - b', note: 'Subtract from all three parts.' },
    ],
    example: { seed: 7, level: 2 },
    tips: [
      'Check your answer: pick a number inside the solution set and plug it into the original inequality. It should be true. Then try a number outside; it should be false.',
      'The sign flips only when you divide by a negative number. Adding or subtracting never flips it.',
      'A strict sign ($<$, $>$) leaves the boundary out; $\\le$ and $\\ge$ include it. Dividing by a negative flips $<$ to $>$ and $\\le$ to $\\ge$ but never changes strictness.',
    ],
  },

  generate(rng, level) {
    return level === 5 ? level5(rng) : solveBuilt(rng, pick(rng, level), level, true);
  },

  story: {
    levels: [1, 2, 3],
    generate(rng, level) {
      const story = pickStory(rng, level);
      const body = solveBuilt(rng, story.built, level, false);
      return { ...body, prompt: story.prompt, steps: [...story.setup, ...body.steps] };
    },
  },
};

// ---------- levels 1-4 ----------

/** Steps, choices and misconceptions for a picked inequality (shared by plain and story problems). */
function solveBuilt(rng: Rng, b: Built, level: Level, withInterpretation: boolean) {
  const { rel, A, B, C, D } = b;
  const k = q(A - C);
  const r = q(D - B);
  const t = r.div(k);
  const relOut = k.sign() < 0 ? flipRel(rel) : rel;
  const ineq = `${b.leftLatex} ${REL[rel]} ${b.rightLatex}`;
  const boundaryEq = `${b.leftExpr} = ${b.rightExpr}`;
  const solutionLatex = `x ${REL[relOut]} ${t.toLatex()}`;
  const steps: Step[] = [];

  if (b.expand) {
    const expandedLatex = linLatex(A, B);
    steps.push({
      key: 'expand',
      instruction: 'Expand the parentheses.',
      math: `${b.leftLatex} = ${expandedLatex} \\;\\Rightarrow\\; ${expandedLatex} ${REL[rel]} ${b.rightLatex}`,
      why: 'Distributive property: $a(x + b) = ax + ab$. Multiply every term inside.',
      ask: {
        prompt: `Expand the left side, $${b.leftLatex}$. What do you get?`,
        answer: { kind: 'expression', value: `${A}*x + (${B})`, variables: ['x'], display: expandedLatex },
        verify: { type: 'equivalent', expr: b.leftExpr, variables: ['x'] },
      },
    });
  }

  const xTerm = (c: Q) => `${coefLatex(c)}x`;
  const moved = `${xTerm(q(A))} ${C < 0 ? '+' : '-'} ${xTerm(q(Math.abs(C)))} ${REL[rel]} ${D}${B < 0 ? ' +' : ' -'} ${Math.abs(B)}`;
  const kx = xTerm(k);
  steps.push({
    key: 'collect',
    instruction: C === 0 ? 'Move the constant to the right side.' : 'Move the x-terms to the left side and the numbers to the right side.',
    math: C === 0
      ? `${kx} ${REL[rel]} ${D} ${B < 0 ? '+' : '-'} ${Math.abs(B)} \\;\\Rightarrow\\; ${kx} ${REL[rel]} ${r.toLatex()}`
      :`${moved} \\;\\Rightarrow\\; ${kx} ${REL[rel]} ${r.toLatex()}`,
    why: 'Adding or subtracting the same thing on both sides never changes the direction of the inequality. A term changes sign when it crosses the sign.',
    ask: {
      prompt: `After collecting terms, $${kx} ${REL[rel]} \\;?$`,
      answer: numberAnswer(r),
      verify: { type: 'evaluate', expr: `${k.toExpr()}*${t.toExpr()}` },
    },
  });

  const flips = k.sign() < 0;
  steps.push({
    key: 'flip',
    instruction: flips
      ? `You divide by $${k.toLatex()}$, a negative number, so the inequality sign reverses.`
      : `You divide by $${k.toLatex()}$, a positive number, so the sign stays the same.`,
    math: flips ? `${REL[rel]} \\;\\longrightarrow\\; ${REL[relOut]}` : `${REL[rel]} \\;\\text{stays}\\; ${REL[rel]}`,
    why: 'Multiplying or dividing by a negative reverses the order of numbers ($2 < 5$ but $-2 > -5$), so the sign must reverse too.',
    ask: {
      prompt: `You divide by $${k.toLatex()}$. Does the inequality sign flip?`,
      answer: {
        kind: 'choice',
        options: [
          { id: 'yes', label: 'Yes, it flips' },
          { id: 'no', label: 'No, it stays' },
        ],
        correct: flips ? 'yes' : 'no',
      },
    },
  });

  steps.push({
    key: 'divide',
    instruction: k.eq(1) ? 'The x is already alone. Read off the boundary.' : `Divide both sides by $${k.toLatex()}$.`,
    math: k.eq(1) ? `x ${REL[relOut]} ${t.toLatex()}` : `x ${REL[relOut]} \\frac{${r.toLatex()}}{${k.toLatex()}} = ${t.toLatex()}`,
    why: 'Division undoes multiplication: if $kx = r$ is the boundary, then $x = \\frac{r}{k}$.',
    ask: {
      prompt: 'What is the boundary value of $x$ (where the two sides are equal)?',
      answer: numberAnswer(t),
      verify: { type: 'solve', equations: [boundaryEq], unknowns: ['x'] },
    },
  });

  // Options: the named mistakes first, fillers after.
  const correct = single(relOut, t);
  const wrongDir = single(flipRel(relOut), t);
  const signConst = single(relOut, r.add(2 * B).div(k));
  const named = [
    { id: flips ? 'no-flip' : 'flip-positive', opt: wrongDir },
    { id: 'sign-constant', opt: signConst },
  ];
  const fillers = [
    single(flipRel(relOut), r.add(2 * B).div(k)),
    single(strictToggle(relOut), t),
    single(relOut, t.add(1)),
    single(flipRel(relOut), t.add(1)),
    single(relOut, t.sub(1)),
    single(flipRel(relOut), t.sub(1)),
    single(relOut, t.neg()),
  ];
  const { answer, mis } = buildChoice(rng, correct, named, fillers);

  steps.push({
    key: 'answer',
    instruction: `Match $${solutionLatex}$ to one of the options.`,
    math: solutionLatex,
    why: 'Check by plugging a number from your set (and one outside it) into the original inequality.',
    ask: { prompt: 'Which is the solution set?', answer },
  });

  // Interpretation draws come last.
  let interpretation: InterpretationQuestion[] | undefined;
  if (withInterpretation && (level === 1 || level === 4) && rng.chance(0.5)) {
    const iq = profitQuestion(rng, b, solutionLatex, t.valueOf());
    if (iq) interpretation = [iq];
  }

  return {
    params: b.params,
    prompt: `Which of the following is the solution set of $$${ineq}$$`,
    answer,
    steps,
    misconceptions: distinctMisconceptions(answer, mis),
    interpretation,
    verify: { type: 'choice' as const, note: 'tests/skills/linear-inequalities.test.ts checks each option against the inequality on a grid' },
  };
}

// ---------- story variants: the same inequalities as situations ----------

const usd = (v: number) => `\\$${v}`;

/** A setup step: write one side of the situation as an expression in x (checked by equivalence). */
function setupStep(key: 'setup' | 'setup-right', prompt: string, latex: string, expr: string, why: string): Step {
  return {
    key,
    instruction: prompt,
    math: latex,
    why,
    ask: {
      prompt,
      answer: { kind: 'expression', value: expr, variables: ['x'], display: latex },
      verify: { type: 'equivalent', expr, variables: ['x'] },
    },
  };
}

interface Story {
  built: Built;
  prompt: string;
  setup: Step[];
}

/** Relation words (index = relation code 0 '<', 1 '>', 2 '≤', 3 '≥'). */
const LIMIT = ['fewer than', 'more than', 'at most', 'at least'];
const COMPARE = ['cheaper than', 'more expensive than', 'no more expensive than', 'at least as expensive as'];

/** Story params stay inside the level's ranges (positive prices, counts and totals). */
function pickStory(rng: Rng, level: Level): Story {
  const rel = rng.int(0, 3);

  if (level === 1) {
    // a·x + b ⊏ c with a fee or head start b > 0: a limit on spending (< or ≤) or a target to reach (> or ≥).
    const a = rng.int(2, 9);
    const t = rng.int(1, 10);
    const b = rng.int(1, 20);
    const c = a * t + b;
    const built: Built = {
      params: { a, b, c, t, rel },
      rel,
      leftLatex: linLatex(a, b),
      leftExpr: `${a}*x + (${b})`,
      rightLatex: `${c}`,
      rightExpr: `(${c})`,
      A: a, B: b, C: 0, D: c, expand: false,
    };
    const ctx = rng.int(0, 2);
    const setup = (prompt: string, why: string) => [setupStep('setup', prompt, built.leftLatex, built.leftExpr, why)];
    if (rel === 0 || rel === 2) {
      const limit = `${rel === 2 ? 'at most' : 'less than'} ${usd(c)}`;
      const k = [
        { intro: `A taxi charges a ${usd(b)} pickup fee plus ${usd(a)} per mile.`, unit: 'miles', total: 'cost of the ride' },
        { intro: `A print shop charges a ${usd(b)} setup fee plus ${usd(a)} per poster.`, unit: 'posters', total: 'bill' },
        { intro: `A bakery charges a ${usd(b)} delivery fee plus ${usd(a)} per box of pastries.`, unit: 'boxes', total: 'bill' },
      ][ctx];
      return {
        built,
        prompt: `${k.intro} You want the total ${k.total} to be ${limit}. Let $x$ be the number of ${k.unit}. Which of the following is the solution set for $x$?`,
        setup: setup(
          `Let $x$ be the number of ${k.unit}. Write the total ${k.total}, in dollars, in terms of $x$.`,
          'The fee is paid once and the price is paid per unit, so the total is the fee plus the price times $x$. The limit ("at most", "less than") goes on the other side of the sign.',
        ),
      };
    }
    const target = rel === 3 ? 'at least' : 'more than';
    const k = [
      {
        prompt: `You already have ${usd(b)} saved and add ${usd(a)} each week. You want to have ${target} ${usd(c)} for a trip. Let $x$ be the number of weeks. Which of the following is the solution set for $x$?`,
        ask: 'Let $x$ be the number of weeks. Write the total saved, in dollars, in terms of $x$.',
        why: 'You start with the amount already saved and add the weekly amount $x$ times.',
      },
      {
        prompt: `A quiz gives ${b} bonus points for handed-in homework plus ${a} points for each correct answer. To earn a badge you need ${target} ${c} points. Let $x$ be the number of correct answers. Which of the following is the solution set for $x$?`,
        ask: 'Let $x$ be the number of correct answers. Write the total points in terms of $x$.',
        why: 'The bonus is a fixed amount and each correct answer adds its points, so the total is the bonus plus the points per answer times $x$.',
      },
      {
        prompt: `A gym member has already logged ${b} workout minutes and adds ${a} minutes per session. A challenge needs ${target} ${c} minutes in total. Let $x$ be the number of sessions. Which of the following is the solution set for $x$?`,
        ask: 'Let $x$ be the number of sessions. Write the total minutes logged in terms of $x$.',
        why: 'Minutes already logged are fixed; each session adds the same amount, so add the per-session minutes times $x$.',
      },
    ][ctx];
    return { built, prompt: k.prompt, setup: setup(k.ask, k.why) };
  }

  if (level === 2) {
    // a·x + b ⊏ c with a < 0: something that starts at b and falls by |a| per unit, so dividing flips the sign.
    for (;;) {
      const a = -rng.int(2, 9);
      const b = rng.int(10, 20);
      const tMax = Math.floor((b - 1) / -a);
      if (tMax < 1) continue;
      const t = rng.int(1, tMax);
      const c = a * t + b;
      const built: Built = {
        params: { a, b, c, t, rel },
        rel,
        leftLatex: linLatex(a, b),
        leftExpr: `${a}*x + (${b})`,
        rightLatex: `${c}`,
        rightExpr: `(${c})`,
        A: a, B: b, C: 0, D: c, expand: false,
      };
      const m = -a;
      const limit = LIMIT[rel];
      const k = [
        {
          intro: `A water tank holds ${b} liters and drains ${m} liters every minute.`,
          unit: 'minutes of draining',
          left: 'liters in the tank',
          ask: `For which values of $x$ does the tank hold ${limit} ${c} liters?`,
          why: `The tank starts at ${b} liters and loses ${m} liters each minute, so subtract ${m} times $x$.`,
        },
        {
          intro: `A tablet has ${b} GB of free space, and each video you record uses ${m} GB.`,
          unit: 'videos recorded',
          left: 'free space, in GB',
          ask: `For which values of $x$ does the tablet have ${limit} ${c} GB free?`,
          why: `The free space starts at ${b} GB and each video takes ${m} GB away, so subtract ${m} times $x$.`,
        },
        {
          intro: `A shop starts the week with ${b} crates of fruit and sells ${m} crates every day.`,
          unit: 'days of selling',
          left: 'crates left',
          ask: `For which values of $x$ are there ${limit} ${c} crates left?`,
          why: `The stock starts at ${b} crates and falls by ${m} each day, so subtract ${m} times $x$.`,
        },
      ][rng.int(0, 2)];
      return {
        built,
        prompt: `${k.intro} Let $x$ be the number of ${k.unit}. ${k.ask} Which of the following is the solution set?`,
        setup: [setupStep('setup', `Let $x$ be the number of ${k.unit}. Write the ${k.left} in terms of $x$.`, built.leftLatex, built.leftExpr, k.why)],
      };
    }
  }

  // Level 3: A (a·x + b) against B (c·x + d), all prices positive. One number in the story doesn't
  // matter: ignoring it is part of the skill.
  for (;;) {
    const a = rng.int(1, 9);
    const c = rng.int(1, 9);
    if (a === c) continue;
    const t = rng.int(1, 10);
    const b = rng.int(1, 20);
    const d = b + (a - c) * t;
    if (d < 1) continue;
    const built: Built = {
      params: { a, b, c, d, t, rel },
      rel,
      leftLatex: linLatex(a, b),
      leftExpr: `${a}*x + (${b})`,
      rightLatex: linLatex(c, d),
      rightExpr: `${c}*x + (${d})`,
      A: a, B: b, C: c, D: d, expand: false,
    };
    const extra = rng.int(3, 14);
    const k = [
      {
        intro: `Gym A charges a ${usd(b)} joining fee plus ${usd(a)} per visit. Gym B charges a ${usd(d)} joining fee plus ${usd(c)} per visit. Both gyms are open ${extra} hours a day.`,
        ask: `Let $x$ be the number of visits. For which values of $x$ is gym A ${COMPARE[rel]} gym B?`,
        unit: 'visits',
        name: 'gym',
        ignored: `The ${extra} opening hours don't enter the cost.`,
      },
      {
        intro: `Print shop A charges a ${usd(b)} setup fee plus ${usd(a)} per poster. Print shop B charges a ${usd(d)} setup fee plus ${usd(c)} per poster. Both can deliver in ${extra} days.`,
        ask: `Let $x$ be the number of posters. For which values of $x$ is shop A ${COMPARE[rel]} shop B?`,
        unit: 'posters',
        name: 'print shop',
        ignored: `The ${extra}-day delivery time doesn't enter the cost.`,
      },
      {
        intro: `Phone plan A costs ${usd(b)} to activate plus ${usd(a)} per month. Plan B costs ${usd(d)} to activate plus ${usd(c)} per month. Your current contract ends in ${extra} months.`,
        ask: `Let $x$ be the number of months you keep the plan. For which values of $x$ is plan A ${COMPARE[rel]} plan B?`,
        unit: 'months',
        name: 'plan',
        ignored: `The ${extra} months left on your current contract don't enter the cost.`,
      },
    ][rng.int(0, 2)];
    const why = `Each total is the one-time fee plus the price times $x$. ${k.ignored}`;
    return {
      built,
      prompt: `${k.intro} ${k.ask} Which of the following is the solution set?`,
      setup: [
        setupStep('setup', `Let $x$ be the number of ${k.unit}. Write the total cost of ${k.name} A, in dollars, in terms of $x$.`, built.leftLatex, built.leftExpr, why),
        setupStep('setup-right', `Write the total cost of ${k.name} B in terms of $x$.`, built.rightLatex, built.rightExpr, why),
      ],
    };
  }
}

// ---------- level 5: c1 ⊏ ax + b ⊏ c2 ----------

function level5(rng: Rng) {
  for (;;) {
    const a = rng.nonzero(-6, 6);
    if (Math.abs(a) === 1) continue;
    const b = rng.nonzero(-10, 10);
    const x1 = rng.int(-8, 7);
    const x2 = rng.int(x1 + 1, 8); // the solution interval is (x1, x2)
    const rel = rng.int(0, 3);
    const s1 = rel & 1; // strictness of the left symbol (c1 ⊏ ax + b)
    const s2 = rel >> 1; // strictness of the right symbol (ax + b ⊏ c2)
    const neg = a < 0;
    const c1 = neg ? a * x2 + b : a * x1 + b;
    const c2 = neg ? a * x1 + b : a * x2 + b;
    const lo = q(x1);
    const hi = q(x2);
    const loS = neg ? s2 : s1;
    const hiS = neg ? s1 : s2;
    const ax = `${coefLatex(q(a))}x`;
    const original = `${c1} ${CREL[s1]} ${linLatex(a, b)} ${CREL[s2]} ${c2}`;
    const sub1 = c1 - b;
    const sub2 = c2 - b;
    const solutionLatex = `${lo.toLatex()} ${CREL[loS]} x ${CREL[hiS]} ${hi.toLatex()}`;

    const steps: Step[] = [
      {
        key: 'subtract-all',
        instruction: b > 0 ? `Subtract ${b} from all three parts.` : `Add ${-b} to all three parts.`,
        math: `${sub1} ${CREL[s1]} ${ax} ${CREL[s2]} ${sub2}`,
        why: 'Whatever you do to the middle you must do to every part, or the three parts stop being comparable.',
        ask: {
          prompt: `What does the left part, $${c1}$, become?`,
          answer: numberAnswer(sub1),
          verify: { type: 'evaluate', expr: `${c1} - (${b})` },
        },
      },
      {
        key: 'flip',
        instruction: neg
          ? `You divide all three parts by $${a}$, a negative number: both signs reverse and the two bounds swap places.`
          : `You divide all three parts by $${a}$, a positive number: the signs and the order stay.`,
        math: neg ? `${sub1} ${CREL[s1]} ${ax} ${CREL[s2]} ${sub2} \\;\\longrightarrow\\; \\text{reverse both signs and swap the bounds}` : `\\text{signs and order unchanged}`,
        why: 'Dividing by a negative reverses the order of numbers, so both inequality signs reverse and the smaller bound becomes the larger one.',
        ask: {
          prompt: `You divide all three parts by $${a}$. Do the signs flip?`,
          answer: {
            kind: 'choice',
            options: [
              { id: 'yes', label: 'Yes, they flip' },
              { id: 'no', label: 'No, they stay' },
            ],
            correct: neg ? 'yes' : 'no',
          },
        },
      },
      {
        key: 'divide-all',
        instruction: `Divide all three parts by $${a}$.`,
        math: `${lo.toLatex()} ${CREL[loS]} x ${CREL[hiS]} ${hi.toLatex()}`,
        why: 'Division undoes multiplication, and it must be applied to all three parts.',
        ask: {
          prompt: 'What is the lower bound of $x$?',
          answer: numberAnswer(lo),
          verify: { type: 'evaluate', expr: `(${neg ? c2 : c1} - (${b}))/(${a})` },
        },
      },
    ];

    const correct = compound(lo, loS, hi, hiS);
    // no-flip: divide every part by a and leave the signs and the order alone. When that happens to give
    // the same set only in a different order, swap the bounds but keep the original symbols instead.
    const noFlip = neg ? compound(q(sub1, a), s1, q(sub2, a), s2) : null;
    const swappedKeepSymbols = neg ? compound(lo, s1, hi, s2) : null;
    // compound-one-side: the part holding c1 was not reduced by b.
    const oneSide = neg ? compound(lo, loS, q(c1, a), hiS) : compound(q(c1, a), loS, hi, hiS);
    const named = [
      { id: 'no-flip', opt: swappedKeepSymbols && swappedKeepSymbols.key !== correct.key ? swappedKeepSymbols : noFlip },
      { id: 'compound-one-side', opt: oneSide },
    ];
    const fillers = [
      compound(lo.add(1), loS, hi, hiS),
      compound(lo, loS, hi.sub(1), hiS),
      compound(lo, 1 - loS, hi, hiS),
      compound(lo, loS, hi, 1 - hiS),
      compound(lo.sub(1), loS, hi, hiS),
      compound(lo, loS, hi.add(1), hiS),
      compound(lo.neg(), loS, hi.neg(), hiS),
    ];
    let built;
    try {
      built = buildChoice(rng, correct, named, fillers);
    } catch {
      continue;
    }
    const { answer, mis } = built;
    steps.push({
      key: 'answer',
      instruction: `Match $${solutionLatex}$ to one of the options.`,
      math: solutionLatex,
      why: 'Check by plugging a number from the middle of your interval into the original compound inequality.',
      ask: { prompt: 'Which is the solution set?', answer },
    });

    return {
      params: { a, b, c1, c2, rel },
      prompt: `Which of the following is the solution set of $$${original}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, mis),
      verify: { type: 'choice' as const, note: 'tests/skills/linear-inequalities.test.ts checks each option against the inequality on a grid' },
    };
  }
}
