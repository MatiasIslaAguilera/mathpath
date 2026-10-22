// Independent re-derivation for systems-of-equations: the two equations are parsed back out of the
// PROMPT text, solved by Cramer's rule, and compared with the answer. Interpretation answers are
// recomputed too.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { systemsOfEquations as skill } from '../../src/skills/math/systems-of-equations';

interface Lin {
  x: number;
  y: number;
  k: number;
}

/** Parse one side such as "3x - y + 4" or "-2y" or "13.5" into coefficients. */
function side(s: string): Lin {
  const out: Lin = { x: 0, y: 0, k: 0 };
  const terms = s.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
  for (const t of terms) {
    const m = t.match(/^(-?)(\d*\.?\d*)([xy]?)$/);
    if (!m) throw new Error(`cannot parse term "${t}" in "${s}"`);
    const sign = m[1] ? -1 : 1;
    const num = m[2] === '' ? 1 : Number(m[2]);
    if (m[3]) out[m[3] as 'x' | 'y'] += sign * num;
    else out.k += sign * num;
  }
  return out;
}

/** "lhs = rhs" → a x + b y = c. */
function parseEq(eq: string): [number, number, number] {
  const [l, r] = eq.split('=').map(side);
  return [l.x - r.x, l.y - r.y, r.k - l.k];
}

function solve(e1: [number, number, number], e2: [number, number, number]): [number, number] {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  if (det === 0) throw new Error('singular system');
  return [(e1[2] * e2[1] - e1[1] * e2[2]) / det, (e1[0] * e2[2] - e1[2] * e2[0]) / det];
}

const value = (s: string) => {
  const [a, b = '1'] = s.split('/');
  return Number(a) / Number(b);
};

describe('systems-of-equations', () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    it(`level ${level}: the answer solves the system written in the prompt`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        if (p.answer.kind !== 'tuple') throw new Error('expected a tuple answer');
        let eqs: string[];
        if (level === 1) {
          const m = p.prompt.match(/\$\$(.+?) \\qquad (.+?)\$\$/);
          if (!m) throw new Error(`cannot parse ${p.prompt}`);
          eqs = [m[1], m[2]];
        } else {
          const m = p.prompt.match(/\\begin\{cases\} (.+?) \\\\ (.+?) \\end\{cases\}/);
          if (!m) throw new Error(`cannot parse ${p.prompt}`);
          eqs = [m[1], m[2]];
        }
        const [x, y] = solve(parseEq(eqs[0]), parseEq(eqs[1]));
        const got = p.answer.values.map(value);
        expect(got[0], `${p.id} x`).toBeCloseTo(x, 9);
        expect(got[1], `${p.id} y`).toBeCloseTo(y, 9);
        // the swapped misconception really is the swap
        const sw = p.misconceptions.find((m) => m.id === 'swapped-order');
        if (sw && sw.wrong.kind === 'tuple') expect(sw.wrong.values.map(value)).toEqual([got[1], got[0]]);
        if (x === y) expect(sw, p.id).toBeUndefined();
      }
    });
  }

  it('level 1 interpretation: the plan with the smaller monthly price is cheaper afterwards', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const iq = p.interpretation![0];
      const { m1, m2, b1, b2, x } = p.params;
      // brute force a month well past the crossing point
      const month = x + 7;
      const costA = b1 + m1 * month;
      const costB = b2 + m2 * month;
      const want = costA < costB ? 'Plan A' : 'Plan B';
      expect(costA).not.toBe(costB);
      expect(iq.options.find((o) => o.id === iq.correct)!.label, p.id).toBe(want);
    }
  });

  it('level 5 interpretation: doubling all quantities leaves the prices unchanged', () => {
    let seen = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (!p.interpretation) continue;
      seen++;
      const eqs = p.prompt.match(/\\begin\{cases\} (.+?) \\\\ (.+?) \\end\{cases\}/)!;
      const doubled = [eqs[1], eqs[2]].map((e) => {
        const [a, b, c] = parseEq(e);
        return [2 * a, 2 * b, 2 * c] as [number, number, number];
      });
      const [x, y] = solve(doubled[0], doubled[1]);
      const [x0, y0] = (p.answer as { values: string[] }).values.map(value);
      expect(x).toBeCloseTo(x0, 9);
      expect(y).toBeCloseTo(y0, 9);
      const iq = p.interpretation[0];
      expect(iq.options.find((o) => o.id === iq.correct)!.label).toBe('The same as before');
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('elimination misconceptions are wrong answers of the right shape', () => {
    for (const level of [3, 4, 5] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const p = makeProblem(skill, level, seed);
        for (const m of p.misconceptions) expect(m.wrong.kind, p.id).toBe('tuple');
      }
    }
  });
});
