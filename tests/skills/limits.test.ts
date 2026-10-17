// Independent check: approach each limit numerically from the raw params (both sides, or large x).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { limits as skill } from '../../src/skills/math/limits';

const ans = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('number expected');
  const [n, d] = p.answer.value.split('/').map(Number);
  return d ? n / d : n;
};
const near = (f: (x: number) => number, a: number) => (f(a + 1e-7) + f(a - 1e-7)) / 2;

describe('limits', () => {
  it('level 1 and 2: two-sided numeric approach', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p1 = makeProblem(skill, 1, seed);
      const { a, b, c, k, x0 } = p1.params;
      expect(near((x) => (a * x * x + b * x + c) / (x + k), x0), p1.id).toBeCloseTo(ans(p1), 5);
      const p2 = makeProblem(skill, 2, seed);
      const { r, s } = p2.params;
      expect(near((x) => (x * x - (r + s) * x + r * s) / (x - r), r), p2.id).toBeCloseTo(ans(p2), 5);
    }
  });
  it('level 3: large x', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { lower, a, b, c, d, e, f } = p.params;
      const top = (x: number) => (lower ? a * x + c : a * x * x + b * x + c);
      const x = 1e8;
      expect(top(x) / (d * x * x + e * x + f), p.id).toBeCloseTo(ans(p), 4); // next-order term is ~1e-7 at x = 1e8
    }
  });
  it('level 4: k makes the pieces meet', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, b, c } = p.params;
      expect(ans(p) * c * c, p.id).toBeCloseTo(a * c + b, 9);
    }
  });
  it('level 5: conjugate limit numerically', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, m } = p.params;
      expect(near((x) => (Math.sqrt(a * x + m * m) - m) / x, 0), p.id).toBeCloseTo(ans(p), 5);
    }
  });
});
