// Independent checks for geometric-series: the two multiple-choice finals (L2 type, L4 convergence)
// and every L5 interpretation's correct option are re-derived from the params, plus the numeric
// answers from first principles (adding the terms up).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { geometricSeries as skill } from '../../src/skills/math/geometric-series';

type P = ReturnType<typeof makeProblem>;
const val = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const ans = (p: P) => {
  if (p.answer.kind !== 'number') throw new Error('expected a number answer');
  return val(p.answer.value);
};
const correctLabel = (p: P) => {
  if (p.answer.kind !== 'choice') throw new Error('expected a choice answer');
  const id = p.answer.correct;
  return p.answer.options.find((o) => o.id === id)!.label;
};
const fracs = (s: string) => [...s.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map((m) => Number(m[1]) / Number(m[2]));

describe('geometric-series: numeric answers from first principles', () => {
  it('L1 n-th term by repeated step', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, a, d, rn, rd, n } = p.params;
      let t = a;
      for (let i = 1; i < n; i++) t = form === 0 ? t + d : (t * rn) / rd;
      expect(ans(p), p.id).toBeCloseTo(t, 9);
    }
  });

  it('L3 finite sums by adding the terms', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, a, d, rn, rd, n } = p.params;
      let t = a;
      let s = 0;
      for (let i = 0; i < n; i++) {
        s += t;
        t = form === 0 ? (t * rn) / rd : t + d;
      }
      expect(ans(p), p.id).toBeCloseTo(s, 9);
    }
  });

  it('L4 infinite sums by adding many terms; repeating decimals by long division', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, a, rn, rd, val: v, len } = p.params;
      if (form === 0) {
        let t = a;
        let s = 0;
        for (let i = 0; i < 400; i++) {
          s += t;
          t = (t * rn) / rd;
        }
        expect(ans(p), p.id).toBeCloseTo(s, 6);
      } else if (form === 2) {
        // 0.(v v v ...) with len digits per block
        let s = 0;
        for (let i = 1; i <= 30; i++) s += v / 10 ** (len * i);
        expect(ans(p), p.id).toBeCloseTo(s, 9);
      }
    }
  });

  it('L5 totals by adding the rounds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, G, bn, bd, n, ever } = p.params;
      const r = bn / bd;
      const terms = form === 0 || (form === 2 && ever) ? 400 : n;
      let t = G;
      let s = 0;
      for (let i = 0; i < terms; i++) {
        s += t;
        t *= r;
      }
      expect(ans(p), p.id).toBeCloseTo(s, 6);
    }
  });
});

describe('geometric-series: L2 type choice', () => {
  it('the correct option matches the differences and ratios of the four terms', () => {
    const seen = [0, 0, 0];
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (p.params.form !== 1) continue;
      const { kind, base, a, d, rn, rd, e } = p.params;
      const t: number[] = [];
      for (let i = 0; i < 4; i++) t.push(base === 0 ? a + i * d : (a * rn ** i) / rd ** i);
      t[3] += e;
      const eps = 1e-9;
      const isArith = Math.abs(t[1] - t[0] - (t[2] - t[1])) < eps && Math.abs(t[2] - t[1] - (t[3] - t[2])) < eps;
      const isGeom = Math.abs(t[1] / t[0] - t[2] / t[1]) < eps && Math.abs(t[2] / t[1] - t[3] / t[2]) < eps;
      const want = isArith ? 'Arithmetic' : isGeom ? 'Geometric' : 'Neither';
      expect(correctLabel(p), p.id).toBe(want);
      expect(['Arithmetic', 'Geometric', 'Neither'][kind], p.id).toBe(want);
      seen[kind]++;
    }
    for (const c of seen) expect(c).toBeGreaterThan(10);
  });

  it('form 2 middle term is the geometric mean and form 0 ratio satisfies the powers', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      if (p.params.form === 0) {
        const { gap, rn, rd, c } = p.params;
        expect(ans(p) ** gap, p.id).toBeCloseTo((c * rn ** gap) / (c * rd ** gap), 9);
      }
      if (p.params.form === 2) {
        const { p: pp, s, c } = p.params;
        expect(ans(p) ** 2, p.id).toBeCloseTo(c * s * s * c * pp * pp, 9);
      }
    }
  });
});

describe('geometric-series: L4 convergence choice', () => {
  it('converges iff |r| < 1, to a/(1-r)', () => {
    let conv = 0;
    let div = 0;
    let negConv = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.params.form !== 1) continue;
      const { a, rn, rd } = p.params;
      const r = rn / rd;
      const label = correctLabel(p);
      if (Math.abs(r) < 1) {
        conv++;
        const v = fracs(label)[0] ?? Number(label.replace(/[^\d-]/g, ''));
        const want = a / (1 - r);
        expect(Math.abs(v) , p.id).toBeCloseTo(Math.abs(want), 9);
        expect(label.startsWith('Converges to'), p.id).toBe(true);
        if (r < 0) {
          negConv++;
          expect(p.misconceptions.map((m) => m.id), p.id).toContain('diverges-negative');
        }
      } else {
        div++;
        expect(label, p.id).toBe('Diverges');
        expect(p.misconceptions.map((m) => m.id), p.id).not.toContain('diverges-negative');
      }
    }
    expect(conv).toBeGreaterThan(10);
    expect(div).toBeGreaterThan(10);
    expect(negConv).toBeGreaterThan(3);
  });
});

describe('geometric-series: L5 interpretation', () => {
  it('correct options are re-derived from the params and prompts', () => {
    const seen = { why: 0, dir: 0, ever: 0 };
    for (let seed = 1; seed <= 800; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      const { form, p: pct } = p.params;
      for (const iq of p.interpretation) {
        const label = iq.options.find((o) => o.id === iq.correct)!.label;
        const others = iq.options.filter((o) => o.id !== iq.correct).map((o) => o.label);
        if (iq.prompt.includes('Suppose the MPC changes')) {
          seen.dir++;
          const [b, b2] = fracs(iq.prompt);
          const rises = 1 / (1 - b2) > 1 / (1 - b);
          expect(label.startsWith(rises ? 'The multiplier rises' : 'The multiplier falls'), p.id).toBe(true);
          expect(others.some((o) => o.startsWith(rises ? 'The multiplier rises' : 'The multiplier falls')), p.id).toBe(false);
          expect(p.params.bn / p.params.bd, p.id).toBeCloseTo(b, 9);
        } else if (iq.prompt.includes('finite number') || iq.prompt.includes('without bound')) {
          seen.why++;
          expect(form, p.id).toBeLessThan(2);
          expect(label.startsWith('Each round is only the fraction'), p.id).toBe(true);
          expect(others.some((o) => o.startsWith('Each round')), p.id).toBe(false);
        } else {
          seen.ever++;
          expect(form, p.id).toBe(2);
          expect(p.params.ever, p.id).toBe(1);
          // total / month-1 sales = 1 / (p/100)
          expect(Number(label.replace(/\$/g, '')), p.id).toBeCloseTo(100 / pct, 9);
          expect(ans(p) / p.params.G, p.id).toBeCloseTo(100 / pct, 9);
          expect(others).not.toContain(label);
        }
      }
    }
    expect(seen.why).toBeGreaterThan(10);
    expect(seen.dir).toBeGreaterThan(10);
    expect(seen.ever).toBeGreaterThan(5);
  });
});
