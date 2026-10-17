// Small polynomial helpers shared by the calculus/economics skills of batch F.
// A polynomial is an array of exact coefficients, index = power of the variable.

import { coefLatex, joinTerms } from '../../engine/format';
import { Q, q } from '../../engine/rational';

export type Poly = Q[];

/** LaTeX for a polynomial, highest power first, zero terms dropped: "-2x^{3} + 5x - 1". */
export function polyLatex(p: Poly, v = 'x'): string {
  const terms: string[] = [];
  for (let n = p.length - 1; n >= 0; n--) {
    const c = p[n];
    if (c.isZero()) continue;
    if (n === 0) terms.push(c.toLatex());
    else terms.push(`${coefLatex(c)}${n === 1 ? v : `${v}^{${n}}`}`);
  }
  return joinTerms(terms);
}

/** mathjs / SymPy expression for a polynomial. */
export function polyExpr(p: Poly, v = 'x'): string {
  const terms: string[] = [];
  for (let n = p.length - 1; n >= 0; n--) {
    const c = p[n];
    if (c.isZero()) continue;
    terms.push(n === 0 ? c.toExpr() : n === 1 ? `${c.toExpr()}*${v}` : `${c.toExpr()}*${v}^${n}`);
  }
  return terms.length ? terms.join(' + ') : '0';
}

export function polyDeriv(p: Poly): Poly {
  return p.slice(1).map((c, i) => c.mul(i + 1));
}

export function polyEval(p: Poly, x: Q | number): Q {
  const xv = Q.of(x);
  return p.reduce((sum, c, n) => sum.add(c.mul(powQ(xv, n))), q(0));
}

export function powQ(x: Q, n: number): Q {
  let out = q(1);
  for (let i = 0; i < n; i++) out = out.mul(x);
  return out;
}

/** Convert a param written as a decimal (0.5, 0.25) back to an exact fraction. */
export const toQ = (x: number): Q => new Q(Math.round(x * 12), 12);
