// The interpretation question's numbers and correct option, re-derived independently:
// f'(x0) by numeric differentiation of the problem statement (verify.expr).

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { LEVELS } from '../../src/engine/types';
import { derivativesPowerRule as skill } from '../../src/skills/math/derivatives-power-rule';

const latexToNumber = (s: string) => Number(evaluate(s.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')));

describe('power rule interpretation', () => {
  it("states f'(x0) correctly and picks the option matching its sign", () => {
    let checked = 0;
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        if (!p.interpretation) continue;
        const q = p.interpretation[0];
        const m = q.prompt.match(/f'\((\d+)\) = (.+?)\$/)!;
        const x0 = Number(m[1]);
        const claimed = latexToNumber(m[2]);
        if (p.verify.type !== 'diff') throw new Error('expected diff verify');
        const h = 1e-5;
        const f = (x: number) => Number(evaluate(p.verify.type === 'diff' ? p.verify.expr : '', { x }));
        const numeric = (f(x0 + h) - f(x0 - h)) / (2 * h);
        expect(claimed).toBeCloseTo(numeric, 4);

        const label = q.options.find((o) => o.id === q.correct)!.label;
        const sign = Math.abs(numeric) < 1e-6 ? 0 : Math.sign(numeric);
        if (q.prompt.includes('increasing or decreasing')) {
          expect(label).toBe(sign > 0 ? 'Increasing' : sign < 0 ? 'Decreasing' : 'Neither: it is flat there');
        } else {
          expect(label).toMatch(sign > 0 ? /\*raises\*/ : sign < 0 ? /\*lowers\*/ : /flat/);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});
