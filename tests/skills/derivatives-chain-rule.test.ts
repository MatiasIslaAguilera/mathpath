// Independent check: answers match finite-difference derivatives of the raw composite.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { derivativesChainRule as skill } from '../../src/skills/math/derivatives-chain-rule';

const raw: Record<number, (P: Record<string, number>) => (x: number) => number> = {
  1: ({ a, b, n }) => (x) => (a * x + b) ** n,
  2: ({ a, b, c, n }) => (x) => (a * x * x + b * x + c) ** n,
  3: ({ form, a, b, k }) => (x) => (form === 0 ? Math.sqrt(a * x * x + b) : (a * x + b) ** -k),
  4: ({ a, b, n }) => (x) => x * (a * x + b) ** n,
  5: ({ a, b, n }) => (x) => (a * x * x + b) ** n,
};

describe('derivatives-chain-rule', () => {
  it('expression answers match finite differences', () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = makeProblem(skill, level, seed);
        if (p.answer.kind !== 'expression') throw new Error('expression expected');
        const f = raw[level](p.params);
        for (const x of [0.6, 1.3, 2.2]) {
          const h = 1e-6;
          const numeric = (f(x + h) - f(x - h)) / (2 * h);
          expect(Number(evaluate(p.answer.value, { x })) / numeric, `${p.id} at ${x}`).toBeCloseTo(1, 4);
        }
      }
    }
  });
  it('level 5: value at the point', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 5, seed);
      const f = raw[5](p.params);
      const x0 = p.params.x0;
      const h = 1e-6;
      const numeric = (f(x0 + h) - f(x0 - h)) / (2 * h);
      const v = p.answer.kind === 'number' ? p.answer.value.split('/').map(Number) : [NaN];
      expect(v.length > 1 ? v[0] / v[1] : v[0], p.id).toBeCloseTo(numeric, 2);
    }
  });
});
