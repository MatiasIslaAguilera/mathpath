// Independent checks: rebuild f from the raw params and use finite differences (not the
// generator's symbolic derivatives) for f′ and f″.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { concavitySecondDerivative as skill } from '../../src/skills/math/concavity-second-derivative';

const h = 1e-3;
const d1 = (f: (x: number) => number, x: number) => (f(x + h) - f(x - h)) / (2 * h);
const d2 = (f: (x: number) => number, x: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
const label = (p: ReturnType<typeof makeProblem>, iq?: number) => {
  const a = iq === undefined ? p.answer : null;
  if (a && a.kind === 'choice') return a.options.find((o) => o.id === a.correct)!.label;
  const q = p.interpretation![iq!];
  return q.options.find((o) => o.id === q.correct)!.label;
};

describe('concavity-second-derivative', () => {
  it('level 2: f″(x0) and the concavity reading', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { a, b, c, d, x0 } = p.params;
      const f = (x: number) => a * x ** 3 + b * x ** 2 + c * x + d;
      const curv = d2(f, x0);
      expect(Number(p.answer.kind === 'number' && eval(p.answer.value)), p.id).toBeCloseTo(curv, 3);
      const l = label(p, 0);
      if (Math.abs(curv) < 1e-6) expect(l).toMatch(/Neither/);
      else expect(l).toMatch(curv > 0 ? /Concave up/ : /Concave down/);
    }
  });

  it('level 4: the critical point is real and classified by the sign of f″', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, r1, r2, d, at } = p.params;
      const f = (x: number) => a * x ** 3 - ((3 * a * (r1 + r2)) / 2) * x ** 2 + 3 * a * r1 * r2 * x + d;
      expect(Math.abs(d1(f, at)), `${p.id} f'(at)=0`).toBeLessThan(1e-4);
      expect(label(p), p.id).toBe(d2(f, at) < 0 ? 'A local maximum' : 'A local minimum');
    }
  });

  it('level 5: the answer maximizes profit over positive output', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, r1, r2 } = p.params;
      const pi = (x: number) => -a * x ** 3 + ((3 * a * (r1 + r2)) / 2) * x ** 2 - 3 * a * r1 * r2 * x;
      const qStar = Number(p.answer.kind === 'number' && p.answer.value);
      // Brute force: the best output on a fine grid of positive quantities is q*.
      let best = 0;
      for (let x = 0.01; x <= 30; x += 0.01) if (pi(x) > pi(best)) best = x;
      expect(Math.abs(best - qStar), p.id).toBeLessThan(0.02);
      expect(label(p, 0)).toMatch(/^0/);
    }
  });
});
