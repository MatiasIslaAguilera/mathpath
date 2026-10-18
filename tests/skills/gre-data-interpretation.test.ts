// Independent re-derivations for data interpretation: the data are re-read from the generated
// FIGURE (chart alt text / table rows) and the question is re-parsed from the prompt, then the
// answer is recomputed with plain JS. Select-all statements are parsed back from their text.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { greDataInterpretation as skill } from '../../src/skills/gre/gre-data-interpretation';

const numOf = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [a, b] = p.answer.value.split('/').map(Number);
  return b ? a / b : a;
};
/** year -> value from a bar chart figure; also checks the svg text labels carry the same numbers. */
function chart(p: Problem): Map<number, number> {
  if (p.figure?.kind !== 'svg') throw new Error('expected svg figure');
  const m = new Map<number, number>();
  for (const [, y, v] of p.figure.alt.matchAll(/(\d{4}): (\d+)/g)) m.set(+y, +v);
  expect(m.size, p.id).toBe(5);
  for (const [y, v] of m) {
    expect(p.figure.svg.includes(`>${v}</text>`), `${p.id} svg shows ${v}`).toBe(true);
    expect(p.figure.svg.includes(`>${y}</text>`), `${p.id} svg shows ${y}`).toBe(true);
  }
  return m;
}
const years = (prompt: string) => [...prompt.matchAll(/\b(20\d\d)\b/g)].map((m) => +m[1]);

describe('gre-data-interpretation', () => {
  it('every problem has a figure with alt text / a well-formed table', () => {
    for (let level = 1; level <= 5; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = makeProblem(skill, level as 1, seed);
        expect(p.figure, p.id).toBeDefined();
        if (p.figure!.kind === 'svg') expect(p.figure!.alt.length).toBeGreaterThan(30);
      }
    }
  });

  it('level 1: values, differences and sums read from the chart', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const data = chart(p);
      const ys = years(p.prompt);
      const [a, b] = [data.get(ys[0])!, data.get(ys[1])!];
      const expected = [a, a - b, a + b][p.params.form];
      expect(numOf(p), p.id).toBe(expected);
    }
  });

  it('level 2: percent change from the chart, with the right direction word', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const data = chart(p);
      const [y1, y2] = years(p.prompt);
      const old = data.get(y1)!;
      const nw = data.get(y2)!;
      const pct = ((nw - old) / old) * 100;
      expect(numOf(p), p.id).toBeCloseTo(Math.abs(pct), 9);
      expect(Math.abs(Math.abs(pct) - Math.round(Math.abs(pct))) < 1e-9, p.id).toBe(true);
      expect(p.prompt.includes(pct > 0 ? 'percent increase' : 'percent decrease'), p.id).toBe(true);
    }
  });

  it('level 3: share of total from the table', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      if (p.figure?.kind !== 'table') throw new Error('expected table');
      const rows = p.figure.rows.map(([c, a]) => [c, +a] as const);
      const total = rows.reduce((s, [, a]) => s + a, 0);
      const named = rows.filter(([c]) => new RegExp(`\\b${c}\\b`).test(p.prompt.split('spent on ')[1]));
      expect(named.length, p.id).toBe(p.params.form === 0 ? 1 : 2);
      const part = named.reduce((s, [, a]) => s + a, 0);
      expect(numOf(p), p.id).toBeCloseTo((100 * part) / total, 9);
    }
  });

  it('level 4: the correct option is the unique one nearest the exact value, options are far apart', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const data = chart(p);
      const ys = years(p.prompt);
      const total = [...data.values()].reduce((a, b) => a + b, 0);
      let exact: number;
      if (p.prompt.includes('percent of the five-year total')) exact = (100 * data.get(ys[0])!) / total;
      else if (p.prompt.includes('percent change')) exact = (100 * (data.get(ys[1])! - data.get(ys[0])!)) / data.get(ys[0])!;
      else exact = total / 5;
      const vals = p.answer.options.map((o) => parseFloat(o.label));
      const sorted = [...vals].sort((a, b) => a - b);
      expect(vals, `${p.id} options ascending`).toEqual(sorted);
      expect(new Set(vals).size, p.id).toBe(5);
      const gap = p.prompt.includes('average') ? 50 : p.prompt.includes('percent change') ? 20 : 10;
      for (let k = 1; k < 5; k++) expect(sorted[k] - sorted[k - 1], `${p.id} spread`).toBeGreaterThanOrEqual(gap);
      const nearest = vals.reduce((best, v) => (Math.abs(v - exact) < Math.abs(best - exact) ? v : best));
      const correct = parseFloat(p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!.label);
      expect(correct, p.id).toBe(nearest);
      expect(Math.abs(correct - exact), `${p.id} estimate is decisive`).toBeLessThanOrEqual(gap === 50 ? 10 : gap === 20 ? 3 : 2);
    }
  });

  it('level 5: each statement re-derived from the table', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'multi' || p.figure?.kind !== 'table') throw new Error('expected multi + table');
      const [, h1] = p.figure.headers;
      const Y1 = +h1;
      const row = new Map(p.figure.rows.map(([n, a, b]) => [n, [+a, +b] as const]));
      const y = (n: string, year: number) => row.get(n)![year === Y1 ? 0 : 1];
      const tot = (year: number) => [...row.keys()].reduce((s, n) => s + y(n, year), 0);
      const truth = (t: string): boolean => {
        let m: RegExpMatchArray | null;
        if ((m = t.match(/^(\w+) had the highest \w+ in (\d+)\.$/))) return [...row.keys()].every((n) => n === m![1] || y(m![1], +m![2]) > y(n, +m![2]));
        if ((m = t.match(/^\w+ in (\w+) increased by more than (\d+)% from (\d+) to (\d+)\.$/))) return ((y(m[1], +m[4]) - y(m[1], +m[3])) / y(m[1], +m[3])) * 100 > +m[2];
        if ((m = t.match(/^Total \w+ across all regions was greater in (\d+) than in (\d+)\.$/))) return tot(+m[1]) > tot(+m[2]);
        if ((m = t.match(/^(\w+) accounted for more than (\d+)% of total \w+ in (\d+)\.$/))) return (y(m[1], +m[3]) / tot(+m[3])) * 100 > +m[2];
        if ((m = t.match(/^\w+ increased in every region from (\d+) to (\d+)\.$/))) return [...row.keys()].every((n) => y(n, +m![2]) > y(n, +m![1]));
        if ((m = t.match(/^Combined \w+ of (\w+) and (\w+) in (\d+) exceeded combined \w+ of (\w+) and (\w+) in \d+\.$/))) return y(m[1], +m[3]) + y(m[2], +m[3]) > y(m[4], +m[3]) + y(m[5], +m[3]);
        if ((m = t.match(/^(\w+) had greater \w+ than (\w+) in both (\d+) and (\d+)\.$/))) return y(m[1], +m[3]) > y(m[2], +m[3]) && y(m[1], +m[4]) > y(m[2], +m[4]);
        throw new Error(`cannot parse statement: ${t}`);
      };
      const expected = p.answer.options.filter((o) => truth(o.label)).map((o) => o.id).sort();
      expect([...p.answer.correct].sort(), p.id).toEqual(expected);
      expect(p.answer.options.length, p.id).toBe(5);
    }
  });
});
