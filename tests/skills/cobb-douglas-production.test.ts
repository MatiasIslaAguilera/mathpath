// Independent checks: returns-to-scale classification and every interpretation's correct option,
// re-derived from the params with floating-point arithmetic (finite differences, not the formulas).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { cobbDouglasProduction as skill } from '../../src/skills/econ/cobb-douglas-production';

const EXPS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
const label = (opts: { id: string; label: string }[], id: string) => opts.find((o) => o.id === id)!.label;
const Qf = (A: number, a: number, b: number, L: number, K: number) => A * L ** a * K ** b;

describe('cobb-douglas-production', () => {
  it('level 2 form 0: classification by scaling the inputs numerically', () => {
    let seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (p.params.form !== 0) continue;
      const { ai, bi, A } = p.params;
      const a = EXPS[ai];
      const b = EXPS[bi];
      const ratio = Qf(A, a, b, 20, 30) > 0 ? Qf(A, a, b, 40, 60) / Qf(A, a, b, 20, 30) : 0;
      const want = Math.abs(ratio - 2) < 1e-9 ? 'const' : ratio > 2 ? 'inc' : 'dec';
      expect(p.answer.kind === 'choice' && p.answer.correct, p.id).toBe(want);
      seen.add(want);
    }
    expect(seen.size).toBe(3);
  });

  it('level 2 form 1: factor equals direct scaling', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (p.params.form !== 1) continue;
      const { ai, bi, A, t } = p.params;
      const a = EXPS[ai];
      const b = EXPS[bi];
      const f = Qf(A, a, b, 5 * t, 7 * t) / Qf(A, a, b, 5, 7);
      const [n, d] = (p.answer.kind === 'number' ? p.answer.value : '0').split('/').map(Number);
      expect(n / (d || 1), p.id).toBeCloseTo(f, 9);
    }
  });

  it('level 3: interpretations match the finite-difference marginal product', () => {
    let meaning = 0;
    let trend = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { which, ai, bi, A, L, K } = p.params;
      const a = EXPS[ai];
      const b = EXPS[bi];
      const h = 1e-6;
      const mp = (l: number, k: number) => (which === 0 ? (Qf(A, a, b, l + h, k) - Qf(A, a, b, l, k)) / h : (Qf(A, a, b, l, k + h) - Qf(A, a, b, l, k)) / h);
      const val = mp(L, K);
      const [n, d] = (p.answer.kind === 'number' ? p.answer.value : '0').split('/').map(Number);
      expect(n / (d || 1), p.id).toBeCloseTo(val, 3);
      if (!p.interpretation) continue;
      const iq = p.interpretation[0];
      const lab = label(iq.options, iq.correct);
      if (iq.prompt.includes('What does that mean')) {
        meaning++;
        const m = lab.match(/\$\\frac\{(\d+)\}\{(\d+)\}\$|\$(-?\d+)\$/)!;
        const shown = m[3] !== undefined ? Number(m[3]) : Number(m[1]) / Number(m[2]);
        expect(shown, p.id).toBeCloseTo(val, 3);
        expect(lab, p.id).toContain(which === 0 ? 'more unit of labor, with capital held fixed' : 'more unit of capital, with labor held fixed');
        expect(lab).not.toMatch(/average|together|times as productive/);
      } else {
        trend++;
        const f1 = mp(L, K);
        const f2 = which === 0 ? mp(2 * L, K) : mp(L, 2 * K);
        const want = Math.abs(f2 - f1) < 1e-6 ? /same/ : f2 < f1 ? /Falls/ : /Rises$/;
        expect(lab, p.id).toMatch(want);
      }
    }
    expect(meaning).toBeGreaterThan(0);
    expect(trend).toBeGreaterThan(0);
  });

  it('level 4: MRTS from finite-difference marginal products', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { ai, bi, A, L, K } = p.params;
      const a = EXPS[ai];
      const b = EXPS[bi];
      const h = 1e-6;
      const mpl = (Qf(A, a, b, L + h, K) - Qf(A, a, b, L, K)) / h;
      const mpk = (Qf(A, a, b, L, K + h) - Qf(A, a, b, L, K)) / h;
      const [n, d] = (p.answer.kind === 'number' ? p.answer.value : '0').split('/').map(Number);
      expect(n / (d || 1), p.id).toBeCloseTo(mpl / mpk, 3);
    }
  });

  it('level 5: growth accounting identity and the residual question', () => {
    let seen = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, ai, bi, gA, gL, gK, gQ } = p.params;
      expect(gQ, p.id).toBeCloseTo(gA + EXPS[ai] * gL + EXPS[bi] * gK, 9);
      const [n, d] = (p.answer.kind === 'number' ? p.answer.value : '0').split('/').map(Number);
      expect(n / (d || 1), p.id).toBeCloseTo(form === 0 ? gQ : gA, 9);
      if (p.interpretation) {
        seen++;
        const iq = p.interpretation[0];
        expect(label(iq.options, iq.correct)).toMatch(/does not explain/);
        expect(iq.prompt).toContain(`${gA}\\%`);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
