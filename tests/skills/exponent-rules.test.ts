// Re-derives every answer from the raw params with plain JS Math (no Q, no generator helpers),
// and the correct option of each conceptual choice step.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { AnswerSpec, Level } from '../../src/engine/types';
import { exponentRules as skill } from '../../src/skills/math/exponent-rules';

const num = (s: string) => Number(evaluate(s));
const values = (a: AnswerSpec): number[] => (a.kind === 'tuple' ? a.values.map(num) : a.kind === 'number' ? [num(a.value)] : []);
const correctLabel = (a: AnswerSpec) => (a.kind === 'choice' ? a.options.find((o) => o.id === a.correct)!.label : '');

function expected(level: Level, p: Record<string, number>): number[] {
  switch (level) {
    case 1:
      return [p.form === 0 ? p.a + p.b : p.a - p.b];
    case 2:
      return p.form === 0 ? [p.a * p.b] : [p.c ** p.b, p.a * p.b];
    case 3:
      return p.form === 0 ? [1] : p.form === 1 ? [Math.pow(p.b, -p.k)] : [Math.pow(p.p / p.q, -p.k2)];
    case 4: {
      const M = p.form === 1 ? -p.m : p.m;
      const base = p.form === 2 ? (p.r / p.s) ** p.n : p.r ** p.n;
      return [Math.pow(base, M / p.n)];
    }
    case 5:
      return [p.a * p.c - p.d, p.b * p.c - p.e];
  }
}

describe('exponent-rules', () => {
  it('answers match an independent recomputation from params', () => {
    for (const level of [1, 2, 3, 4, 5] as Level[]) {
      for (let seed = 1; seed <= 400; seed++) {
        const p = makeProblem(skill, level, seed);
        const want = expected(level, p.params);
        const got = values(p.answer);
        expect(got.length, p.id).toBe(want.length);
        got.forEach((g, i) => expect(g, p.id).toBeCloseTo(want[i], 9));
      }
    }
  });

  it('L4 bases are perfect n-th powers and the prompt shows the same base', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { r, n, m, form, s } = p.params;
      expect(Number.isInteger(r ** n)).toBe(true);
      expect(m % n).not.toBe(0); // exponent in lowest terms
      expect(p.prompt).toContain(form === 2 ? `\\frac{${r ** n}}{${s ** n}}` : `${r ** n}`);
    }
  });

  it('the first (conceptual) step picks the right rule', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p1 = makeProblem(skill, 1, seed);
      expect(correctLabel(p1.steps[0].ask!.answer)).toBe(p1.params.form === 0 ? 'Add the exponents' : 'Subtract the exponents');
      const p2 = makeProblem(skill, 2, seed);
      if (p2.params.form === 0) expect(correctLabel(p2.steps[0].ask!.answer)).toBe('Multiply the exponents');
      const p3 = makeProblem(skill, 3, seed);
      if (p3.params.form === 0) expect(correctLabel(p3.steps[0].ask!.answer)).toBe('$1$');
    }
  });

  it('misconception wrong answers are computed from the same params', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p1 = makeProblem(skill, 1, seed);
      for (const m of p1.misconceptions) {
        const w = values(m.wrong)[0];
        if (m.id === 'multiply-for-product') expect(w).toBe(p1.params.a * p1.params.b);
        if (m.id === 'divide-for-quotient') expect(w).toBeCloseTo(p1.params.a / p1.params.b, 9);
        if (m.id === 'add-for-quotient') expect(w).toBe(p1.params.a + p1.params.b);
      }
      const p2 = makeProblem(skill, 2, seed);
      for (const m of p2.misconceptions) {
        const [kWrong, eWrong] = values(m.wrong);
        if (m.id === 'power-as-product') {
          expect(kWrong, p2.id).toBe(p2.params.c);
          expect(eWrong, p2.id).toBe(p2.params.a + p2.params.b);
        }
      }
      const p3 = makeProblem(skill, 3, seed);
      for (const m of p3.misconceptions) {
        const w = values(m.wrong)[0];
        if (m.id === 'zero-power-is-zero') expect(w).toBe(0);
        if (m.id === 'negative-means-negative') expect(w).toBeLessThan(0);
      }
    }
  });
});

describe('exponent-rules diagnoses from logged progress', () => {
  it('reads (2x^3)^2 -> "8, 6" as the coefficient raised to the inside exponent', async () => {
    const { problemFromId } = await import('../../src/engine/registry');
    const { matchMisconception } = await import('../../src/engine/misconceptions');
    const p = problemFromId('exponent-rules:2:1703201749');
    expect(p.prompt).toContain('(2x^{3})^{2}');
    expect(matchMisconception(p, ['8', '6'])).toBe('coefficient-raised-to-inner');
  });
});
