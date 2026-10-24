// Skill-specific checks: answers and every interpretation option are re-derived here from the
// raw params and prompt with floating-point math, independently of the generator's exact-Q code.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { presentValue as skill } from '../../src/skills/econ/present-value';

const value = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('number answer expected');
  return Number(evaluate(p.answer.value));
};
const correctLabel = (p: Problem, i = 0) => {
  const iq = p.interpretation![i];
  return iq.options.find((o) => o.id === iq.correct)!.label;
};
const amounts = (s: string) => [...s.matchAll(/\\\$(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
const rateOf = (s: string) => Number(s.match(/(\d+)% per year/)![1]) / 100;
const N = 400;
const usd = (v: number) => {
  const c = Math.round(v * 100);
  return `\$${c % 100 === 0 ? c / 100 : (c / 100).toFixed(2)}`;
};

describe('present value answers match the definitions', () => {
  it('level 1: PV compounds back up to the future sum', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { n } = p.params;
      const FV = amounts(p.prompt)[0];
      const r = rateOf(p.prompt);
      expect(value(p) * Math.pow(1 + r, n)).toBeCloseTo(FV, 6);
      expect(Number.isInteger(value(p))).toBe(true);
    }
  });

  it('level 1 stories: the answer grows to the future sum the story states', () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed, 'story');
      const { n } = p.params;
      const FV = amounts(p.prompt)[0];
      const r = rateOf(p.prompt);
      expect(value(p) * Math.pow(1 + r, n), p.id).toBeCloseTo(FV, 6);
      expect(Number.isInteger(value(p))).toBe(true);
      expect(p.prompt, p.id).toContain(n === 1 ? '1 year' : `${n} years`);
      keys.add(p.steps[0].key);
    }
    expect([...keys].sort()).toEqual(['setup-grows', 'setup-offers', 'setup-prize']);
  });

  it('level 2: NPV = discounted returns minus the outlay', () => {
    let neg = 0;
    let pos = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { T } = p.params;
      const [outlay, ...rets] = amounts(p.prompt);
      const r = rateOf(p.prompt);
      expect(rets.length).toBe(T);
      const npv = rets.reduce((a, R, i) => a + R / Math.pow(1 + r, i + 1), 0) - outlay;
      expect(value(p)).toBeCloseTo(npv, 6);
      if (npv < 0) neg++;
      else pos++;
    }
    expect(neg).toBeGreaterThan(50);
    expect(pos).toBeGreaterThan(50);
  });

  it('level 3: annuity as the closed form', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { r, n, A } = p.params;
      const i = r / 100;
      expect(value(p)).toBeCloseTo((A * (1 - Math.pow(1 + i, -n))) / i, 6);
      expect(Number.isInteger(value(p))).toBe(true);
    }
  });

  it('level 4: perpetuity formulas, level, growing, deferred', () => {
    const seen = [0, 0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, A, r, g, k } = p.params;
      const i = r / 100;
      const expected = form === 0 ? A / i : form === 1 ? A / (i - g / 100) : A / i / Math.pow(1 + i, k);
      expect(value(p)).toBeCloseTo(expected, 6);
      expect(Number.isInteger(value(p))).toBe(true);
      seen[form]++;
    }
    expect(Math.min(...seen)).toBeGreaterThan(50);
  });

  it('level 5: the payment repays the loan / reaches the target', () => {
    const seen = [0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, r, n } = p.params;
      const i = r / 100;
      const given = amounts(p.prompt)[0];
      const A = value(p);
      expect(Number.isInteger(A)).toBe(true);
      if (form === 0) {
        // balance after n payments is zero
        let bal = given;
        for (let t = 0; t < n; t++) bal = bal * (1 + i) - A;
        expect(Math.abs(bal)).toBeLessThan(1e-6);
      } else {
        let fund = 0;
        for (let t = 0; t < n; t++) fund = fund * (1 + i) + A;
        expect(fund).toBeCloseTo(given, 6);
      }
      seen[form]++;
    }
    expect(Math.min(...seen)).toBeGreaterThan(100);
  });
});

describe('present value interpretation', () => {
  const lowerQuestion = (p: Problem) => /would be…/.test(p.interpretation![0].prompt);

  it('"a higher rate makes the value…" is Lower, and the explanation figure is right', () => {
    let seen = 0;
    for (let level = 1; level <= 4; level++) {
      for (let seed = 1; seed <= N; seed++) {
        const p = makeProblem(skill, level as 1 | 2 | 3 | 4, seed);
        if (!p.interpretation || !lowerQuestion(p)) continue;
        const { r } = p.params;
        const r2 = (2 * r) / 100;
        const i = r / 100;
        let pv2: number;
        let pv1: number;
        if (level === 1) {
          const FV = amounts(p.prompt)[0];
          pv1 = FV / Math.pow(1 + i, p.params.n);
          pv2 = FV / Math.pow(1 + r2, p.params.n);
        } else if (level === 3) {
          const { n, A } = p.params;
          pv1 = pv2 = 0;
          for (let t = 1; t <= n; t++) {
            pv1 += A / Math.pow(1 + i, t);
            pv2 += A / Math.pow(1 + r2, t);
          }
        } else {
          const { form, A, g, k } = p.params;
          const f = (x: number) => (form === 1 ? A / (x - g / 100) : A / x / Math.pow(1 + x, k));
          pv1 = f(i);
          pv2 = f(r2);
        }
        expect(pv2).toBeLessThan(pv1);
        expect(correctLabel(p)).toBe('Lower');
        expect(p.interpretation![0].explanation).toContain(`\\$${pv2.toFixed(2)}`);
        expect(p.interpretation![0].explanation).toContain(`\\$${pv1.toFixed(2)}`);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('level 1: meaning and "is it enough?"', () => {
    let meaning = 0;
    let enough = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 1, seed);
      if (!p.interpretation || lowerQuestion(p)) continue;
      const iq = p.interpretation[0];
      const { n } = p.params;
      const PV = value(p);
      if (/What does that mean/.test(iq.prompt)) {
        expect(p.params.form).toBe(0);
        expect(correctLabel(p)).toMatch(/grows to exactly/);
        expect(correctLabel(p)).toContain(`\\$${PV}`);
        meaning++;
      } else {
        expect(p.params.form).toBe(1);
        const [X, FV] = amounts(iq.prompt);
        const r = Number(iq.prompt.match(/at (\d+)%/)![1]) / 100;
        const sufficient = X * Math.pow(1 + r, n) >= FV;
        expect(X * Math.pow(1 + r, n)).not.toBeCloseTo(FV, 6);
        expect(correctLabel(p)).toBe(sufficient ? 'Yes, it is enough' : 'No, it falls short');
        expect(X).toBeGreaterThan(0);
        enough++;
      }
    }
    expect(meaning).toBeGreaterThan(20);
    expect(enough).toBeGreaterThan(20);
  });

  it('level 2: invest exactly when NPV > 0', () => {
    let yes = 0;
    let no = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (!p.interpretation) continue;
      const npv = value(p);
      expect(npv).not.toBe(0);
      const label = correctLabel(p);
      expect(label).toMatch(npv > 0 ? /^Yes: the returns are worth more/ : /^No: the returns are worth less/);
      if (npv > 0) yes++;
      else no++;
    }
    expect(yes).toBeGreaterThan(20);
    expect(no).toBeGreaterThan(20);
  });

  it('level 4 form 0: the 50-year annuity is worth a bit less than A/r', () => {
    let seen = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (!p.interpretation || lowerQuestion(p)) continue;
      const { form, A, r } = p.params;
      expect(form).toBe(0);
      const i = r / 100;
      const ann50 = (A * (1 - Math.pow(1 + i, -50))) / i;
      expect(ann50).toBeLessThan(A / i);
      expect(correctLabel(p)).toMatch(/payments after year 50/);
      expect(p.interpretation[0].explanation).toContain(`\\$${ann50.toFixed(2)}`);
      seen++;
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('level 5: the payments exceed the loan (interest owed) / the target exceeds the deposits (interest earned)', () => {
    let seen = [0, 0];
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      const { form, n } = p.params;
      const A = value(p);
      const given = amounts(p.interpretation[0].prompt).at(-1)!;
      if (form === 0) {
        expect(A * n).toBeGreaterThan(given);
        expect(correctLabel(p)).toMatch(/interest on the balance still owed/);
        expect(p.interpretation[0].explanation).toContain(usd(A * n - given));
      } else {
        expect(given).toBeGreaterThan(A * n);
        expect(correctLabel(p)).toMatch(/deposits earn interest/);
        expect(p.interpretation[0].explanation).toContain(usd(given - A * n));
      }
      seen[form]++;
    }
    expect(Math.min(...seen)).toBeGreaterThan(20);
  });
});
