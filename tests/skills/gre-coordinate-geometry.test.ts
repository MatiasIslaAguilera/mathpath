// Independent re-derivations for gre-coordinate-geometry, from raw params in plain JS.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greCoordinateGeometry as skill } from '../../src/skills/gre/gre-coordinate-geometry';

const N = 400;
const fracOf = (value: string) => {
  const [n, d] = value.split('/').map(Number);
  return { n, d: d ?? 1 };
};
/** Evaluate a label like "$y = -\frac{2}{3}x + 1$" as a function of x. */
function lineFn(label: string): (x: number) => number {
  const body = label
    .replace(/^\$y = /, '')
    .replace(/\$$/, '')
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '(($1)/($2))')
    .replace(/(^|[-+]\s*)x/g, '$1 1*x')
    .replace(/(\d|\))x/g, '$1*x');
  return new Function('x', `return ${body};`) as (x: number) => number;
}
const choiceLabel = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'choice') throw new Error('expected choice');
  return { options: p.answer.options, correct: p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)! };
};
const val = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  return fracOf(p.answer.value);
};

describe('gre-coordinate-geometry', () => {
  it('level 1: slope and intercept satisfy both points; the right option is the only one through both', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, x1, y1, x2, y2 } = p.params;
      if (form === 0) {
        const { n, d } = val(p);
        expect(Math.abs(n * (x2 - x1) - d * (y2 - y1)), p.id).toBe(0);
      } else if (form === 1) {
        const { n, d } = val(p);
        // line y = m x + b with m = dy/dx passes through (x1, y1): b = y1 - m x1
        expect(Math.abs(n * (x2 - x1) - d * (y1 * (x2 - x1) - (y2 - y1) * x1)), p.id).toBe(0);
      } else {
        const { options, correct } = choiceLabel(p);
        const through = options.filter((o) => {
          const f = lineFn(o.label);
          return Math.abs(f(x1) - y1) < 1e-9 && Math.abs(f(x2) - y2) < 1e-9;
        });
        expect(through.map((o) => o.id), p.id).toEqual([correct.id]);
      }
      expect(p.figure?.kind).toBe('svg');
    }
  });

  it('level 2: distance, midpoint, and endpoint from midpoint', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, x1, y1, x2, y2 } = p.params;
      const { n, d } = val(p);
      if (form === 0) {
        expect(d).toBe(1);
        expect(n * n, p.id).toBe((x2 - x1) ** 2 + (y2 - y1) ** 2);
        expect(n).toBeGreaterThan(0);
      } else if (form === 1) {
        const useX = p.prompt.includes('x-coordinate');
        expect(n * 2, p.id).toBe(d * ((useX ? x1 + x2 : y1 + y2)));
      } else {
        const useX = p.prompt.includes('x-coordinate');
        expect(d).toBe(1);
        expect(n, p.id).toBe(useX ? x2 : y2);
        // midpoint printed in the prompt is the true midpoint of A and B
        expect(p.prompt).toContain(`(${x1}, ${y1})`);
      }
    }
  });

  it('level 3: slopes and intercepts', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, a, b, x0, y0 } = p.params;
      if (form === 3) {
        const { options, correct } = choiceLabel(p);
        const slope = (o: { label: string }) => lineFn(o.label)(1) - lineFn(o.label)(0);
        const perp = options.filter((o) => Math.abs(slope(o) * (-a / b) + 1) < 1e-9);
        expect(perp.map((o) => o.id), p.id).toEqual([correct.id]);
        continue;
      }
      const { n, d } = val(p);
      if (form === 0) expect(Math.abs(n * a - d * b), p.id).toBe(0); // s = b/a, s*(-a/b) = -1
      if (form === 1) expect(Math.abs(b * d * y0 - (-a * x0 * d + n * b)), p.id).toBe(0); // parallel: slope -a/b
      if (form === 2) expect(Math.abs(a * d * y0 - (b * x0 * d + n * a)), p.id).toBe(0); // perpendicular: slope b/a
    }
  });

  it('level 4: triangle with the axes', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, p: px, q: qy, s } = p.params;
      const a = s * qy;
      const b = s * px;
      const c = s * px * qy;
      const xi = c / a; // y = 0
      const yi = c / b; // x = 0
      expect(a * xi + b * 0).toBe(c);
      expect(a * 0 + b * yi).toBe(c);
      const { n, d } = val(p);
      const want = form === 1 ? xi + yi : Math.abs(xi * yi) / 2;
      expect(n / d, p.id).toBeCloseTo(want, 12);
      expect(p.figure?.kind).toBe('svg');
    }
  });

  it('level 5: comparisons', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, quad, x1, y1, x2, y2 } = p.params;
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      let want: string;
      if (form === 0) {
        const num = y2 - y1;
        const den = x2 - x1;
        const slopeMinus1 = (num - den) / den; // slope - 1
        want = slopeMinus1 > 0 ? 'a' : slopeMinus1 < 0 ? 'b' : 'c';
      } else if (form === 1) {
        const A = x1 * x1 + y1 * y1;
        const B = x2 * x2 + y2 * y2;
        want = A > B ? 'a' : A < B ? 'b' : 'c';
      } else {
        const sx = quad === 1 || quad === 4 ? 1 : -1;
        const sy = quad === 1 || quad === 2 ? 1 : -1;
        want = sx * sy > 0 ? 'a' : 'b';
      }
      expect(p.answer.correct, p.id).toBe(want);
      if (form !== 2) expect(want).not.toBe('d');
    }
  });
});
