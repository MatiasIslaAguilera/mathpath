import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { expressionAnswer, numberAnswer, tupleAnswer } from '../src/engine/answers';
import { checkAnswer } from '../src/engine/checker';
import { q } from '../src/engine/rational';

const small = fc.integer({ min: -60, max: 60 });
const den = fc.integer({ min: 1, max: 12 });
const nonzero = small.filter((n) => n !== 0);

describe('number answers', () => {
  it('accepts equivalent fraction forms', () => {
    fc.assert(
      fc.property(small, den, fc.integer({ min: 2, max: 7 }), (n, d, k) => {
        const spec = numberAnswer(q(n, d));
        expect(checkAnswer(spec, `${n}/${d}`).correct).toBe(true);
        expect(checkAnswer(spec, `${n * k}/${d * k}`).correct).toBe(true);
        expect(checkAnswer(spec, `(${n})/(${d})`).correct).toBe(true);
      }),
    );
  });

  it('accepts exact decimals and decimals rounded to 2+ places', () => {
    fc.assert(
      fc.property(small, den, fc.integer({ min: 2, max: 4 }), (n, d, places) => {
        const spec = numberAnswer(q(n, d));
        expect(checkAnswer(spec, (n / d).toFixed(places)).correct).toBe(true);
      }),
    );
  });

  it('rejects values that are off', () => {
    fc.assert(
      fc.property(small, den, nonzero, (n, d, off) => {
        const spec = numberAnswer(q(n, d));
        expect(checkAnswer(spec, `${n}/${d} + ${off}/100`).correct).toBe(false);
        expect(checkAnswer(spec, `${-n - (n === 0 ? 1 : 0)}/${d}`).correct).toBe(n === 0 ? false : false);
      }),
    );
  });

  it('rejects one-decimal roundings of non-terminating values', () => {
    expect(checkAnswer(numberAnswer(q(2, 3)), '0.7').correct).toBe(false);
    expect(checkAnswer(numberAnswer(q(2, 3)), '0.67').correct).toBe(true);
    expect(checkAnswer(numberAnswer(q(2, 3)), '0.66').correct).toBe(false);
    expect(checkAnswer(numberAnswer(q(1, 2)), '0.5').correct).toBe(true);
  });

  it('handles phone keyboard characters', () => {
    expect(checkAnswer(numberAnswer(-3), '−3').correct).toBe(true);
    expect(checkAnswer(numberAnswer(6), '2×3').correct).toBe(true);
    expect(checkAnswer(numberAnswer(q(1, 2)), '1÷2').correct).toBe(true);
  });
});

describe('tuple answers', () => {
  it('grades each part separately', () => {
    fc.assert(
      fc.property(small, small, (p, qq) => {
        const spec = tupleAnswer(['P', 'Q'], [p, qq]);
        expect(checkAnswer(spec, [`${p}`, `${qq}`])).toEqual({ correct: true, parts: [true, true] });
        expect(checkAnswer(spec, [`${p}`, `${qq + 1}`])).toEqual({ correct: false, parts: [true, false] });
      }),
    );
  });
  it('asks for missing parts instead of grading', () => {
    const r = checkAnswer(tupleAnswer(['P', 'Q'], [1, 2]), ['1', '']);
    expect(r.error).toBeTruthy();
  });
});

// Random polynomial c·(x − r1)(x − r2) + k, written several equivalent ways.
const poly = fc.record({ c: nonzero, r1: small, r2: small, k: small });
const expanded = ({ c, r1, r2, k }: { c: number; r1: number; r2: number; k: number }) =>
  `${c}x^2 + ${-c * (r1 + r2)}x + ${c * r1 * r2 + k}`.replace(/\+ -/g, '- ');

describe('expression answers', () => {
  it('accepts expanded, factored, and reordered forms', () => {
    fc.assert(
      fc.property(poly, (pp) => {
        const { c, r1, r2, k } = pp;
        const spec = expressionAnswer(`${c}*(x - (${r1}))*(x - (${r2})) + (${k})`, '');
        expect(checkAnswer(spec, expanded(pp)).correct).toBe(true);
        expect(checkAnswer(spec, `${c}(x - ${r1})(x - ${r2}) + ${k}`.replace(/- -/g, '+ ')).correct).toBe(true);
        expect(checkAnswer(spec, `${k} + ${c}*(x-(${r2}))*(x-(${r1}))`).correct).toBe(true);
      }),
    );
  });

  it('rejects a changed coefficient', () => {
    fc.assert(
      fc.property(poly, nonzero, (pp, off) => {
        const spec = expressionAnswer(expanded(pp).replace(/(\d)x/g, '$1*x'), '');
        expect(checkAnswer(spec, `${expanded(pp)} + ${off}x`).correct).toBe(false);
        expect(checkAnswer(spec, `${expanded(pp)} + ${off}`).correct).toBe(false);
      }),
    );
  });

  it('accepts negative and fractional exponent spellings', () => {
    const spec = expressionAnswer('-12*x^(-4) + 3*x^(-1/2)', '');
    for (const s of ['-12/x^4 + 3/sqrt(x)', '-12x^-4 + 3x^(-1/2)', '3/√x - 12/x^4', '-12*x^(-4)+3*x^(-0.5)']) {
      expect(checkAnswer(spec, s).correct, s).toBe(true);
    }
    expect(checkAnswer(spec, '-12x^-3 + 3x^(-1/2)').correct).toBe(false);
  });

  it('treats x(...) as multiplication', () => {
    expect(checkAnswer(expressionAnswer('x^2 + x', ''), 'x(x+1)').correct).toBe(true);
  });

  it('rejects unknown variables with a readable error', () => {
    const r = checkAnswer(expressionAnswer('2*x', ''), '2y');
    expect(r.correct).toBe(false);
    expect(r.error).toMatch(/variable/);
  });
});

describe('robustness', () => {
  it('never throws on arbitrary input', () => {
    const specs = [numberAnswer(q(3, 4)), expressionAnswer('3*x^2', ''), tupleAnswer(['P', 'Q'], [1, 2])];
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), fc.string({ maxLength: 10 }), (a, b) => {
        for (const spec of specs) {
          const r = checkAnswer(spec, spec.kind === 'tuple' ? [a, b] : a);
          expect(typeof r.correct).toBe('boolean');
        }
      }),
      { numRuns: 500 },
    );
  });

  it('reports unparseable input as an error, not as wrong', () => {
    for (const s of ['', '3+', '((2', '=5', 'x=3']) {
      const r = checkAnswer(numberAnswer(5), s);
      expect(r.error, s).toBeTruthy();
    }
  });
});
