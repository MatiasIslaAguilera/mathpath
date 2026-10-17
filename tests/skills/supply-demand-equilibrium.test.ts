// Skill-specific checks the generic harness can't do: interpretation questions are
// re-derived here from the raw params, independently of the generator's logic.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { supplyDemandEquilibrium as skill } from '../../src/skills/econ/supply-demand-equilibrium';
import { LEVELS } from '../../src/engine/types';

const label = (p: ReturnType<typeof makeProblem>, i: number) => {
  const iq = p.interpretation![i];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};

describe('supply & demand interpretation', () => {
  it('surplus/shortage answer matches Qd vs Qs at the stated price', () => {
    for (const level of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const { a, b, c, d } = p.params;
        const price = Number(p.interpretation![0].prompt.match(/\\\$([\d.]+)/)![1]);
        const qd = level === 3 ? (a - price) / b : a - b * price;
        const qs = level === 3 ? (price - c) / d : c + d * price;
        expect(qd).toBeGreaterThanOrEqual(0);
        const ans = label(p, 0);
        const gap = Math.abs(qs - qd);
        expect(ans).toContain(qs > qd ? 'Surplus' : 'Shortage');
        expect(ans).toContain(qs > qd ? 'fall' : 'rise');
        expect(ans).toContain(`${gap} units`);
      }
    }
  });

  it('tax burden falls on the less price-responsive side', () => {
    for (const level of [4, 5] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const { b, d } = p.params;
        const ans = label(p, 0);
        // Buyers' share of a per-unit tax with linear curves is d / (b + d).
        if (d > b) expect(ans).toMatch(/Buyers/);
        else if (d < b) expect(ans).toMatch(/Sellers/);
        else expect(ans).toMatch(/equally/);
        expect(label(p, 1)).toContain(`${p.params.P - p.params.t}`);
      }
    }
  });

  it('every level produces interpretation questions', () => {
    for (const level of LEVELS) expect(makeProblem(skill, level, 1).interpretation!.length).toBeGreaterThan(0);
  });
});
