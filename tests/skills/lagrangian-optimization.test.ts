// Independent re-derivation: interpretations, the Lagrangian choice (L1/L2/L3/L5), the L5 soc choice,
// and that answers satisfy the FOCs and the constraint.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { lagrangianOptimization as skill } from '../../src/skills/econ/lagrangian-optimization';
import type { Problem } from '../../src/engine/types';

const cl = (n: number) => (n === 1 ? '' : String(n));
const label = (opts: { id: string; label: string }[], id: string) => opts.find((o) => o.id === id)!.label;
const tupleVals = (p: Problem) => (p.answer.kind === 'tuple' ? p.answer.values.map((v) => eval(v)) : []);
const lagStep = (p: Problem) => {
  const a = p.steps.find((s) => s.key === 'lagrangian')!.ask!.answer;
  if (a.kind !== 'choice') throw new Error('choice');
  return label(a.options, a.correct);
};

describe('lagrangian-optimization', () => {
  it('L1/L2: budget problem satisfies FOCs and constraint; Lagrangian choice', () => {
    for (const level of [1, 2] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const { px, py, lam } = p.params;
        const m = 2 * lam * px * py;
        expect(lagStep(p)).toBe(`\\mathcal{L} = xy + \\lambda(${m} - ${cl(px)}x - ${cl(py)}y)`);
        if (level === 1) {
          const [x, y] = tupleVals(p);
          expect(px * x + py * y).toBe(m);
          expect(y / x).toBeCloseTo(px / py, 9); // MRS = price ratio
        } else {
          const x = lam * py, y = lam * px;
          expect(px * x + py * y).toBe(m);
          expect(y / px).toBe(lam);
          expect(x / py).toBe(lam);
          expect(eval((p.answer as { value: string }).value)).toBe(lam);
          if (p.interpretation) {
            const qn = p.interpretation[0];
            expect(label(qn.options, qn.correct)).toBe(`One more dollar of income raises maximum utility by about ${lam} utils (utils per dollar).`);
            // numeric check: value of an extra dollar
            const U = (mm: number) => (mm / (2 * px)) * (mm / (2 * py));
            expect((U(m + 0.001) - U(m)) / 0.001).toBeCloseTo(lam, 2);
          }
        }
      }
    }
  });

  it('L3: cost minimization', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { a, b, u, n } = p.params;
      const w = b * b * u, r = a * a * u, Q0 = n * a * b;
      expect(lagStep(p)).toBe(`\\mathcal{L} = ${w}L + ${r}K + \\lambda(${Q0 * Q0} - LK)`);
      const [L, K] = tupleVals(p);
      expect(L * K).toBe(Q0 * Q0);
      expect(w / K).toBeCloseTo(r / L, 9); // w = lam K, r = lam L
      const cost = (l: number) => w * l + (r * Q0 * Q0) / l;
      expect(cost(L)).toBeLessThan(cost(L + 0.01));
      expect(cost(L)).toBeLessThan(cost(L - 0.01));
    }
  });

  it('L4: envelope approximation matches the exact change', () => {
    const forms = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, px, py, lam, a, b, u, n, d } = p.params;
      forms.add(form);
      const ans = eval((p.answer as { value: string }).value);
      let lamV: number;
      if (form === 0) {
        lamV = lam;
        const m = 2 * lam * px * py;
        const U = (mm: number) => (mm / (2 * px)) * (mm / (2 * py));
        expect((U(m + 0.001) - U(m)) / 0.001).toBeCloseTo(lam, 2);
      } else {
        lamV = 2 * a * b * u;
        const w = b * b * u, r = a * a * u, Q0 = n * a * b;
        // min cost of Q: 2 sqrt(w r) Q
        const C = (Q: number) => 2 * Math.sqrt(w * r) * Q;
        expect((C(Q0 + 0.001) - C(Q0)) / 0.001).toBeCloseTo(lamV, 2);
      }
      expect(ans).toBe(lamV * d);
      if (p.interpretation) {
        const qn = p.interpretation[0];
        const lbl = label(qn.options, qn.correct);
        expect(lbl).toBe(form === 0 ? `One more dollar of income raises maximum utility by about ${lam} utils (utils per dollar).` : `The marginal cost of one more unit of output, about \\$${lamV}.`);
      }
    }
    expect(forms.size).toBe(2);
  });

  it('L5: two plants', () => {
    let interp = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { c1, c2 } = p.params;
      const [q1, q2] = tupleVals(p);
      const Q = q1 + q2;
      expect(2 * c1 * q1).toBeCloseTo(2 * c2 * q2, 9);
      expect(lagStep(p)).toBe(`\\mathcal{L} = ${cl(c1)}x^2 + ${cl(c2)}y^2 + \\lambda(${Q} - x - y)`);
      // soc: convex along the constraint -> minimum; bordered det negative
      const C = (x: number) => c1 * x * x + c2 * (Q - x) * (Q - x);
      expect(C(q1)).toBeLessThan(C(q1 + 0.01));
      expect(C(q1)).toBeLessThan(C(q1 - 0.01));
      const det = 0 - 1 * (1 * 2 * c2 - 0) + 1 * (0 - 2 * c1 * 1);
      expect(det).toBeLessThan(0);
      const soc = p.steps.find((s) => s.key === 'soc')!.ask!.answer;
      if (soc.kind !== 'choice') throw new Error('choice');
      expect(label(soc.options, soc.correct)).toMatch(/^A minimum: the bordered Hessian determinant is negative/);
      if (p.interpretation) {
        interp++;
        const lamV = 2 * c1 * q1;
        const [l, why] = p.interpretation;
        expect(label(l.options, l.correct)).toBe(`The marginal cost of one more unit of output, about \\$${lamV}.`);
        const cheaper = c1 < c2 ? 1 : 2;
        expect(why.prompt).toContain(`plant ${cheaper}`);
        expect(cheaper === 1 ? q1 > q2 : q2 > q1).toBe(true);
        expect(label(why.options, why.correct)).toMatch(/^Cost is minimized where marginal costs are equal/);
        // MC of total output = \lambda
        const TC = (Qt: number) => 2 * Math.sqrt((c1 * c2) / (c1 + c2)) ** 2 * 0 + (c1 * c2 * Qt * Qt) / (c1 + c2);
        expect((TC(Q + 0.001) - TC(Q)) / 0.001).toBeCloseTo(lamV, 1);
      }
    }
    expect(interp).toBeGreaterThan(50);
  });
});
