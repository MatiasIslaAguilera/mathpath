// Image points are re-derived from the raw params: the image of (p, f(p)) on g(x) = A f(B(x-h)) + k
// must satisfy g(X) = Y and B(X - h) = p. Interpretation answers are re-derived too.

import { describe, expect, it } from 'vitest';
import { evalExact } from '../../src/engine/checker';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { functionTransformations as skill } from '../../src/skills/math/function-transformations';

const N = 300;
const F = [(x: number) => x * x, Math.abs, Math.sqrt, (x: number) => x ** 3];
const tuple = (p: Problem) => (p.answer.kind === 'tuple' ? p.answer.values.map(evalExact) : [NaN, NaN]);
const num = (p: Problem) => (p.answer.kind === 'number' ? evalExact(p.answer.value) : NaN);
const pointInPrompt = (p: Problem) => {
  const m = /point \$\((-?\d+), (-?\d+)\)\$/.exec(p.prompt)!;
  return [Number(m[1]), Number(m[2])];
};

describe('function-transformations answers', () => {
  it('levels 1-2: shifts', () => {
    for (const level of [1, 2] as const) {
      for (let seed = 1; seed <= N; seed++) {
        const p = makeProblem(skill, level, seed);
        const { base, p: pt, h, k } = p.params;
        const [px, py] = pointInPrompt(p);
        expect(px).toBe(pt);
        expect(py).toBe(F[base](pt));
        const [X, Y] = tuple(p);
        expect(X).toBe(pt + h);
        expect(Y).toBe(F[base](pt) + k);
        // g(X) = Y with g(x) = f(x - h) + k
        expect(F[base](X - h) + k).toBeCloseTo(Y, 9);
      }
    }
  });

  it('level 3: reflection and vertical stretch', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { base, form, p: pt, A, k } = p.params;
      const [X, Y] = tuple(p);
      if (form === 0) {
        expect(X).toBe(pt);
        expect(A * F[base](X) + k).toBeCloseTo(Y, 9);
      } else {
        expect(X).toBeCloseTo(-pt, 9);
        expect(F[base](-X) + k).toBeCloseTo(Y, 9);
      }
    }
  });

  it('level 4: X = (p + c)/B and g(X) = A f(p) + k, with g(x) = f(Bx - c) + k', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { base, p: pt, B, c, k } = p.params;
      const [X, Y] = tuple(p);
      expect(X).toBeCloseTo((pt + c) / B, 9);
      expect(F[base](B * X - c) + k).toBeCloseTo(Y, 9);
      expect(Y).toBeCloseTo(F[base](pt) + k, 9);
    }
  });

  it('level 4 misconceptions are the predicted points', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { p: pt, B, c, k, base } = p.params;
      const Y = F[base](pt) + k;
      for (const mi of p.misconceptions) {
        if (mi.wrong.kind !== 'tuple') continue;
        const [wx, wy] = mi.wrong.values.map(evalExact);
        expect(wy).toBeCloseTo(Y, 9);
        if (mi.id === 'horizontal-sign') expect(wx).toBeCloseTo((pt - c) / B, 9);
        if (mi.id === 'horizontal-scale-inverted') expect(wx).toBeCloseTo(B * pt + c / B, 9);
        if (mi.id === 'factor-b-first') expect(wx).toBeCloseTo(pt / B + c, 9);
      }
    }
  });

  it('level 3 reflect-wrong-axis and vertical-order', () => {
    let reflect = 0;
    let order = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { base, form, p: pt, A, k } = p.params;
      const q = F[base](pt);
      for (const mi of p.misconceptions) {
        if (mi.wrong.kind !== 'tuple') continue;
        const [wx, wy] = mi.wrong.values.map(evalExact);
        if (mi.id === 'reflect-wrong-axis') {
          reflect++;
          if (form === 0) [wx, wy].forEach((v, i) => expect(v).toBe(i === 0 ? -pt : Math.abs(A) * q + k));
          else [wx, wy].forEach((v, i) => expect(v).toBe(i === 0 ? pt : -q + k));
        }
        if (mi.id === 'vertical-order') {
          order++;
          expect(wy).toBeCloseTo(A * (q + k), 9);
        }
      }
    }
    expect(reflect).toBeGreaterThan(100);
    expect(order).toBeGreaterThan(50);
  });

  it('level 5: g(x0) from the stated moves', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { h, A, flip, k, x0 } = p.params;
      expect(num(p)).toBe((flip ? -1 : 1) * A * (x0 - h) ** 2 + k);
      expect(p.prompt).toContain(`Stretch it vertically by a factor of ${A}`);
      expect(p.prompt.includes('Reflect it over the $x$-axis.')).toBe(!!flip);
      expect(p.prompt).toContain(h > 0 ? `right ${h}` : `left ${-h}`);
      expect(p.prompt).toContain(k > 0 ? `up ${k}` : `down ${-k}`);
    }
  });
});

describe('function-transformations interpretation', () => {
  it('level 2: a tax of t shifts supply up by t, with t = k when k > 0', () => {
    let seen = 0;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (!p.interpretation) continue;
      const iq = p.interpretation[0];
      const t = Number(/tax of \\?\$(\d+)/.exec(iq.prompt)![1]);
      const { k } = p.params;
      if (k > 0) expect(t).toBe(k);
      expect(t).toBeGreaterThanOrEqual(1);
      expect(iq.options.find((o) => o.id === iq.correct)!.label).toBe(`Up by \\$${t}`);
      expect(iq.options.map((o) => o.label)).toEqual(expect.arrayContaining([`Down by \\$${t}`, `Right by \\$${t}`, `Left by \\$${t}`]));
      seen++;
    }
    expect(seen).toBeGreaterThan(90);
    expect(seen).toBeLessThan(220);
  });

  it('other levels have none', () => {
    for (const level of [1, 3, 4, 5] as const) expect(makeProblem(skill, level, 1).interpretation).toBeUndefined();
  });
});
