// Skill-specific checks: answers, the L3 combine choice and every interpretation option are
// re-derived here from the raw params and the printed text with floating-point math,
// independently of the generator's exact-Q arithmetic.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { growthRatesLogs as skill } from '../../src/skills/econ/growth-rates-logs';

const value = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('number answer expected');
  return Number(evaluate(p.answer.value));
};
const label = (iq: { options: { id: string; label: string }[]; correct: string }) => iq.options.find((o) => o.id === iq.correct)!.label;
const problems = (level: 1 | 2 | 3 | 4 | 5, n = 500) => Array.from({ length: n }, (_, i) => makeProblem(skill, level, i + 1));
const logsIn = (prompt: string) => [...prompt.matchAll(/= (\d+\.\d{3})\$/g)].map((m) => Number(m[1]));
const lnR = (x: number) => Math.round(Math.log(x) * 1000) / 1000;

describe('level 1: growth from levels and logs', () => {
  it('form 0 is the exact percent change; form 1 uses the printed logs', () => {
    let f0 = 0;
    let f1 = 0;
    for (const p of problems(1)) {
      const { form, a, b, c } = p.params;
      if (form === 0) {
        expect(a % 10).toBe(0);
        expect(value(p)).toBeCloseTo((100 * (b / 10 - a)) / a, 8);
        expect(value(p)).toBe(c);
        f0++;
      } else {
        const [L0, L1] = logsIn(p.prompt);
        expect(L0).toBeCloseTo(lnR(a), 9);
        expect(L1).toBeCloseTo(lnR((a * (100 + c)) / 100), 9);
        expect(value(p)).toBeCloseTo(100 * (L1 - L0), 8);
        f1++;
      }
    }
    expect(f0).toBeGreaterThan(100);
    expect(f1).toBeGreaterThan(100);
  });

  it('interpretation: the approximation fails for large changes; prompt quotes the exact change', () => {
    let seen = 0;
    for (const p of problems(1)) {
      if (!p.interpretation) continue;
      expect(p.params.form).toBe(1);
      const iq = p.interpretation[0];
      expect(label(iq)).toBe('Large changes');
      const exact = Number(iq.prompt.match(/exact change in the level is (\d+)%/)![1]);
      expect(exact).toBe(p.params.c);
      // the approximation is below the exact percent by under 1 point for these changes (p <= 12)
      expect(Math.abs(value(p) - exact)).toBeLessThan(1);
      // the explanation's example: 100 -> 150 is 50% exactly but 40.5% in logs
      expect(100 * Math.log(1.5)).toBeCloseTo(40.55, 1);
      seen++;
    }
    expect(seen).toBeGreaterThan(30);
  });
});

describe('level 2: rule of 70', () => {
  it('answers', () => {
    const seen = [0, 0, 0];
    for (const p of problems(2)) {
      const { form, a, b, c } = p.params;
      seen[form]++;
      if (form === 0) expect(value(p)).toBeCloseTo(70 / (a / 10), 8);
      if (form === 1) expect(value(p)).toBeCloseTo(70 / b, 8);
      if (form === 2) {
        const Y = Number(p.prompt.match(/after ([\d.]+) years/)![1]);
        expect(Y * (a / 10)).toBeCloseTo(70 * c, 8); // Y years = c doublings
        expect(value(p)).toBe(2 ** c);
      }
    }
    expect(Math.min(...seen)).toBeGreaterThan(100);
  });

  it('interpretation: twice the rate halves the doubling time; twice the years halves the rate', () => {
    let seen = 0;
    for (const p of problems(2)) {
      if (!p.interpretation) continue;
      const iq = p.interpretation[0];
      const { form, a, b } = p.params;
      if (form === 1) {
        expect(label(iq)).toBe(`${35 / b}%`);
        expect(iq.prompt).toContain(`${2 * b} years`);
      } else {
        const g = a / 10;
        expect(iq.prompt).toContain(`${2 * g}% instead`);
        expect(label(iq)).toBe(`${70 / (2 * g)} years`);
      }
      seen++;
    }
    expect(seen).toBeGreaterThan(150);
  });

  it('doublings-linear only appears at k = 3', () => {
    for (const p of problems(2)) {
      const m = p.misconceptions.find((x) => x.id === 'doublings-linear');
      if (m) expect(p.params.c).toBe(3);
      if (p.params.form === 2 && p.params.c === 3) expect(m).toBeDefined();
    }
  });
});

describe('level 3: growth of products, ratios, powers', () => {
  const expected = (p: Problem) => {
    const { form, a, b, c, d } = p.params;
    return form === 0 || form === 1 ? (a - b) / 10 : form === 2 ? (a + b) / 10 : (a / 10) * (c / d);
  };

  it('answers', () => {
    const seen = [0, 0, 0, 0];
    for (const p of problems(3)) {
      seen[p.params.form]++;
      expect(value(p)).toBeCloseTo(expected(p), 8);
      expect(Math.abs(value(p) * 10 - Math.round(value(p) * 10))).toBeLessThan(1e-9);
    }
    expect(Math.min(...seen)).toBeGreaterThan(80);
  });

  it('the combine step asks add / subtract / multiply by the power correctly', () => {
    const want = ['Subtract the growth rates', 'Subtract the growth rates', 'Add the growth rates', 'Multiply the growth rate by the power'];
    for (const p of problems(3)) {
      const ask = p.steps[0].ask!.answer;
      if (ask.kind !== 'choice') throw new Error('choice expected');
      expect(ask.options.find((o) => o.id === ask.correct)!.label).toBe(want[p.params.form]);
      expect(ask.options).toHaveLength(3);
    }
  });

  it('interpretation: rises / falls by the approximate rate', () => {
    let seen = 0;
    let falls = 0;
    for (const p of problems(3)) {
      if (!p.interpretation) continue;
      expect(p.params.form).toBeLessThan(3);
      const l = label(p.interpretation[0]);
      const m = l.match(/^(Rises|Falls) by about ([\d.]+)%$/)!;
      const signed = (m[1] === 'Rises' ? 1 : -1) * Number(m[2]);
      expect(signed).toBeCloseTo(expected(p), 8);
      if (signed < 0) falls++;
      seen++;
    }
    expect(seen).toBeGreaterThan(100);
    expect(falls).toBeGreaterThan(0);
  });
});

describe('level 4: average growth and time in logs', () => {
  it('answers from the printed logs', () => {
    const seen = [0, 0];
    for (const p of problems(4)) {
      const { form, a, b, c } = p.params;
      const [L0, L1] = logsIn(p.prompt);
      seen[form]++;
      expect(L0).toBeCloseTo(lnR(a), 9);
      if (form === 0) {
        expect(value(p)).toBeCloseTo((100 * (L1 - L0)) / b, 8);
      } else {
        // g = b/1000 as a decimal; the answer t solves L0 + g t = LT
        expect(L0 + (b / 1000) * value(p)).toBeCloseTo(L1, 9);
        expect(Number.isInteger(value(p))).toBe(true);
        expect(value(p)).toBe(c);
      }
    }
    expect(Math.min(...seen)).toBeGreaterThan(100);
  });

  it('interpretation: rule-of-70 doubling time; doubling the rate halves the years', () => {
    let seen = 0;
    for (const p of problems(4)) {
      if (!p.interpretation) continue;
      const iq = p.interpretation[0];
      if (p.params.form === 0) {
        const g = Number(iq.prompt.match(/grew ([\d.]+)% a year/)![1]);
        expect(g).toBeCloseTo(value(p), 8);
        expect(label(iq)).toBe(`${(70 / g).toFixed(1)} years`);
      } else {
        expect(label(iq)).toBe(`${value(p) / 2} years`);
      }
      seen++;
    }
    expect(seen).toBeGreaterThan(150);
  });
});

describe('level 5: index numbers', () => {
  it('answers', () => {
    const seen = [0, 0, 0];
    for (const p of problems(5)) {
      const { form, a, b, c, d } = p.params;
      seen[form]++;
      if (form === 0) expect(value(p)).toBeCloseTo((100 * b) / a, 8);
      if (form === 1) {
        expect(value(p)).toBeCloseTo((100 * a) / b, 8);
        expect(Number.isInteger(value(p))).toBe(true);
      }
      if (form === 2) {
        const real0 = (100 * a) / b;
        const real1 = (100 * c) / d;
        expect(value(p)).toBeCloseTo(100 * (real1 / real0 - 1), 8);
        expect(Number.isInteger(value(p))).toBe(true);
      }
    }
    expect(Math.min(...seen)).toBeGreaterThan(100);
  });

  it('interpretation (form 1): compares real spending with the base-year spending', () => {
    const labels = new Set<string>();
    for (const p of problems(5)) {
      if (!p.interpretation) continue;
      const { form, a, b, c } = p.params;
      expect(form).toBe(1);
      const real = (100 * a) / b;
      const want = real < c ? 'Prices rose faster than spending' : real === c ? 'Prices rose exactly as fast as spending' : 'Real spending rose less than nominal because prices rose';
      expect(label(p.interpretation[0])).toBe(want);
      expect(a).toBeGreaterThan(c); // nominal spending rose
      labels.add(want);
    }
    expect(labels.size).toBeGreaterThanOrEqual(2);
  });

  it('every misconception is reachable', () => {
    const seen = new Set<string>();
    for (const level of [1, 2, 3, 4, 5] as const) for (const p of problems(level)) for (const m of p.misconceptions) seen.add(m.id);
    for (const id of Object.keys(skill.misconceptions)) expect(seen.has(id), id).toBe(true);
  });
});
