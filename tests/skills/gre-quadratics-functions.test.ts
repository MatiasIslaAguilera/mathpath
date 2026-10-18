// Independent re-derivations (plain JS, from raw params) for gre-quadratics-functions.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greQuadraticsFunctions as skill } from '../../src/skills/gre/gre-quadratics-functions';

const num = (p: ReturnType<typeof makeProblem>) => (p.answer.kind === 'number' ? Number(p.answer.value) : NaN);

describe('gre-quadratics-functions', () => {
  it('level 1: roots, sums, products, and select-all by plugging in', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { r1, r2, form } = p.params;
      const b = -(r1 + r2);
      const c = r1 * r2;
      const isRoot = (t: number) => t * t + b * t + c === 0;
      if (form === 3) {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const should = p.answer.options.filter((o) => isRoot(Number(o.label))).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(should);
        expect(should.length).toBe(2);
        // the sign-flipped roots are present as traps
        expect(p.answer.options.some((o) => Number(o.label) === -r1)).toBe(true);
      } else {
        // brute-force search for the roots
        const roots: number[] = [];
        for (let t = -40; t <= 40; t++) if (isRoot(t)) roots.push(t);
        const want = form === 0 ? roots[0] + roots[1] : form === 1 ? roots[0] * roots[1] : Math.max(...roots);
        expect(num(p), p.id).toBe(want);
      }
    }
  });

  it('level 2: special products from real x, y', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { x, y, form } = p.params;
      const want = form === 0 ? x * x - y * y : form === 1 ? x * x + y * y : (x + y) * (x + y);
      expect(num(p), p.id).toBe(want);
      const stated = p.prompt.match(/-?\d+/g)!.map(Number);
      if (form === 0) expect(stated.slice(0, 2).sort()).toEqual([x + y, x - y].sort());
    }
  });

  it('level 3: function notation', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { p: pp, q, r, a, b, form } = p.params;
      const want = form === 0 ? pp * a * a + q * a + r - (pp * b * b + q * b + r) : pp * (pp * a + q) + q;
      expect(num(p), p.id).toBe(want);
    }
  });

  it('level 4: comparison relation, by enumeration over the integer domain / case analysis', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { form, m, n, h, k, c, t } = p.params;
      const sign = (A: (x: number) => number, B: (x: number) => number, xs: number[]) => {
        const s = new Set(xs.map((x) => Math.sign(A(x) - B(x))));
        return s.size > 1 ? 'd' : [...s][0] > 0 ? 'a' : [...s][0] < 0 ? 'b' : 'c';
      };
      const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      let want: string;
      if (form === 3) {
        let min = Infinity;
        for (let x = -40; x <= 40; x++) min = Math.min(min, x * x - 2 * h * x + c);
        want = min > t ? 'a' : min < t ? 'b' : 'c';
      } else if (form === 0) want = sign((x) => (x - m) * (x + n), (x) => x * x + (n - m) * x - m * n, range(-30, 30));
      else if (form === 1) {
        const restricted = p.prompt.includes('\\ne');
        want = sign((x) => (x - h) ** 2 + k, () => k, range(-30, 30).filter((x) => !restricted || x !== h));
      } else {
        const A = (x: number) => (x + n) ** 2;
        const B = (x: number) => x * x + n * n;
        if (p.prompt.includes('x > 0')) want = sign(A, B, range(1, 40));
        else if (p.prompt.includes('x < 0')) want = sign(A, B, range(-40, -1));
        else want = sign(A, B, range(-40, 40));
      }
      expect(p.answer.correct, p.id).toBe(want);
    }
  });

  it('level 5: nested defined operation', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, p: pp, x, y, z } = p.params;
      const op = (a: number, b: number) => (form === 0 ? pp * a - b ** 2 : a ** 2 - pp * b);
      expect(num(p), p.id).toBe(op(x, op(y, z)));
    }
  });
});
