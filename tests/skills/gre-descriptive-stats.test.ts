// Independent re-derivations: statistics recomputed from the generated lists with plain JS floats
// (not the generator's exact Q arithmetic), SD relations from the population formula,
// and every select-all option recomputed from the list.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greDescriptiveStats as skill } from '../../src/skills/gre/gre-descriptive-stats';

const list = (p: { params: Record<string, number> }, prefix: string, n: number) => Array.from({ length: n }, (_, i) => p.params[`${prefix}${i}`]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
};
const num = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [a, b] = p.answer.value.split('/').map(Number);
  return b ? a / b : a;
};

describe('gre-descriptive-stats', () => {
  it('level 1: mean/median/mode/range match a recomputation from the list', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const xs = list(p, 'v', p.params.n);
      const counts = new Map<number, number>();
      xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
      const top = Math.max(...counts.values());
      const modes = [...counts].filter(([, c]) => c === top).map(([v]) => v);
      expect(modes.length, p.id).toBe(1);
      const expected = [mean(xs), median(xs), modes[0], Math.max(...xs) - Math.min(...xs)][p.params.stat];
      expect(num(p), p.id).toBeCloseTo(expected, 9);
      // the prompt really contains the list
      expect(p.prompt.includes(xs.join(', ')), p.id).toBe(true);
    }
  });

  it('level 2: the missing value makes the stated mean', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const known = list(p, 'k', p.params.n - 1);
      expect(mean([...known, num(p)]), p.id).toBeCloseTo(p.params.m, 9);
    }
  });

  it('level 3: weighted mean', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { n1, a1, n2, a2 } = p.params;
      const all = [...Array(n1).fill(a1), ...Array(n2).fill(a2)];
      expect(num(p), p.id).toBeCloseTo(mean(all), 9);
    }
  });

  it('level 4: SD relation from the population formula on the listed numbers', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const A = list(p, 'a', p.params.na);
      const B = list(p, 'b', p.params.nb);
      const sa = Math.sqrt(variance(A));
      const sb = Math.sqrt(variance(B));
      const expected = Math.abs(sa - sb) < 1e-9 ? 'c' : sa > sb ? 'a' : 'b';
      expect(p.answer.correct, p.id).toBe(expected);
      seen.add(expected);
      expect(p.prompt.includes(A.join(', ')) && p.prompt.includes(B.join(', ')), p.id).toBe(true);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });

  it('level 5: each select-all option is correct exactly when that statistic increases', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'multi') throw new Error('expected multi');
      const xs = list(p, 'v', p.params.n);
      const ys = [...xs, p.params.add];
      const up: Record<string, boolean> = {
        'The mean': mean(ys) > mean(xs) + 1e-12,
        'The median': median(ys) > median(xs),
        'The range': Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs),
        'The sum of the numbers': ys.reduce((a, b) => a + b, 0) > xs.reduce((a, b) => a + b, 0),
        'The smallest number': Math.min(...ys) > Math.min(...xs),
      };
      expect(p.answer.options.map((o) => o.label).sort(), p.id).toEqual(Object.keys(up).sort());
      const expected = p.answer.options.filter((o) => up[o.label]).map((o) => o.id).sort();
      expect([...p.answer.correct].sort(), p.id).toEqual(expected);
    }
  });
});
