// Independent checks without calculus: MC by a tiny finite difference of total cost, the
// profit maximum, efficient scale and shutdown point by brute-force grid search.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { costProfitMaximization as skill } from '../../src/skills/econ/cost-profit-maximization';

const vals = (p: ReturnType<typeof makeProblem>) =>
  p.answer.kind === 'tuple' ? p.answer.values.map(Number) : p.answer.kind === 'number' ? [Number(eval(p.answer.value))] : [];
const argBest = (f: (x: number) => number, hi: number, max: boolean) => {
  let best = 0.01;
  for (let x = 0.01; x <= hi; x += 0.005) if (max ? f(x) > f(best) : f(x) < f(best)) best = x;
  return best;
};

describe('cost-profit-maximization', () => {
  it('level 1: MC equals the cost of a tiny extra amount', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { F, v, w, q0 } = p.params;
      const tc = (x: number) => F + v * x + w * x * x;
      const h = 1e-6;
      expect(vals(p)[0], p.id).toBeCloseTo((tc(q0 + h) - tc(q0)) / h, 3);
    }
  });

  it('level 1 stories: MC from the cost function the story describes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 1, seed, 'story');
      const { F, v, w, q0 } = p.params;
      const tc = (x: number) => F + v * x + w * x * x;
      const h = 1e-6;
      expect(vals(p)[0], p.id).toBeCloseTo((tc(q0 + h) - tc(q0)) / h, 3);
      // the prompt names the same numbers
      expect(p.prompt, p.id).toContain(`\\$${F} a month in rent`);
      expect(p.prompt, p.id).toContain(`${q0} `);
      if (p.steps[0].key === 'setup-average') expect(p.prompt, p.id).toContain(`$${v} + ${w === 1 ? '' : w}q$`);
      else expect(p.prompt, p.id).toContain(`\\$${v} per`);
    }
  });

  it('level 3 stories: grid-search profit maximum, sunk cost left out', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 3, seed, 'story');
      const { p: price, v, w, F } = p.params;
      const pi = (x: number) => price * x - (F + v * x + w * x * x);
      const [qStar, profit] = vals(p);
      expect(Math.abs(argBest(pi, 80, true) - qStar), p.id).toBeLessThan(0.01);
      expect(pi(qStar), p.id).toBeCloseTo(profit, 6);
      expect(p.prompt, p.id).toContain(`\\$${price} each`);
      if (p.steps[0].key === 'setup-sunk') {
        const S = Number(p.prompt.match(/spent \\\$(\d+) on a market study/)![1]);
        const wrong = p.misconceptions.find((m) => m.id === 'sunk-cost-counted')!;
        expect(wrong.wrong.kind === 'tuple' && Number(wrong.wrong.values[1]), p.id).toBe(profit - S);
      }
    }
  });

  it('level 2: AC and AVC from the definitions', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { F, v, w, q0 } = p.params;
      expect(vals(p), p.id).toEqual([(F + v * q0 + w * q0 * q0) / q0, (v * q0 + w * q0 * q0) / q0]);
    }
  });

  it('level 3: the grid-search profit maximum', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { p: price, v, w, F } = p.params;
      const pi = (x: number) => price * x - (F + v * x + w * x * x);
      const [qStar, profit] = vals(p);
      expect(Math.abs(argBest(pi, 80, true) - qStar), p.id).toBeLessThan(0.01);
      expect(pi(qStar)).toBeCloseTo(profit, 6);
      expect(profit).toBeGreaterThan(0);
    }
  });

  it('level 4: grid-search minimum of AC', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { F, v, w } = p.params;
      const ac = (x: number) => F / x + v + w * x;
      const [qs, min] = vals(p);
      expect(Math.abs(argBest(ac, 40, false) - qs), p.id).toBeLessThan(0.01);
      expect(ac(qs)).toBeCloseTo(min, 6);
    }
  });

  it('level 5: the shutdown price is the minimum of AVC (not of MC)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, b, c } = p.params;
      const avc = (x: number) => a - b * x + c * x * x;
      const [qs, shut] = vals(p);
      expect(Math.abs(argBest(avc, 40, false) - qs), p.id).toBeLessThan(0.01);
      expect(avc(qs)).toBeCloseTo(shut, 6);
      const iq = p.interpretation![0];
      expect(iq.options.find((o) => o.id === iq.correct)!.label).toMatch(/^Shut down/);
    }
  });
});
