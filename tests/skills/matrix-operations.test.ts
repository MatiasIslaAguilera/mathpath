// Re-derives matrix-operations answers from the raw params: the L4 size choice from m, n, p, q,
// the L1-L3 and L5 tuples by plain arithmetic, and the L5 interpretation from the table entry.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { matrixOperations as skill } from '../../src/skills/math/matrix-operations';

const vals = (p: Problem) => (p.answer.kind === 'tuple' ? p.answer.values.map(Number) : []);

describe('matrix-operations answers', () => {
  it('level 1: entrywise sum, difference, scalar multiple', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const P = p.params;
      const a = [P.a11, P.a12, P.a21, P.a22];
      const b = [P.b11, P.b12, P.b21, P.b22];
      seen.add(P.form);
      const want = a.map((x, i) => (P.form === 0 ? x + b[i] : P.form === 1 ? x - b[i] : P.k * x));
      expect(vals(p)).toEqual(want);
    }
    expect(seen.size).toBe(3);
  });

  it('level 2: one entry of AB', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const P = p.params;
      const A = [[P.a11, P.a12, P.a13], [P.a21, P.a22, P.a23]];
      const B = [[P.b11, P.b12], [P.b21, P.b22], [P.b31, P.b32]];
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[P.i - 1][k] * B[k][P.j - 1];
      expect(p.answer.kind === 'number' ? Number(p.answer.value) : NaN).toBe(s);
    }
  });

  it('level 3: the full product', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const P = p.params;
      const A = [[P.a11, P.a12], [P.a21, P.a22]];
      const B = [[P.b11, P.b12], [P.b21, P.b22]];
      const want = [0, 1].flatMap((r) => [0, 1].map((c) => A[r][0] * B[0][c] + A[r][1] * B[1][c]));
      expect(vals(p)).toEqual(want);
    }
  });

  it('level 4: the correct size option, from m, n, p, q', () => {
    let undefinedCount = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { m, n, p: pp, q } = p.params;
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const label = p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!.label;
      if (n === pp) expect(label).toBe(`$${m} \\times ${q}$`);
      else {
        expect(label).toBe('Not defined');
        undefinedCount++;
      }
      // Four distinct options, and the right one appears exactly once.
      expect(new Set(p.answer.options.map((o) => o.label)).size).toBe(4);
    }
    expect(undefinedCount).toBeGreaterThan(80);
    expect(undefinedCount).toBeLessThan(250);
  });

  it('level 5: matrix times vector, and the interpretation option', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const P = p.params;
      const T = [[P.t11, P.t12, P.t13], [P.t21, P.t22, P.t23], [P.t31, P.t32, P.t33]];
      const v = [P.v1, P.v2, P.v3];
      expect(vals(p)).toEqual(T.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]));
      const iq = p.interpretation![0];
      const right = iq.options.find((o) => o.id === iq.correct)!;
      expect(right.label.startsWith(`$${T[P.ir][P.ij]}$`)).toBe(true);
      expect(iq.options.filter((o) => o.label.startsWith(`$${T[P.ir][P.ij]}$ `)).length).toBe(1);
    }
  });
});
