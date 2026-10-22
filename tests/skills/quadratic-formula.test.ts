// Skill-specific checks: discriminant, roots and interpretation answers are re-derived from
// the params; every tuple (answer and misconception) is sorted ascending.

import { describe, expect, it } from 'vitest';
import { evalExact } from '../../src/engine/checker';
import { makeProblem } from '../../src/engine/registry';
import { quadraticFormula as skill } from '../../src/skills/math/quadratic-formula';
import type { AnswerSpec } from '../../src/engine/types';

const tupleValues = (spec: AnswerSpec) => {
  if (spec.kind !== 'tuple') throw new Error('expected tuple');
  return spec.values.map((v) => evalExact(v));
};
const correctLabel = (p: ReturnType<typeof makeProblem>) => {
  const iq = p.interpretation![0];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};

describe('quadratic-formula', () => {
  it('level 1: answer is b^2 - 4ac, form picks the sign of D, interpretation counts roots', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, a, b, c } = p.params;
      const D = b * b - 4 * a * c;
      seen.add(Math.sign(D));
      expect(Math.sign(D), `${p.id} form`).toBe(form === 0 ? 1 : form === 1 ? 0 : -1);
      expect(p.answer.kind === 'number' && Number(p.answer.value)).toBe(D);
      const label = correctLabel(p);
      expect(label, p.id).toBe(D > 0 ? 'Two real solutions' : D === 0 ? 'Exactly one real solution' : 'No real solutions');
    }
    expect(seen.size).toBe(3);
  });

  it('levels 2-5: roots re-derived from the params, sorted ascending, sum = -b/a', () => {
    for (const level of [2, 3, 4, 5] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const a = level === 3 ? 1 : p.params.a;
        const sign = level === 5 ? -1 : 1;
        const A = sign * a, B = p.params.b, C = sign * p.params.c;
        const D = B * B - 4 * A * C;
        expect(D, p.id).toBeGreaterThan(0);
        const isSquare = Number.isInteger(Math.sqrt(D));
        if (level >= 3 && level <= 4) expect(isSquare, `${p.id} irrational`).toBe(false);
        if (level === 2) expect(isSquare, `${p.id} rational`).toBe(true);
        const e = [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)].sort((x, y) => x - y);
        const [r1, r2] = tupleValues(p.answer);
        expect(r1, p.id).toBeLessThan(r2);
        expect(r1, p.id).toBeCloseTo(e[0], 9);
        expect(r2, p.id).toBeCloseTo(e[1], 9);
        expect(r1 + r2, p.id).toBeCloseTo(-B / A, 9);
        if (level === 5) expect(r1, p.id).toBeGreaterThan(0);
      }
    }
  });

  it('every misconception tuple is sorted ascending', () => {
    for (const level of [2, 3, 4, 5] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const m of makeProblem(skill, level, seed).misconceptions) {
          const [x, y] = tupleValues(m.wrong);
          expect(x).toBeLessThanOrEqual(y);
        }
      }
    }
  });

  it('level 5: exactly the offered quantity with positive profit is marked correct', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, b, c } = p.params;
      const pi = (n: number) => -a * n * n + b * n - c;
      const iq = p.interpretation![0];
      const qty = (label: string) => Number(label.match(/^(\d+) units$/)![1]);
      const positive = iq.options.filter((o) => pi(qty(o.label)) > 0);
      expect(positive.length, p.id).toBe(1);
      expect(positive[0].id, p.id).toBe(iq.correct);
      expect(iq.options.length).toBe(4);
    }
  });
});
