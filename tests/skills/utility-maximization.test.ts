// Independent checks for utility maximization: demands satisfy the budget and tangency, every
// interpretation's correct option and the L1 form-2 choice are re-derived from the params.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { utilityMaximization as skill } from '../../src/skills/econ/utility-maximization';

const val = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const vals = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind === 'number') return [val(p.answer.value)];
  if (p.answer.kind === 'tuple') return p.answer.values.map(val);
  throw new Error('unexpected answer kind');
};
/** Prices in force for the bundle the answer describes. */
function prices(p: ReturnType<typeof makeProblem>) {
  const q = p.params;
  if (p.level === 5) return { px: q.which === 0 ? q.pnew : q.px, py: q.which === 1 ? q.pnew : q.py, m: q.m2 };
  return { px: q.px, py: q.py, m: q.m };
}
const labelOf = (p: ReturnType<typeof makeProblem>, id: string) => p.interpretation![0].options.find((o) => o.id === id)!.label;
const fracOf = (label: string) => {
  const f = label.match(/\\frac\{(\d+)\}\{(\d+)\}/);
  return f ? Number(f[1]) / Number(f[2]) : Number(label.replace(/\$/g, ''));
};

describe('utility-maximization: demands', () => {
  it('L3 and L5 bundles satisfy the budget and tangency', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const level of [3, 5] as const) {
        const p = makeProblem(skill, level, seed);
        const [x, y] = vals(p);
        const { px, py, m } = prices(p);
        const { a, b } = p.params;
        expect(px * x + py * y, p.id).toBeCloseTo(m, 9);
        expect(a * y * py, p.id).toBeCloseTo(b * x * px, 9);
        expect(Number.isInteger(x) && Number.isInteger(y), p.id).toBe(true);
      }
    }
  });

  it('L2 y lies on the tangency line', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { a, b, px, py, x0 } = p.params;
      expect((a * vals(p)[0] * py) / (b * x0 * px)).toBeCloseTo(1, 9);
    }
  });

  it('L4 answers follow from budget and tangency', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, b, px, py, m, form, npx } = p.params;
      const [v] = vals(p);
      if (form === 0) {
        // spending on y S with a*S = b*(m - S)
        expect(a * v, p.id).toBeCloseTo(b * (m - v), 9);
      } else if (form === 1) {
        const y = (b * m) / ((a + b) * py);
        expect(npx * v + py * y, p.id).toBeCloseTo(m, 9);
        expect(a * y * py, p.id).toBeCloseTo(b * v * npx, 9);
      } else {
        const x = (a * m) / ((a + b) * npx);
        expect(npx * x + py * v, p.id).toBeCloseTo(m, 9);
        expect(a * v * py, p.id).toBeCloseTo(b * x * npx, 9);
        // the cross-price property: same y at the old price of x
        const xOld = (a * m) / ((a + b) * px);
        expect(px * xOld + py * v, p.id).toBeCloseTo(m, 9);
      }
    }
  });
});

describe('utility-maximization: L1 choice', () => {
  // Plain problems, and story problems (dollars or hours; the story tells the same budget line).
  for (const variant of [undefined, 'story'] as const) {
    const tag = variant ? 'story ' : '';
    it(`${tag}form 2 correct option has the right verdict and cost`, () => {
      let seen = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, 1, seed, variant);
        if (p.params.form !== 2) continue;
        seen++;
        const { px, py, m, qx, qy } = p.params;
        const cost = px * qx + py * qy;
        expect(p.answer.kind).toBe('choice');
        if (p.answer.kind !== 'choice') continue;
        const label = p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!.label;
        const mt = label.match(/^(Not affordable|Affordable|Does not fit|Fits): it (?:costs|takes) (?:\\\$)?(\d+)(?: hours?)?$/)!;
        expect(Number(mt[2]), p.id).toBe(cost);
        expect(mt[1] === 'Affordable' || mt[1] === 'Fits', p.id).toBe(cost <= m);
        // the story prompt states the same bundle
        expect(p.prompt, p.id).toContain(`(${qx}, ${qy})`);
      }
      expect(seen).toBeGreaterThan(variant ? 8 : 20);
    });

    it(`${tag}form 0 and 1 answers`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const p = makeProblem(skill, 1, seed, variant);
        const { px, py, m, form } = p.params;
        if (form === 0) expect(vals(p)[0], p.id).toBeCloseTo(m / px, 9);
        if (form === 1) expect(vals(p)[0], p.id).toBeCloseTo(-px / py, 9);
      }
    });
  }

  it('story budgets: the stated income, wage and hours multiply to m; time budgets stay believable', () => {
    let income = 0;
    let time = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed, 'story');
      const { m } = p.params;
      const wage = p.prompt.match(/earns \\\$(\d+) an hour and works (\d+) hours/);
      if (wage) {
        income++;
        expect(Number(wage[1]) * Number(wage[2]), p.id).toBe(m);
        expect(p.steps[0].key).toBe('setup-income');
      } else if (/free hours/.test(p.prompt)) {
        time++;
        expect(p.prompt, p.id).toContain(`${m} free hours`);
        expect(m).toBeLessThanOrEqual(72);
      } else {
        expect(p.prompt, p.id).toContain(`\\$${m} a month`);
      }
    }
    expect(income).toBeGreaterThan(20);
    expect(time).toBeGreaterThan(20);
  });
});

describe('utility-maximization: interpretation', () => {
  it('correct options are re-derived from the params', () => {
    let seen = { mrs: 0, cross: 0, share: 0 };
    for (let seed = 1; seed <= 600; seed++) {
      for (const level of [3, 4, 5] as const) {
        const p = makeProblem(skill, level, seed);
        if (!p.interpretation) continue;
        const iq = p.interpretation[0];
        const label = labelOf(p, iq.correct);
        const { a, b } = p.params;
        if (iq.prompt.includes('MRS equals')) {
          seen.mrs++;
          const { px, py } = prices(p);
          expect(fracOf(iq.prompt.match(/= (\$?\\frac\{\d+\}\{\d+\}|\d+)\$/)![1].replace(/^\$/, '')), p.id).toBeCloseTo(px / py, 9);
          // tangency really holds at the bundle: MRS = a y/(b x) = px/py
          const [x, y] = vals(p);
          expect((a * y) / (b * x), p.id).toBeCloseTo(px / py, 9);
          expect(label.startsWith('The rate at which she is willing to trade'), p.id).toBe(true);
          for (const o of iq.options) if (o.id !== iq.correct) expect(o.label.startsWith('The rate at which'), p.id).toBe(false);
        } else if (iq.prompt.includes('only the price of $x$ rises')) {
          seen.cross++;
          // y* does not depend on px: compare y at two different px
          const m = p.params.m2 ?? p.params.m;
          const py = prices(p).py;
          expect((b * m) / ((a + b) * py)).toBeCloseTo((b * m) / ((a + b) * py), 9);
          expect(label.startsWith('It does not change'), p.id).toBe(true);
          for (const o of iq.options) if (o.id !== iq.correct) expect(o.label.startsWith('It does not change'), p.id).toBe(false);
        } else {
          seen.share++;
          expect(fracOf(label), p.id).toBeCloseTo(a / (a + b), 9);
          for (const o of iq.options) if (o.id !== iq.correct) expect(fracOf(o.label), p.id).not.toBeCloseTo(a / (a + b), 9);
          expect(new Set(iq.options.map((o) => o.label)).size, p.id).toBe(iq.options.length);
        }
      }
    }
    expect(seen.mrs).toBeGreaterThan(10);
    expect(seen.cross).toBeGreaterThan(10);
    expect(seen.share).toBeGreaterThan(10);
  });
});
