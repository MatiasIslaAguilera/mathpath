// Independent checks: elasticities from raw numbers (finite percentage changes, not the
// dQ/dP·P/Q formula), the classification, and the revenue reading by direct computation.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { elasticity as skill } from '../../src/skills/econ/elasticity';

const num = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const correctLabel = (opts: { id: string; label: string }[], id: string) => opts.find((o) => o.id === id)!.label;

describe('elasticity', () => {
  it('level 1: matches a tiny-change percentage ratio, and the 1% reading', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { a, b, P0 } = p.params;
      const Qf = (P: number) => a - b * P;
      const h = 1e-7;
      const e = ((Qf(P0 + h) - Qf(P0)) / Qf(P0)) / (h / P0);
      expect(p.answer.kind === 'number' && num(p.answer.value), p.id).toBeCloseTo(e, 5);
      const iq = p.interpretation![0];
      expect(correctLabel(iq.options, iq.correct)).toMatch(/falls by about/);
    }
  });

  it('level 2: classification and revenue direction by computing revenue directly', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { a, b, P0 } = p.params;
      const absE = (b * P0) / (a - b * P0);
      const want = Math.abs(absE - 1) < 1e-12 ? 'unit' : absE > 1 ? 'elastic' : 'inelastic';
      expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(want);
      // Revenue just above vs at P0.
      const R = (P: number) => P * (a - b * P);
      const dR = R(P0 * 1.0001) - R(P0);
      const iq = p.interpretation![0];
      const label = correctLabel(iq.options, iq.correct);
      if (want === 'unit') expect(label).toMatch(/same/);
      else expect(label).toMatch(dR < 0 ? /falls/ : /rises/);
    }
  });

  it('level 3: midpoint formula from the two points', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { a, b, P1, P2 } = p.params;
      const Q1 = a - b * P1;
      const Q2 = a - b * P2;
      const e = ((Q2 - Q1) / ((Q1 + Q2) / 2)) / ((P2 - P1) / ((P1 + P2) / 2));
      expect(p.answer.kind === 'number' && num(p.answer.value), p.id).toBeCloseTo(e, 9);
    }
  });

  it('level 4: constant elasticity is the same at every price', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { A, k } = p.params;
      for (const P of [2, 7, 19]) {
        const Qf = (x: number) => A * x ** -k;
        const h = 1e-7;
        expect(((Qf(P + h) - Qf(P)) / Qf(P)) / (h / P)).toBeCloseTo(-k, 4);
      }
      expect(p.answer.kind === 'number' && num(p.answer.value)).toBeCloseTo(-k, 12);
    }
  });

  it('level 5: grid-search revenue maximum, unit elastic there', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, b } = p.params;
      let best = 0;
      for (let P = 0; P <= a / b; P += 0.005) if (P * (a - b * P) > best * (a - b * best)) best = P;
      const [Pstar, e] = p.answer.kind === 'tuple' ? p.answer.values.map(num) : [];
      expect(Math.abs(best - Pstar), p.id).toBeLessThan(0.01);
      expect(e).toBe(-1);
    }
  });
});
