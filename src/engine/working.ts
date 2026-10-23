// The working pad: the learner's own lines of working, checked line by line.
//
// A correct line of working stays TRUE when the correct solution is substituted. So the first
// line that turns false is exactly where the mistake entered: no guessing, just exact evaluation
// (with a small tolerance only when the learner typed rounded decimals). Lines the checker can't
// judge (no "=", an inequality, an unknown symbol like f(x)) are skipped, never marked wrong.

import type { MathNode } from 'mathjs';
import { evalExact, math, normalizeInput } from './checker';
import type { AnswerInput, AnswerSpec, Problem } from './types';

export interface WorkingSpec {
  /** The unknowns the learner solves for, in answer order (they fill the answer box). */
  vars: string[];
  /** Every correct solution (a quadratic has two), including the values of `names`. */
  solutions: Record<string, number>[];
  /** Other named quantities a line may use (`AC`, `MC`, `pi` for profit); checked, never filled in. */
  names?: string[];
}

/** ok: true for every solution · some: true for some (one root of a quadratic) · wrong: false for all. */
export type LineStatus = 'ok' | 'some' | 'wrong' | 'skipped' | 'unreadable' | 'empty';

export interface WorkingReport {
  status: LineStatus[];
  /** Index of the first wrong line, or null if none. */
  firstWrong: number | null;
}

const CONSTANTS = new Set(['e', 'pi']);

/** What the working pad checks against, or null when this problem has no equation working. */
export function workingSpec(problem: Problem): WorkingSpec | null {
  const base = unknownsSpec(problem);
  const names = problem.working?.names;
  if (!base || !names) return base;
  const values = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, evalExact(v)]));
  return { vars: base.vars, names: Object.keys(names), solutions: base.solutions.map((s) => ({ ...values, ...s })) };
}

function unknownsSpec(problem: Problem): WorkingSpec | null {
  const given = problem.working?.solutions;
  if (given?.length) {
    const solutions = given.map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, evalExact(v)])));
    return { vars: Object.keys(given[0]), solutions };
  }
  const v = problem.verify;
  if (v.type !== 'solve') return null;
  const a = problem.answer;
  const values = a.kind === 'number' ? [a.value] : a.kind === 'tuple' ? a.values : null;
  if (!values || values.length !== v.unknowns.length) return null;
  return { vars: v.unknowns, solutions: [Object.fromEntries(v.unknowns.map((u, i) => [u, evalExact(values[i])]))] };
}

/** Split at top-level separators (outside brackets). */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0) {
      const m = s.slice(i).match(sep);
      if (m && m.index === 0) {
        out.push(s.slice(start, i));
        i += m[0].length - 1;
        start = i + 1;
      }
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

/** "x = 5 ± 4" → ["x = 5 + 4", "x = 5 - 4"] (one ± only). */
const expandPm = (part: string): string[] => (part.includes('±') ? [part.replace('±', '+'), part.replace('±', '-')] : [part]);

interface ParsedPart {
  sides: MathNode[];
}

const isMathFunction = (name: string) => name === 'ln' || typeof (math as unknown as Record<string, unknown>)[name] === 'function';

/**
 * One side of a line, rewritten into something to evaluate, or null when it is notation the pad
 * can't judge (that side is then left out of the chain, and the rest is still checked):
 * - "P^*", "q^*": the optimum is the same quantity (P, q).
 * - "R'(q)": a derivative; substitution can't check it. (In mathjs ' would be a transpose.)
 * - "R(q)", "MC(q)": a named quantity at the unknown, so its value at the solution (R, MC).
 * - "x(x + 1)", "P(30 - 5P)": a one-letter unknown times a bracket, a product.
 * - "R(3)", "f(x)", "AC(q + 1)": a function at some other point: can't judge.
 */
function readSide(text: string, vars: string[], names: string[]): string | null {
  let t = text.replace(/\^\s*\(\s*\*\s*\)|\^\s*\*/g, '');
  if (t.includes("'")) return null;
  const known = new Set([...vars, ...names]);
  const call = /([A-Za-z_]\w*)\s*\(/g;
  for (let m = call.exec(t); m; m = call.exec(t)) {
    const name = m[1];
    if (!known.has(name) && isMathFunction(name)) continue; // sqrt(...), log(...): real functions
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let j = open; j < t.length; j++) {
      if (t[j] === '(') depth++;
      else if (t[j] === ')' && --depth === 0) {
        close = j;
        break;
      }
    }
    if (close < 0) return t; // unbalanced: let the parser report it as unreadable
    const arg = t.slice(open + 1, close).trim();
    if (known.has(name) && name !== arg && vars.includes(arg)) {
      t = t.slice(0, m.index) + name + t.slice(close + 1);
      call.lastIndex = m.index + name.length;
    } else if (vars.includes(name) && name.length === 1 && (/^[a-z]$/.test(name) || !/^[\d.\s]+$/.test(arg))) {
      t = t.slice(0, open) + '*' + t.slice(open);
      call.lastIndex = open + 2;
    } else return null;
  }
  return t;
}

/** Parse a line into alternatives ("x = 2 or x = 3"), each a chain of equal sides. */
function parseLine(line: string, vars: string[], names: string[] = []): ParsedPart[] | 'skipped' | 'unreadable' {
  if (/<|>|!=/.test(line)) return 'skipped'; // inequalities aren't judged by substitution
  if (!line.includes('=')) return 'skipped';
  const parts = splitTop(line, /^(\s+or\s+|,|;)/).flatMap(expandPm);
  // A name listed for the problem (pi for profit) is that quantity here, not the constant.
  const allowed = new Set([...vars, ...names, ...CONSTANTS]);
  // readSide has already turned products into "x*(": nothing else gets that reading.
  const products: string[] = [];
  const parsed: ParsedPart[] = [];
  for (const part of parts) {
    const allSides = part.split('=').map((t) => t.trim());
    if (allSides.length < 2 || allSides.some((t) => !t)) return 'unreadable';
    // Notation sides ("R'(q)", "f(3)") are left out; the rest of the chain is still judged
    // ("R'(q) = 16 - 8q = 0" checks "16 - 8q = 0").
    const sideTexts = allSides.map((t) => readSide(t, vars, names)).filter((t): t is string => t !== null);
    if (sideTexts.length < 2) return 'skipped';
    const sides: MathNode[] = [];
    for (const t of sideTexts) {
      let node: MathNode;
      try {
        node = math.parse(normalizeInput(t, products));
      } catch {
        return 'unreadable';
      }
      let unknownSymbol = false;
      node.traverse((n, path, parent) => {
        const isFnName = parent && (parent as MathNode & { isFunctionNode?: boolean }).isFunctionNode && path === 'fn';
        if ((n as MathNode & { isSymbolNode?: boolean }).isSymbolNode && !isFnName && !allowed.has((n as unknown as { name: string }).name)) unknownSymbol = true;
        if ((n as MathNode & { isAssignmentNode?: boolean }).isAssignmentNode) unknownSymbol = true;
      });
      if (unknownSymbol) return 'skipped'; // f(x), P, a label: not something we can substitute into
      sides.push(node);
    }
    parsed.push({ sides });
  }
  return parsed;
}

function evaluate(node: MathNode, scope: Record<string, number>): number {
  try {
    const v = node.compile().evaluate({ ln: Math.log, ...scope });
    return typeof v === 'number' ? v : Number(v);
  } catch {
    return NaN;
  }
}

/** Equal within tolerance: exact (1e-9) unless the learner typed a rounded decimal. */
function sidesEqual(a: number, b: number, rounded: boolean): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= (rounded ? 0.01 : 1e-9) * scale;
}

/** Check one line of working (mathjs syntax) against the correct solutions. */
export function checkLine(line: string, spec: WorkingSpec): LineStatus {
  if (!line.trim()) return 'empty';
  const parsed = parseLine(line, spec.vars, spec.names);
  if (typeof parsed === 'string') return parsed;
  const rounded = /\d\.\d/.test(line);
  let held = 0;
  let judged = 0;
  for (const sol of spec.solutions) {
    let holds = false;
    let any = false;
    for (const { sides } of parsed) {
      const vals = sides.map((n) => evaluate(n, sol));
      if (vals.some((v) => !Number.isFinite(v))) continue; // undefined at this solution: can't judge
      any = true;
      if (vals.every((v) => sidesEqual(v, vals[0], rounded))) holds = true;
    }
    if (any) judged++;
    if (holds) held++;
  }
  if (!judged) return 'skipped';
  return held === spec.solutions.length ? 'ok' : held > 0 ? 'some' : 'wrong';
}

export function checkWorking(lines: string[], spec: WorkingSpec): WorkingReport {
  const status = lines.map((l) => checkLine(l, spec));
  const i = status.indexOf('wrong');
  return { status, firstWrong: i < 0 ? null : i };
}

/** Bare assignments "x = <number>" in a line (also "x = 2 or x = 3"). */
function assignments(line: string, vars: string[]): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const part of splitTop(line, /^(\s+or\s+|,|;)/).flatMap(expandPm)) {
    const m = part.match(/^\s*([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (!m || !vars.includes(m[1]) || m[2].includes('=')) continue;
    const value = m[2].trim();
    try {
      const node = math.parse(normalizeInput(value));
      let symbols = false;
      node.traverse((n, path, parent) => {
        const isFnName = parent && (parent as MathNode & { isFunctionNode?: boolean }).isFunctionNode && path === 'fn';
        if ((n as MathNode & { isSymbolNode?: boolean }).isSymbolNode && !isFnName && !CONSTANTS.has((n as unknown as { name: string }).name)) symbols = true;
      });
      if (!symbols && Number.isFinite(evaluate(node, {}))) out.push({ name: m[1], value });
    } catch {
      // not a plain value
    }
  }
  return out;
}

/**
 * The final answer the working arrives at, shaped for the answer box, or null when the last
 * lines don't state one. Number answers: the last "x = value". Tuples: the last value of each
 * unknown, in order; for the two roots of one variable, both values, smaller first.
 */
export function answerFromWorking(lines: string[], spec: WorkingSpec, answer: AnswerSpec): AnswerInput | null {
  const found = lines.flatMap((l) => assignments(l, spec.vars));
  if (!found.length) return null;
  if (answer.kind === 'number' && spec.vars.length === 1) {
    return found.filter((f) => f.name === spec.vars[0]).at(-1)?.value ?? null;
  }
  if (answer.kind !== 'tuple') return null;
  if (spec.vars.length === 1 && answer.values.length === spec.solutions.length) {
    // Roots of one variable: distinct values from the working, smaller first.
    const byValue = new Map<number, string>();
    for (const f of found) byValue.set(Math.round(evaluate(math.parse(normalizeInput(f.value)), {}) * 1e9) / 1e9, f.value);
    if (byValue.size !== answer.values.length) return null;
    return [...byValue.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }
  if (spec.vars.length !== answer.values.length) return null;
  const values = spec.vars.map((v) => found.filter((f) => f.name === v).at(-1)?.value);
  return values.every((v): v is string => v !== undefined) ? values : null;
}

/** The problem's equation as a first line of working (LaTeX), when the prompt has exactly one. */
export function firstLineLatex(problem: Problem): string | null {
  const maths = [...problem.prompt.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)].map((m) => (m[1] ?? m[2]).trim());
  // One equation only: a display like "y = 3 + x \qquad y = 9 + 2x" holds two.
  const equations = maths.filter((m) => m.split('=').length === 2 && !m.includes('\\begin') && !/\\(le|ge|lt|gt)\b|<|>/.test(m));
  return equations.length === 1 ? equations[0] : null;
}
