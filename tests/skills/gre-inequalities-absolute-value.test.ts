// Independent re-derivations for gre-inequalities-absolute-value. Everything is recomputed from
// the PROMPT TEXT / option labels (parsed back into JavaScript) and checked by brute force on a
// grid, so it does not share any logic with the generator's tables.

import { describe, expect, it } from 'vitest';
import { makeProblem } from '../../src/engine/registry';
import { greInequalitiesAbsoluteValue as skill } from '../../src/skills/gre/gre-inequalities-absolute-value';

const NAMES = [['x', 'y'], ['a', 'b'], ['m', 'n'], ['p', 'q'], ['r', 's'], ['j', 'k']];

/** Translate the restricted LaTeX used in these prompts into a JS expression string. */
function toJs(tex: string): string {
  let s = tex.replace(/\$/g, '').trim();
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
  s = s.replace(/\|([^|]+)\|/g, 'ABS($1)');
  s = s.replace(/\\le(?![a-z])/g, '<=').replace(/\\ge(?![a-z])/g, '>=');
  s = s.replace(/([a-z0-9]+)\^(\d+)/g, '($1**$2)');
  s = s.replace(/([a-z0-9])(?=[a-z])/g, '$1*').replace(/\)(?=[a-z])/g, ')*');
  s = s.replace(/\^/g, '**');
  return s;
}
const fn = (js: string, names: string[]) => new Function(...names, 'ABS', `return (${js});`) as (...a: number[]) => number | boolean;
const compile = (tex: string, names: string[]) => {
  const f = fn(toJs(tex), names);
  return (...vals: number[]) => (f as (...a: unknown[]) => number | boolean)(...vals, Math.abs);
};
/** "a < b < c" -> "a < b && b < c" */
const chain = (tex: string) => {
  const parts = tex.split(/(?=\s[<>]\s)|(?<=\s[<>]\s)/);
  void parts;
  const toks = tex.replace(/\$/g, '').split(/\s*(<|>)\s*/);
  if (toks.length <= 3) return tex;
  const out: string[] = [];
  for (let i = 0; i + 2 < toks.length; i += 2) out.push(`${toks[i]} ${toks[i + 1]} ${toks[i + 2]}`);
  return out.join(' && ');
};

const num = (p: ReturnType<typeof makeProblem>) => {
  if (p.answer.kind !== 'number') throw new Error('expected number');
  const [n, d = '1'] = p.answer.value.split('/');
  return Number(n) / Number(d);
};

describe('gre-inequalities-absolute-value', () => {
  it('level 1: exactly one option has the same solution set as the inequality', () => {
    const grid = Array.from({ length: 961 }, (_, i) => -40 + i / 12);
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 1, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { a, b, c, op } = p.params;
      const holds = (x: number) => (op === 0 ? a * x + b < c : op === 1 ? a * x + b > c : op === 2 ? a * x + b <= c : a * x + b >= c);
      const sameSet = (label: string) => {
        const m = label.replace(/\$/g, '').match(/^x (<|>|\\le|\\ge) (.+)$/)!;
        const f = m[2].match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}$/);
        const v = f ? (f[1] ? -1 : 1) * (Number(f[2]) / Number(f[3])) : Number(m[2]);
        const test = (x: number) => (m[1] === '<' ? x < v : m[1] === '>' ? x > v : m[1] === '\\le' ? x <= v + 1e-9 : x >= v - 1e-9);
        return grid.every((x) => test(x) === holds(x));
      };
      const right = p.answer.options.filter((o) => sameSet(o.label)).map((o) => o.id);
      expect(right, p.id).toEqual([p.answer.correct]);
      expect(p.answer.options.length).toBe(5);
    }
  });

  it('level 2: brute-force the integer solutions of the equation in the prompt', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 2, seed);
      const m = p.prompt.match(/\$\|(.+)\| = (\d+)\$/)!;
      const inner = compile(m[1], ['x']);
      const rhs = Number(m[2]);
      const sols: number[] = [];
      for (let x = -80; x <= 80; x++) if (Math.abs(inner(x) as number) === rhs) sols.push(x);
      expect(sols.length, p.id).toBe(2);
      const want = /product/.test(p.prompt) ? sols[0] * sols[1] : sols[0] + sols[1];
      expect(num(p) + 0, p.id).toBe(want + 0);
    }
  });

  it('level 3: count integers by enumeration', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      const m = p.prompt.match(/\$\|(.+)\| (<|\\le) ([\d.]+)\$/)!;
      const inner = compile(m[1], ['x']);
      const bound = Number(m[3]);
      let n = 0;
      for (let x = -80; x <= 80; x++) {
        const d = Math.abs(inner(x) as number);
        if (m[2] === '<' ? d < bound : d <= bound) n++;
      }
      expect(num(p), p.id).toBe(n);
    }
  });

  it('level 4: the QC relation holds (or genuinely fails to) on a grid satisfying the constraints', () => {
    const vals: number[] = [];
    for (let i = -40; i <= 40; i++) if (i !== 0) vals.push(i / 4);
    vals.push(0.1, -0.1, 0.9, -0.9, 1.1, -1.1, 1 / 3, -1 / 3);
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      const { nm } = p.params;
      const names = NAMES[nm];
      const lines = p.prompt.split('\n\n');
      const cond = compile(chain(lines[0]), names);
      const A = compile(lines[1].replace('**Quantity A:** ', ''), names);
      const B = compile(lines[2].replace('**Quantity B:** ', ''), names);
      const signs = new Set<number>();
      for (const u of vals)
        for (const v of vals) {
          if (!cond(u, v)) continue;
          const d = (A(u, v) as number) - (B(u, v) as number);
          signs.add(Math.abs(d) < 1e-12 ? 0 : Math.sign(d));
        }
      expect(signs.size, `${p.id} grid satisfied the constraints`).toBeGreaterThan(0);
      const expected = signs.size > 1 ? 'd' : [...signs][0] > 0 ? 'a' : [...signs][0] < 0 ? 'b' : 'c';
      expect(p.answer.correct, p.id).toBe(expected);
    }
  });

  it('level 5: an option is correct iff the statement has no counterexample under the constraints', () => {
    const vals: number[] = [];
    for (let i = -32; i <= 32; i++) if (i !== 0) vals.push(i / 4);
    const constraints: ((p: number, q: number) => boolean)[] = [
      (p, q) => p > q && q > 0,
      (p, q) => p < q && q < 0,
      (p, q) => p > q,
      (p, q) => p > q && p * q > 0,
    ];
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      if (p.answer.kind !== 'multi') throw new Error('expected multi');
      const { nm, set } = p.params;
      const names = NAMES[nm];
      const want = p.answer.options
        .filter((o) => {
          const f = compile(o.label, names);
          for (const x of vals) for (const y of vals) if (constraints[set](x, y) && !f(x, y)) return false;
          return true;
        })
        .map((o) => o.id)
        .sort();
      expect([...p.answer.correct].sort(), p.id).toEqual(want);
      expect(want.length).toBeGreaterThan(0);
      expect(want.length).toBeLessThan(p.answer.options.length);
    }
  });
});
