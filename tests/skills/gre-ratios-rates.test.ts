// Independent re-derivations for gre-ratios-rates from raw params / option labels.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greRatiosRates as skill } from '../../src/skills/gre/gre-ratios-rates';

const ans = (p: ReturnType<typeof makeProblem>) => (p.answer.kind === 'number' ? Number(eval(p.answer.value)) : NaN);

describe('gre-ratios-rates', () => {
  it('level 1: shares add up, and select-all options are exactly the proportional ratios', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, a, b, c, k, idx, t } = p.params;
      if (form === 0) {
        const parts = c ? [a, b, c] : [a, b];
        expect(parts.reduce((s, x) => s + x, 0) * k, p.id).toBe(t);
        expect(ans(p), p.id).toBe((t * parts[idx]) / parts.reduce((s, x) => s + x, 0));
      } else {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const want = p.answer.options
          .filter((o) => {
            const [x, y] = o.label.replace(/\$/g, '').split(':').map(Number);
            return x * b === y * a;
          })
          .map((o) => o.id)
          .sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(want);
        expect(want.length).toBeGreaterThan(0);
      }
    }
  });

  it('level 2: the combined time satisfies 1/a + 1/b = 1/t (exact, by cross-multiplying)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, a, b, t } = p.params;
      const x = ans(p);
      if (form === 0) expect(x * (a + b), p.id).toBe(a * b); // t = ab/(a+b)
      else {
        expect(x * (a - t), p.id).toBe(a * t); // 1/t = 1/a + 1/x  =>  x = at/(a - t)
        expect(x * a * t * 0 + (x + a) * t, p.id).toBe(x * a); // and x + a over product = 1/t
      }
    }
  });

  it('level 3: average speed from total distance/total time; QC by direct evaluation', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, u, v, sub } = p.params;
      // one-way distance L = u*v: times v and u; round trip = 2uv over (u+v)
      const avg = (2 * u * v) / (v + u);
      if (form === 0) expect(ans(p), p.id).toBe(avg);
      else if (form === 1) {
        const l = avg, r = (u + v) / 2;
        expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(l > r ? 'a' : l < r ? 'b' : 'c');
      } else {
        // u, v on a grid of positive values (u != v when sub = 0): harmonic <= arithmetic, equal iff u = v
        const g = [1, 2, 3, 5, 10, 40, 60, 100];
        const signs = new Set<number>();
        for (const x of g) for (const y of g) if (sub === 1 || x !== y) signs.add(Math.sign(Math.round((2 * x * y) / (x + y) * 1e9) - Math.round(((x + y) / 2) * 1e9)));
        const exp = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
        expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(exp);
      }
    }
  });

  it('level 4: rate x time with the right unit conversions', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, s, t, d, x, h, v } = p.params;
      const got = ans(p);
      if (form === 0) expect(got, p.id).toBe((s * (t / 60)));
      else if (form === 1) expect(got / 60 * s, p.id).toBeCloseTo(d, 9); // minutes -> hours times speed = distance
      else if (form === 2) expect(got, p.id).toBe(x * h * 60);
      else expect(got * 1000, p.id).toBe(v * 3600); // km/h * 1000 m = m/s * 3600 s
    }
  });

  it('level 5: mixtures conserve the solute; QC checked on a grid', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, x, y, c1, c2, sub } = p.params;
      if (form === 0) expect(ans(p) * (x + y), p.id).toBe(x * c1 + y * c2);
      else if (form === 1) expect(c2 * (x + ans(p)), p.id).toBe(x * c1); // solute c1*x = c2*(x + water)
      else {
        const mid = (c1 + c2) / 2;
        const conc = (X: number, Y: number) => (X * c1 + Y * c2) / (X + Y);
        const g = [0.5, 1, 2, 3, 10, 25, 49];
        let pts: [number, number][];
        if (sub === 0) pts = [[x, y]];
        else pts = g.flatMap((X) => g.map((Y): [number, number] => [X, Y])).filter(([X, Y]) => (sub === 1 ? true : sub === 2 ? X > Y : Y > X));
        const signs = new Set(pts.map(([X, Y]) => Math.sign(Math.round((conc(X, Y) - mid) * 1e9))));
        const exp = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
        expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(exp);
      }
    }
  });
});
