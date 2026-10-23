// Independent re-derivation for matrix-inverse: L3 has exactly one singular option (determinant read
// back from the option text), L1/L2/L4/L5 answers satisfy A·X = I, A x = b, and A·A⁻¹ = I from params.

import { describe, expect, it } from 'vitest';
import { evaluate } from 'mathjs';
import { makeProblem } from '../../src/engine/registry';
import type { Problem } from '../../src/engine/types';
import { matrixInverse as skill } from '../../src/skills/math/matrix-inverse';

const vals = (p: Problem) =>
  p.answer.kind === 'tuple' ? p.answer.values.map((v) => Number(evaluate(v))) : [Number(evaluate((p.answer as any).value))];

describe('matrix-inverse answers', () => {
  it('level 3: exactly one option has determinant 0, and it is the keyed one', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 3, seed);
      if (p.answer.kind !== 'choice') throw new Error('not a choice');
      const blocks = [...p.prompt.matchAll(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/g)].map((m) => m[1]);
      expect(blocks).toHaveLength(4);
      const dets = blocks.map((body) => {
        const [r1, r2] = body.split('\\\\').map((r) => r.split('&').map((x) => Number(x.trim())));
        expect(r1).toHaveLength(2);
        expect(r2).toHaveLength(2);
        return r1[0] * r2[1] - r1[1] * r2[0];
      });
      expect(dets.filter((d) => d === 0), p.id).toHaveLength(1);
      expect(dets[p.answer.options.findIndex((o) => o.id === (p.answer as any).correct)], p.id).toBe(0);
      // the zero-entry decoy has a zero and a nonzero determinant
      const decoy = p.misconceptions.find((m) => m.id === 'zero-entry')!;
      const di = p.answer.options.findIndex((o) => o.id === (decoy.wrong as any).correct);
      expect(dets[di]).not.toBe(0);
      expect(blocks[di].split(/[&\\]+/).map((x) => x.trim())).toContain('0');
    }
  });

  it('levels 1-2: A times the answer is the identity', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeProblem(skill, level, seed);
        const { a, b, c, d } = p.params;
        const [w, x, y, z] = vals(p);
        const prod = [a * w + b * y, a * x + b * z, c * w + d * y, c * x + d * z];
        prod.forEach((v, i) => expect(v, p.id).toBeCloseTo([1, 0, 0, 1][i], 9));
        const det = a * d - b * c;
        expect(level === 1 ? Math.abs(det) === 1 : [2, 4].includes(Math.abs(det))).toBe(true);
      }
    }
  });

  it('level 4: the answer solves Ax = b', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 4, seed);
      const { a, b, c, d, e, f } = p.params;
      const [x, y] = vals(p);
      expect(a * x + b * y, p.id).toBeCloseTo(e, 9);
      expect(c * x + d * y, p.id).toBeCloseTo(f, 9);
    }
  });

  it('level 5: the missing entry makes A times the inverse the identity', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem(skill, 5, seed);
      const { a, b, c, d, pos } = p.params;
      const det = a * d - b * c;
      const want = [d / det, -b / det, -c / det, a / det];
      expect(vals(p)[0], p.id).toBeCloseTo(want[pos], 9);
      const inv = [...want];
      inv[pos] = vals(p)[0];
      const prod = [a * inv[0] + b * inv[2], a * inv[1] + b * inv[3], c * inv[0] + d * inv[2], c * inv[1] + d * inv[3]];
      prod.forEach((v, i) => expect(v, p.id).toBeCloseTo([1, 0, 0, 1][i], 9));
    }
  });
});
