// REFERENCE SKILL (math, number answer). New skills should follow this file's structure:
// metadata → misconceptions → learn card → generate() that picks params, then builds the
// prompt, answer, steps (each with instruction / math / why / ask+verify) and misconceptions
// from the SAME params.

import { numberAnswer, wrongNumber } from '../../engine/answers';
import { linExpr, linLatex } from '../../engine/format';
import { distinctMisconceptions } from '../../engine/misconceptions';
import { Q, q } from '../../engine/rational';
import type { Rng } from '../../engine/rng';
import type { Level, SkillDefinition, Step } from '../../engine/types';

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
    'distribute-first-only': {
      name: 'Multiplied only the first term inside the parentheses',
      explanation:
        'The distributive property multiplies every term inside: $3(x + 4) = 3x + 12$, not $3x + 4$.',
    },
    'lcd-skip-term': {
      name: "Didn't multiply every term by the LCD",
      explanation:
        'Multiplying an equation by a number means multiplying every term on both sides, including terms that have no fraction. Otherwise the two sides are no longer equal.',
    },
  },
  stepLabels: {
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
    tips: ['Check your answer by substituting it back into the original equation. Both sides should give the same number.'],
  },

  generate(rng, level) {
    const built = pick(rng, level);
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
    const kx = `${k.eq(1) ? '' : k.eq(-1) ? '-' : k.toLatex()}x`;
    steps.push({
      key: 'collect',
      instruction: C.isZero()
        ? 'Move the constant to the right side.'
        : 'Move the x-terms to the left side and the numbers to the right side.',
      math: C.isZero()
        ? `${kx} = ${D.toLatex()} ${B.sign() < 0 ? '+' : '-'} ${B.abs().toLatex()} = ${r.toLatex()}`
        : `${kx} = ${r.toLatex()}`,
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
      wrongNumber('divide-flipped', () => k.div(r)),
      k.eq(1) ? null : wrongNumber('subtract-coefficient', () => r.sub(k)),
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
  },
};
