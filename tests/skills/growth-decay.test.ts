// Skill-specific checks: every answer and interpretation option is re-derived here from the
// raw params with floating-point math, independently of the generator's exact-Q arithmetic.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { growthDecay as skill } from '../../src/skills/math/growth-decay';

const value = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('number answer expected');
  return Number(evaluate(p.answer.value));
};
const correctLabel = (p: Problem, i = 0) => {
  const iq = p.interpretation![i];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};
const firstDollar = (s: string) => Number(s.match(/\\\$([\d.]+)/)![1]);
const money = (v: number) => `\\$${v.toFixed(2)}`;

describe('growth & decay answers match the formulas', () => {
  it('levels 1-2: P(1 +/- r)^t, in whole cents', () => {
    for (const level of [1, 2] as const) {
      for (let seed = 1; seed <= 500; seed++) {
        const p = makeProblem(skill, level, seed);
        const { P, r, t } = p.params;
        const a = P * Math.pow(1 + (level === 1 ? r : -r) / 100, t);
        expect(value(p)).toBeCloseTo(a, 8);
        expect(Math.abs(a * 100 - Math.round(a * 100))).toBeLessThan(1e-6);
      }
    }
  });

  it('level 3: P e^(rt)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { P, r, t } = p.params;
      expect(value(p)).toBeCloseTo(P * Math.exp((r * t) / 100), 8);
    }
  });

  it('level 4: the answer t satisfies (1 + r)^t = k', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { r, k } = p.params;
      expect(Math.pow(1 + r / 100, value(p))).toBeCloseTo(k, 8);
    }
  });

  it('level 5: the answer rate grows P to A in t years', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { P, t } = p.params;
      const A = Number(p.prompt.match(/grows to \\\$([\d.]+)/)![1]);
      expect(Number.isInteger(value(p))).toBe(true);
      expect(P * Math.pow(1 + value(p) / 100, t)).toBeCloseTo(A, 6);
    }
  });
});

describe('growth & decay interpretation', () => {
  it('levels 1-2: conceptual and numeric options match the money', () => {
    let seen = 0;
    for (const level of [1, 2] as const) {
      for (let seed = 1; seed <= 400; seed++) {
        const p = makeProblem(skill, level, seed);
        const { P, r, t } = p.params;
        if (t === 1) {
          expect(p.interpretation).toBeUndefined();
          continue;
        }
        const f = Math.pow(1 + (level === 1 ? r : -r) / 100, t);
        const change = Math.abs(P * f - P);
        const simple = (P * r * t) / 100;
        const prompt = p.interpretation![0].prompt;
        const label = correctLabel(p);
        if (/Why is the real/.test(prompt)) {
          expect(firstDollar(prompt)).toBeCloseTo(change, 6);
          expect(label).toMatch(level === 1 ? /Interest earns interest/ : /smaller, already-reduced/);
        } else {
          // numeric: interest on interest (gain - simple) or shortfall (simple - loss)
          expect(label).toBe(money(Math.abs(change - simple)));
          expect(level === 1 ? change > simple : simple > change).toBe(true);
        }
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(300);
  });

  it('level 3: continuous compounding beats annual', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { P, r, t } = p.params;
      const annual = P * Math.pow(1 + r / 100, t);
      expect(firstDollar(p.interpretation![0].prompt)).toBeCloseTo(annual, 2);
      expect(P * Math.exp((r * t) / 100)).toBeGreaterThan(annual);
      expect(correctLabel(p)).toBe('More money');
    }
  });

  it('level 4: rule of 70 is lower than exact; doubling the rate roughly halves the time', () => {
    let rule = 0;
    let halve = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { r, k } = p.params;
      const exact = Math.log(k) / Math.log(1 + r / 100);
      const prompt = p.interpretation![0].prompt;
      if (/rule of 70/.test(prompt)) {
        expect(k).toBe(2);
        expect(70 / r).toBeLessThan(exact);
        expect(correctLabel(p)).toBe('A little lower than the exact time');
        rule++;
      } else {
        const ratio = Math.log(k) / Math.log(1 + (2 * r) / 100) / exact;
        expect(ratio).toBeGreaterThan(0.45);
        expect(ratio).toBeLessThan(0.6);
        expect(correctLabel(p)).toBe('It would roughly halve');
        halve++;
      }
    }
    expect(rule).toBeGreaterThan(30);
    expect(halve).toBeGreaterThan(30);
  });

  it('level 4: the rule-of-70 misconception is distinguishable from the exact answer at 2 decimals', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { r, k } = p.params;
      if (k !== 2) continue;
      expect((70 / r).toFixed(2)).not.toBe((Math.log(2) / Math.log(1 + r / 100)).toFixed(2));
    }
  });
});
