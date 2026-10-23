// Independent checks for intertemporal-solow: every answer is re-derived from the params with
// floats (budget, tangency, steady state, golden rule), and every interpretation's correct
// option is re-derived and the others shown wrong.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { intertemporalSolow as skill } from '../../src/skills/econ/intertemporal-solow';

type P = ReturnType<typeof makeProblem>;

const val = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
};
const vals = (p: P) => {
  if (p.answer.kind === 'number') return [val(p.answer.value)];
  if (p.answer.kind === 'tuple') return p.answer.values.map(val);
  throw new Error('unexpected answer kind');
};
const iq = (p: P, startsWith: string) => p.interpretation?.find((x) => String(x.prompt).startsWith(startsWith));
const correctLabel = (x: NonNullable<P['interpretation']>[number]) => x.options.find((o) => o.id === x.correct)!.label;
const wrongLabels = (x: NonNullable<P['interpretation']>[number]) => x.options.filter((o) => o.id !== x.correct).map((o) => o.label);

const pvOf = (m1: number, m2: number, r: number) => m1 + m2 / (1 + r);

describe('intertemporal-solow: two-period budget (L1)', () => {
  it('PV, FV and slope follow from the definitions', () => {
    const seen = [0, 0, 0];
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { m1, m2, rPct, form } = p.params;
      const r = rPct / 100;
      const [v] = vals(p);
      seen[form]++;
      if (form === 0) expect(v, p.id).toBeCloseTo(m1 + m2 / (1 + r), 9);
      if (form === 1) expect(v, p.id).toBeCloseTo(m1 * (1 + r) + m2, 9);
      if (form === 2) expect(v, p.id).toBeCloseTo(-(1 + r), 9);
      // PV and FV are the same wealth at two dates
      expect(m1 * (1 + r) + m2, p.id).toBeCloseTo(pvOf(m1, m2, r) * (1 + r), 9);
    }
    expect(Math.min(...seen)).toBeGreaterThan(30);
  });

  it('PV interpretation: the correct option is the borrowing-capacity meaning and the prompt shows the right PV', () => {
    let seen = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 1, seed);
      if (!p.interpretation) continue;
      seen++;
      const x = p.interpretation[0];
      const { m1, m2, rPct } = p.params;
      const pv = pvOf(m1, m2, rPct / 100);
      expect(String(x.prompt), p.id).toContain(`\\$${pv}`);
      expect(correctLabel(x).startsWith('The most she could spend today'), p.id).toBe(true);
      for (const l of wrongLabels(x)) expect(l.startsWith('The most she could spend today'), p.id).toBe(false);
    }
    expect(seen).toBeGreaterThan(30);
  });
});

describe('intertemporal-solow: optimal consumption (L2, L3)', () => {
  it('L2 satisfies tangency and the budget', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { m1, m2, rPct } = p.params;
      const r = rPct / 100;
      const [c1, c2] = vals(p);
      expect(c2, p.id).toBeCloseTo((1 + r) * c1, 9);
      expect(c1 + c2 / (1 + r), p.id).toBeCloseTo(pvOf(m1, m2, r), 9);
      expect(Number.isInteger(c1) && Number.isInteger(c2), p.id).toBe(true);
    }
  });

  it('L3 answers satisfy Cobb-Douglas tangency and the budget', () => {
    const seen = [0, 0, 0];
    let borrowers = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { m1, m2, rPct, aN, aD, form } = p.params;
      const r = rPct / 100;
      const a = aN / aD;
      seen[form]++;
      const [v] = vals(p);
      // independent solution: maximize via the FOC c2*a = (1-a)(1+r)*c1 and the budget
      const pv = pvOf(m1, m2, r);
      const c1 = a * pv;
      const c2 = ((1 - a) * (1 + r) * c1) / a;
      expect(c1 + c2 / (1 + r), p.id).toBeCloseTo(pv, 9);
      const saving = m1 - c1;
      if (saving < 0) borrowers++;
      if (form === 0) expect(v, p.id).toBeCloseTo(c1, 9);
      if (form === 1) expect(v, p.id).toBeCloseTo(saving, 9);
      if (form === 2) {
        expect(v, p.id).toBeCloseTo(c2, 9);
        expect(v, p.id).toBeCloseTo(saving * (1 + r) + m2, 9);
      }
      expect(Number.isInteger(v), p.id).toBe(true);
    }
    expect(Math.min(...seen)).toBeGreaterThan(40);
    expect(borrowers).toBeGreaterThan(20);
  });

  it('borrower/saver and interest-rate questions are re-derived', () => {
    const kinds = { saver: 0, borrower: 0, fall: 0 };
    for (let seed = 1; seed <= 600; seed++) {
      for (const level of [2, 3] as const) {
        const p = makeProblem(skill, level, seed);
        if (!p.interpretation) continue;
        const { m1, m2, rPct } = p.params;
        const r = rPct / 100;
        const a = level === 2 ? 0.5 : p.params.aN / p.params.aD;
        const c1 = a * pvOf(m1, m2, r);
        const b = iq(p, 'Is this consumer')!;
        const label = correctLabel(b);
        if (c1 < m1) {
          expect(label.startsWith('A saver'), p.id).toBe(true);
          kinds.saver++;
        } else if (c1 > m1) {
          expect(label.startsWith('A borrower'), p.id).toBe(true);
          kinds.borrower++;
        } else expect(label.startsWith('Neither'), p.id).toBe(true);
        for (const l of wrongLabels(b)) expect(l.slice(0, 8) === label.slice(0, 8), p.id).toBe(false);

        // c1* falls when r rises (m2 > 0): compare at two rates
        const rise = iq(p, 'The interest rate rises')!;
        expect(m2).toBeGreaterThan(0);
        expect(a * pvOf(m1, m2, 1), p.id).toBeLessThan(c1);
        expect(correctLabel(rise), p.id).toBe('Fall');
        expect(wrongLabels(rise), p.id).not.toContain('Fall');
        kinds.fall++;
      }
    }
    expect(kinds.saver).toBeGreaterThan(10);
    expect(kinds.borrower).toBeGreaterThan(10);
  });
});

describe('intertemporal-solow: Solow steady state (L4)', () => {
  it('k* and y* satisfy s·A·k^α = (n+δ)·k', () => {
    const seen = [0, 0];
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { s, A, n, d, ad, form } = p.params;
      const alpha = 1 / ad;
      const [v] = vals(p);
      seen[form]++;
      const k = form === 0 ? v : Math.pow(v / A, 1 / alpha);
      const y = A * Math.pow(k, alpha);
      expect((s / 100) * y, p.id).toBeCloseTo(((n + d) / 100) * k, 9);
      if (form === 1) expect(v, p.id).toBeCloseTo(y, 9);
      expect(Number.isInteger(k), p.id).toBe(true);
    }
    expect(Math.min(...seen)).toBeGreaterThan(50);
  });

  it('the "what stays constant" question has the per-worker option correct', () => {
    let seen = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (!p.interpretation) continue;
      seen++;
      const x = p.interpretation[0];
      expect(correctLabel(x)).toBe('Capital per worker and output per worker');
      expect(String(x.explanation)).toContain(`n = ${p.params.n}\\%`);
      for (const l of wrongLabels(x)) expect(l).not.toContain('per worker');
    }
    expect(seen).toBeGreaterThan(30);
  });
});

describe('intertemporal-solow: consumption and the golden rule (L5)', () => {
  it('re-derives c*, k_gold and the golden-rule saving rate', () => {
    const seen = [0, 0, 0];
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { s, A, n, d, an, ad, form } = p.params;
      const alpha = an / ad;
      const [v] = vals(p);
      seen[form]++;
      if (form === 0) {
        const k = Math.pow(((s / 100) * A) / ((n + d) / 100), 1 / (1 - alpha));
        const y = A * Math.pow(k, alpha);
        expect(v, p.id).toBeCloseTo((1 - s / 100) * y, 9);
        // consumption = output - break-even investment
        expect(v, p.id).toBeCloseTo(y - ((n + d) / 100) * k, 9);
      } else if (form === 1) {
        expect(alpha).toBe(0.5);
        // marginal product equals n + δ at the golden-rule capital stock
        expect(alpha * A * Math.pow(v, alpha - 1), p.id).toBeCloseTo((n + d) / 100, 9);
      } else {
        // the s that maximizes c*(s) = (1-s) A k(s)^α, found by grid search
        let best = 0;
        let bestS = 0;
        for (let sp = 1; sp < 100; sp++) {
          const sv = sp / 100;
          const k = Math.pow((sv * A) / ((n + d) / 100), 1 / (1 - alpha));
          const c = (1 - sv) * A * Math.pow(k, alpha);
          if (c > best) {
            best = c;
            bestS = sp;
          }
        }
        expect(v, p.id).toBe(bestS);
        expect(v, p.id).not.toBe(s);
      }
    }
    expect(Math.min(...seen)).toBeGreaterThan(80);
  });

  it('the saving-rate and golden-rule consumption questions are re-derived', () => {
    let falseQ = 0;
    let cmp = { rise: 0, fall: 0, same: 0 };
    for (let seed = 1; seed <= 800; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      const { s, A, n, d, an, ad } = p.params;
      const alpha = an / ad;
      const t = iq(p, 'True or false')!;
      expect(correctLabel(t).startsWith('False: it raises the steady-state level'), p.id).toBe(true);
      for (const l of wrongLabels(t)) expect(l.startsWith('False: it raises'), p.id).toBe(false);
      falseQ++;
      const g = iq(p, 'If the saving rate were changed');
      if (!g) continue;
      const cAt = (sv: number) => {
        const k = Math.pow((sv * A) / ((n + d) / 100), 1 / (1 - alpha));
        return (1 - sv) * A * Math.pow(k, alpha);
      };
      const now = cAt(s / 100);
      const gold = cAt(alpha);
      const label = correctLabel(g);
      if (gold > now + 1e-9) {
        expect(label, p.id).toBe('Rise');
        cmp.rise++;
        expect(s / 100).not.toBeCloseTo(alpha, 9);
      } else {
        expect(gold, p.id).toBeLessThanOrEqual(now + 1e-9); // the golden rule is the maximum
        expect(s / 100, p.id).toBeCloseTo(alpha, 9);
        expect(label, p.id).toBe('Stay the same');
        cmp.same++;
      }
      expect(wrongLabels(g), p.id).not.toContain(label);
    }
    expect(falseQ).toBeGreaterThan(50);
    expect(cmp.rise).toBeGreaterThan(5);
  });
});
