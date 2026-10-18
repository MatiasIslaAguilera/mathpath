// Independent check: answers match finite-difference derivatives of the raw function; level 5
// growth rates match a finite-difference derivative of ln Y.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { derivativesExpLog as skill } from '../../src/skills/math/derivatives-exp-log';

const raw: Record<number, (P: Record<string, number>) => (x: number) => number> = {
  1: ({ form, c, k }) => (x) => (form === 0 ? c * Math.exp(k * x) : c * Math.log(x)),
  2: ({ form, a, b }) => (x) => (form === 0 ? Math.log(a * x) : form === 1 ? Math.log(a * x + b) : Math.exp(a * x + b)),
  3: ({ form, a, b, c }) => (x) => (form === 0 ? Math.exp(a * x * x + b * x) : Math.log(a * x * x + c)),
  4: ({ form, a, b, k, m, c }) => (x) => (form === 0 ? (a * x + b) * Math.exp(k * x) : c * x ** m * Math.log(x)),
};

describe('derivatives-exp-log', () => {
  it('levels 1-4 match finite differences (relative)', () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = makeProblem(skill, level, seed);
        if (p.answer.kind !== 'expression') throw new Error('expression expected');
        const f = raw[level](p.params);
        for (const x of [0.4, 0.9, 1.6]) {
          const h = 1e-6;
          const numeric = (f(x + h) - f(x - h)) / (2 * h);
          const claimed = Number(evaluate(p.answer.value, { x }));
          expect(Math.abs(claimed - numeric) / Math.max(1, Math.abs(numeric)), `${p.id} at ${x}`).toBeLessThan(1e-4);
        }
      }
    }
  });
  it('level 5: growth rate = derivative of ln Y', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, Y0, g, a, t0 } = p.params;
      const lnY = (t: number) => (form === 0 ? Math.log(Y0 * Math.exp((g / 100) * t)) : Math.log(Y0 * t ** a));
      const at = form === 0 ? 5 : t0;
      const h = 1e-6;
      const numeric = (lnY(at + h) - lnY(at - h)) / (2 * h);
      const [n, d] = p.answer.kind === 'number' ? p.answer.value.split('/').map(Number) : [NaN];
      expect(d ? n / d : n, p.id).toBeCloseTo(numeric, 5);
    }
  });
});
