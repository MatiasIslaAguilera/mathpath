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
