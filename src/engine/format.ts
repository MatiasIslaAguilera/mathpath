// Formatting helpers: exact values → LaTeX for display and → plain strings for mathjs/SymPy.

import { Q } from './rational';

/** LaTeX for a coefficient in front of a symbol: 1 → "", -1 → "-", 2/3 → "\frac{2}{3}". */
export function coefLatex(c: Q): string {
  if (c.eq(1)) return '';
  if (c.eq(-1)) return '-';
  return c.toLatex();
}

/** Join signed LaTeX terms: ["3x", "-5"] → "3x - 5". Zero terms should be filtered by the caller. */
export function joinTerms(terms: string[]): string {
  if (terms.length === 0) return '0';
  return terms
    .map((t, i) => {
      if (i === 0) return t;
      return t.startsWith('-') ? `- ${t.slice(1)}` : `+ ${t}`;
    })
    .join(' ');
}

/** LaTeX for c·v + k, e.g. linLatex(3, -5) → "3x - 5". */
export function linLatex(coef: Q | number, constant: Q | number, v = 'x'): string {
  const c = Q.of(coef);
  const k = Q.of(constant);
  const terms: string[] = [];
  if (!c.isZero()) terms.push(`${coefLatex(c)}${v}`);
  if (!k.isZero() || terms.length === 0) terms.push(k.toLatex());
  return joinTerms(terms);
}

/** Plain expression for c·v + k, e.g. "3*x + (-5)". */
export function linExpr(coef: Q | number, constant: Q | number, v = 'x'): string {
  return `${Q.of(coef).toExpr()}*${v} + ${Q.of(constant).toExpr()}`;
}

/** Wrap negative numbers in parentheses for display inside a product: -3 → "(-3)". */
export function parenIfNeg(x: Q | number): string {
  const v = Q.of(x);
  return v.sign() < 0 ? `(${v.toLatex()})` : v.toLatex();
}

/** "+ 5" / "- 5" for appending a signed constant to an expression in LaTeX. */
export function signed(x: Q | number): string {
  const v = Q.of(x);
  return v.sign() < 0 ? `- ${v.abs().toLatex()}` : `+ ${v.toLatex()}`;
}
