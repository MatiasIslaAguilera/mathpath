// Independent check: the answer expression matches a finite-difference derivative of the raw
// function, and the average-cost reading (AC falls ⇔ MC < AC) holds numerically.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { LEVELS } from '../../src/engine/types';
import { derivativesProductQuotient as skill } from '../../src/skills/math/derivatives-product-quotient';

const raw: Record<number, (P: Record<string, number>) => (x: number) => number> = {
  1: ({ a, b, c, d }) => (x) => (a * x + b) * (c * x + d),
  2: ({ a, m, b, c }) => (x) => a * x ** m * (b * x + c),
  3: ({ a, b, c, d }) => (x) => (a * x + b) / (c * x + d),
  4: ({ a, b, c, d }) => (x) => (a * x * x + b) / (c * x + d),
  5: ({ F, v, w }) => (x) => (F + v * x + w * x * x) / x,
};

describe('derivatives-product-quotient', () => {
  it('answers match finite differences of the raw function', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = makeProblem(skill, level, seed);
        if (p.answer.kind !== 'expression') throw new Error('expression expected');
        const f = raw[level](p.params);
        const v = p.answer.variables[0];
        for (const x of [0.7, 1.9, 3.1]) {
          const h = 1e-6;
          const numeric = (f(x + h) - f(x - h)) / (2 * h);
          expect(Number(evaluate(p.answer.value, { [v]: x })), `${p.id} at ${x}`).toBeCloseTo(numeric, 3);
        }
      }
    }
  });

  it('level 5: AC is falling exactly where MC < AC', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { F, v, w } = p.params;
      for (const x of [1, 3, 8, 20]) {
        const ac = (F + v * x + w * x * x) / x;
        const mc = v + 2 * w * x;
        const acSlope = Number(p.answer.kind === 'expression' && evaluate(p.answer.value, { q: x }));
        if (Math.abs(mc - ac) > 1e-9) expect(acSlope < 0, p.id).toBe(mc < ac);
      }
    }
  });
});
