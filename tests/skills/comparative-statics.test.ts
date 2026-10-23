// Independent checks for comparative statics: every answer is recomputed numerically by solving the
// model at shifter = s and s + 1 and differencing (exact for these linear models), and each
// interpretation question's correct option is re-derived from the params.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { comparativeStatics as skill } from '../../src/skills/econ/comparative-statics';

const val = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const ans = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('number answer expected');
  return val(p.answer.value);
};
const correctLabel = (p: ReturnType<typeof makeProblem>, i = 0) => {
  const iq = p.interpretation![i];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};
/** Root of a function that is linear in x. */
const root = (g: (x: number) => number) => {
  const g0 = g(0);
  return -g0 / (g(1) - g0);
};
const SEEDS = 300;

describe('comparative-statics: answers match a finite difference of the solved model', () => {
  it('L1 demand shifter', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { a, b, c, d, e } = p.params;
      const Pstar = (Y: number) => root((P) => a - b * P + c * Y - (d + e * P));
      expect(ans(p), p.id).toBeCloseTo(Pstar(1) - Pstar(0), 9);
    }
  });

  it('L2 tax incidence', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { a, b, d, e, form } = p.params;
      const Pstar = (t: number) => root((P) => a - b * P - (d + e * (P - t)));
      const buyers = Pstar(1) - Pstar(0);
      expect(ans(p), p.id).toBeCloseTo(form === 0 ? buyers : 1 - buyers, 9);
    }
  });

  it('L3 taxed monopolist', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { A, B, c, F, form } = p.params;
      const profit = (qq: number, t: number) => (A - B * qq) * qq - c * qq - F - t * qq;
      // profit is quadratic in q: its maximizer is where the (exact) derivative is zero
      const qStar = (t: number) => root((qq) => (profit(qq + 1, t) - profit(qq, t)) + (profit(qq, t) - profit(qq - 1, t))) / 1;
      const q0 = qStar(0);
      const q1 = qStar(1);
      expect(q1 - q0, p.id).toBeCloseTo(-1 / (2 * B), 9);
      const dP = A - B * q1 - (A - B * q0);
      expect(ans(p), p.id).toBeCloseTo(form === 0 ? q1 - q0 : dP, 9);
    }
  });

  it('L4 Keynesian multipliers', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, bn, bd, I, G, T, form } = p.params;
      const b = bn / bd;
      const Y = (g: number, t: number) => root((y) => y - (a + b * (y - t) + I + g));
      const base = Y(G, T);
      const want = form === 0 ? Y(G + 1, T) - base : form === 1 ? Y(G, T + 1) - base : Y(G + 1, T + 1) - base;
      expect(ans(p), p.id).toBeCloseTo(want, 9);
    }
  });

  it('L5 two-country model (solved by elimination)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a1, a2, I1, I2, which, b1n, b1d, b2n, b2d, m1n, m1d, m2n, m2d } = p.params;
      const [b1, b2, m1, m2] = [b1n / b1d, b2n / b2d, m1n / m1d, m2n / m2d];
      const solve = (i1: number) => {
        // Y1 = a1 + b1 Y1 + i1 + m2 Y2 - m1 Y1;  Y2 = a2 + b2 Y2 + I2 + m1 Y1 - m2 Y2
        const Y2of = (y1: number) => (a2 + I2 + m1 * y1) / (1 - b2 + m2);
        const y1 = root((y) => y - (a1 + b1 * y + i1 + m2 * Y2of(y) - m1 * y));
        return [y1, Y2of(y1)];
      };
      const [x0, z0] = solve(I1);
      const [x1, z1] = solve(I1 + 1);
      expect(ans(p), p.id).toBeCloseTo(which === 0 ? x1 - x0 : z1 - z0, 9);
    }
  });
});

describe('comparative-statics: interpretation answers are re-derived from the params', () => {
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  it('L1: normal vs inferior follows the sign of c', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 1, seed);
      if (!p.interpretation) continue;
      seen[1]++;
      expect(correctLabel(p).startsWith(p.params.c > 0 ? 'Normal' : 'Inferior'), p.id).toBe(true);
    }
  });
  it('L2: the less responsive side bears more', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (!p.interpretation) continue;
      seen[2]++;
      const { b, e } = p.params;
      const want = e > b ? 'Buyers' : e < b ? 'Sellers:' : 'Neither';
      expect(correctLabel(p).startsWith(want), p.id).toBe(true);
    }
  });
  it('L3: the tax lowers output', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 3, seed);
      if (!p.interpretation) continue;
      seen[3]++;
      expect(correctLabel(p).startsWith('Output falls'), p.id).toBe(true);
    }
  });
  it('L4: the right reason for each multiplier', () => {
    const key = ['are spent again', 'only the fraction', 'leaving 1'];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (!p.interpretation) continue;
      seen[4]++;
      const label = correctLabel(p);
      const want = ['a fraction $b$ of that is spent again', 'only the fraction $b$ of it is spent', 'leaving 1'][p.params.form];
      expect(label.includes(want), `${p.id} ${key[p.params.form]}`).toBe(true);
    }
  });
  it('L5: exports linkage (country 2) and leakage (country 1)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      seen[5]++;
      const { which, b1n, b1d, b2n, b2d, m1n, m1d, m2n, m2d } = p.params;
      const label = correctLabel(p);
      if (which === 1) {
        expect(label, p.id).toContain("country 2's exports");
      } else {
        const [b1, b2, m1, m2] = [b1n / b1d, b2n / b2d, m1n / m1d, m2n / m2d];
        const k1 = 1 - b1 + m1;
        const k2 = 1 - b2 + m2;
        const open = k2 / (k1 * k2 - m1 * m2);
        const closed = 1 / (1 - b1);
        expect(label.startsWith(open < closed ? 'Smaller' : 'Larger'), p.id).toBe(true);
      }
    }
  });
  it('every level draws interpretation questions sometimes', () => {
    for (const l of [1, 2, 3, 4, 5] as const) expect(seen[l], `level ${l}`).toBeGreaterThan(20);
  });
});
