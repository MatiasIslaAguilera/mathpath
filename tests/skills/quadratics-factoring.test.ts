// Skill-specific checks: roots are re-derived from the params (not from the generator's
// answer), tuples are sorted ascending, and the sign-of-the-expression question is re-derived.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { quadraticsFactoring as skill } from '../../src/skills/math/quadratics-factoring';
import type { Level } from '../../src/engine/types';

const num = (v: string) => {
  const [n, d] = v.split('/').map(Number);
  return d ? n / d : n;
};
const roots = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'tuple') throw new Error('expected tuple');
  return p.answer.values.map(num);
};
const correctLabel = (p: ReturnType<typeof makeProblem>) => {
  const iq = p.interpretation![0];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};

/** Roots derived straight from each level's params. */
function expectedRoots(level: Level, P: Record<string, number>): number[] {
  switch (level) {
    case 1:
    case 3:
      return [P.r1, P.r2];
    case 2:
      return P.form === 0 ? [-P.k, P.k] : [Math.min(0, -P.b), Math.max(0, -P.b)];
    case 4:
      return [-P.q / P.p, -P.s / P.r].sort((x, y) => x - y);
    case 5: {
      // Solve the standard form from the original equation's coefficients.
      const bp = P.form === 0 ? P.b - P.c : P.p + P.q;
      const cp = P.form === 0 ? -P.d : P.p * P.q - P.k;
      const disc = Math.sqrt(bp * bp - 4 * cp);
      return [(-bp - disc) / 2, (-bp + disc) / 2];
    }
  }
}

describe('quadratics-factoring', () => {
  it('roots match the params, are sorted ascending and distinct at every level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const [r1, r2] = roots(p);
        const [e1, e2] = expectedRoots(level, p.params);
        expect(r1, `${p.id} sorted`).toBeLessThan(r2);
        expect(r1, `${p.id} smaller root`).toBeCloseTo(e1, 9);
        expect(r2, `${p.id} larger root`).toBeCloseTo(e2, 9);
      }
    }
  });

  it('level 5 original equation holds at both roots', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, b, c, d, p: pp, q, k } = p.params;
      for (const x of roots(p)) {
        if (form === 0) expect(x * x + b * x).toBeCloseTo(c * x + d, 9);
        else {
          expect(k).not.toBe(0);
          expect((x + pp) * (x + q)).toBeCloseTo(k, 9);
        }
      }
    }
  });

  it('every tuple misconception is sorted ascending', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const m of makeProblem(skill, level, seed).misconceptions) {
          if (m.wrong.kind !== 'tuple') throw new Error('expected tuple');
          const [a, b] = m.wrong.values.map(num);
          expect(a).toBeLessThanOrEqual(b);
        }
      }
    }
  });

  it('between the roots the expression has the opposite sign of the leading coefficient', () => {
    for (const level of [3, 4] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        // Leading coefficient and a point strictly between the roots, from the params.
        const lead = level === 3 ? p.params.a : p.params.p * p.params.r;
        const [e1, e2] = expectedRoots(level, p.params);
        const mid = (e1 + e2) / 2;
        const f = level === 3 ? p.params.a * (mid - e1) * (mid - e2) : (p.params.p * mid + p.params.q) * (p.params.r * mid + p.params.s);
        expect(Math.sign(f)).toBe(-Math.sign(lead));
        const label = correctLabel(p);
        expect(label, p.id).toMatch(lead > 0 ? /^Negative/ : /^Positive/);
        if (/profit/.test(p.interpretation![0].prompt)) expect(lead).toBeLessThan(0);
      }
    }
  });

  it('profit framing appears for negative leading coefficients', () => {
    let profit = 0;
    for (let seed = 1; seed <= 200; seed++) if (/profit/.test(makeProblem(skill, 3, seed).interpretation![0].prompt)) profit++;
    expect(profit).toBeGreaterThan(0);
  });
});
