// Independent re-derivations: counts by brute-force enumeration (subsets, orderings), probabilities
// by exhaustive enumeration of outcomes, Venn counts by building the actual sets, and every
// select-all / multiple-choice option parsed back from its label and evaluated.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { greCountingProbability as skill } from '../../src/skills/gre/gre-counting-probability';

/** Number of k-subsets of {0..n-1}, by recursion over elements (no factorials). */
const subsets = (n: number, k: number): number => (k === 0 ? 1 : n < k ? 0 : subsets(n - 1, k - 1) + subsets(n - 1, k));
/** Number of ordered k-arrangements of n distinct items, by enumeration. */
const arrangements = (n: number, k: number): number => {
  if (k === 0) return 1;
  let total = 0;
  for (let i = 0; i < n; i++) total += arrangements(n - 1, k - 1);
  return total;
};
const numOf = (p: Problem) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [a, b] = p.answer.value.split('/').map(Number);
  return b ? a / b : a;
};
const parseLabel = (label: string): number => {
  const l = label.replace(/\$/g, '');
  let m = l.match(/^\\binom\{(\d+)\}\{(\d+)\}$/);
  if (m) return subsets(+m[1], +m[2]);
  m = l.match(/^\{\}_\{(\d+)\}P_\{(\d+)\}$/);
  if (m) return arrangements(+m[1], +m[2]);
  m = l.match(/^\\frac\{\{\}_\{(\d+)\}P_\{(\d+)\}\}\{(\d+)(!?)\}$/);
  if (m) {
    const r = +m[3];
    const d = m[4] ? arrangements(r, r) : r;
    return arrangements(+m[1], +m[2]) / d;
  }
  throw new Error(`cannot parse option ${label}`);
};

describe('gre-counting-probability', () => {
  it('level 1: counting principle by enumeration', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { form, a, b, c } = p.params;
      let count = 0;
      if (form === 0) for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) for (let k = 0; k < c; k++) count++;
      else if (form === 1) {
        // b positions with a digit choices each
        let words = [''];
        for (let pos = 0; pos < b; pos++) words = words.flatMap((w) => Array.from({ length: a }, (_, d) => w + d));
        count = words.length;
      } else for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) for (let k = 0; k <= c; k++) count++; // k = c is "no dessert"
      expect(numOf(p), p.id).toBe(count);
    }
  });

  it('level 2: numeric forms and select-all options', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, n, r } = p.params;
      if (form === 0) expect(numOf(p), p.id).toBe(subsets(n, r));
      else if (form === 1) expect(numOf(p), p.id).toBe(arrangements(n, r));
      else if (form === 2) expect(numOf(p), p.id).toBe(arrangements(n, n));
      else {
        if (p.answer.kind !== 'multi') throw new Error('expected multi');
        const target = subsets(n, r);
        const expected = p.answer.options.filter((o) => parseLabel(o.label) === target).map((o) => o.id).sort();
        expect([...p.answer.correct].sort(), p.id).toEqual(expected);
        expect(p.answer.options.length).toBe(5);
      }
    }
  });

  it('level 3: probabilities by exhaustive outcome enumeration (numeric and multiple choice)', () => {
    let mc = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { form, fmt, a, b, c, d, k } = p.params;
      let good = 0;
      let all = 0;
      if (form === 0) {
        const bag = [...Array(a).fill('r'), ...Array(b).fill('b'), ...Array(c).fill('g')];
        all = bag.length;
        good = bag.filter((x) => x !== 'r').length;
      } else if (form === 1) {
        for (let i = 0; i < b; i++) for (let j = 0; j < d; j++) {
          all++;
          if (i < a && j < c) good++;
        }
      } else {
        const rolls = (m: number): number[][] => (m === 0 ? [[]] : rolls(m - 1).flatMap((r) => Array.from({ length: a }, (_, f) => [...r, f + 1])));
        for (const r of rolls(k)) {
          all++;
          if (r.includes(1)) good++;
        }
      }
      const truth = good / all;
      if (fmt === 0) expect(numOf(p), p.id).toBeCloseTo(truth, 12);
      else {
        mc++;
        if (p.answer.kind !== 'choice') throw new Error('expected choice');
        const val = (label: string) => {
          const m = label.replace(/\$/g, '').match(/^(-)?\\frac\{(\d+)\}\{(\d+)\}$|^(\d+)$/);
          if (!m) throw new Error(`bad label ${label}`);
          return m[4] ? +m[4] : (m[1] ? -1 : 1) * (+m[2] / +m[3]);
        };
        const vals = p.answer.options.map((o) => val(o.label));
        expect(new Set(vals.map((v) => v.toFixed(10))).size, p.id).toBe(5);
        const correct = p.answer.options.find((o) => o.id === (p.answer as { correct: string }).correct)!;
        expect(val(correct.label), p.id).toBeCloseTo(truth, 12);
        expect(vals.filter((v) => Math.abs(v - truth) < 1e-12).length, p.id).toBe(1);
      }
    }
    expect(mc).toBeGreaterThan(50);
  });

  it('level 4: Venn counts from explicitly built sets', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { form, N, A, B, both, neither } = p.params;
      const overlap = form === 0 ? both : A + B - (N - neither);
      // Build the people: ids 0..A-1 play chess; the last `overlap` chess players also play checkers.
      const chess = new Set(Array.from({ length: A }, (_, i) => i));
      const checkers = new Set(Array.from({ length: B }, (_, i) => A - overlap + i));
      const people = Array.from({ length: N }, (_, i) => i);
      expect(people.filter((x) => chess.has(x) && checkers.has(x)).length, p.id).toBe(overlap);
      const expected = [
        people.filter((x) => !chess.has(x) && !checkers.has(x)).length,
        people.filter((x) => chess.has(x) && checkers.has(x)).length,
        people.filter((x) => chess.has(x) !== checkers.has(x)).length,
      ][form];
      expect(numOf(p), p.id).toBe(expected);
      if (p.figure?.kind !== 'table') throw new Error('expected table figure');
      expect(p.figure.rows[0][1]).toBe(String(N));
    }
  });

  it('level 5: QC relations from enumerated counts', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { form, n, k, lo, hi, g } = p.params;
      const pairs: [number, number][] = [];
      if (form === 0) pairs.push([subsets(n, k), subsets(n, n - k)]);
      else if (form === 1) pairs.push([subsets(n, k), subsets(n, k + 1)]);
      else if (form === 2) pairs.push([arrangements(n, k), subsets(n, k)]);
      else for (let m = lo; m <= hi; m++) pairs.push(g === 0 ? [subsets(m, 2), subsets(m, m - 2)] : [subsets(m, 1), subsets(m, 2)]);
      const signs = new Set(pairs.map(([x, y]) => Math.sign(x - y)));
      let expected: string;
      if (signs.size > 1) expected = 'd';
      else {
        const s = [...signs][0];
        expected = s === 0 ? 'c' : s > 0 ? 'a' : 'b';
      }
      if (form !== 3) {
        // the prompt's A/B may have been swapped; relation must agree with the verify spec's expressions
        expect(p.verify.type).toBe('qc');
      }
      if (form === 3 || form === 0) expect(p.answer.correct, p.id).toBe(expected);
      else {
        // forms 1 and 2 may swap A and B: compare with the possibly swapped orientation
        if (p.verify.type !== 'qc') throw new Error('qc verify expected');
        const swapped = form === 2 ? p.verify.quantityA.startsWith('combinations') : p.verify.quantityA === `combinations(${n},${k + 1})`;
        const flip: Record<string, string> = { a: 'b', b: 'a', c: 'c', d: 'd' };
        expect(p.answer.correct, p.id).toBe(swapped ? flip[expected] : expected);
      }
      seen.add(p.answer.correct);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
