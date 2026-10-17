// Re-derives each answer from the raw params with Math.log, checks the level-3 construction
// rules, and the level-5 rounding guarantee for a learner using the given 3-decimal constants.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { AnswerSpec } from '../../src/engine/types';
import { logarithmRules as skill } from '../../src/skills/math/logarithm-rules';

const num = (s: string) => Number(evaluate(s));
const val = (a: AnswerSpec) => (a.kind === 'number' ? num(a.value) : NaN);
const correctLabel = (a: AnswerSpec) => (a.kind === 'choice' ? a.options.find((o) => o.id === a.correct)!.label : '');
const logb = (x: number, b: number) => Math.log(x) / Math.log(b);
const isPow = (x: number, b: number) => {
  while (x > 1 && x % b === 0) x /= b;
  return x === 1;
};

describe('logarithm-rules', () => {
  it('L1: log_b of the shown argument equals the answer', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { b, k } = p.params;
      expect(logb(b ** k, b)).toBeCloseTo(val(p.answer), 9);
      expect(val(p.answer)).toBe(k);
      // The argument shown in the prompt is b^|k| (as a fraction for negative k).
      expect(p.prompt).toContain(k >= 0 ? `${b ** k}` : `\\frac{1}{${b ** -k}}`);
      const sign = p.misconceptions.find((m) => m.id === 'negative-k-sign');
      expect(!!sign).toBe(k < 0);
      if (sign) expect(val(sign.wrong)).toBe(-k);
    }
  });

  it('L2: special values', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, b, k, m } = p.params;
      const want = form === 0 ? Math.log(Math.exp(k)) : form === 1 ? Math.exp(Math.log(m)) : form === 2 ? logb(1, b) : logb(b, b);
      expect(val(p.answer)).toBeCloseTo(want, 9);
      const wrong = p.misconceptions.find((m2) => m2.id === 'ln-e-confusion');
      if (form === 0) expect(val(wrong!.wrong)).toBeCloseTo(Math.exp(k), 9);
      else expect(wrong).toBeUndefined();
    }
  });

  it('L3: value, and neither argument is a power of the base', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, b, k, A, B } = p.params;
      const want = form === 0 ? logb(A, b) + logb(B, b) : logb(A, b) - logb(B, b);
      expect(want).toBeCloseTo(val(p.answer), 9);
      expect(val(p.answer)).toBe(k);
      expect(isPow(A, b)).toBe(false);
      expect(isPow(B, b)).toBe(false);
      expect(p.steps[0].ask!.answer.kind).toBe('number');
      for (const m of p.misconceptions) {
        const w = val(m.wrong);
        if (m.id === 'log-of-sum') expect(w).toBeCloseTo(logb(A + B, b), 9);
        if (m.id === 'log-division-confusion') expect(w).toBeCloseTo(Math.log(A) / Math.log(B), 9);
      }
    }
  });

  it('L4: p*log A + log B - log C = log N', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { b, p: pw, A, B, C } = p.params;
      const N = val(p.answer);
      expect(Number.isInteger(N)).toBe(true);
      expect(logb(N, b)).toBeCloseTo(pw * logb(A, b) + logb(B, b) - logb(C, b), 9);
      for (const m of p.misconceptions) {
        if (m.id === 'log-of-sum') expect(val(m.wrong)).toBe(pw * A + B - C);
        if (m.id === 'power-rule-misplaced') expect(val(m.wrong)).toBeCloseTo((pw * A * B) / C, 9);
      }
    }
  });

  it('L5: exact value, and the given 3-decimal constants round to the same 2-decimal answer', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, a, b, u } = p.params;
      const v = 2 ** a * 3 ** b;
      let exact: number;
      let approx: number;
      if (form === 1) {
        exact = Math.log(v) / Math.log(u);
        approx = (a * 0.693 + b * 1.099) / (u === 2 ? 0.693 : 1.099);
        expect(isPow(v, u)).toBe(false); // irrational
      } else {
        const s = form === 2 ? -1 : 1;
        exact = a * Math.log(2) + s * b * Math.log(3);
        approx = a * 0.693 + s * b * 1.099;
        // quotient needs a, b >= 1
        if (form === 2) expect(a >= 1 && b >= 1).toBe(true);
        const label = correctLabel(p.steps[0].ask!.answer);
        expect(label.includes('\\ln 2')).toBe(a > 0);
        expect(label.includes('\\ln 3')).toBe(b > 0);
        expect(label.includes(s === -1 ? ' - ' : ' + ')).toBe(a > 0 && b > 0);
      }
      expect(val(p.answer)).toBeCloseTo(exact, 9);
      expect(approx.toFixed(2)).toBe(exact.toFixed(2));
    }
  });
});

describe('logarithm-rules level 5 accepts answers built from the given constants', () => {
  it('3 ln 3 with ln 3 ≈ 1.099 → 3.297 is accepted; a real mistake is not', async () => {
    const { makeProblem: mk } = await import('../../src/engine/registry');
    const { logarithmRules } = await import('../../src/skills/math/logarithm-rules');
    let tested = 0;
    for (let seed = 1; seed <= 400 && tested < 20; seed++) {
      const p = mk(logarithmRules, 5, seed);
      const { form, a, b, u } = p.params;
      const lnV = a * 0.693 + (form === 2 ? -1 : 1) * b * 1.099;
      const viaGiven = form === 1 ? lnV / (u === 2 ? 0.693 : 1.099) : lnV;
      expect(logarithmRules.check!(p, viaGiven.toFixed(3)).correct, p.id).toBe(true);
      expect(logarithmRules.check!(p, (viaGiven + 0.05).toFixed(3)).correct, p.id).toBe(false);
      expect(logarithmRules.check!(p, 'ln(').error, p.id).toBeTruthy();
      tested++;
    }
    expect(tested).toBe(20);
  });
});
