// LaTeX from the math keyboard (MathLive) → mathjs syntax for the working checker.
// Only the subset the keyboard produces is supported; anything else throws, and the line is
// treated as unreadable rather than guessed at.

const SPACE = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad']);
const SYMBOL: Record<string, string> = {
  cdot: '*',
  times: '*',
  div: '/',
  le: '<=',
  leq: '<=',
  ge: '>=',
  geq: '>=',
  lt: '<',
  gt: '>',
  ne: '!=',
  neq: '!=',
  pm: '±',
  pi: 'pi',
  // Elasticity is written ε; a problem that uses it names `epsilon` (working.names).
  epsilon: 'epsilon',
  varepsilon: 'epsilon',
  ln: 'log', // natural log, as in the checker
  log: 'log10',
  exp: 'exp',
};

export class LatexError extends Error {}

/** Convert one line of keyboard LaTeX to a mathjs expression/equation string. */
export function latexToMath(latex: string): string {
  let i = 0;
  // The keyboard writes a derivative's prime as a superscript: R^{\prime}(q) → R'(q).
  const s = latex
    .replace(/−/g, '-')
    .replace(/\^\{\\prime\\prime\}/g, "''")
    .replace(/\^\{\\prime\}|\^\\prime/g, "'");

  const group = (): string => {
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      i++;
      const inner = seq('}');
      i++; // '}'
      return inner;
    }
    // A single token: \frac12 or x^2.
    if (s[i] === '\\') return command();
    return s[i++] ?? '';
  };

  const command = (): string => {
    i++; // backslash
    if (!/[a-zA-Z]/.test(s[i] ?? '')) {
      const c = s[i++];
      if (SPACE.has(c)) return ' ';
      if (c === '{' || c === '}') return c === '{' ? '(' : ')';
      throw new LatexError(`\\${c}`);
    }
    let name = '';
    while (/[a-zA-Z]/.test(s[i] ?? '')) name += s[i++];
    if (SPACE.has(name)) return ' ';
    if (name in SYMBOL) return ` ${SYMBOL[name]} `.replace(/ (log|log10|exp) /, ' $1');
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac': {
        const a = group();
        const b = group();
        return `((${a})/(${b}))`;
      }
      case 'sqrt': {
        if (s[i] === '[') {
          i++;
          const n = seq(']');
          i++;
          return `nthRoot(${group()}, ${n})`;
        }
        return `sqrt(${group()})`;
      }
      case 'left':
      case 'right': {
        const d = s[i] === '\\' ? s.slice(i, i + 2) : s[i];
        i += d.length;
        if (d === '.') return '';
        if (d === '|') return name === 'left' ? 'abs(' : ')';
        if (d === '(' || d === '[' || d === '\\{') return '(';
        if (d === ')' || d === ']' || d === '\\}') return ')';
        throw new LatexError(`\\${name}${d}`);
      }
      case 'text':
      case 'mathrm':
      case 'operatorname': {
        const inner = s[i] === '{' ? (i++, seq('}', true)) : '';
        i++;
        return ` ${inner.trim()} `;
      }
      default:
        throw new LatexError(`\\${name}`);
    }
  };

  /** Read until `end` (not consumed). Raw mode keeps text verbatim (inside \text{}). */
  const seq = (end: string, raw = false): string => {
    let out = '';
    while (i < s.length && s[i] !== end) {
      const c = s[i];
      if (raw) {
        out += c;
        i++;
      } else if (c === '\\') out += command();
      else if (c === '{') {
        i++;
        out += `(${seq('}')})`;
        i++;
      } else if (c === '^') {
        i++;
        out += `^(${group()})`;
      } else if (c === '_') {
        i++;
        out += `_${group().replace(/\W/g, '')}`;
      } else {
        out += c;
        i++;
      }
    }
    return out;
  };

  const out = seq('\u0000');
  return out.replace(/\s+/g, ' ').trim();
}
