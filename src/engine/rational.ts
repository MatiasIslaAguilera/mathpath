// Exact rational arithmetic for generators. Small integers only (safe-integer range),
// which is all clean-answer problems need. Every value is kept normalized: d > 0, gcd(n, d) = 1.

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export class Q {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`Q needs integers, got ${n}/${d}`);
    if (d === 0) throw new Error('Q: division by zero');
    const g = gcd(n, d);
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g || 0; // avoid -0
    this.d = (s * d) / g;
  }

  static of(x: number | Q): Q {
    return x instanceof Q ? x : new Q(x);
  }

  add(o: number | Q): Q {
    const b = Q.of(o);
    return new Q(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: number | Q): Q {
    return this.add(Q.of(o).neg());
  }
  mul(o: number | Q): Q {
    const b = Q.of(o);
    return new Q(this.n * b.n, this.d * b.d);
  }
  div(o: number | Q): Q {
    const b = Q.of(o);
    if (b.n === 0) throw new Error('Q: division by zero');
    return new Q(this.n * b.d, this.d * b.n);
  }
  neg(): Q {
    return new Q(-this.n, this.d);
  }
  abs(): Q {
    return new Q(Math.abs(this.n), this.d);
  }

  eq(o: number | Q): boolean {
    const b = Q.of(o);
    return this.n === b.n && this.d === b.d;
  }
  isZero(): boolean {
    return this.n === 0;
  }
  isInt(): boolean {
    return this.d === 1;
  }
  sign(): number {
    return Math.sign(this.n);
  }
  valueOf(): number {
    return this.n / this.d;
  }

  /** Plain string parseable by mathjs / SymPy, e.g. "7/3", "-2". */
  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
  /** Parenthesized form for embedding in a larger mathjs / SymPy expression. */
  toExpr(): string {
    return this.d === 1 && this.n >= 0 ? `${this.n}` : `(${this.toString()})`;
  }
  /** LaTeX, e.g. "-\frac{7}{3}". */
  toLatex(): string {
    if (this.d === 1) return `${this.n}`;
    return `${this.n < 0 ? '-' : ''}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
}

export const q = (n: number, d = 1) => new Q(n, d);
