// Independent re-derivation: the L3 classification by sampling f on a small circle around the
// critical point, and the L5 interpretation (MR equal across markets and equal to marginal cost).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { multivariableOptimization as skill } from '../../src/skills/math/multivariable-optimization';

describe('multivariable optimization level 3', () => {
  it('classifies by sampling around the point; D = 0 is inconclusive', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, a, b, c, xs, ys, g } = p.params;
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const label = p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!.label;
      let expected: string;
      if (form === 0) {
        // f = a x² + b xy + c y² + d x + e y + g with critical point (xs, ys)
        const d = -(2 * a * xs + b * ys);
        const e = -(b * xs + 2 * c * ys);
        const f = (x: number, y: number) => a * x * x + b * x * y + c * y * y + d * x + e * y + g;
        expected = sample(f, xs, ys);
      } else {
        const D = a * c - b * b;
        if (D === 0) expected = 'Test inconclusive';
        else expected = sample((x, y) => 0.5 * a * x * x + b * x * y + 0.5 * c * y * y, 0, 0);
      }
      expect(label).toBe(expected);
      seen.add(expected);
    }
    expect(seen.size).toBe(4);
  });
});

function sample(f: (x: number, y: number) => number, x0: number, y0: number): string {
  const f0 = f(x0, y0);
  let lower = 0;
  let higher = 0;
  for (let i = 0; i < 3600; i++) {
    const t = (2 * Math.PI * i) / 3600;
    const v = f(x0 + 0.1 * Math.cos(t), y0 + 0.1 * Math.sin(t));
    if (v < f0 - 1e-9) lower++;
    else if (v > f0 + 1e-9) higher++;
  }
  if (lower > 0 && higher > 0) return 'Saddle point';
  return lower > 0 ? 'Local maximum' : 'Local minimum';
}

describe('multivariable optimization level 5 interpretation', () => {
  it('marks "MR equal in both markets and equal to marginal cost" correct, and it holds', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { q1, q2, be1, be2, m } = p.params;
      // alpha_i = m + 2 beta_i q_i, so MR_i = alpha_i - 2 beta_i q_i = m in both markets
      const mr1 = m + 2 * be1 * q1 - 2 * be1 * q1;
      const mr2 = m + 2 * be2 * q2 - 2 * be2 * q2;
      expect(mr1).toBe(m);
      expect(mr2).toBe(m);
      if (!p.interpretation) continue;
      const qn = p.interpretation[0];
      expect(qn.options.find((o) => o.id === qn.correct)!.label).toMatch(/^Marginal revenue is the same in both markets and equals marginal cost/);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
});
