// Multiple-choice domain/range answers are re-derived from the raw params by testing the
// actual function on a grid of inputs: exactly one option must describe the true set, and
// each misconception distractor must be wrong in the way its definition says.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { functionsBasics as skill } from '../../src/skills/math/functions-basics';

type Pred = (v: number) => boolean;

/** Turn an option label like "$x \ge 3,\ x \ne 5$" into a membership test. */
function predicate(label: string): Pred {
  const body = label.replace(/^\$|\$$/g, '');
  if (body === '\\text{all real numbers}') return () => true;
  const parts = body.split(/,\\ /).map((s) => {
    const m = s.trim().match(/^[xy] (\\ge|\\le|\\ne|>|<|=) (-?\d+)$/);
    if (!m) throw new Error(`cannot parse option "${label}"`);
    const c = Number(m[2]);
    return ((v: number) => {
      switch (m[1]) {
        case '\\ge':
          return v >= c;
        case '\\le':
          return v <= c;
        case '\\ne':
          return v !== c;
        case '>':
          return v > c;
        case '<':
          return v < c;
        default:
          return v === c;
      }
    }) as Pred;
  });
  return (v) => parts.every((f) => f(v));
}

const GRID = Array.from({ length: 61 }, (_, i) => -15 + i * 0.5);
const defined = (y: number) => Number.isFinite(y);
const optionOf = (p: Problem, id: string) => {
  if (p.answer.kind !== 'choice') throw new Error('choice expected');
  return p.answer.options.find((o) => o.id === id)!.label;
};
const correctOf = (p: Problem) => (p.answer.kind === 'choice' ? p.answer.correct : '');
const disagreements = (a: Pred, b: Pred) => GRID.filter((v) => a(v) !== b(v));
const wrongId = (p: Problem, miscId: string) => {
  const m = p.misconceptions.find((x) => x.id === miscId);
  return m && m.wrong.kind === 'choice' ? m.wrong.correct : undefined;
};

/** The function itself, from the raw params. */
function domainFn(p: Problem): (x: number) => number {
  const { form, a, b } = p.params;
  if (p.level === 3) {
    return form === 0 ? (x) => Math.sqrt(x - a) : form === 1 ? (x) => Math.sqrt(a - x) : (x) => 1 / (x - a);
  }
  return form === 0 ? (x) => Math.sqrt(x - a) / (x - b) : form === 1 ? (x) => Math.log(x - a) : (x) => 1 / Math.sqrt(x - a);
}

describe('functions-basics: number answers', () => {
  it('level 1 evaluates ax^2 + bx + c', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { a, b, c, x0 } = p.params;
      expect(Number(p.answer.kind === 'number' && p.answer.value)).toBe(a * x0 * x0 + b * x0 + c);
    }
  });

  it('level 2: -ax^2 + bx at negatives, and piecewise (>= goes to the second rule)', () => {
    let pieces = 0;
    let atCut = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, a, b, p: pp, q, k, x0 } = p.params;
      const expected = form === 0 ? -a * x0 * x0 + b * x0 : x0 < k ? pp * x0 + q : a * x0 * x0 + b;
      expect(Number(p.answer.kind === 'number' && p.answer.value)).toBe(expected);
      if (form === 0) expect(x0).toBeLessThan(0);
      else {
        pieces++;
        if (x0 === k) atCut++;
        const wrong = p.misconceptions.find((m) => m.id === 'wrong-piece');
        if (wrong) expect(Number(wrong.wrong.kind === 'number' && wrong.wrong.value)).toBe(x0 < k ? a * x0 * x0 + b : pp * x0 + q);
      }
    }
    expect(pieces).toBeGreaterThan(100);
    expect(atCut).toBeGreaterThan(10);
  });

  it('negative-squared flips the sign of the squared term (level 1)', () => {
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 1, seed);
      const m = p.misconceptions.find((x) => x.id === 'negative-squared');
      if (!m) continue;
      const { a, b, c, x0 } = p.params;
      expect(x0).toBeLessThan(0);
      expect(Number(m.wrong.kind === 'number' && m.wrong.value)).toBe(-a * x0 * x0 + b * x0 + c);
      n++;
    }
    expect(n).toBeGreaterThan(50);
  });
});

describe('functions-basics: domain (levels 3 and 5)', () => {
  for (const level of [3, 5] as const) {
    it(`level ${level}: exactly the correct option equals the true domain`, () => {
      for (let seed = 1; seed <= 400; seed++) {
        const p = makeProblem(skill, level, seed);
        const f = domainFn(p);
        const truth: Pred = (x) => defined(f(x));
        if (p.answer.kind !== 'choice') throw new Error('choice expected');
        const matching = p.answer.options.filter((o) => disagreements(predicate(o.label), truth).length === 0);
        expect(matching.map((o) => o.id), p.id).toEqual([correctOf(p)]);
      }
    });

    it(`level ${level}: strict-vs-inclusive differs from the right answer only at the boundary`, () => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const p = makeProblem(skill, level, seed);
        const id = wrongId(p, 'strict-vs-inclusive');
        if (!id) continue;
        const diff = disagreements(predicate(optionOf(p, id)), predicate(optionOf(p, correctOf(p))));
        expect(diff, p.id).toEqual([p.params.a]);
        n++;
      }
      expect(n).toBeGreaterThan(100);
    });
  }

  it('level 3: domain-flipped is the mirror inequality (agrees only at the boundary)', () => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const id = wrongId(p, 'domain-flipped');
      if (!id) continue;
      const diff = disagreements(predicate(optionOf(p, id)), predicate(optionOf(p, correctOf(p))));
      expect(GRID.length - diff.length).toBe(1);
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe('functions-basics: range of a(x-h)^2 + k (level 4)', () => {
  it('exactly the correct option equals the set of attained values', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, h, k } = p.params;
      // y is attained iff (x - h)^2 = (y - k)/a has a real solution
      const attained: Pred = (y) => (y - k) / a >= 0;
      // sanity check against the function itself
      const f = (x: number) => a * (x - h) ** 2 + k;
      for (let x = -20; x <= 20; x += 0.25) expect(attained(f(x))).toBe(true);
      if (p.answer.kind !== 'choice') throw new Error('choice expected');
      const matching = p.answer.options.filter((o) => disagreements(predicate(o.label), attained).length === 0);
      expect(matching.map((o) => o.id), p.id).toEqual([correctOf(p)]);
    }
  });

  it('range-direction flips the inequality; range-used-h uses h in place of k', () => {
    let dir = 0;
    let usedH = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, h, k } = p.params;
      const d = wrongId(p, 'range-direction');
      if (d) {
        expect(optionOf(p, d)).toBe(`$y ${a > 0 ? '\\le' : '\\ge'} ${k}$`);
        dir++;
      }
      const u = wrongId(p, 'range-used-h');
      if (u) {
        expect(optionOf(p, u)).toBe(`$y ${a > 0 ? '\\ge' : '\\le'} ${h}$`);
        usedH++;
      }
    }
    expect(dir).toBeGreaterThan(300);
    expect(usedH).toBeGreaterThan(300);
  });
});
