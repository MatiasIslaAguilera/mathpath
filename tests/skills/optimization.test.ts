// Independent check: brute-force grid search of each objective (no calculus) must land on the
// generator's optimum, and the optimal value must match.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { optimization as skill } from '../../src/skills/math/optimization';

const values = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'tuple') throw new Error('expected tuple');
  return p.answer.values.map((v) => {
    const [n, d] = v.split('/').map(Number);
    return d ? n / d : n;
  });
};

function gridBest(f: (x: number) => number, lo: number, hi: number, maximize: boolean) {
  let best = lo;
  for (let x = lo; x <= hi; x += 0.005) if (maximize ? f(x) > f(best) : f(x) < f(best)) best = x;
  return best;
}

describe('optimization', () => {
  const cases: [number, (P: Record<string, number>) => { f: (x: number) => number; hi: number; max: boolean; second?: (x: number) => number }][] = [
    [1, ({ a, b }) => ({ f: (x) => a * x - b * x * x, hi: 200, max: true })],
    [2, ({ F, w }) => ({ f: (x) => F / x + w * x, hi: 40, max: false })],
    [3, ({ p, v, w, F }) => ({ f: (x) => p * x - (F + v * x + w * x * x), hi: 60, max: true })],
    [4, ({ A, B, c }) => ({ f: (x) => (A - B * x) * x - c * x, hi: 120, max: true, second: (x) => A - B * x })],
    [5, ({ L }) => ({ f: (x) => x * (L - 2 * x), hi: 80, max: true })],
  ];
  for (const [level, make] of cases) {
    it(`level ${level}: grid search agrees`, () => {
      for (let seed = 1; seed <= 120; seed++) {
        const p = makeProblem(skill, level as 1, seed);
        const { f, hi, max, second } = make(p.params);
        const [xStar, v] = values(p);
        const best = gridBest(f, 0.01, hi, max);
        expect(Math.abs(best - xStar), `${p.id} argopt`).toBeLessThan(0.01);
        expect(second ? second(xStar) : f(xStar), `${p.id} value`).toBeCloseTo(v, 6);
      }
    });
  }

  it('level 4: price ends up above marginal cost (market power)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 4, seed);
      const iq = p.interpretation![0];
      expect(iq.options.find((o) => o.id === iq.correct)!.label).toBe('Price is above marginal cost');
      expect(values(p)[1]).toBeGreaterThan(p.params.c);
    }
  });
});
