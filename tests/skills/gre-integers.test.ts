// Independent re-derivations for the reference GRE skill: brute-force divisibility for the
// select-all level, exhaustive enumeration for integer comparisons, and divisor counting by
// trial division (not the (e+1)(e+1)... formula the generator teaches).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greIntegers as skill } from '../../src/skills/gre/gre-integers';

describe('gre-integers', () => {
  it('select-all factors: exactly the options that divide n are correct', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (p.answer.kind !== 'multi') throw new Error('expected multi');
      const n = p.params.n;
      const shouldBe = p.answer.options.filter((o) => n % Number(o.label) === 0).map((o) => o.id).sort();
      expect([...p.answer.correct].sort(), p.id).toEqual(shouldBe);
      expect(p.answer.options.some((o) => Number(o.label) % n === 0 && Number(o.label) > n), `${p.id} has a multiple trap`).toBe(true);
    }
  });

  it('comparisons: the relation holds for every allowed value (or genuinely varies)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { form, lo, hi, k, a, b, d } = p.params;
      const pairs: [number, number][] = [];
      if (form === 0) for (let n = lo; n <= hi; n++) pairs.push([n * n, k * n]);
      else pairs.push([a % d, b % d]);
      const signs = new Set(pairs.map(([x, y]) => Math.sign(x - y)));
      const expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
      expect(p.answer.correct, p.id).toBe(expected);
    }
  });

  it('divisor counts match trial division', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const n = p.params.n;
      let count = 0;
      for (let k = 1; k <= n; k++) if (n % k === 0) count++;
      expect(p.answer.kind === 'number' && Number(p.answer.value), p.id).toBe(count);
    }
  });
});
