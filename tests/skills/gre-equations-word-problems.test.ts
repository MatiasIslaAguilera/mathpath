// Independent re-derivations for gre-equations-word-problems: brute-force integer search for
// the systems, and direct re-evaluation of every select-all option.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greEquationsWordProblems as skill } from '../../src/skills/gre/gre-equations-word-problems';

const num = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [n, d = '1'] = p.answer.value.split('/');
  return Number(n) / Number(d);
};

describe('gre-equations-word-problems', () => {
  it('level 1: the answer satisfies the equation written from the sentence', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, m, k, r } = p.params;
      const x = num(p);
      const lhs = form === 0 ? m * x + k : form === 1 ? m * x - k : m * (x + k);
      expect(lhs, p.id).toBe(r);
    }
  });

  it('level 2: consecutive integers, ages and coins by brute force', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, k, step, n, m, t, p: pc, q: qc, y, x } = p.params;
      const got = num(p);
      if (form === 0) {
        // find the sequence whose sum matches the one in the prompt
        const S = Number(p.prompt.match(/is (\d+)\./)![1]);
        let found = -1;
        for (let a = -5; a < 400; a++) {
          let sum = 0;
          for (let i = 0; i < k; i++) sum += a + i * step;
          if (sum === S) found = a + (k - 1) * step;
        }
        expect(got, p.id).toBe(found);
        expect(found).toBe(n + (k - 1) * step);
      } else if (form === 1) {
        const S = Number(p.prompt.match(/will be (\d+)\./)![1]);
        const tom = Array.from({ length: 60 }, (_, a) => a).filter((a) => a + t + (m * a + t) === S);
        expect(tom, p.id).toEqual([got]);
        expect(got).toBe(x);
      } else {
        const V = Number(p.prompt.match(/worth (\d+) cents/)![1]);
        const N = Number(p.prompt.match(/holds (\d+) coins/)![1]);
        const sols = Array.from({ length: N + 1 }, (_, c) => c).filter((c) => pc * (N - c) + qc * c === V);
        expect(sols, p.id).toEqual([got]);
        expect(got).toBe(y);
      }
    }
  });

  it('level 3: the unique non-negative integer pair meets both conditions', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const m = p.prompt.match(/total of (\d+) tickets were sold for .{2}(\d+)/)!; // "\$" is two characters
      const total = Number(m[1]);
      const R = Number(m[2]);
      const [pa, pc] = [p.params.p, p.params.q];
      const sols: [number, number][] = [];
      for (let a = 0; a <= total; a++) if (pa * a + pc * (total - a) === R) sols.push([a, total - a]);
      expect(sols.length, p.id).toBe(1);
      if (p.answer.kind === 'number') expect(num(p), p.id).toBe(sols[0][0]);
      else if (p.answer.kind === 'tuple') expect(p.answer.values.map(Number), p.id).toEqual(sols[0]);
      else throw new Error('unexpected answer kind');
    }
  });

  it('level 4: the integer solution of the system decides the comparison', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, a1, b1, a2, b2, x, y } = p.params;
      const c1 = a1 * x + b1 * y;
      const c2 = a2 * x + b2 * y;
      const sols: [number, number][] = [];
      for (let u = -30; u <= 30; u++) for (let v = -30; v <= 30; v++) if (a1 * u + b1 * v === c1 && a2 * u + b2 * v === c2) sols.push([u, v]);
      expect(sols, p.id).toEqual([[x, y]]);
      const [u, v] = sols[0];
      const A = form === 0 ? u : u + v;
      const B = form === 0 ? v : u - v;
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      expect(p.answer.correct, p.id).toBe(A > B ? 'a' : A < B ? 'b' : 'c');
    }
  });

  it('level 5: each option is correct iff it satisfies the stated condition', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'multi') throw new Error('expected multi');
      const { form, a, b, d, r } = p.params;
      const ok = (n: number) => (form === 0 ? Number.isInteger(n) && (a * n + b) % 2 === 0 : form === 1 ? n > 0 && n % d === r : n > 0 && (a * n + b) % d === 0);
      const want = p.answer.options.filter((o) => ok(Number(o.label.replace(/\$/g, '')))).map((o) => o.id).sort();
      expect([...p.answer.correct].sort(), p.id).toEqual(want);
      expect(want.length).toBeGreaterThan(0);
      expect(want.length).toBeLessThan(p.answer.options.length);
    }
  });
});
