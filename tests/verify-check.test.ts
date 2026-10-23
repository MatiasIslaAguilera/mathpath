import { describe, expect, it } from 'vitest';
import { numberAnswer } from '../src/engine/answers';
import { q } from '../src/engine/rational';
import { verifyAnswer } from './verify-check';

describe('independent verifier: limits', () => {
  const lim = (expr: string, point: string, side?: '+' | '-') => ({ type: 'limit' as const, expr, variable: 'x', point, side });
  it('accepts correct limits and rejects wrong ones', () => {
    expect(verifyAnswer(lim('(x^2 - 9)/(x - 3)', '3'), numberAnswer(6))).toBeNull();
    expect(verifyAnswer(lim('(x^2 - 9)/(x - 3)', '3'), numberAnswer(5))).not.toBeNull();
    expect(verifyAnswer(lim('(3*x^2 + 1)/(x^2 - 4)', 'oo'), numberAnswer(3))).toBeNull();
    expect(verifyAnswer(lim('(sqrt(x + 4) - 2)/x', '0'), numberAnswer(q(1, 4)))).toBeNull();
    expect(verifyAnswer(lim('(sqrt(x + 4) - 2)/x', '0'), numberAnswer(q(1, 2)))).not.toBeNull();
  });
});

import { qcAnswer } from '../src/engine/answers';
import { qcRelation } from './verify-check';

describe('independent verifier: GRE quantitative comparison', () => {
  const qc = (A: string, B: string, vars: { name: string; min: number; max: number; integer?: boolean }[], constraints: string[] = []) => ({
    type: 'qc' as const,
    quantityA: A,
    quantityB: B,
    variables: vars,
    constraints,
  });
  const x = (min: number, max: number, integer = false) => [{ name: 'x', min, max, integer }];

  it('classifies the textbook cases', () => {
    expect(qcRelation(qc('x^2', 'x', x(-10, 10)))).toBe('d'); // classic trap: fractions and negatives
    expect(qcRelation(qc('x^2', 'x', x(-10, 10), ['x > 1']))).toBe('a');
    expect(qcRelation(qc('x^2', 'x', x(0, 1), ['x > 0', 'x < 1']))).toBe('b');
    expect(qcRelation(qc('(x+1)^2', 'x^2 + 2*x + 1', x(-10, 10)))).toBe('c');
    expect(qcRelation(qc('x^3', 'x^2', x(-5, 5, true), ['x != 0']))).toBe('d'); // negatives flip it
    expect(qcRelation(qc('2^10', '10^3', []))).toBe('a'); // no variables: 1024 > 1000
  });

  it('rejects a wrong claimed relation', () => {
    expect(verifyAnswer(qc('x^2', 'x', x(-10, 10)), qcAnswer('a'))).not.toBeNull();
    expect(verifyAnswer(qc('x^2', 'x', x(-10, 10)), qcAnswer('d'))).toBeNull();
  });
});

describe('QC verifier: tiny values', () => {
  it('does not mistake tiny-but-different values for equal', () => {
    const spec = { type: 'qc' as const, quantityA: 'x^4', quantityB: 'x^3', variables: [{ name: 'x', min: 0, max: 1 }], constraints: ['x > 0', 'x < 1'] };
    expect(qcRelation(spec)).toBe('b');
  });
});

describe('independent verifier: partial derivatives and determinants', () => {
  const expr = (value: string) => ({ kind: 'expression' as const, value, variables: ['x', 'y'], display: value });
  const f = '3*x^2*y^3 - 4*x*y + 5*y^2 + 7';
  const partial = (wrt: string[], at?: Record<string, string>) => ({ type: 'partial' as const, expr: f, wrt, variables: ['x', 'y'], at });

  it('checks a partial derivative as an expression', () => {
    expect(verifyAnswer(partial(['x']), expr('6*x*y^3 - 4*y'))).toBeNull();
    expect(verifyAnswer(partial(['y']), expr('9*x^2*y^2 - 4*x + 10*y'))).toBeNull();
    expect(verifyAnswer(partial(['x']), expr('6*x*y^3 - 4*y + 5*y^2'))).not.toBeNull(); // kept a y-only term
    expect(verifyAnswer(partial(['x']), expr('18*x*y^2 - 4'))).not.toBeNull(); // differentiated y too
  });

  it('checks second-order and mixed partials at a point', () => {
    // f_xy = 18 x y^2 - 4; at (1, 2): 72 - 4 = 68. f_yy = 18 x^2 y + 10; at (1, 2): 46.
    expect(verifyAnswer(partial(['x', 'y'], { x: '1', y: '2' }), numberAnswer(68))).toBeNull();
    expect(verifyAnswer(partial(['y', 'y'], { x: '1', y: '2' }), numberAnswer(46))).toBeNull();
    expect(verifyAnswer(partial(['x', 'x'], { x: '1', y: '2' }), numberAnswer(68))).not.toBeNull(); // f_xx = 6y^3 = 48
    expect(verifyAnswer(partial(['x'], { x: '-1', y: '(1/2)' }), numberAnswer(q(-11, 4)))).toBeNull(); // -6/8 - 2
  });

  it('checks determinants', () => {
    const det = (matrix: string[][]) => ({ type: 'det' as const, matrix });
    expect(verifyAnswer(det([['2', '3'], ['1', '4']]), numberAnswer(5))).toBeNull();
    expect(verifyAnswer(det([['2', '3'], ['1', '4']]), numberAnswer(11))).not.toBeNull(); // ad + bc
    expect(verifyAnswer(det([['1', '2', '3'], ['0', '1', '4'], ['5', '6', '0']]), numberAnswer(1))).toBeNull();
    expect(verifyAnswer(det([['(1/2)', '1'], ['3', '4']]), numberAnswer(-1))).toBeNull();
  });
});
