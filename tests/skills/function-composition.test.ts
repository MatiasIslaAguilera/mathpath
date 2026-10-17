// Compositions are re-derived from the raw params with plain JavaScript functions and compared
// to the generator's answers; interpretation options are checked against a context table.

import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { functionComposition as skill } from '../../src/skills/math/function-composition';

const num = (p: Problem) => Number(evaluate(p.answer.kind === 'number' ? p.answer.value : 'NaN'));
const exprAt = (p: Problem, x: number) => Number(evaluate(p.answer.kind === 'expression' ? p.answer.value : 'NaN', { x }));
const quad = (A: number, B: number, C: number) => (x: number) => A * x * x + B * x + C;
const XS = [-3.5, -1, 0, 0.5, 2, 4.25];

describe('function-composition answers', () => {
  it('level 1: f(g(u)) with linear f and g', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      const { m, n, p: pp, q, u } = p.params;
      expect(num(p)).toBe(m * (pp * u + q) + n);
    }
  });

  it('level 2: one of f, g is quadratic', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const { form, a2, a1, a0, m, n, u } = p.params;
      const Q = quad(a2, a1, a0);
      const L = (x: number) => m * x + n;
      expect(num(p)).toBe(form === 0 ? Q(L(u)) : L(Q(u)));
    }
  });

  it('level 3: f(g(x)) as an expression, f(u) = Au^2 + Bu + C, g = px + q', () => {
    let quadratic = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const { A, B, C, p: pp, q } = p.params;
      for (const x of XS) expect(exprAt(p, x)).toBeCloseTo(quad(A, B, C)(pp * x + q), 8);
      if (A !== 0) quadratic++;
      // square-not-expanded: A(p^2 x^2 + q^2) + B(px+q) + C
      const sq = p.misconceptions.find((m) => m.id === 'square-not-expanded');
      if (A !== 0 && sq && sq.wrong.kind === 'expression') {
        const w = (x: number) => A * (pp * pp * x * x + q * q) + B * (pp * x + q) + C;
        for (const x of XS) expect(Number(evaluate(sq.wrong.value, { x }))).toBeCloseTo(w(x), 8);
      }
    }
    expect(quadratic).toBeGreaterThan(100);
  });

  it('level 4: asks for the composition named in the prompt', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { which, A, B, C, D, E, F } = p.params;
      const f = quad(A, B, C);
      const g = quad(D, E, F);
      expect(p.prompt).toContain(which === 0 ? 'Find $f(g(x))$' : 'Find $g(f(x))$');
      for (const x of XS) expect(exprAt(p, x)).toBeCloseTo(which === 0 ? f(g(x)) : g(f(x)), 8);
      const swap = p.misconceptions.find((m) => m.id === 'order-swapped');
      if (swap && swap.wrong.kind === 'expression') {
        for (const x of XS) expect(Number(evaluate(swap.wrong.value, { x }))).toBeCloseTo(which === 0 ? g(f(x)) : f(g(x)), 8);
      }
      const mult = p.misconceptions.find((m) => m.id === 'multiplied-functions');
      if (mult && mult.wrong.kind === 'expression') {
        for (const x of XS) expect(Number(evaluate(mult.wrong.value, { x }))).toBeCloseTo(f(x) * g(x), 8);
      }
    }
  });

  it('level 5: f(answer) reproduces h', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { form, m, n, k } = p.params;
      const h = (x: number) => (form === 0 ? (m * x + n) ** k : form === 1 ? Math.sqrt(m * x + n) : Math.exp(m * x + n));
      const outer = (u: number) => (form === 0 ? u ** k : form === 1 ? Math.sqrt(u) : Math.exp(u));
      for (const x of [-0.5, 0, 0.3, 1, 2]) {
        const g = exprAt(p, x);
        expect(g).toBeCloseTo(m * x + n, 10);
        if (form !== 1 || m * x + n >= 0) expect(outer(g)).toBeCloseTo(h(x), 8);
      }
    }
  });
});

describe('function-composition interpretation', () => {
  const CONTEXT: [RegExp, string, string][] = [
    [/Price depends on cost/, 'quantity sold', 'cost'],
    [/tax rate \$t\$ sets the price/, 'quantity demanded', 'tax rate'],
    [/Hours worked/, 'revenue', 'hours worked'],
  ];

  it('the correct option names the final quantity as a function of the starting one', () => {
    let seen = 0;
    for (const level of [1, 2] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        if (!p.interpretation) continue;
        const iq = p.interpretation[0];
        const [, out, start] = CONTEXT.find(([re]) => re.test(iq.prompt))!;
        const label = iq.options.find((o) => o.id === iq.correct)!.label.toLowerCase();
        expect(label).toBe(`${out}, as a function of ${start}`);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('levels 3-5 have no interpretation question', () => {
    for (const level of [3, 4, 5] as const) expect(makeProblem(skill, level, 1).interpretation).toBeUndefined();
  });
});
