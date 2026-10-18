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
