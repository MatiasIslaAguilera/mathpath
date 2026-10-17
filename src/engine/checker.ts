// Answer checking with mathjs. Accepts equivalent forms:
//   numbers: 0.5 = 1/2 = 2/4; decimals rounded to >= 2 places are accepted (2/3 ≈ 0.67)
//   expressions: compared numerically at many sample points (2x+2 = 2(x+1))
// Unparseable input is reported as an error, never graded as wrong.

import { create, all, type MathNode } from 'mathjs';
import type { AnswerInput, AnswerSpec } from './types';

const math = create(all, {});

const FUNCTIONS = new Set(['sqrt', 'cbrt', 'ln', 'log', 'exp', 'abs', 'nthRoot']);
const CONSTANTS = new Set(['e', 'pi']);
const SCOPE_FUNCTIONS = { ln: (x: number) => Math.log(x) };

export interface CheckResult {
  correct: boolean;
  /** Per-component results for tuple answers. */
  parts?: boolean[];
  /** Set when the input could not be read; the attempt should not be graded. */
  error?: string;
}

/** Normalize what people type on phones and keyboards into mathjs syntax. */
export function normalizeInput(raw: string, variables: string[] = []): string {
  let s = raw
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*(\(|[a-zA-Z0-9.]+)/g, (_m, t: string) => (t === '(' ? 'sqrt(' : `sqrt(${t})`))
    .replace(/π/g, 'pi')
    // "0x" would be read as a hex literal, "2e3" as scientific notation: make "digit letter" a product.
    .replace(/(\d)\s*(?=[a-zA-Z])/g, '$1*');
  // "x(x+1)" means multiplication, not a function call.
  for (const v of variables) {
    s = s.replace(new RegExp(`\\b${v}\\s*\\(`, 'g'), `${v}*(`);
  }
  return s;
}

class InputError extends Error {}

function parse(raw: string, variables: string[]): MathNode {
  const text = normalizeInput(raw, variables);
  if (!text) throw new InputError('Type an answer first.');
  let node: MathNode;
  try {
    node = math.parse(text);
  } catch {
    throw new InputError("I couldn't read that. Check the brackets and operators.");
  }
  const allowed = new Set([...variables, ...CONSTANTS]);
  node.traverse((n, path, parent) => {
    if ((n as MathNode & { isFunctionNode?: boolean }).isFunctionNode) {
      const name = (n as unknown as { fn: { name: string } }).fn.name;
      if (!FUNCTIONS.has(name)) throw new InputError(`Unknown function "${name}".`);
    } else if ((n as MathNode & { isSymbolNode?: boolean }).isSymbolNode) {
      const isFnName = parent && (parent as MathNode & { isFunctionNode?: boolean }).isFunctionNode && path === 'fn';
      const name = (n as unknown as { name: string }).name;
      if (!isFnName && !allowed.has(name)) {
        throw new InputError(
          variables.length ? `Use only ${variables.join(', ')} as variables ("${name}" isn't one).` : `Enter a number ("${name}" isn't one).`,
        );
      }
    } else if (
      (n as MathNode & { isAssignmentNode?: boolean }).isAssignmentNode ||
      (n as MathNode & { isFunctionAssignmentNode?: boolean }).isFunctionAssignmentNode
    ) {
      throw new InputError('Enter just the answer, without "=".');
    }
  });
  return node;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'valueOf' in v) {
    const n = (v as { valueOf(): unknown }).valueOf();
    if (typeof n === 'number') return n;
  }
  return NaN; // Complex, matrices, etc.
}

type Compiled = ReturnType<MathNode['compile']>;

function evalCompiled(code: Compiled, scope: Record<string, number>): number {
  try {
    return toNumber(code.evaluate({ ...SCOPE_FUNCTIONS, ...scope }));
  } catch {
    return NaN;
  }
}

function evalNode(node: MathNode, scope: Record<string, number>): number {
  try {
    return evalCompiled(node.compile(), scope);
  } catch {
    return NaN;
  }
}

/** Evaluate an exact value string from a generator ("7/3", "-2"). */
export function evalExact(value: string, scope: Record<string, number> = {}): number {
  return evalNode(math.parse(value), scope);
}

const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

export function numbersMatch(inputText: string, user: number, expected: number): boolean {
  if (!Number.isFinite(user) || !Number.isFinite(expected)) return false;
  if (close(user, expected)) return true;
  // A decimal typed to d >= 2 places is accepted if it is the correct value rounded.
  const m = inputText.trim().match(/^[-−]?\d*\.(\d+)$/);
  if (m && m[1].length >= 2) {
    const d = m[1].length;
    return Math.abs(user - expected) <= 0.5 * 10 ** -d + 1e-12;
  }
  return false;
}

// Fixed sample points (positive, away from 0) so results are deterministic and log/sqrt are defined.
const SAMPLE_POINTS = [0.37, 0.71, 1.13, 1.58, 2.21, 2.9, 3.47, 0.53, 1.91, 2.63, 1.37, 3.11];

export function expressionsMatch(a: MathNode, b: MathNode, variables: string[]): boolean {
  let ca: Compiled, cb: Compiled;
  try {
    ca = a.compile();
    cb = b.compile();
  } catch {
    return false;
  }
  let valid = 0;
  for (let i = 0; i < SAMPLE_POINTS.length; i++) {
    const scope: Record<string, number> = {};
    variables.forEach((v, k) => (scope[v] = SAMPLE_POINTS[(i + 5 * k) % SAMPLE_POINTS.length]));
    const va = evalCompiled(ca, scope);
    const vb = evalCompiled(cb, scope);
    if (!Number.isFinite(vb)) continue; // expected undefined here: skip the point
    if (!Number.isFinite(va)) return false;
    if (!close(va, vb, 1e-7)) return false;
    valid++;
  }
  return valid >= 5;
}

function checkNumber(text: string, expected: string): CheckResult {
  const node = parse(text, []);
  const user = evalNode(node, {});
  if (!Number.isFinite(user)) throw new InputError("That doesn't evaluate to a number.");
  return { correct: numbersMatch(text, user, evalExact(expected)) };
}

export function checkAnswer(spec: AnswerSpec, input: AnswerInput): CheckResult {
  try {
    switch (spec.kind) {
      case 'number':
        return checkNumber(String(input), spec.value);
      case 'expression': {
        const user = parse(String(input), spec.variables);
        return { correct: expressionsMatch(user, math.parse(spec.value), spec.variables) };
      }
      case 'tuple': {
        const values = Array.isArray(input) ? input : [input];
        if (values.length !== spec.values.length || values.some((v) => !v.trim())) {
          throw new InputError(`Fill in ${spec.labels.join(' and ')}.`);
        }
        const parts = spec.values.map((expected, i) => checkNumber(values[i], expected).correct);
        return { correct: parts.every(Boolean), parts };
      }
      case 'choice':
        if (!input) throw new InputError('Pick an option.');
        return { correct: input === spec.correct };
      case 'multi': {
        const chosen = Array.isArray(input) ? input : input ? [input] : [];
        if (!chosen.length) throw new InputError('Select at least one option.');
        const want = new Set(spec.correct);
        const got = new Set(chosen);
        return { correct: got.size === want.size && [...want].every((id) => got.has(id)) };
      }
    }
  } catch (e) {
    if (e instanceof InputError) return { correct: false, error: e.message };
    throw e;
  }
}

/** LaTeX preview of what the learner typed, or null if it doesn't parse yet. */
export function previewLatex(raw: string, variables: string[]): string | null {
  try {
    return parse(raw, variables).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch {
    return null;
  }
}

export { math };
