// Independent checks for Cramer's rule: every answer solves the system (by direct substitution,
// not by determinants), and the L5 interpretation's correct option is re-derived from the model.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { cramersRule as skill } from '../../src/skills/math/cramers-rule';

const val = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const answerValues = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind === 'number') return [val(p.answer.value)];
  if (p.answer.kind === 'tuple') return p.answer.values.map(val);
  throw new Error('unexpected answer kind');
};

describe("cramers-rule: answers solve the system", () => {
  it('L1-L3: both equations hold at the answer', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const level of [1, 2, 3] as const) {
        const p = makeProblem(skill, level, seed);
        const { a, b, c, d } = p.params;
        let x: number;
        let y: number;
        let e: number;
        let f: number;
        if (level === 3) {
          ({ e, f } = p.params);
          [x, y] = answerValues(p);
        } else {
          x = p.params.x;
          y = p.params.y;
          e = a * x + b * y;
          f = c * x + d * y;
          const got = answerValues(p);
          expect(got[0], p.id).toBeCloseTo(x, 9);
          if (level === 2) expect(got[1], p.id).toBeCloseTo(y, 9);
          continue;
        }
        expect(a * x + b * y, p.id).toBeCloseTo(e, 9);
        expect(c * x + d * y, p.id).toBeCloseTo(f, 9);
      }
    }
  });

  it('L4: the named unknown solves the 3x3 system', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 4, seed);
      const q = p.params;
      const sol = [q.x, q.y, q.z];
      const A = [
        [q.m11, q.m12, q.m13],
        [q.m21, q.m22, q.m23],
        [q.m31, q.m32, q.m33],
      ];
      // The stated solution satisfies the system the prompt was built from, and the answer is its component.
      expect(answerValues(p)[0], p.id).toBeCloseTo(sol[q.which], 9);
      // Independent: Gaussian elimination on the stored matrix gives a unique solution equal to sol.
      const rhs = A.map((r) => r.reduce((t, v, i) => t + v * sol[i], 0));
      const aug = A.map((r, i) => [...r, rhs[i]]);
      for (let i = 0; i < 3; i++) {
        let piv = i;
        for (let r = i + 1; r < 3; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[piv][i])) piv = r;
        [aug[i], aug[piv]] = [aug[piv], aug[i]];
        expect(Math.abs(aug[i][i]), p.id).toBeGreaterThan(1e-9);
        for (let r = 0; r < 3; r++)
          if (r !== i) {
            const k = aug[r][i] / aug[i][i];
            for (let c = i; c < 4; c++) aug[r][c] -= k * aug[i][c];
          }
      }
      for (let i = 0; i < 3; i++) expect(aug[i][3] / aug[i][i], p.id).toBeCloseTo(sol[i], 9);
    }
  });

  it('L5: (Y, C) satisfies Y = C + I0 + G0 and C = a + bY', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, bp, I0, G0 } = p.params;
      const b = bp / 100;
      const [Y, C] = answerValues(p);
      expect(Y, p.id).toBeCloseTo(C + I0 + G0, 9);
      expect(C, p.id).toBeCloseTo(a + b * Y, 9);
      expect(Number.isInteger(Math.round(Y * 1e6) / 1e6), p.id).toBe(true);
    }
  });
});

describe('cramers-rule: L5 interpretation (multiplier)', () => {
  it('the correct option is dG / (1 - b), and the options are distinct', () => {
    let seen = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      seen++;
      const b = p.params.bp / 100;
      const iq = p.interpretation[0];
      const dG = Number(/rises by (\d+)/.exec(iq.prompt)![1]);
      // Independent: solve the model for two values of G0 by substitution and take the difference.
      const solveY = (G: number) => (p.params.a + p.params.I0 + G) / (1 - b);
      const dY = solveY(p.params.G0 + dG) - solveY(p.params.G0);
      const parse = (label: string) => {
        const m = /^\$(-?)(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+(?:\.\d+)?))\$$/.exec(label)!;
        const v = m[4] !== undefined ? Number(m[4]) : Number(m[2]) / Number(m[3]);
        return m[1] ? -v : v;
      };
      const correct = iq.options.find((o) => o.id === iq.correct)!;
      expect(parse(correct.label), p.id).toBeCloseTo(dY, 6);
      const vals = iq.options.map((o) => parse(o.label).toFixed(6));
      expect(new Set(vals).size, p.id).toBe(vals.length);
      expect(iq.options.filter((o) => Math.abs(parse(o.label) - dY) < 1e-6).length, p.id).toBe(1);
    }
    expect(seen).toBeGreaterThan(100);
  });
});
