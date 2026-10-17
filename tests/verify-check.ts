// Independent answer verification for the generator harness. Deliberately separate from
// the generators' own arithmetic: answers are checked against the PROBLEM STATEMENT
// (VerifySpec) by substitution, numeric differentiation, or evaluation.

import { create, all } from 'mathjs';
import type { AnswerSpec, VerifySpec } from '../src/engine/types';

const math = create(all, {});
const POINTS = [0.6, 0.9, 1.3, 1.7, 2.2, 2.8];

const ev = (expr: string, scope: Record<string, number> = {}): number => {
  const v = math.evaluate(expr, scope);
  return typeof v === 'number' ? v : Number(v);
};
const close = (a: number, b: number, tol: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function values(answer: AnswerSpec): string[] {
  switch (answer.kind) {
    case 'number':
    case 'expression':
      return [answer.value];
    case 'tuple':
      return answer.values;
    case 'choice':
    case 'multi':
      throw new Error('choice answers are not verified numerically');
  }
}

/** Returns null when the answer satisfies the spec, else a description of the failure. */
export function verifyAnswer(spec: VerifySpec, answer: AnswerSpec): string | null {
  if (spec.type === 'choice') return answer.kind === 'choice' || answer.kind === 'multi' ? null : `'choice' verify used with a ${answer.kind} answer`;
  if (spec.type === 'qc') {
    if (answer.kind !== 'choice') return `'qc' verify needs a choice answer, got ${answer.kind}`;
    const found = qcRelation(spec);
    if (typeof found !== 'string') return found.error;
    return found === answer.correct ? null : `QC: sampling says '${found}' (${QC_NAMES[found]}), answer says '${answer.correct}'`;
  }
  const vals = values(answer);
  switch (spec.type) {
    case 'solve': {
      if (vals.length !== spec.unknowns.length) return `expected ${spec.unknowns.length} values, got ${vals.length}`;
      const scope: Record<string, number> = {};
      spec.unknowns.forEach((u, i) => (scope[u] = ev(vals[i])));
      if (spec.positive && spec.unknowns.some((u) => !(scope[u] > 0))) return `expected positive values, got ${JSON.stringify(scope)}`;
      for (const eq of spec.equations) {
        const parts = eq.split('=');
        if (parts.length !== 2) return `bad equation: ${eq}`;
        const l = ev(parts[0], scope);
        const r = ev(parts[1], scope);
        if (!close(l, r, 1e-9)) return `${eq} fails at ${JSON.stringify(scope)}: ${l} ≠ ${r}`;
      }
      return null;
    }
    case 'diff': {
      for (const x of POINTS) {
        const h = 1e-5;
        const numeric = (ev(spec.expr, { [spec.variable]: x + h }) - ev(spec.expr, { [spec.variable]: x - h })) / (2 * h);
        const claimed = ev(vals[0], { [spec.variable]: x });
        if (!close(numeric, claimed, 1e-5)) return `d/d${spec.variable} of ${spec.expr} at ${x}: numeric ${numeric}, claimed ${claimed} (${vals[0]})`;
      }
      return null;
    }
    case 'equivalent': {
      for (const x of POINTS) {
        const scope = Object.fromEntries(spec.variables.map((v, i) => [v, x + 0.37 * i]));
        const a = ev(spec.expr, scope);
        const b = ev(vals[0], scope);
        if (!close(a, b, 1e-9)) return `${vals[0]} ≢ ${spec.expr} at ${JSON.stringify(scope)}: ${b} vs ${a}`;
      }
      return null;
    }
    case 'limit': {
      // Approach numerically from the requested side(s); the sequence must settle on the answer.
      const claimed = ev(vals[0]);
      const f = (x: number) => ev(spec.expr, { [spec.variable]: x });
      const inf = spec.point === 'oo' || spec.point === '-oo';
      const sides = spec.side ? [spec.side] : inf ? [spec.point === 'oo' ? '+' : '-'] : ['+', '-'];
      for (const side of sides) {
        const xs = inf
          ? [1e4, 1e5, 1e6].map((x) => (spec.point === '-oo' ? -x : x))
          : [1e-4, 1e-5, 1e-6].map((h) => ev(spec.point) + (side === '+' ? h : -h));
        const last = f(xs[xs.length - 1]);
        if (!close(last, claimed, 1e-3)) return `limit of ${spec.expr} as ${spec.variable}→${spec.point}${side}: numeric ${last}, claimed ${claimed}`;
      }
      return null;
    }
    case 'evaluate': {
      const a = ev(spec.expr);
      const b = ev(vals[0]);
      return close(a, b, 1e-9) ? null : `${spec.expr} = ${a}, claimed ${vals[0]}`;
    }
  }
}

// ---------- GRE quantitative comparison ----------

const QC_NAMES = { a: 'A greater', b: 'B greater', c: 'equal', d: 'cannot be determined' } as const;
type QcSpec = Extract<VerifySpec, { type: 'qc' }>;

/** Deterministic PRNG so failures are reproducible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classify A vs B by sampling the allowed values. GRE traps live at special values, so the
 * candidates always include 0, ±1, ±1/2, ±2, the bounds and their neighbors, plus random draws.
 * Any two samples that disagree are a counterexample proving 'd'.
 */
export function qcRelation(spec: QcSpec, samples = 4000): keyof typeof QC_NAMES | { error: string } {
  const rand = prng(12345);
  const special = (v: QcSpec['variables'][number]) => {
    const base = [0, 1, -1, 0.5, -0.5, 2, -2, 0.1, -0.1, 0.9, 1.1, 3, -3, 10, -10, v.min, v.max, v.min + 1, v.max - 1, (v.min + v.max) / 2];
    return base.filter((x) => x >= v.min && x <= v.max && (!v.integer || Number.isInteger(x)));
  };
  const draw = (v: QcSpec['variables'][number], i: number) => {
    const sp = special(v);
    if (i < sp.length * 3 && sp.length) return sp[Math.floor(rand() * sp.length)];
    const x = v.min + rand() * (v.max - v.min);
    return v.integer ? Math.round(x) : x;
  };
  const signs = new Set<number>();
  let valid = 0;
  const total = spec.variables.length ? samples : 1;
  for (let i = 0; i < total; i++) {
    const scope: Record<string, number> = {};
    for (const v of spec.variables) scope[v.name] = draw(v, i);
    try {
      if (!spec.constraints.every((c) => Boolean(math.evaluate(c, scope)))) continue;
    } catch {
      continue;
    }
    const a = ev(spec.quantityA, scope);
    const b = ev(spec.quantityB, scope);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    valid++;
    const d = a - b;
    signs.add(Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) ? 0 : Math.sign(d));
    if (signs.size > 1) return 'd';
  }
  if (valid < Math.min(total, 30)) return { error: `QC: only ${valid} samples satisfied the constraints` };
  const only = [...signs][0];
  return only > 0 ? 'a' : only < 0 ? 'b' : 'c';
}
