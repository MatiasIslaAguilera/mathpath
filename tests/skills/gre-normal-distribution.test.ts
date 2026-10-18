// Independent re-derivations: the 68-95-99.7 slices are rebuilt from the standard normal CDF
// (erf), tail/QC relations come from exact z-scores re-parsed from the prompt, and
// quartiles are recomputed from the listed numbers by the stated convention.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { greNormalDistribution as skill } from '../../src/skills/gre/gre-normal-distribution';

// Abramowitz-Stegun erf approximation (|error| < 1.5e-7): enough to confirm the rule's
// rounded slices (2.5, 13.5, 34, ...) to within the rule's own rounding.
const erf = (x: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const cdf = (z: number) => 100 * 0.5 * (1 + erf(z / Math.SQRT2));
const numOf = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [a, b] = p.answer.value.split('/').map(Number);
  return b ? a / b : a;
};
const nums = (s: string) => [...s.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => +m[0]);

describe('gre-normal-distribution', () => {
  it('level 1: interval percent is the rule value (within the rule rounding)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { mean, sd } = p.params;
      const m = p.prompt.match(/between (\d+) and (\d+)\?/)!;
      const za = (+m[1] - mean) / sd;
      const zb = (+m[2] - mean) / sd;
      expect(Number.isInteger(za) && Number.isInteger(zb), p.id).toBe(true);
      expect(Math.abs(numOf(p) - (cdf(zb) - cdf(za))), p.id).toBeLessThan(0.5);
      expect(numOf(p) * 2 === Math.round(numOf(p) * 2), p.id).toBe(true);
    }
  });

  it('level 2: values, z-scores and the within-1-SD select-all', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, mean, sd, k2 } = p.params;
      if (form === 0) {
        const k = +p.prompt.match(/What score is (\S+) standard/)![1].split('/').reduce((a, b) => +a / +b as never) ;
        const dir = p.prompt.includes('above the mean?') ? 1 : -1;
        expect(numOf(p), p.id).toBeCloseTo(mean + dir * k * sd, 9);
      } else if (form === 1) {
        const x = +p.prompt.match(/A score of (\d+) is/)![1];
        expect(numOf(p), p.id).toBeCloseTo((x - mean) / sd, 9);
        expect(k2 / 2, p.id).toBeCloseTo((x - mean) / sd, 9);
      } else {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const expected = p.answer.options.filter((o) => Math.abs(+o.label - mean) < sd).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(expected);
        expect(p.answer.options.every((o) => Math.abs(Math.abs(+o.label - mean) - sd) > 0), p.id).toBe(true);
      }
    }
  });

  it('level 3: tail percent from z (numeric and multiple choice)', () => {
    let mc = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const m = p.prompt.match(/are (above|below) (\d+)\?/)!;
      const { mean, sd } = p.params;
      const z = (+m[2] - mean) / sd;
      const truth = m[1] === 'above' ? 100 - cdf(z) : cdf(z);
      if (p.answer.kind === 'number') expect(Math.abs(numOf(p) - truth), p.id).toBeLessThan(0.35);
      else if (p.answer.kind === 'choice') {
        mc++;
        const vals = p.answer.options.map((o) => parseFloat(o.label));
        expect(new Set(vals).size, p.id).toBe(5);
        const correct = parseFloat(p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!.label);
        expect(Math.abs(correct - truth), p.id).toBeLessThan(0.35);
        expect(vals.filter((v) => Math.abs(v - truth) < 0.35).length, p.id).toBe(1);
      }
    }
    expect(mc).toBeGreaterThan(40);
  });

  it('level 4: QC relation from z-scores (and the SD interval for the unknown-SD form)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { form, above, m1, s1, x1, m2, s2, x2, smin, smax } = p.params;
      const z1 = (x1 - m1) / s1;
      // percent above/below is monotone in z: compare via the CDF itself
      const pct = (z: number) => (above ? 100 - cdf(z) : cdf(z));
      let expected: string;
      if (form !== 2) {
        const z2 = (x2 - m2) / s2;
        const d = pct(z1) - pct(z2);
        expected = Math.abs(d) < 1e-6 ? 'c' : d > 0 ? 'a' : 'b';
      } else {
        const signs = new Set<number>();
        for (let i = 0; i <= 200; i++) {
          const s = smin + ((smax - smin) * i) / 200;
          const d = pct(z1) - pct((x2 - m2) / s);
          signs.add(Math.abs(d) < 1e-9 ? 0 : Math.sign(d));
        }
        expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : 'b';
      }
      expect(p.answer.correct, p.id).toBe(expected);
      seen.add(expected);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('level 5: quartiles and percent below, by the stated convention', () => {
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      const h = Math.floor(s.length / 2);
      return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    };
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, n, x } = p.params;
      const listText = p.prompt.match(/students are ([\d, ]+)\./)![1];
      const xs = nums(listText);
      expect(xs.length, p.id).toBe(n);
      const s = [...xs].sort((a, b) => a - b);
      const lower = s.slice(0, Math.floor(n / 2));
      const upper = s.slice(n - Math.floor(n / 2));
      const expected = [median(lower), median(upper), median(upper) - median(lower), (100 * s.filter((v) => v < x).length) / n][form];
      expect(numOf(p), p.id).toBeCloseTo(expected, 9);
      if (form === 3) expect(xs.includes(x), p.id).toBe(true);
    }
  });
});
