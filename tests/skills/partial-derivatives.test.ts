// The level-4 interpretation, re-derived independently: the partial at the point by numeric
// differentiation of the problem statement (verify.expr), and the correct option from its sign.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { partialDerivatives as skill } from '../../src/skills/math/partial-derivatives';

const latexToNumber = (s: string) => Number(evaluate(s.replace(/\frac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')));

describe('partial derivatives interpretation', () => {
  it('states the partial at the point correctly and picks the option matching its sign', () => {
    let checked = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (!p.interpretation) continue;
      if (p.verify.type !== 'partial') throw new Error('expected partial verify');
      const q = p.interpretation[0];
      const m = q.prompt.match(/f_([LK])\((-?\d+), (-?\d+)\) = (.+?)\$/)!;
      const [x0, y0] = [Number(m[2]), Number(m[3])];
      const claimed = latexToNumber(m[4]);
      const f = (x: number, y: number) => Number(evaluate(p.verify.type === 'partial' ? p.verify.expr : '', { x, y }));
      const h = 1e-4;
      const numeric = m[1] === 'L' ? (f(x0 + h, y0) - f(x0 - h, y0)) / (2 * h) : (f(x0, y0 + h) - f(x0, y0 - h)) / (2 * h);
      expect(claimed).toBeCloseTo(numeric, 3);
      expect(p.verify.wrt[0]).toBe(m[1] === 'L' ? 'x' : 'y');

      const label = q.options.find((o) => o.id === q.correct)!.label;
      expect(label).toContain(numeric > 0 ? 'raises' : 'lowers');
      expect(label).toContain(m[1] === 'L' ? 'labor' : 'machine');
      expect(label).toMatch(/held fixed/);
      expect(label).not.toMatch(/\*and\*/);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
