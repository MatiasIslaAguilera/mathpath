// Independent check of the level-5 rules: build random integer matrices with the stated
// determinant and confirm each rule numerically with mathjs (not the generator's formulas).

import { describe, expect, it } from 'vitest';
import { det } from 'mathjs';
import { makeProblem } from '../../src/engine/registry';
import { determinants as skill } from '../../src/skills/math/determinants';

type M = number[][];
const identity = (n: number): M => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));

/** A random integer n×n matrix with determinant exactly `d`: diag(d,1,..) times unimodular row ops. */
function withDet(n: number, d: number, r: () => number): M {
  const m = identity(n);
  m[0][0] = d;
  for (let t = 0; t < 8; t++) {
    const i = Math.floor(r() * n);
    let j = Math.floor(r() * n);
    if (i === j) j = (j + 1) % n;
    const f = Math.floor(r() * 5) - 2;
    for (let c = 0; c < n; c++) m[i][c] += f * m[j][c];
  }
  return m;
}
const mulberry = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const value = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('not a number');
  return Number(p.answer.value);
};

describe('determinants level 5', () => {
  it('matches each rule on random matrices with the stated determinants', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, n, d, e, k } = p.params;
      seen.add(form);
      const r = mulberry(seed);
      const A = withDet(n, d, r);
      expect(det(A), p.id).toBeCloseTo(d, 6);
      let want: number;
      if (form === 0) want = det(A.map((row) => row.map((v) => k * v)));
      else if (form === 1) want = det(mul(A, withDet(n, e, r)));
      else if (form === 2) want = det(A[0].map((_, j) => A.map((row) => row[j])));
      else want = det([A[1], A[0], ...A.slice(2)]);
      expect(value(p), p.id).toBeCloseTo(want, 6);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});
