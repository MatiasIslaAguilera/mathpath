// Independent re-derivation for linear-inequalities. The inequality is parsed back out of the PROMPT
// text and each option out of its label; exactly one option's set must match the inequality on a grid
// of x values (step 1/12 from -30 to 30, plus every option boundary and boundary ± 1/1000).

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { linearInequalities as skill } from '../../src/skills/math/linear-inequalities';

const EPS = 1e-9;

/** "3x - 5" / "-2(x + 4)" / "13" → function of x. */
function expr(tex: string): (x: number) => number {
  const js = tex
    .trim()
    .replace(/(\d)\s*x/g, '$1*x')
    .replace(/(\d)\s*\(/g, '$1*(')
    .replace(/-\s*\(/g, '-1*(');
  return new Function('x', `return (${js});`) as (x: number) => number;
}

type Cmp = (l: number, r: number) => boolean;
const CMP: Record<string, Cmp> = {
  '<': (l, r) => l < r - EPS,
  '>': (l, r) => l > r + EPS,
  '<=': (l, r) => l <= r + EPS,
  '>=': (l, r) => l >= r - EPS,
};

/** Parse "e1 REL e2 [REL e3]" (LaTeX \le, \ge) into a predicate on x. */
function parseChain(tex: string): (x: number) => boolean {
  const norm = tex.replace(/\\le(?![a-z])/g, '<=').replace(/\\ge(?![a-z])/g, '>=');
  const parts = norm.split(/(<=|>=|<|>)/);
  const exprs = parts.filter((_, i) => i % 2 === 0).map(expr);
  const rels = parts.filter((_, i) => i % 2 === 1);
  return (x) => rels.every((r, i) => CMP[r](exprs[i](x), exprs[i + 1](x)));
}

const fracValue = (s: string): number => {
  const f = s.match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}$/);
  return f ? (f[1] ? -1 : 1) * (Number(f[2]) / Number(f[3])) : Number(s);
};

/** Option label → predicate and its boundaries. */
function parseOption(label: string): { holds: (x: number) => boolean; bounds: number[] } {
  const body = label.replace(/\$/g, '').trim();
  const one = body.match(/^x (<|>|\\le|\\ge) (.+)$/);
  if (one) {
    const v = fracValue(one[2]);
    const rel = one[1].replace('\\le', '<=').replace('\\ge', '>=');
    return { holds: (x) => CMP[rel](x, v), bounds: [v] };
  }
  const two = body.match(/^(.+?) (<|\\le) x (<|\\le) (.+)$/);
  if (!two) throw new Error(`cannot parse option ${label}`);
  const lo = fracValue(two[1]);
  const hi = fracValue(two[4]);
  const r1 = two[2].replace('\\le', '<=');
  const r2 = two[3].replace('\\le', '<=');
  return { holds: (x) => CMP[r1](lo, x) && CMP[r2](x, hi), bounds: [lo, hi] };
}

describe('linear-inequalities', () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    it(`level ${level}: exactly the correct option matches the inequality on a grid`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        if (p.answer.kind !== 'choice') throw new Error('expected a choice answer');
        expect(p.answer.options.length, p.id).toBe(4);
        const m = p.prompt.match(/\$\$(.+)\$\$/s);
        if (!m) throw new Error(`no display inequality in ${p.prompt}`);
        const original = parseChain(m[1]);
        const opts = p.answer.options.map((o) => ({ id: o.id, ...parseOption(o.label) }));
        const xs = new Set<number>();
        for (let i = -360; i <= 360; i++) xs.add(i / 12);
        for (const o of opts) for (const b of o.bounds) [b, b - 0.001, b + 0.001].forEach((v) => xs.add(v));
        const matching = opts.filter((o) => [...xs].every((x) => o.holds(x) === original(x))).map((o) => o.id);
        expect(matching, `${p.id}: ${m[1]}`).toEqual([p.answer.correct]);
        // every named misconception points at a wrong option
        for (const mi of p.misconceptions) {
          if (mi.wrong.kind !== 'choice') throw new Error('misconception must be a choice');
          expect(mi.wrong.correct, p.id).not.toBe(p.answer.correct);
        }
      }
    });
  }

  for (const level of [1, 2, 3] as const) {
    it(`story level ${level}: exactly the correct option matches the inequality built from the params`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed, 'story');
        if (p.answer.kind !== 'choice') throw new Error('expected a choice answer');
        const { a, b, c, d, rel } = p.params;
        const L = (x: number) => a * x + b;
        const R = level === 3 ? (x: number) => c * x + d : () => c;
        const cmp = ['<', '>', '<=', '>='][rel];
        const original = (x: number) => CMP[cmp](L(x), R(x));
        const opts = p.answer.options.map((o) => ({ id: o.id, ...parseOption(o.label) }));
        const xs = new Set<number>();
        for (let i = -360; i <= 360; i++) xs.add(i / 12);
        for (const o of opts) for (const bd of o.bounds) [bd, bd - 0.001, bd + 0.001].forEach((v) => xs.add(v));
        const matching = opts.filter((o) => [...xs].every((x) => o.holds(x) === original(x))).map((o) => o.id);
        expect(matching, p.id).toEqual([p.answer.correct]);

        // The sense-check step: its value is in the story's set exactly when the step says "yes",
        // and the reversed set is tagged read-backwards (never flip-positive / no-flip in a story).
        const check = p.steps.find((s) => s.key === 'check');
        if (!check?.ask || check.ask.answer.kind !== 'choice') throw new Error(`${p.id}: missing check step`);
        const v = Number(check.ask.prompt.match(/At \$x = (\d+)\$/)![1]);
        expect(check.ask.answer.correct, `${p.id} check at ${v}`).toBe(original(v) ? 'yes' : 'no');
        const ids = p.misconceptions.map((x) => x.id);
        expect(ids, p.id).not.toContain('flip-positive');
        expect(ids, p.id).not.toContain('no-flip');
      }
    });
  }

  it('flip misconceptions: no-flip only when the divisor is negative, flip-positive only when positive', () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const p = makeProblem(skill, level, seed);
        const step = p.steps.find((s) => s.key === 'flip')!;
        const flips = step.ask!.answer.kind === 'choice' && step.ask!.answer.correct === 'yes';
        const ids = p.misconceptions.map((x) => x.id);
        if (flips) expect(ids, p.id).not.toContain('flip-positive');
        else expect(ids, p.id).not.toContain('no-flip');
      }
    }
  });

  it('interpretation (levels 1 and 4): exactly the correct quantity satisfies the inequality', () => {
    let seen = 0;
    for (const level of [1, 4] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        for (const iq of p.interpretation ?? []) {
          seen++;
          const m = iq.prompt.match(/exactly when \$(.+?)\$, where/);
          if (!m) throw new Error(`cannot parse ${iq.prompt}`);
          const holds = parseChain(m[1]);
          const good = iq.options.filter((o) => holds(Number(o.label.match(/\$(-?\d+)\$/)![1]))).map((o) => o.id);
          expect(good, p.id).toEqual([iq.correct]);
        }
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
});
