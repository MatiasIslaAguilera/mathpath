// Re-derives total-differential from the params: df, the slope, and the L5 interpretation.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { totalDifferential as skill } from '../../src/skills/math/total-differential';

const latexToNumber = (s: string) => Number(evaluate(s.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')));

/** Numeric partials of the problem's polynomial statement at (x0, y0). */
function partials(expr: string, x0: number, y0: number) {
  const f = (x: number, y: number) => Number(evaluate(expr, { x, y }));
  const h = 1e-4;
  return { fx: (f(x0 + h, y0) - f(x0 - h, y0)) / (2 * h), fy: (f(x0, y0 + h) - f(x0, y0 - h)) / (2 * h) };
}

function polyExprFromParams(p: Record<string, number>) {
  return `${p.k1}*x^${p.m1}*y^${p.n1} + ${p.k2}*x^${p.p2} + ${p.k3}*y^${p.q3} + ${p.k4}`;
}

describe('total differential', () => {
  it('df at L1 equals fx dx + fy dy from the params', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { fx, fy, dxn, dyn } = p.params;
      expect(p.answer.kind === 'number' ? Number(evaluate(p.answer.value)) : NaN).toBeCloseTo(fx * (dxn / 4) + fy * (dyn / 4), 9);
    }
  });

  it('df (L2, L4) and slope (L3) match the independently recomputed partials', () => {
    for (const level of [2, 3, 4]) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const { x0, y0 } = p.params;
        const { fx, fy } = partials(polyExprFromParams(p.params), x0, y0);
        const got = Number(evaluate(p.answer.kind === 'number' ? p.answer.value : 'NaN'));
        if (level === 3) expect(got).toBeCloseTo(-fx / fy, 3);
        else {
          const dx = p.params.dxn / 4;
          const dy = (level === 4 ? -p.params.dyn : p.params.dyn) / 4;
          expect(got).toBeCloseTo(fx * dx + fy * dy, 3);
        }
      }
    }
  });

  it('L5 slope is -a y / (b x) and the interpretation matches it', () => {
    let checked = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, b, x0, y0 } = p.params;
      const slope = -(a * y0) / (b * x0);
      expect(Number(evaluate(p.answer.kind === 'number' ? p.answer.value : 'NaN'))).toBeCloseTo(slope, 9);
      if (!p.interpretation) continue;
      const q = p.interpretation[0];
      const m = q.prompt.match(/has slope \$(.+?)\$/)!;
      expect(latexToNumber(m[1])).toBeCloseTo(slope, 9);
      expect(q.prompt).toContain(`x^{${a}}y^{${b}}`);
      expect(q.prompt).toContain(`(${x0}, ${y0})`);
      const label = q.options.find((o) => o.id === q.correct)!.label;
      const absM = label.match(/\$(.+?)\$/)!;
      expect(latexToNumber(absM[1])).toBeCloseTo(Math.abs(slope), 9);
      expect(label).toMatch(/give up/);
      expect(label).toMatch(/equally well off/);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
