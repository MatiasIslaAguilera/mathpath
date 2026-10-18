// Independent re-derivations for gre-lines-angles-triangles: trig, Heron's formula, the law of
// cosines and a dense scan of the triangle-inequality interval, all from raw params / prompt numbers.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greLinesAnglesTriangles as skill } from '../../src/skills/gre/gre-lines-angles-triangles';

const N = 400;
type P = ReturnType<typeof makeProblem>;
/** Numeric value of a number answer, including "k*sqrt(r)". */
function numVal(p: P): number {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  return evalSurd(p.answer.value);
}
function evalSurd(v: string): number {
  const m = v.match(/^(-?\d+)\*sqrt\((\d+)\)$/);
  if (m) return Number(m[1]) * Math.sqrt(Number(m[2]));
  const f = v.split('/').map(Number);
  return f[0] / (f[1] ?? 1);
}
/** "$3\sqrt{2}$" / "$\sqrt{3}$" / "$12$" -> number. */
function labelVal(label: string): number {
  const m = label.match(/^\$(\d*)\\sqrt\{(\d+)\}\$$/);
  if (m) return (m[1] === '' ? 1 : Number(m[1])) * Math.sqrt(Number(m[2]));
  return Number(label.replace(/\$/g, ''));
}
const ints = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('gre-lines-angles-triangles', () => {
  it('level 1: angle sums', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, a, b, c } = p.params;
      const x = numVal(p);
      if (form === 0) expect(a + b + x, p.id).toBe(180);
      else if (form === 1) expect(x * (a + b + c), p.id).toBe(180);
      else expect(90 + a + x, p.id).toBe(180);
      expect(p.figure?.kind).toBe('svg');
    }
  });

  it('level 2: Pythagorean triples', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form } = p.params;
      const x = numVal(p);
      const [n1, n2] = ints(p.prompt.split('?')[0].replace(/triangle \$ABC\$/, '')).filter((v) => v > 2).slice(-2);
      if (form === 2) expect(x, p.id).toBeCloseTo(n1 + n2 + Math.hypot(n1, n2), 9);
      else if (p.prompt.includes('legs of lengths')) expect(x * x, p.id).toBe(n1 * n1 + n2 * n2);
      else expect(x * x + n1 * n1, p.id).toBe(n2 * n2);
      expect(Number.isInteger(x)).toBe(true);
    }
  });

  it('level 3: special triangles by trigonometry', () => {
    const rad = (d: number) => (d * Math.PI) / 180;
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, s } = p.params;
      if (form === 0 || form === 5) {
        const want = s / Math.cos(rad(45));
        if (form === 0) expect(numVal(p), p.id).toBeCloseTo(want, 9);
        else {
          if (p.answer.kind !== 'choice') throw new Error('expected choice');
          const correct = p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!;
          expect(labelVal(correct.label), p.id).toBeCloseTo(want, 9);
          expect(p.answer.options.filter((o) => Math.abs(labelVal(o.label) - want) < 1e-9).length).toBe(1);
        }
      } else if (form === 1) expect(numVal(p), p.id).toBeCloseTo((2 * s) * Math.cos(rad(45)), 9);
      else if (form === 2) expect(numVal(p), p.id).toBeCloseTo(s / Math.sin(rad(30)), 9);
      else if (form === 3) expect(numVal(p), p.id).toBeCloseTo(s * Math.tan(rad(60)), 9);
      else expect(numVal(p), p.id).toBeCloseTo(2 * s * Math.cos(rad(30)), 9);
    }
  });

  it('level 4: isosceles angles, area (Heron) and perimeter', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form } = p.params;
      const x = numVal(p);
      const nums = ints(p.prompt.split('?')[0].replace(/\^\\circ/g, ' deg'));
      if (form === 0) {
        const apex = nums.find((n) => n >= 20)!;
        expect(x * 2 + apex, p.id).toBe(180);
      } else if (form === 1) {
        const base = nums.find((n) => n >= 20)!;
        expect(x + 2 * base, p.id).toBe(180);
      } else if (form === 2) {
        const [leg, base] = nums.slice(-2);
        const sp = (leg + leg + base) / 2;
        expect(x, p.id).toBeCloseTo(Math.sqrt(sp * (sp - leg) * (sp - leg) * (sp - base)), 9);
      } else {
        const [base, alt] = nums.slice(-2);
        expect(x, p.id).toBeCloseTo(base + 2 * Math.hypot(base / 2, alt), 9);
      }
    }
  });

  it('level 5: scale-free comparisons, triangle inequality', () => {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, a, b, c } = p.params;
      if (form === 0) {
        if (p.answer.kind !== 'choice') throw new Error('expected choice');
        // law of cosines for several valid third sides: angle C (opposite AB=a) vs angle B (opposite AC=b)
        const seen = new Set<string>();
        for (let bc = Math.abs(a - b) + 0.5; bc < a + b; bc += 0.5) {
          const angC = Math.acos((a * a + bc * bc - b * b) / (2 * a * bc)) ; // angle at C? sides: AB=a opposite C
          void angC;
          const cosC = (bc * bc + b * b - a * a) / (2 * bc * b); // angle C is between BC and CA, opposite AB
          const cosB = (bc * bc + a * a - b * b) / (2 * bc * a); // angle B is between BC and BA, opposite AC
          const dC = Math.acos(cosC);
          const dB = Math.acos(cosB);
          seen.add(Math.abs(dC - dB) < 1e-9 ? 'c' : dC > dB ? 'a' : 'b');
        }
        expect([...seen], p.id).toEqual([p.answer.correct]);
      } else if (form === 1) {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const lo = Math.abs(a - b);
        const hi = a + b;
        const should = p.answer.options.filter((o) => Number(o.label) > lo && Number(o.label) < hi).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(should);
        expect(p.answer.options.some((o) => Number(o.label) === hi)).toBe(true);
      } else {
        if (p.answer.kind !== 'choice') throw new Error('expected choice');
        const lo = Math.abs(a - b);
        const hi = a + b;
        const rels = new Set<string>();
        for (let i = 1; i < 1000; i++) {
          const x = lo + ((hi - lo) * i) / 1000;
          rels.add(x > c ? 'a' : x < c ? 'b' : 'c');
        }
        const want = rels.size > 1 ? 'd' : [...rels][0];
        expect(p.answer.correct, p.id).toBe(want);
      }
    }
  });
});
