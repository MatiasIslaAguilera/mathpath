// Substitutes each answer back into the equation using plain Math, and re-derives the choice
// steps of level 5 (which roots, which one is valid) from the raw params.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { AnswerSpec } from '../../src/engine/types';
import { expLogEquations as skill } from '../../src/skills/math/exp-log-equations';

const val = (a: AnswerSpec) => (a.kind === 'number' ? Number(evaluate(a.value)) : NaN);
const correctLabel = (a: AnswerSpec) => (a.kind === 'choice' ? a.options.find((o) => o.id === a.correct)!.label : '');
const logb = (x: number, b: number) => Math.log(x) / Math.log(b);

describe('exp-log-equations', () => {
  it('L1: b^(x+c) = b^k', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { b, k, c } = p.params;
      const x = val(p.answer);
      expect(x).toBe(k - c);
      expect(b ** (x + c)).toBe(b ** k);
      expect(p.prompt).toContain(`= ${b ** k}`);
    }
  });

  it('L2: the base raised to the answer is the right side', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, r, p: pp, q } = p.params;
      const L = form === 1 ? r ** q : r ** pp;
      const R = form === 0 ? r ** q : form === 1 ? r ** pp : 1 / r ** q;
      const x = val(p.answer);
      expect(L ** x).toBeCloseTo(R, 9);
      expect(L === R).toBe(false);
      for (const m of p.misconceptions) expect(val(m.wrong)).toBeCloseTo(R / L, 9);
    }
  });

  it('L3: log_b(mx+n) = k at the answer, argument positive', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { b, k, m, n } = p.params;
      const x = val(p.answer);
      expect(Number.isInteger(x)).toBe(true);
      expect(m * x + n).toBe(b ** k);
      expect(logb(m * x + n, b)).toBeCloseTo(k, 9);
      for (const mi of p.misconceptions) {
        if (mi.id === 'log-times') expect(val(mi.wrong)).toBeCloseTo((b * k - n) / m, 9);
        if (mi.id === 'log-power-swapped') expect(val(mi.wrong)).toBeCloseTo((k ** b - n) / m, 9);
      }
    }
  });

  it('L4: A e^(kx) = B at the answer', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { A, B, k } = p.params;
      const x = val(p.answer);
      expect(A * Math.exp(k * x)).toBeCloseTo(B, 8);
      expect(A).not.toBe(B);
      for (const m of p.misconceptions) expect(val(m.wrong)).toBeCloseTo(Math.log(B / A) - k, 9);
    }
  });

  it('L5: valid root satisfies the equation, the other root is rejected, choices are correct', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, b, k, d, r } = p.params;
      const N = b ** k;
      const x = val(p.answer);
      expect(x).toBe(r);
      // The equation holds at r (all arguments positive) ...
      const [a1, a2] = form === 0 ? [r, r - d] : [r + d, r];
      expect(a1).toBeGreaterThan(0);
      expect(a2).toBeGreaterThan(0);
      expect(logb(a1, b) + logb(a2, b)).toBeCloseTo(k, 9);
      // ... and the other root of the quadratic is -(N / r), which makes an argument non-positive.
      const other = -N / r;
      expect(r * r - (form === 0 ? d : -d) * r - N).toBe(0); // r solves x^2 -/+ d x - N
      expect(other * other - (form === 0 ? d : -d) * other - N).toBeCloseTo(0, 9);
      expect(other).toBeLessThan(0);
      const mis = p.misconceptions.find((m) => m.id === 'kept-extraneous')!;
      expect(val(mis.wrong)).toBe(other);
      // choice steps
      const quad = p.steps.find((s) => s.key === 'quadratic')!;
      expect(correctLabel(quad.ask!.answer)).toBe(`$x = ${r}$ or $x = ${other}$`);
      const dom = p.steps.find((s) => s.key === 'check-domain')!;
      expect(correctLabel(dom.ask!.answer)).toBe(`$x = ${r}$ only`);
    }
  });
});
