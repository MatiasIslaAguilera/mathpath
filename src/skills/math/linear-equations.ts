// REFERENCE SKILL (math, number answer). New skills should follow this file's structure:
// metadata → misconceptions → learn card → generate() that picks params, then builds the
// prompt, answer, steps (each with instruction / math / why / ask+verify) and misconceptions
// from the SAME params.

import { numberAnswer, wrongNumber } from '../../engine/answers';
import { linExpr, linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { Level, MisconceptionInstance, SkillDefinition, Step } from '../../engine/types';

const ID = 'linear-equations';

/** One side of a linear equation: how it is shown, and its value as coef·x + konst. */
interface Side {
  latex: string;
  expr: string; // mathjs / SymPy syntax
  coef: Q;
  konst: Q;
  hasParens: boolean;
}

const plain = (coef: Q | number, konst: Q | number): Side => ({
  latex: linLatex(coef, konst),
  expr: linExpr(coef, konst),
  coef: Q.of(coef),
  konst: Q.of(konst),
  hasParens: false,
});

/** a(x + b) [+ c] */
const distributed = (a: number, b: number, c = 0): Side => {
  const inner = linLatex(1, b);
  const tail = c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${-c}`;
  return {
    latex: `${a === -1 ? '-' : a}(${inner})${tail}`,
    expr: `${a}*(x + ${q(b).toExpr()}) + ${q(c).toExpr()}`,
    coef: q(a),
    konst: q(a * b + c),
    hasParens: true,
  };
};

/** \frac{x + b}{m} [+ k] */
const fractional = (m: number, b: number, k = 0): Side => {
  const tail = k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`;
  return {
    latex: `\\frac{${linLatex(1, b)}}{${m}}${tail}`,
    expr: `(x + ${q(b).toExpr()})/${m} + ${q(k).toExpr()}`,
    coef: q(1, m),
    konst: q(b, m).add(k),
    hasParens: true,
  };
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

interface Built {
  params: Record<string, number>;
  left: Side;
  right: Side;
  /** For fraction equations: the cleared, still-unexpanded sides. */
  cleared?: { lcd: number; left: Side; right: Side };
}

function pick(rng: Rng, level: Level): Built {
  for (;;) {
    switch (level) {
      case 1: {
        // a·x + b = c
        const a = rng.int(2, 9);
        const x = rng.int(-10, 10);
        const b = rng.nonzero(-20, 20);
        const c = a * x + b;
        return { params: { a, b, c, x }, left: plain(a, b), right: plain(0, c) };
      }
      case 2: {
        // a·x + b = c·x + d
        const a = rng.nonzero(-9, 9);
        const c = rng.nonzero(-9, 9);
        if (a === c) continue;
        const x = rng.int(-10, 10);
        const b = rng.nonzero(-20, 20);
        const d = a * x + b - c * x;
        if (d === 0) continue;
        return { params: { a, b, c, d, x }, left: plain(a, b), right: plain(c, d) };
      }
      case 3: {
        // a(x + b) = c·x + d
        const a = rng.nonzero(-6, 9);
        if (a === 1 || a === -1) continue;
        const b = rng.nonzero(-9, 9);
        const c = rng.int(-9, 9);
        if (c === a) continue;
        const x = rng.int(-10, 10);
        const d = a * (x + b) - c * x;
        return { params: { a, b, c, d, x }, left: distributed(a, b), right: plain(c, d) };
      }
      case 4: {
        // a(x + b) + c = d(x + e); solution may be a simple fraction
        const a = rng.nonzero(-6, 9);
        const d = rng.nonzero(-6, 9);
        if (a === d || Math.abs(a) === 1 || Math.abs(d) === 1) continue;
        const b = rng.nonzero(-9, 9);
        const e = rng.nonzero(-9, 9);
        const c = rng.nonzero(-20, 20);
        const x = q(d * e - a * b - c, a - d);
        if (x.d > 6 || Math.abs(x.n) > 90) continue;
        return {
          params: { a, b, c, d, e, xNum: x.n, xDen: x.d },
          left: distributed(a, b, c),
          right: distributed(d, e),
        };
      }
      case 5: {
        // (x + b)/m + k = (x + c)/n, integer solution
        const m = rng.int(2, 6);
        const n = rng.int(2, 6);
        if (m === n) continue;
        const x = rng.int(-12, 12);
        const b = rng.int(-12, 12);
        const k = rng.nonzero(-5, 5);
        const c = q(n * (x + b), m).add(n * k).sub(x); // makes (x + c)/n = (x + b)/m + k
        if (!c.isInt() || Math.abs(c.n) > 15) continue;
        const L = lcm(m, n);
        return {
          params: { m, n, b, k, c: c.n, x },
          left: fractional(m, b, k),
          right: fractional(n, c.n),
          cleared: { lcd: L, left: distributed(L / m, b, k * L), right: distributed(L / n, c.n) },
        };
      }
    }
  }
}

function solveSides(left: Side, right: Side): Q {
  return right.konst.sub(left.konst).div(left.coef.sub(right.coef));
}

/** Like distributed(), but expanded wrongly as a·x + b (only the first term multiplied). */
function firstTermOnly(s: Side, b: number, c: number): Side {
  return { ...s, konst: q(b + c) };
}

export const linearEquations: SkillDefinition = {
  id: ID,
  title: 'Linear equations',
  track: 'math',
  unit: 'Linear equations & systems',
  description: 'Solve equations like 3(x − 2) = x + 4 by keeping both sides balanced.',
  prerequisites: [],
  maxDenominator: 6,
  workingPad: [1, 2, 3, 4, 5],
  levels: {
    1: {
      description: 'Two-step: ax + b = c',
      ranges: { a: [2, 9], b: [-20, 20], c: [-110, 110], x: [-10, 10] },
    },
    2: {
      description: 'x on both sides',
      ranges: { a: [-9, 9], b: [-20, 20], c: [-9, 9], d: [-200, 200], x: [-10, 10] },
    },
    3: {
      description: 'Parentheses on one side',
      ranges: { a: [-6, 9], b: [-9, 9], c: [-9, 9], d: [-270, 270], x: [-10, 10] },
    },
    4: {
      description: 'Parentheses on both sides, fractional answers',
      ranges: { a: [-6, 9], b: [-9, 9], c: [-20, 20], d: [-6, 9], e: [-9, 9], xNum: [-90, 90], xDen: [1, 6] },
    },
    5: {
      description: 'Fractions: clear denominators first',
      ranges: { m: [2, 6], n: [2, 6], b: [-12, 12], k: [-5, 5], c: [-15, 15], x: [-12, 12] },
    },
  },
  misconceptions: {
    'sign-constant': {
      name: "Moved a number without changing its sign",
      explanation:
        'When a term crosses the equals sign, you are really doing the same operation to both sides. To remove $+5$ from the left you subtract 5 from both sides, so it shows up as $-5$ on the right.',
    },
    'sign-x-term': {
      name: "Moved an x-term without changing its sign",
      explanation:
        'Moving $2x$ from the right to the left means subtracting $2x$ from both sides, so it becomes $-2x$ on the left. The sign rule is the same for x-terms as for numbers.',
    },
    'divide-flipped': {
      name: 'Divided the wrong way',
      explanation:
        'From $4x = 12$ you divide both sides by the coefficient of $x$: $x = \\frac{12}{4}$, not $\\frac{4}{12}$. The number multiplying $x$ goes in the denominator.',
    },
    'subtract-coefficient': {
      name: 'Subtracted the coefficient instead of dividing',
      explanation:
        '$4x$ means $4 \\cdot x$. To undo multiplication you divide: $4x = 12 \\Rightarrow x = 3$. Subtracting 4 would undo an addition, which is not what is happening here.',
    },
    'forgot-divide': {
      name: 'Stopped before dividing by the coefficient',
      explanation:
        'After collecting terms, $2x = 4$ tells you what $2x$ is, not what $x$ is. Finish by dividing both sides by the coefficient: $x = \\frac{4}{2} = 2$.',
    },
    'divide-one-coefficient': {
      name: 'Divided by only one of the x-coefficients',
      explanation:
        'When $x$ is on both sides, combine the x-terms first: $7x - 18 = -7x - 158$ becomes $14x = -140$, so $x = -10$. Divide by the combined coefficient ($14$), not by one of the original ones ($7$).',
    },
    'sign-answer': {
      name: 'Got the sign of the answer wrong',
      explanation:
        'Check the signs in the last division: negative ÷ positive is negative, and negative ÷ negative is positive. From $4x = -8$, $x = -2$. Substituting your answer back into the original equation catches this.',
    },
    'distribute-first-only': {
      name: 'Multiplied only the first term inside the parentheses',
      explanation:
        'The distributive property multiplies every term inside: $3(x + 4) = 3x + 12$, not $3x + 4$.',
    },
    'total-over-count': {
      name: 'Divided the total by the count without taking off the other part',
      explanation:
        'A 4-night stay at \\$44 with a \\$4 fee every night: $44 \\div 4 = 11$ is the cost of one night *including* the fee, not the rate. Take off the other part first: $11 - 4 = 7$. With a one-time fee, subtract the fee from the total before dividing by the count.',
    },
    'compare-reversed': {
      name: 'Read the comparison the wrong way round',
      explanation:
        '"Red is 5 more than 3 times blue" describes red in terms of blue: $\\text{red} = 3\\cdot\\text{blue} + 5$. If red is 26, then $3x + 5 = 26$. Multiplying the *known* number by 3 describes it the other way round. Sense-check: the quantity that is "3 times" the other should be the bigger one.',
    },
    'unit-mismatch': {
      name: 'Used the rate in the wrong unit',
      explanation:
        'If parking costs \\$2 per half hour, one hour costs \\$4. When $x$ counts hours, the equation needs the price per hour. Using \\$2 gives the number of half-hour blocks, twice the number of hours.',
    },
    'aged-one-only': {
      name: 'Added the years to only one person',
      explanation:
        'In $x$ years everyone is $x$ years older. If a parent is 40 and a child is 10, in $x$ years they are $40 + x$ and $10 + x$, so "twice as old" is $40 + x = 2(10 + x)$, giving $x = 20$.',
    },
    'ignored-gap': {
      name: 'Found when they are equal instead of the gap asked for',
      explanation:
        '"A has \\$15 more than B" means $A = B + 15$, not $A = B$. Put the gap on the side of the smaller amount before solving.',
    },
    'discount-sign': {
      name: 'Added a discount instead of subtracting it',
      explanation:
        'A discount lowers each price: in the sale one item costs $x - 3$, not $x + 3$. Then $4(x - 3) = 28$ gives $x - 3 = 7$, so $x = 10$. The regular price is *more* than what you paid per item.',
    },
    'lcd-skip-term': {
      name: "Didn't multiply every term by the LCD",
      explanation:
        'Multiplying an equation by a number means multiplying every term on both sides, including terms that have no fraction. Otherwise the two sides are no longer equal.',
    },
  },
  stepLabels: {
    setup: 'Set up: write the situation as an expression',
    'setup-right': 'Set up the other side',
    'setup-rate': 'Set up: the rate is the unknown',
    'setup-compare': 'Set up: "5 more than 3 times"',
    'setup-units': 'Set up: put the rate in the right unit',
    'setup-age': 'Set up: both ages change',
    'setup-gap': 'Set up: include the gap',
    'setup-chase': 'Set up: head start plus speed × time',
    'setup-extra': 'Set up: the per-item extra is the unknown',
    'setup-discount': 'Set up: a discount on every item',
    'setup-orders': 'Set up: two orders, one price',
    'clear-fractions': 'Clear the fractions (multiply by the LCD)',
    expand: 'Expand the parentheses',
    collect: 'Collect x-terms and numbers',
    divide: 'Divide by the coefficient of x',
  },
  learn: {
    whyItMatters:
      'Solving for an unknown is the core move inside equilibrium, break-even, and later regression formulas. Say a firm earns revenue $12q$ and pays cost $300 + 7q$. It breaks even when $12q = 300 + 7q$, so $5q = 300$ and $q = 60$ units. In first-semester micro theory and econometrics you will rearrange equations like this constantly, so being quick and calm with it pays off everywhere.',
    summary:
      'An equation is a balance. Whatever you do to one side you must do to the other. The goal is to get $x$ alone: clear fractions, expand parentheses, gather $x$-terms on one side and numbers on the other, then divide by the coefficient of $x$.',
    formulas: [
      { latex: 'a(x + b) = ax + ab', note: 'Distributive property: multiply every term inside.' },
      { latex: 'ax + b = c \\;\\Rightarrow\\; ax = c - b \\;\\Rightarrow\\; x = \\frac{c - b}{a}', note: 'Undo addition first, then multiplication.' },
    ],
    example: { seed: 7, level: 3 },
    tips: [
      'Check your answer by substituting it back into the original equation. Both sides should give the same number.',
      'Go slowly with negatives when you move a number across. From $3x - 12 = -30$, add 12 to both sides: $-30 + 12 = -18$. Adding a positive to a negative moves toward zero, so the answer is closer to zero than $-30$ (not $-42$, not $-21$).',
      'With x on both sides, combine the x-terms into one coefficient first ($7x + 7x = 14x$), then divide by that.',
    ],
  },

  generate(rng, level) {
    return solveBuilt(pick(rng, level), level);
  },

  story: {
    levels: [1, 2, 3],
    generate(rng, level) {
      const pattern = rng.int(0, 3);
      return tell(pattern === 0 ? pickStory(rng, level) : NEW_PATTERNS[level as 1 | 2 | 3][pattern - 1](rng), level);
    },
    original: (rng, level) => tell(pickStory(rng, level), level),
  },
};

/** A story's setup steps, then the equation's own steps. */
function tell(story: Story, level: Level): Body {
  const body = solveBuilt(story.built, level);
  return {
    ...body,
    prompt: story.prompt,
    steps: [...story.setup, ...body.steps],
    // Story readings first: when one gives the same number as an algebra slip, the reading is the likelier cause.
    misconceptions: distinctMisconceptions(body.answer, [...(story.mis ?? []), ...body.misconceptions]),
  };
}

type Body = ReturnType<SkillDefinition['generate']>;

/** Steps, answer and misconceptions for a picked equation (shared by plain and story problems). */
function solveBuilt(built: Built, level: Level): Body {
    const { left, right } = built;
    const x = solveSides(left, right);
    const original = `${left.expr} = ${right.expr}`;
    const eqLatex = `${left.latex} = ${right.latex}`;
    const steps: Step[] = [];

    if (built.cleared) {
      const { lcd, left: cl, right: cr } = built.cleared;
      steps.push({
        key: 'clear-fractions',
        instruction: `Multiply every term on both sides by the least common denominator, ${lcd}.`,
        math: `${lcd}\\cdot\\left(${left.latex}\\right) = ${lcd}\\cdot${right.latex} \\;\\Rightarrow\\; ${cl.latex} = ${cr.latex}`,
        why: 'Multiplying both sides by the same nonzero number keeps them equal and removes the fractions.',
        ask: {
          prompt: `What is the least common denominator of $${built.params.m}$ and $${built.params.n}$?`,
          answer: numberAnswer(lcd),
          verify: { type: 'evaluate', expr: `lcm(${built.params.m}, ${built.params.n})` },
        },
      });
    }

    const toExpand = built.cleared ? built.cleared : left.hasParens ? { left, right } : null;
    if (toExpand) {
      const expandedL = plain(toExpand.left.coef, toExpand.left.konst);
      const expandedR = plain(toExpand.right.coef, toExpand.right.konst);
      steps.push({
        key: 'expand',
        instruction: 'Expand the parentheses and combine like terms on each side.',
        math: `${expandedL.latex} = ${expandedR.latex}`,
        why: 'Distributive property: $a(x + b) = ax + ab$. Every term inside gets multiplied.',
        ask: {
          prompt: `Expand the left side, $${toExpand.left.latex}$. What do you get?`,
          answer: { kind: 'expression', value: expandedL.expr, variables: ['x'], display: expandedL.latex },
          verify: { type: 'equivalent', expr: toExpand.left.expr, variables: ['x'] },
        },
      });
    }

    // Collect: (A − C)x = D − B, where the equation is now Ax + B = Cx + D.
    const base = built.cleared ?? { left, right };
    const A = base.left.coef;
    const B = base.left.konst;
    const C = base.right.coef;
    const D = base.right.konst;
    const k = A.sub(C);
    const r = D.sub(B);
    const xTerm = (c: Q) => `${c.eq(1) ? '' : c.eq(-1) ? '-' : c.toLatex()}x`;
    const kx = xTerm(k);
    // Show the moved terms (Ax − Cx = D − B) before the result, so the step never just states x.
    const moved = `${xTerm(A)} ${C.sign() < 0 ? '+' : '-'} ${xTerm(C.abs())} = ${D.toLatex()}${
      B.isZero() ? '' : ` ${B.sign() < 0 ? '+' : '-'} ${B.abs().toLatex()}`
    }`;
    steps.push({
      key: 'collect',
      instruction: C.isZero()
        ? 'Move the constant to the right side.'
        : 'Move the x-terms to the left side and the numbers to the right side.',
      math: C.isZero()
        ? `${kx} = ${D.toLatex()} ${B.sign() < 0 ? '+' : '-'} ${B.abs().toLatex()} = ${r.toLatex()}`
        : `${moved} \\;\\Rightarrow\\; ${kx} = ${r.toLatex()}`,
      why: 'Subtracting the same term from both sides keeps the equation balanced. That is why a term changes sign when it crosses the equals sign.',
      ask: {
        prompt: `After collecting terms, $${kx} = \\;?$`,
        answer: numberAnswer(r),
        verify: { type: 'evaluate', expr: `${k.toExpr()}*${x.toExpr()}` },
      },
    });

    steps.push({
      key: 'divide',
      instruction: k.eq(1) ? 'The x is already alone. Read off the answer.' : `Divide both sides by $${k.toLatex()}$.`,
      math: k.eq(1) ? `x = ${x.toLatex()}` : `x = \\frac{${r.toLatex()}}{${k.toLatex()}} = ${x.toLatex()}`,
      why: 'Division undoes multiplication: if $kx = r$ then $x = \\frac{r}{k}$.',
      ask: {
        prompt: 'So $x = \\;?$',
        answer: numberAnswer(x),
        verify: { type: 'solve', equations: [original], unknowns: ['x'] },
      },
    });

    // Misconceptions: the wrong x each common error would produce with these numbers.
    const p = built.params;
    const candidates = [
      B.isZero() ? null : wrongNumber('sign-constant', () => D.add(B).div(k)),
      C.isZero() ? null : wrongNumber('sign-x-term', () => r.div(A.add(C))),
      // The same slip made moving Ax to the right instead: B − D = (C + A)x.
      C.isZero() ? null : wrongNumber('sign-x-term', () => B.sub(D).div(A.add(C))),
      wrongNumber('divide-flipped', () => k.div(r)),
      k.eq(1) ? null : wrongNumber('subtract-coefficient', () => r.sub(k)),
      // Answered kx = r with r itself.
      k.eq(1) ? null : wrongNumber('forgot-divide', () => r),
      // x on both sides: divided by A (or by −C, collecting on the right) instead of A − C.
      C.isZero() ? null : wrongNumber('divide-one-coefficient', () => r.div(A)),
      C.isZero() ? null : wrongNumber('divide-one-coefficient', () => r.div(C.neg())),
      x.isZero() ? null : wrongNumber('sign-answer', () => x.neg()),
    ];
    if (level === 3) {
      const wrongL = firstTermOnly(left, p.b, 0);
      candidates.push(wrongNumber('distribute-first-only', () => solveSides(wrongL, right)));
    }
    if (level === 4) {
      const wrongL = firstTermOnly(left, p.b, p.c);
      const wrongR = firstTermOnly(right, p.e, 0);
      candidates.push(wrongNumber('distribute-first-only', () => solveSides(wrongL, wrongR)));
    }
    if (level === 5 && built.cleared) {
      // Forgot to multiply the constant k by the LCD.
      const wrongL = { ...built.cleared.left, konst: q(built.cleared.left.coef.n * p.b + p.k) };
      candidates.push(wrongNumber('lcd-skip-term', () => solveSides(wrongL, built.cleared!.right)));
    }

    const answer = numberAnswer(x);
    return {
      params: built.params,
      prompt: `Solve for $x$: $$${eqLatex}$$`,
      answer,
      steps,
      misconceptions: distinctMisconceptions(answer, candidates),
      verify: { type: 'solve', equations: [original], unknowns: ['x'] },
    };
}

// ---------- Story variants: the same equations as situations ----------

/** A setup step: write one side of the situation as an expression in x (checked by equivalence). */
function setupStep(key: string, prompt: string, side: Side, why: string): Step {
  return {
    key,
    instruction: prompt,
    math: side.latex,
    why,
    ask: {
      prompt,
      answer: { kind: 'expression', value: side.expr, variables: ['x'], display: side.latex },
      verify: { type: 'equivalent', expr: side.expr, variables: ['x'] },
    },
  };
}

const SETUP_WHY = 'Name the unknown, then translate each phrase: "plus a fee" adds a constant, "per unit" multiplies by $x$.';
const usd = (v: number) => `\\$${v}`;

interface Story {
  built: Built;
  prompt: string;
  setup: Step[];
  /** Misreadings of the situation, computed with this story's numbers. */
  mis?: (MisconceptionInstance | null)[];
}

/** Story params stay inside the level's ranges (positive prices, counts and totals). */
function pickStory(rng: Rng, level: Level): Story {
  if (level === 1) {
    // a·x + b = c: a fee plus a per-unit price (b > 0), or a per-unit price less a discount (b < 0).
    const a = rng.int(2, 9);
    const x = rng.int(1, 10);
    const discount = rng.chance(0.3) && a * x > 2;
    const b = discount ? -rng.int(1, Math.min(20, a * x - 1)) : rng.int(1, 20);
    const c = a * x + b;
    const ctx = rng.int(0, 2);
    const left = plain(a, b);
    const built: Built = { params: { a, b, c, x }, left, right: plain(0, c) };
    if (discount) {
      return {
        built,
        prompt: `Concert tickets cost ${usd(a)} each. With a ${usd(-b)} discount code on the whole order, you paid ${usd(c)}. How many tickets did you buy?`,
        setup: [setupStep('setup', 'Let $x$ be the number of tickets. Write what you paid, in dollars, in terms of $x$.', left, 'The tickets cost the price times $x$; the discount comes off once, so subtract it.')],
        mis: [wrongNumber('total-over-count', () => q(c, a))],
      };
    }
    const settings = [
      [`A taxi charges a ${usd(b)} pickup fee plus ${usd(a)} per mile. A ride cost ${usd(c)}. How many miles was the ride?`, 'the number of miles'],
      [`A climbing gym charges a ${usd(b)} monthly fee plus ${usd(a)} per visit. Last month you paid ${usd(c)}. How many times did you go?`, 'the number of visits'],
      [`A plumber charges a ${usd(b)} call-out fee plus ${usd(a)} per hour. The bill came to ${usd(c)}. How many hours did the job take?`, 'the number of hours'],
    ];
    const [prompt, unit] = settings[ctx];
    return {
      built,
      prompt,
      setup: [setupStep('setup', `Let $x$ be ${unit}. Write the total cost, in dollars, in terms of $x$.`, left, SETUP_WHY)],
      mis: [wrongNumber('total-over-count', () => q(c, a))],
    };
  }

  if (level === 2) {
    // a·x + b = c·x + d with a > c: two pricing plans meet, or revenue meets cost (b = 0).
    const a = rng.int(2, 9);
    const c = rng.int(1, a - 1);
    const x = rng.int(1, 10);
    const breakEven = rng.chance(0.4);
    const b = breakEven ? 0 : rng.int(0, 20);
    const d = b + (a - c) * x;
    const left = plain(a, b);
    const right = plain(c, d);
    const built: Built = { params: { a, b, c, d, x }, left, right };
    if (breakEven) {
      const item = rng.pick(['cakes', 'candles', 'T-shirts']);
      return {
        built,
        prompt: `A small shop sells ${item} for ${usd(a)} each. Each one costs ${usd(c)} in materials, and the shop pays ${usd(d)} a week in rent. How many ${item} must it sell in a week to break even?`,
        setup: [
          setupStep('setup', `Let $x$ be the number of ${item} sold. Write the week's revenue in terms of $x$.`, left, 'Revenue is price times quantity.'),
          setupStep('setup-right', "Write the week's total cost in terms of $x$.", right, 'Total cost is the fixed cost (rent) plus the cost per item times the number of items.'),
        ],
      };
    }
    const [thing, period] = rng.pick([
      ['gym', 'month'],
      ['phone plan', 'month'],
      ['car rental', 'day'],
    ]);
    const upFront = (v: number) => (v === 0 ? 'nothing up front' : `${usd(v)} up front`);
    const Thing = thing[0].toUpperCase() + thing.slice(1);
    return {
      built,
      prompt: `${Thing} A costs ${upFront(b)} plus ${usd(a)} per ${period}. ${Thing} B costs ${upFront(d)} plus ${usd(c)} per ${period}. After how many ${period}s do the two cost the same in total?`,
      setup: [
        setupStep('setup', `Let $x$ be the number of ${period}s. Write the total cost of ${thing} A in terms of $x$.`, left, SETUP_WHY),
        setupStep('setup-right', `Write the total cost of ${thing} B in terms of $x$.`, right, SETUP_WHY),
      ],
    };
  }

  // Level 3: a(x + b) = d, i.e. a items, each at an unknown base price plus a per-item extra.
  // One number in the story doesn't matter: ignoring it is part of the skill.
  const a = rng.int(2, 9);
  const b = rng.int(1, 9);
  const x = rng.int(1, 10);
  const d = a * (x + b);
  const left = distributed(a, b);
  const days = rng.int(3, 14);
  const hotel = rng.chance(0.5);
  return {
    built: { params: { a, b, c: 0, d, x }, left, right: plain(0, d) },
    prompt: hotel
      ? `A hotel charges a nightly rate plus a ${usd(b)} resort fee per night. Booked ${days} days ahead, a ${a}-night stay cost ${usd(d)} in total. What is the nightly rate?`
      : `A team orders ${a} jerseys. Each costs a base price plus ${usd(b)} to print a name. The order ships in ${days} days, and the total bill is ${usd(d)}. What is the base price of one jersey?`,
    setup: [
      setupStep(
        'setup',
        hotel ? 'Let $x$ be the nightly rate. Write the total cost in terms of $x$.' : 'Let $x$ be the base price. Write the total bill in terms of $x$.',
        left,
        `Each ${hotel ? 'night' : 'jersey'} costs $x + ${b}$, and there are ${a} of them: multiply the whole bracket by ${a}. The ${days} days doesn't enter the equation.`,
      ),
    ],
    // Seen: a 4-night stay costing 44 with a fee of 4 a night answered 11 (= 44/4, the fee still inside).
    mis: [wrongNumber('total-over-count', () => q(d, a))],
  };
}

// ---------- Story patterns added in batch S2 (docs/skill-specs/batch-s2-stories.md) ----------
// Each pattern changes how the situation maps to the equation, not just the setting: a different
// unknown, a comparison, a rate in the wrong unit, two quantities that both change, a gap, a chase.

/** A setup step with its own display and expression (for sides written in story order). */
function setupAs(key: string, prompt: string, latex: string, expr: string, why: string): Step {
  return {
    key,
    instruction: prompt,
    math: latex,
    why,
    ask: { prompt, answer: { kind: 'expression', value: expr, variables: ['x'], display: latex }, verify: { type: 'equivalent', expr, variables: ['x'] } },
  };
}

/** "5 more than" / "3 fewer than". */
const moreFewer = (b: number) => (b > 0 ? `${b} more than` : `${-b} fewer than`);
const times = (a: number) => (a === 2 ? 'twice' : a === 3 ? 'three times' : `${a} times`);

/** L1: the rate is unknown and the count is given (a·x + b = c with x the price). */
function rateUnknown(rng: Rng): Story {
  const a = rng.int(2, 9);
  const x = rng.int(1, 10);
  const b = rng.int(1, 20);
  const c = a * x + b;
  const left = plain(a, b);
  const [prompt, unknown] = rng.pick([
    [`A ${a}-mile taxi ride cost ${usd(c)}, including a ${usd(b)} pickup fee. What does the taxi charge per mile?`, 'the price per mile, in dollars'],
    [`A plumber's ${a}-hour job came to ${usd(c)}, which includes a ${usd(b)} call-out fee. What is the plumber's hourly rate?`, 'the hourly rate, in dollars'],
    [`You bought ${a} identical notebooks online and paid ${usd(c)}, including ${usd(b)} for shipping. What did one notebook cost?`, 'the price of one notebook, in dollars'],
  ]);
  return {
    built: { params: { a, b, c, x }, left, right: plain(0, c) },
    prompt,
    setup: [
      setupStep(
        'setup-rate',
        `Let $x$ be ${unknown}. Write the total paid in terms of $x$.`,
        left,
        `This time the count (${a}) is known and the rate is the unknown: the count multiplies $x$, and the one-time fee is added once. Take the fee off before you divide by the count.`,
      ),
    ],
    mis: [wrongNumber('total-over-count', () => q(c, a))],
  };
}

/** L1: one quantity described through another ("5 more than 3 times as many"). */
function comparison(rng: Rng): Story {
  for (;;) {
    const a = rng.int(2, 9);
    const x = rng.int(1, 10);
    const b = rng.nonzero(-20, 20);
    const c = a * x + b;
    if (c < 1) continue;
    const left = plain(a, b);
    const rel = `${moreFewer(b)} ${times(a)}`;
    const k = rng.pick([
      {
        prompt: `A jar holds red and blue marbles. The number of red marbles is ${rel} the number of blue marbles. There are ${c} red marbles. How many blue marbles are there?`,
        unknown: 'the number of blue marbles',
        known: 'the number of red marbles',
      },
      {
        prompt: `A chess club has ${c} members this year. That is ${rel} the number of members it had when it started. How many members did it start with?`,
        unknown: 'the number of members at the start',
        known: "this year's number of members",
      },
      {
        prompt: `A shop sold ${c} umbrellas on a rainy Saturday: ${rel} the number it sold the sunny Saturday before. How many umbrellas did it sell on the sunny Saturday?`,
        unknown: 'the number sold on the sunny Saturday',
        known: 'the number sold on the rainy Saturday',
      },
    ]);
    return {
      built: { params: { a, b, c, x }, left, right: plain(0, c) },
      prompt: k.prompt,
      setup: [
        setupStep(
          'setup-compare',
          `Let $x$ be ${k.unknown}. Write ${k.known} in terms of $x$.`,
          left,
          `"${times(a)} the number" multiplies the unknown by ${a}, then "${moreFewer(b)}" ${b > 0 ? 'adds' : 'subtracts'} ${Math.abs(b)}. The quantity described *in terms of* the other one is the one you write as an expression.`,
        ),
      ],
      // Read the comparison the other way round: x = a·c ± |b|.
      mis: [wrongNumber('compare-reversed', () => a * c + b)],
    };
  }
}

/** L1: the price is per block of minutes, x is in hours (convert the rate first). */
function unitRate(rng: Rng): Story {
  const [n, block] = rng.pick([
    [2, 'half hour'],
    [3, '20 minutes'],
    [4, '15 minutes'],
  ] as const);
  const r = rng.int(1, Math.floor(9 / n));
  const a = n * r;
  const x = rng.int(1, 10);
  const b = rng.int(1, 20);
  const c = a * x + b;
  const left = plain(a, b);
  const [intro, what] = rng.pick([
    [`A parking garage charges a ${usd(b)} entry fee plus ${usd(r)} for every ${block}.`, 'How many hours did you park?'],
    [`A kayak rental costs a ${usd(b)} booking fee plus ${usd(r)} for every ${block} on the water.`, 'For how many hours did you rent the kayak?'],
    [`A coworking space charges a ${usd(b)} day-pass fee plus ${usd(r)} for every ${block} in a meeting room.`, 'How many hours did you use the meeting room?'],
  ]);
  return {
    built: { params: { a, b, c, x }, left, right: plain(0, c) },
    prompt: `${intro} You paid ${usd(c)} in total, for a whole number of hours. ${what}`,
    setup: [
      setupStep(
        'setup-units',
        'Let $x$ be the number of hours. Write the total cost, in dollars, in terms of $x$.',
        left,
        `An hour has ${n} blocks of ${60 / n} minutes, so one hour costs ${n} times ${usd(r)}, which is ${usd(a)}. Put the rate in the unit of $x$ before writing the equation.`,
      ),
    ],
    // Used the per-block price as if it were per hour: the answer comes out in blocks, not hours.
    mis: [wrongNumber('unit-mismatch', () => q(c - b, r))],
  };
}

/** L2: ages: in x years the parent is k times as old as the child (both ages grow). */
function ages(rng: Rng): Story {
  for (;;) {
    const k = rng.int(2, 3);
    const s = rng.int(1, Math.floor(20 / k));
    const x = rng.int(1, 10);
    const m = k * s + (k - 1) * x;
    if (m - s < 16 || m - s > 45) continue;
    const [parent, child] = rng.pick([
      ['mother', 'daughter'],
      ['father', 'son'],
      ['aunt', 'nephew'],
    ]);
    const pron = parent === 'father' ? 'his' : 'her';
    const left = plain(k, k * s);
    const right = plain(1, m);
    return {
      built: { params: { a: k, b: k * s, c: 1, d: m, x }, left, right },
      prompt: `A${parent === 'aunt' ? 'n' : ''} ${parent} is ${m} years old and ${pron} ${child} is ${s}. In how many years will the ${parent} be ${times(k)} as old as the ${child}?`,
      setup: [
        setupAs(
          'setup-age',
          `Let $x$ be the number of years from now. Write ${times(k)} the ${child}'s age at that time, in terms of $x$.`,
          `${k}(x + ${s})`,
          `${k}*(x + ${s})`,
          `In $x$ years *both* people are $x$ years older: the ${child} will be $x + ${s}$ and the ${parent} $x + ${m}$. "${times(k)} as old" multiplies the ${child}'s whole future age.`,
        ),
        setupAs('setup-right', `Write the ${parent}'s age at that time in terms of $x$.`, `x + ${m}`, `x + ${m}`, 'The years pass for both people.'),
      ],
      // Added the years to only one of the two: k(s + x) = m, or k·s = m + x.
      mis: [wrongNumber('aged-one-only', () => q(m, k).sub(s)), wrongNumber('aged-one-only', () => k * s - m)],
    };
  }
}

/** L2: when will A be ahead of B by a given gap (not just equal)? */
function gap(rng: Rng): Story {
  for (;;) {
    const a = rng.int(3, 9);
    const c = rng.int(1, a - 1);
    const x = rng.int(2, 10);
    const b = rng.int(0, 20);
    const g = 5 * rng.int(1, 4);
    if (g >= (a - c) * x) continue;
    const d = b + (a - c) * x; // B's start plus the gap
    const d0 = d - g; // B's start
    const left = plain(a, b);
    const right = plain(c, d);
    const k = rng.pick([
      {
        prompt: `You have ${usd(b)} saved and put in ${usd(a)} a week. Your brother has ${usd(d0)} saved and puts in ${usd(c)} a week. After how many weeks will you have ${usd(g)} more than him?`,
        a: 'your savings',
        b: "your brother's savings",
        gapWord: `${usd(g)} gap`,
        unit: 'dollars',
      },
      {
        prompt: `Plant A is ${b} cm tall and grows ${a} cm a week. Plant B is ${d0} cm tall and grows ${c} cm a week. After how many weeks will plant A be ${g} cm taller than plant B?`,
        a: "plant A's height",
        b: "plant B's height",
        gapWord: `${g} cm gap`,
        unit: 'cm',
      },
    ]);
    return {
      built: { params: { a, b, c, d, x }, left, right },
      prompt: k.prompt,
      setup: [
        setupStep('setup-gap', `Let $x$ be the number of weeks. Write ${k.a} after $x$ weeks, in ${k.unit}.`, left, SETUP_WHY),
        setupAs(
          'setup-right',
          `Write ${k.b} after $x$ weeks, plus the ${k.gapWord}.`,
          `${linLatex(c, d0)} + ${g}`,
          `${c}*x + ${d0} + ${g}`,
          `"${g} more than B" means A equals B's amount *plus* ${g}. Without the gap you would find when the two are equal.`,
        ),
      ],
      mis: [wrongNumber('ignored-gap', () => q(d0 - b, a - c))],
    };
  }
}

/** L2: a chase: the faster one starts behind by a head start. */
function chase(rng: Rng): Story {
  const c = rng.int(1, 6);
  const a = rng.int(c + 1, 9);
  const x = rng.int(1, 10);
  const d = (a - c) * x;
  const left = plain(a, 0);
  const right = plain(c, d);
  const k = rng.pick([
    { slow: 'a walker', fast: 'a runner', slowS: 'walker', fastS: 'runner', place: 'trail' },
    { slow: 'a raft', fast: 'a motorboat', slowS: 'raft', fastS: 'boat', place: 'river' },
  ]);
  return {
    built: { params: { a, b: 0, c, d, x }, left, right },
    prompt: `On a long ${k.place}, ${k.slow} moves at ${c} km/h. When ${k.fast} sets off from the same starting point at ${a} km/h in the same direction, the ${k.slowS} is already ${d} km ahead. How many hours after setting off does the ${k.fastS} catch up?`,
    setup: [
      setupStep('setup-chase', `Let $x$ be the hours since the ${k.fastS} set off. Write the ${k.fastS}'s distance from the start, in km, in terms of $x$.`, left, 'Distance is speed times time.'),
      setupStep(
        'setup-right',
        `Write the ${k.slowS}'s distance from the start in terms of $x$.`,
        right,
        `The ${k.slowS} starts ${d} km out and keeps moving at ${c} km/h: the head start plus speed times time. Catching up means the two distances are equal.`,
      ),
    ],
  };
}

/** L3: the per-item extra is the unknown, the base price is given: a(x + p) = d. */
function extraUnknown(rng: Rng): Story {
  const a = rng.int(2, 9);
  const b = rng.int(1, 9);
  const x = rng.int(1, 10);
  const d = a * (x + b);
  const left = distributed(a, b);
  const k = rng.pick([
    {
      prompt: `A ${a}-night hotel stay came to ${usd(d)}. The room is ${usd(b)} a night, and the city adds the same tourist tax on top of every night. How much is the tax per night?`,
      unknown: 'the tax per night',
      each: 'night',
    },
    {
      prompt: `A team orders ${a} jerseys at ${usd(b)} each, plus the same printing charge on every jersey. The bill is ${usd(d)}. What is the printing charge per jersey?`,
      unknown: 'the printing charge per jersey',
      each: 'jersey',
    },
  ]);
  return {
    built: { params: { a, b, c: 0, d, x }, left, right: plain(0, d) },
    prompt: k.prompt,
    setup: [setupStep('setup-extra', `Let $x$ be ${k.unknown}. Write the total in terms of $x$.`, left, `Each ${k.each} costs ${usd(b)} plus $x$, so $x + ${b}$, and there are ${a} of them: multiply the whole bracket by ${a}.`)],
    mis: [wrongNumber('total-over-count', () => q(d, a))],
  };
}

/** L3: the same discount off every item: a(x − e) = d. */
function discount(rng: Rng): Story {
  const a = rng.int(2, 9);
  const e = rng.int(1, 9);
  const x = rng.int(e + 1, Math.max(e + 1, 10));
  const d = a * (x - e);
  const left = distributed(a, -e);
  const [item, items] = rng.pick([
    ['book', 'books'],
    ['plant', 'plants'],
    ['concert T-shirt', 'concert T-shirts'],
  ]);
  return {
    built: { params: { a, b: -e, c: 0, d, x }, left, right: plain(0, d) },
    prompt: `In a sale, every ${item} is ${usd(e)} off its regular price. You buy ${a} ${items} and pay ${usd(d)}. What is the regular price of one ${item}?`,
    setup: [setupStep('setup-discount', 'Let $x$ be the regular price. Write what you paid in terms of $x$.', left, `Each ${item} costs $x - ${e}$ in the sale, and you buy ${a}: multiply the whole bracket by ${a}.`)],
    mis: [wrongNumber('discount-sign', () => q(d, a).sub(e)), wrongNumber('total-over-count', () => q(d, a))],
  };
}

/** L3: two orders at the same unknown price come to the same total: a(x + b) = c·x + d. */
function twoOrders(rng: Rng): Story {
  for (;;) {
    const a = rng.int(2, 9);
    const c = rng.int(1, 9);
    if (c === a) continue;
    const b = rng.int(1, 9);
    const x = rng.int(1, 10);
    const d = a * (x + b) - c * x;
    if (d < 1) continue;
    const days = rng.int(2, 9);
    const left = distributed(a, b);
    const right = plain(c, d);
    return {
      built: { params: { a, b, c, d, x }, left, right },
      prompt: `Two orders of the same mug came to the same total. Order A was ${a} mugs, each gift-wrapped for ${usd(b)} extra. Order B was ${c} mug${c === 1 ? '' : 's'} with one ${usd(d)} delivery charge. Order A arrived ${days} days sooner. What is the price of one mug?`,
      setup: [
        setupStep('setup-orders', 'Let $x$ be the price of one mug. Write the total of order A in terms of $x$.', left, `Each mug in order A costs $x + ${b}$: multiply the whole bracket by ${a}. The ${days} days doesn't enter the cost.`),
        setupStep('setup-right', 'Write the total of order B in terms of $x$.', right, 'The delivery charge is paid once, so add it once.'),
      ],
    };
  }
}

const NEW_PATTERNS: Record<1 | 2 | 3, ((rng: Rng) => Story)[]> = {
  1: [rateUnknown, comparison, unitRate],
  2: [ages, gap, chase],
  3: [extraUnknown, discount, twoOrders],
};
