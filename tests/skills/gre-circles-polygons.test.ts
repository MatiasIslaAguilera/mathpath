// Independent re-derivations for gre-circles-polygons: numeric areas with Math.PI, polygon
// angle checks by direct search, and parsing of each multiple-choice label into a number.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greCirclesPolygons as skill } from '../../src/skills/gre/gre-circles-polygons';

const N = 400;
type P = ReturnType<typeof makeProblem>;
const frac = (v: string) => {
  const [n, d] = v.split('/').map(Number);
  return n / (d ?? 1);
};
const numVal = (p: P) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  return frac(p.answer.value);
};
/** "$9 - 4\pi$", "$12 + \frac{9}{2}\pi$", "$\pi - 4$" -> number. */
function labelVal(label: string): number {
  const js = label
    .replace(/\$/g, '')
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')
    .replace(/([\d)])\\pi/g, '$1*Math.PI')
    .replace(/\\pi/g, 'Math.PI');
  return new Function(`return ${js};`)() as number;
}

describe('gre-circles-polygons', () => {
  it('level 1: coefficient of pi', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, r } = p.params;
      const area = Math.PI * r * r;
      const circ = 2 * Math.PI * r;
      const want = form === 0 || form === 1 || form === 4 ? area / Math.PI : circ / Math.PI;
      expect(numVal(p), p.id).toBeCloseTo(want, 9);
      // given quantities match the stated radius
      if (form === 1 || form === 2) expect(p.prompt).toContain(`diameter ${2 * r}`);
      if (form === 0 || form === 3) expect(p.prompt).toContain(`radius ${r}`);
      expect(p.figure?.kind).toBe('svg');
    }
  });

  it('level 2: arcs and sectors', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, r, th, useD } = p.params;
      const ans = numVal(p);
      if (form === 0) expect(ans, p.id).toBeCloseTo(((th * Math.PI) / 180) * r / Math.PI, 9); // arc = radians * r
      else if (form === 1) expect(ans, p.id).toBeCloseTo(((th * Math.PI) / 360) * r * r / Math.PI, 9); // sector = (theta_rad/2) r^2
      else {
        expect(ans, p.id).toBe(th);
        const m = p.prompt.match(/area \$(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+))\\pi\$/)!;
        const k = m[3] ? Number(m[3]) : Number(m[1]) / Number(m[2]);
        expect(((ans * Math.PI) / 360) * r * r / Math.PI, p.id).toBeCloseTo(k, 9);
      }
      if (useD) expect(p.prompt).toContain(`diameter of ${2 * r}`);
      expect(p.figure?.kind).toBe('svg');
    }
  });

  it('level 3: polygon angles', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, n, th } = p.params;
      if (form === 3) {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const possible = (ang: number) => {
          for (let k = 3; k <= 400; k++) if (Math.abs(180 - 360 / k - ang) < 1e-9) return true;
          return false;
        };
        const should = p.answer.options.filter((o) => possible(parseInt(o.label, 10))).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(should);
      } else if (form === 0) {
        // fan triangulation: n - 2 triangles
        let tri = 0;
        for (let v = 1; v < n - 1; v++) tri++;
        expect(numVal(p), p.id).toBe(tri * 180);
      } else if (form === 1) {
        let tri = 0;
        for (let v = 1; v < n - 1; v++) tri++;
        expect(numVal(p), p.id).toBeCloseTo((tri * 180) / n, 9);
      } else {
        let found = -1;
        for (let k = 3; k <= 400; k++) if (Math.abs(180 - 360 / k - th) < 1e-9) found = k;
        expect(numVal(p), p.id).toBe(found);
      }
    }
  });

  it('level 4: composite regions, by parsing every option', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, r, h } = p.params;
      if (form === 2) {
        expect(numVal(p), p.id).toBeCloseTo((Math.SQRT2 * r) ** 2, 9); // side = r*sqrt(2)
        continue;
      }
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const want = form === 0 ? (2 * r) ** 2 - Math.PI * r * r : 2 * r * h + (Math.PI * r * r) / 2;
      const matching = p.answer.options.filter((o) => Math.abs(labelVal(o.label) - want) < 1e-9);
      expect(matching.map((o) => o.id), p.id).toEqual([p.answer.correct]);
    }
  });

  it('level 5: comparisons with pi', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { form, p: a, q } = p.params;
      const A = form === 0 ? Math.PI * (a / 2) ** 2 : form === 1 ? Math.PI * a : Math.PI * a * a;
      const B = form === 0 ? (q * q) / 2 : form === 1 ? q : q * q;
      expect(Math.abs(A - B), p.id).toBeGreaterThan(0.04);
      expect(p.answer.correct, p.id).toBe(A > B ? 'a' : 'b');
    }
  });
});
