// Answers are re-derived from the raw params with plain JavaScript, independent of the generator.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { evalExact } from '../../src/engine/checker';
import type { Problem } from '../../src/engine/types';
import { inverseFunctions as skill } from '../../src/skills/math/inverse-functions';

const N = 300;
const nums = (p: Problem): number[] => (p.answer.kind === 'tuple' ? p.answer.values.map(evalExact) : p.answer.kind === 'number' ? [evalExact(p.answer.value)] : [NaN]);
const XS = [-7, -2.5, 0, 1, 3, 10];

describe('inverse-functions answers', () => {
  it('level 1: f(answer) = k for f(x) = mx + b', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { m, b, k } = p.params;
      expect(m * nums(p)[0] + b).toBe(k);
    }
  });

  it('level 2: f(f^-1(x)) = x at five points', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { m, b } = p.params;
      const [pp, qq] = nums(p);
      for (const x of XS.slice(0, 5)) expect(m * (pp * x + qq) + b).toBeCloseTo(x, 9);
    }
  });

  it('level 3: demand(inverse demand(Q)) = Q at five points, slope negative', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { a, b } = p.params;
      const [c, s] = nums(p);
      expect(s).toBeLessThan(0);
      for (const Q of XS.slice(0, 5)) expect(a - b * (c + s * Q)).toBeCloseTo(Q, 9);
    }
  });

  it('level 4: f(answer) = k for both forms', () => {
    const forms = [0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, a, b, c, d, k } = p.params;
      const x = nums(p)[0];
      forms[form]++;
      const fx = form === 0 ? a * x ** 3 + b : (a * x + b) / (c * x + d);
      expect(fx).toBeCloseTo(k, 9);
    }
    expect(forms[0]).toBeGreaterThan(80);
    expect(forms[1]).toBeGreaterThan(80);
  });

  it('level 5: answer is on the domain branch and f(answer) = K', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { h, k, s } = p.params;
      const x = nums(p)[0];
      expect(x).toBeGreaterThanOrEqual(h);
      expect(x).toBe(h + s);
      const K = Number(/Find \$f\^\{-1\}\((-?\d+)\)\$/.exec(p.prompt)![1]);
      expect((x - h) ** 2 + k).toBe(K);
      // wrong-branch lands off the domain unless s = 0 (never)
      const wb = p.misconceptions.find((m) => m.id === 'wrong-branch');
      if (wb && wb.wrong.kind === 'number') expect(evalExact(wb.wrong.value)).toBe(h - s);
    }
  });
});

describe('inverse-functions misconceptions', () => {
  it('level 1: reciprocal, evaluate-instead and undo-order are the predicted numbers', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { m, b, k } = p.params;
      const get = (id: string) => {
        const w = p.misconceptions.find((x) => x.id === id)?.wrong;
        return w && w.kind === 'number' ? evalExact(w.value) : undefined;
      };
      const fk = m * k + b;
      if (get('reciprocal') !== undefined) expect(get('reciprocal')).toBeCloseTo(1 / fk, 9);
      if (get('evaluate-instead') !== undefined) expect(get('evaluate-instead')).toBe(fk);
      if (get('undo-order') !== undefined) expect(get('undo-order')).toBeCloseTo(k / m - b, 9);
    }
  });

  it('level 2: undo-order and negative-reciprocal-slope tuples', () => {
    let seen = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { m, b } = p.params;
      for (const mi of p.misconceptions) {
        if (mi.wrong.kind !== 'tuple') continue;
        const v = mi.wrong.values.map(evalExact);
        if (mi.id === 'undo-order') expect([v[0], v[1]]).toEqual([expect.closeTo(1 / m, 9), -b]);
        if (mi.id === 'negative-reciprocal-slope') expect([v[0], v[1]]).toEqual([expect.closeTo(-1 / m, 9), expect.closeTo(b / m, 9)]);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(300);
  });
});

describe('inverse-functions interpretation', () => {
  const labelOf = (p: Problem, i: number) => {
    const iq = p.interpretation![i];
    return iq.options.find((o) => o.id === iq.correct)!.label;
  };

  it('level 1 (about half): the correct option asks which input gives the output k', () => {
    let seen = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      if (!p.interpretation) continue;
      const { k } = p.params;
      expect(labelOf(p, 0)).toBe(`Which input gives the output ${k}?`);
      expect(p.prompt).toContain(`f^{-1}(${k})`);
      seen++;
    }
    expect(seen).toBeGreaterThan(90);
    expect(seen).toBeLessThan(220);
  });

  it('level 3: choke price always; slope question about half and equals -1/b', () => {
    let slopeQs = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { a, b } = p.params;
      expect(p.interpretation![0].prompt).toContain('intercept');
      expect(labelOf(p, 0)).toMatch(/^The choke price: the price at which quantity demanded falls to zero$/);
      // the choke price is the P-intercept a/b, i.e. P when Q = 0
      expect(p.interpretation![0].explanation).toContain(a % b === 0 ? `P = ${a / b}` : `P = \\frac{${a / (gcd(a, b))}}{${b / gcd(a, b)}}`);
      if (p.interpretation!.length > 1) {
        slopeQs++;
        const expected = b === 1 ? 'Falls by $1$' : `Falls by $\\frac{1}{${b}}$`;
        expect(labelOf(p, 1)).toBe(expected);
      }
    }
    expect(slopeQs).toBeGreaterThan(90);
    expect(slopeQs).toBeLessThan(220);
  });

  it('levels 2, 4 and 5 have no interpretation question', () => {
    for (const level of [2, 4, 5] as const) expect(makeProblem(skill, level, 1).interpretation).toBeUndefined();
  });
});

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
