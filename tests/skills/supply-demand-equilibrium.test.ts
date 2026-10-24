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

describe('supply & demand story variants', () => {
  const demandOf = (p: ReturnType<typeof makeProblem>) => {
    const { a, b } = p.params;
    return (price: number) => a - b * price;
  };

  it('the story numbers describe the same market the params do', () => {
    for (const level of [1, 4] as const) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed, 'story');
        const { a, b, c, d, t = 0 } = p.params;
        const text = p.prompt;
        seen.add(p.steps[0].key);
        if (p.steps[0].key === 'setup-points') {
          const m = text.match(/At \\\$(\d+) buyers took (\d+)[^;]*; at \\\$(\d+) they took (\d+)/)!;
          const [p1, q1, p2, q2] = m.slice(1).map(Number);
          expect(p1, p.id).not.toBe(p2);
          expect(q1, p.id).toBeGreaterThan(0);
          expect(q2, p.id).toBeGreaterThan(0);
          expect(q1, p.id).toBe(demandOf(p)(p1));
          expect(q2, p.id).toBe(demandOf(p)(p2));
        } else if (p.steps[0].key === 'setup-shift') {
          const m = text.match(/normally \$Q_d = (\d+) - (\d*)P\$.* adds (\d+) /)!;
          const a0 = Number(m[1]);
          expect(a0 + Number(m[3]), p.id).toBe(a);
          expect(a0, p.id).toBeGreaterThan(0);
          expect(Number(m[3])).toBeGreaterThanOrEqual(5);
          expect(Number(m[3])).toBeLessThanOrEqual(30);
          expect(m[2] === '' ? 1 : Number(m[2]), p.id).toBe(b);
        } else {
          expect(p.steps[0].key).toBe('setup-words');
          expect(text, p.id).toContain(`${a} `);
        }
        // Supply in words matches c and d (and the tax, at level 4).
        expect(c, p.id).toBeGreaterThanOrEqual(0);
        if (c > 0) expect(text, p.id).toContain(`${c} `);
        expect(text, p.id).toContain(`${d} `);
        if (level === 4) expect(text, p.id).toContain(`\\$${t} to the government`);
        // The answer solves both curves independently.
        const [P, Qn] = p.answer.kind === 'tuple' ? p.answer.values.map(Number) : [];
        expect(demandOf(p)(P), p.id).toBe(Qn);
        expect(c + d * (P - t), p.id).toBe(Qn);
        // The interpretation question is the plain level's.
        expect(p.interpretation!.length, p.id).toBe(2);
        if (level === 4) {
          const ans = label(p, 0);
          if (d > b) expect(ans).toMatch(/Buyers/);
          else if (d < b) expect(ans).toMatch(/Sellers/);
          else expect(ans).toMatch(/equally/);
          expect(label(p, 1)).toContain(`${P - t}`);
        }
      }
      expect([...seen].sort()).toEqual(['setup-points', 'setup-shift', 'setup-words']);
    }
  });
});
