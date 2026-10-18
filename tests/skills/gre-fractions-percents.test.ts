// Independent re-derivations for gre-fractions-percents, from raw params and option labels,
// using plain JS (exact integer cross-multiplication, not the generator's Q arithmetic).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greFractionsPercents as skill } from '../../src/skills/gre/gre-fractions-percents';

const frac = (label: string): [number, number] => {
  const m = label.match(/\\frac\{(\d+)\}\{(\d+)\}/)!;
  return [Number(m[1]), Number(m[2])];
};

describe('gre-fractions-percents', () => {
  it('level 1: percent change relative to the original', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { old, nw, up } = p.params;
      expect(up === 1 ? nw > old : nw < old, p.id).toBe(true);
      expect(p.answer.kind === 'number' && Number(p.answer.value) * old, p.id).toBeCloseTo(Math.abs(nw - old) * 100, 9);
    }
  });

  it('level 2: net change by direct multiplication; QC cases by plug-in', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, a, b, s1, s2, sub, price } = p.params;
      if (form === 0) {
        const net = (1 + (s1 * a) / 100) * (1 + (s2 * b) / 100) - 1;
        expect(p.answer.kind === 'number' && Number(p.answer.value), p.id).toBeCloseTo(net * 100, 6);
      } else {
        const f = (x: number, y: number) => price * (1 + x / 100) * (1 - y / 100);
        // sample grid (percent values strictly between 0 and 100)
        const xs = [1, 5, 10, 25, 50, 75, 99];
        const signs = new Set<number>();
        for (const x of xs)
          for (const y of sub === 2 ? xs : [x]) {
            if (sub === 1) signs.add(Math.sign(+(f(x, x) - f(x, x)).toFixed(9)));
            else signs.add(Math.sign(+(f(x, y) - price).toFixed(9)));
          }
        const expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
        expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(expected);
      }
    }
  });

  it('level 3: fraction comparison and select-all by cross-multiplication', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, n1, d1, n2, d2, tn, td } = p.params;
      if (p.answer.kind === 'multi') {
        expect(form).toBe(1);
        const want = p.answer.options.filter((o) => { const [n, d] = frac(o.label); return n * td > tn * d; }).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(want);
        expect(want.length).toBeGreaterThan(0);
      } else {
        const l = n1 * d2;
        const r = n2 * d1;
        expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(l > r ? 'a' : l < r ? 'b' : 'c');
      }
    }
  });

  it('level 4: the correct original, reduced/increased by the percent, gives the stated price', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, d, orig, price, a, b, n } = p.params;
      if (form === 2) {
        expect(p.answer.kind === 'number' && Number(p.answer.value), p.id).toBeCloseTo((n * (a / 100) * (b / 100)), 9);
      } else if (p.answer.kind === 'choice') {
        const o = p.answer.options.find((x) => x.id === (p.answer as { correct: string }).correct)!;
        const val = Number(o.label.replace(/[^0-9.]/g, ''));
        expect(val * (1 - d / 100), p.id).toBeCloseTo(price, 9);
        expect(val).toBe(orig);
        // the trap price*(1+d%) is offered and wrong
        expect(p.answer.options.some((x) => Math.abs(Number(x.label.replace(/[^0-9.]/g, '')) - price * (1 + d / 100)) < 1e-9)).toBe(true);
      } else {
        expect(p.answer.kind === 'number' && Number(p.answer.value) * (1 + d / 100), p.id).toBeCloseTo(price, 9);
      }
    }
  });

  it('level 5: QC verified over a grid of exact test values', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, k, sub, a, b } = p.params;
      const grid = [-100, -10, -1, -0.5, 0, 0.5, 1, 10, 50, 99, 100, 101, 250, 1000];
      let ok: (v: number) => boolean;
      let A: (v: number) => number;
      let B: (v: number) => number;
      if (form === 0) {
        ok = (v) => v > 0; A = (v) => (v / 100) * k; B = (v) => (k / 100) * v;
      } else if (form === 1) {
        ok = [(v: number) => v > 100, (v: number) => v > 0 && v < 100, (v: number) => v > 0][sub]; A = (v) => (v / 100) * k; B = () => k;
      } else {
        ok = [(v: number) => v > 0, (v: number) => v < 0, (v: number) => v !== 0, (v: number) => v >= 0][sub]; A = (v) => (a / 100) * v; B = (v) => (b / 100) * v;
      }
      const signs = new Set(grid.filter(ok).map((v) => Math.sign(+(A(v) - B(v)).toFixed(9))));
      const expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
      expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(expected);
    }
  });
});
