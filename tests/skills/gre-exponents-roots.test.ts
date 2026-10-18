// Independent re-derivations for gre-exponents-roots: BigInt evaluation of the select-all
// options, modular exponentiation for units digits, and grid evaluation for the QC relations.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greExponentsRoots as skill } from '../../src/skills/gre/gre-exponents-roots';

const value = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [n, d = '1'] = p.answer.value.split('/');
  return Number(n) / Number(d);
};

/** Evaluate a restricted LaTeX label ($3^{5}$, 3 \cdot 3^{5}, \frac{3^{7}}{3}, (3^{5})^{3}) with BigInt. */
function evalLabel(label: string): bigint {
  let s = label.replace(/\$/g, '');
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  s = s.replace(/\^\{([^{}]*)\}/g, '**($1)');
  s = s.replace(/\d+/g, (m) => `${m}n`);
  return new Function(`return ${s};`)() as bigint;
}

function modpow(b: number, e: number, m: number): number {
  let r = 1n;
  let base = BigInt(b) % BigInt(m);
  let ex = BigInt(e);
  while (ex > 0n) {
    if (ex & 1n) r = (r * base) % BigInt(m);
    base = (base * base) % BigInt(m);
    ex >>= 1n;
  }
  return Number(r);
}

describe('gre-exponents-roots', () => {
  it('level 1: roots and powers', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, k, b, c, e, x, y } = p.params;
      const got = value(p);
      if (form === 0) expect(got * got * b, p.id).toBe(k * k * b); // sqrt(k^2 b) = k sqrt(b)
      else if (form === 1) expect(got, p.id).toBe(Math.pow(-c, e));
      else expect(got * got, p.id).toBe(x * x + y * y);
    }
  });

  it('level 2: substituting the answer satisfies the exponential equation', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, r, s, t, c, m } = p.params;
      const x = value(p);
      if (form === 0) expect(Math.pow(r ** s, x), p.id).toBeCloseTo(r ** t, 6);
      else if (form === 1) expect(Math.pow(r, x + c), p.id).toBeCloseTo(r ** t, 6);
      else expect(Math.pow(r, m * x + c), p.id).toBeCloseTo(r ** t, 6);
    }
  });

  it('level 3: QC relation agrees with evaluation on grids inside the stated domain', () => {
    const grids: Record<number, number[]> = {
      0: [0.05, 0.25, 0.5, 0.75, 0.95],
      1: [1.05, 1.5, 2, 4, 9, 16],
      2: [0.05, 0.25, 0.5, 0.75, 0.95, 1, 1.05, 1.5, 2, 4, 9, 16],
      3: [-0.05, -0.25, -0.5, -0.75, -0.95],
      4: [-1.05, -1.5, -2, -4, -9],
      5: [-0.05, -0.25, -0.5, -0.95, -1, -1.05, -2, -4, -9],
    };
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, dom, p2, q2, a1, b1, m, a2, b2, n } = p.params;
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const signs = new Set<number>();
      if (form === 1) {
        // exact: compare (a1/b1)^m with (a2/b2)^n by cross-multiplying integers
        const lhs = a1 ** m * b2 ** n;
        const rhs = a2 ** n * b1 ** m;
        signs.add(Math.sign(lhs - rhs));
      } else {
        for (const x of grids[dom]) {
          const A = Math.pow(x, p2 / 2);
          const B = Math.pow(x, q2 / 2);
          signs.add(Math.abs(A - B) < 1e-12 ? 0 : Math.sign(A - B));
        }
        // x = 1 / x = -1 style equality points are only in the 'pos'/'neg' grids on purpose
      }
      const expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
      expect(p.answer.correct, p.id).toBe(expected);
    }
  });

  it('level 4: factoring numerics and BigInt-checked select-all', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, r, a, b } = p.params;
      if (p.answer.kind === 'multi') {
        const target = BigInt(r) ** BigInt(a + 1); // r copies of r^a
        const sum = BigInt(r) * BigInt(r) ** BigInt(a);
        expect(sum).toBe(target);
        const want = p.answer.options.filter((o) => evalLabel(o.label) === sum).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(want);
        expect(want.length).toBeGreaterThan(0);
        expect(want.length).toBeLessThan(p.answer.options.length);
      } else if (form === 0) {
        expect(value(p) * r ** b, p.id).toBe(r ** a + r ** b);
      } else {
        expect(value(p) * r ** (a - 1), p.id).toBe(r ** (a + 1) - r ** a);
      }
    }
  });

  it('level 5: units digit by modular exponentiation', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, r, n, s, m } = p.params;
      const expected = form === 0 ? modpow(r, n, 10) : (modpow(r, n, 10) + modpow(s, m, 10)) % 10;
      expect(value(p), p.id).toBe(expected);
    }
  });
});
