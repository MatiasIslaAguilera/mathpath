// Independent re-derivations for gre-solids, from raw params and by brute force where possible
// (corner-to-corner distance over the box's vertices, face counting by enumeration).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greSolids as skill } from '../../src/skills/gre/gre-solids';

const N = 400;
type P = ReturnType<typeof makeProblem>;
const numVal = (p: P) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [n, d] = p.answer.value.split('/').map(Number);
  return n / (d ?? 1);
};
/** Surface area by summing the six faces explicitly. */
const faces = (l: number, w: number, h: number) => [l * w, l * w, l * h, l * h, w * h, w * h].reduce((a, b) => a + b, 0);
/** Longest distance between two vertices of an l x w x h box. */
function longest(l: number, w: number, h: number): number {
  let best = 0;
  const verts: [number, number, number][] = [];
  for (const x of [0, l]) for (const y of [0, w]) for (const z of [0, h]) verts.push([x, y, z]);
  for (const a of verts) for (const b of verts) best = Math.max(best, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  return best;
}

describe('gre-solids', () => {
  it('level 1: volume', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, l, w, h } = p.params;
      const x = numVal(p);
      if (form === 0) expect(x, p.id).toBe(l * w * h);
      else if (form === 1) {
        const V = Number(p.prompt.match(/volume (\d+)/)![1]);
        expect(l * w * x, p.id).toBe(V);
      } else if (form === 2) expect(x, p.id).toBe(h * h * h);
      else {
        const V = Number(p.prompt.match(/volume (\d+)/)![1]);
        expect(x * x * x, p.id).toBe(V);
      }
    }
  });

  it('level 2: surface area by counting faces', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, l, w, h } = p.params;
      const x = numVal(p);
      if (form === 0) expect(x, p.id).toBe(faces(l, w, h));
      else if (form === 1) expect(x, p.id).toBe(faces(h, h, h));
      else if (form === 2) {
        const A = Number(p.prompt.match(/surface area of (\d+)/)![1]);
        expect(faces(x, x, x), p.id).toBe(A);
      } else {
        const A = Number(p.prompt.match(/surface area (\d+)/)![1]);
        expect(faces(l, w, x), p.id).toBe(A);
      }
    }
  });

  it('level 3: cylinders (coefficient of pi), via numeric integration of the radius', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, r, h } = p.params;
      const x = numVal(p);
      // volume = integral of the circle area 2 pi s ds over 0..r, times h (midpoint rule, exact for this integrand)
      let area = 0;
      const steps = 2000;
      for (let i = 0; i < steps; i++) area += 2 * Math.PI * (((i + 0.5) * r) / steps) * (r / steps);
      const volume = area * h;
      const total = 2 * area + 2 * Math.PI * r * h;
      if (form === 1) expect(x, p.id).toBeCloseTo(total / Math.PI, 6);
      else expect(x, p.id).toBeCloseTo(volume / Math.PI, 6);
    }
  });

  it('level 4: scaling and comparison', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, k, e, v, m } = p.params;
      const vol = (a: number, b: number, c: number) => a * b * c;
      if (form === 0) expect(numVal(p), p.id).toBe(vol(k, k, k));
      else if (form === 1) expect(numVal(p), p.id).toBe(faces(k, k, k) / 6);
      else if (form === 2) expect(numVal(p), p.id).toBe(v * vol(k, k, k));
      else {
        if (p.answer.kind !== 'choice') throw new Error('expected choice');
        const A = vol(k * e, k * e, k * e);
        const B = m * vol(e, e, e);
        expect(p.answer.correct, p.id).toBe(A > B ? 'a' : A < B ? 'b' : 'c');
      }
    }
  });

  it('level 5: space diagonal over the vertices', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, l, w, h, e } = p.params;
      if (form === 0) {
        expect(numVal(p), p.id).toBeCloseTo(longest(l, w, h), 9);
        expect(Number.isInteger(numVal(p))).toBe(true);
      } else {
        if (p.answer.kind !== 'choice') throw new Error('expected choice');
        const want = longest(e, e, e);
        const value = (label: string) => {
          const m = label.match(/^\$(\d+)\\sqrt\{(\d+)\}\$$/);
          return m ? Number(m[1]) * Math.sqrt(Number(m[2])) : Number(label.replace(/\$/g, ''));
        };
        const hit = p.answer.options.filter((o) => Math.abs(value(o.label) - want) < 1e-9).map((o) => o.id);
        expect(hit, p.id).toEqual([p.answer.correct]);
      }
    }
  });
});
