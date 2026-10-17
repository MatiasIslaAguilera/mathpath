// The full planned skill tree (PLAN §3), including skills not built yet. It is the single source
// of truth for skill ids, tracks, order, and prerequisites:
//   - prerequisites resolve THROUGH unbuilt skills to the nearest built ones
//     (power rule → limits → functions → linear equations);
//   - the placement test searches the tree in this order;
//   - new skill files must use the id and prerequisites listed here (a test enforces it).

import type { Track } from '../engine/types';

export interface TreeNode {
  id: string;
  title: string;
  track: Track;
  unit: string;
  prerequisites: string[];
  /** Not needed for the core courses (excluded from overall progress). */
  optional?: boolean;
}

const m = (id: string, title: string, unit: string, prerequisites: string[], optional = false): TreeNode => ({ id, title, track: 'math', unit, prerequisites, optional });
const e = (id: string, title: string, unit: string, prerequisites: string[]): TreeNode => ({ id, title, track: 'econ', unit, prerequisites });

/** Topological order: every skill comes after all of its prerequisites. */
export const TREE: TreeNode[] = [
  // ---------- math ----------
  m('linear-equations', 'Linear equations', 'Linear equations & systems', []),
  m('linear-inequalities', 'Linear inequalities', 'Linear equations & systems', ['linear-equations']),
  m('systems-of-equations', 'Systems of equations', 'Linear equations & systems', ['linear-equations']),
  m('quadratics-factoring', 'Quadratics: factoring', 'Quadratics', ['linear-equations']),
  m('quadratic-formula', 'Quadratic formula', 'Quadratics', ['quadratics-factoring']),
  m('vertex-form', 'Vertex form', 'Quadratics', ['quadratic-formula']),
  m('functions-basics', 'Functions: domain & range', 'Functions', ['linear-equations']),
  m('function-composition', 'Function composition', 'Functions', ['functions-basics']),
  m('inverse-functions', 'Inverse functions', 'Functions', ['function-composition']),
  m('function-transformations', 'Transformations', 'Functions', ['functions-basics', 'quadratics-factoring']),
  m('exponent-rules', 'Exponent rules', 'Exponents & logarithms', ['linear-equations']),
  m('logarithm-rules', 'Logarithm rules', 'Exponents & logarithms', ['exponent-rules', 'inverse-functions']),
  m('exp-log-equations', 'Exponential & log equations', 'Exponents & logarithms', ['logarithm-rules']),
  m('growth-decay', 'Growth & decay', 'Exponents & logarithms', ['exp-log-equations']),
  m('geometric-series', 'Sequences & geometric series', 'Sequences & series', ['exponent-rules']),
  m('limits', 'Limits & continuity', 'Limits', ['functions-basics']),
  m('derivatives-power-rule', 'Derivatives: power rule', 'Derivatives', ['limits', 'exponent-rules']),
  m('derivatives-product-quotient', 'Product & quotient rules', 'Derivatives', ['derivatives-power-rule']),
  m('derivatives-chain-rule', 'Chain rule', 'Derivatives', ['derivatives-product-quotient', 'function-composition']),
  m('derivatives-exp-log', 'Derivatives of exp & log', 'Derivatives', ['derivatives-chain-rule', 'logarithm-rules']),
  m('implicit-differentiation', 'Implicit differentiation', 'Derivatives', ['derivatives-chain-rule']),
  m('differentials-approximation', 'Differentials & linear approximation', 'Applications', ['derivatives-power-rule']),
  m('concavity-second-derivative', 'Concavity & second-derivative test', 'Applications', ['derivatives-power-rule']),
  m('optimization', 'Optimization', 'Applications', ['concavity-second-derivative']),
  m('partial-derivatives', 'Partial derivatives', 'Multivariable calculus', ['derivatives-chain-rule']),
  m('total-differential', 'Total differential', 'Multivariable calculus', ['partial-derivatives']),
  m('matrix-operations', 'Matrix operations', 'Matrices', ['systems-of-equations']),
  m('determinants', 'Determinants', 'Matrices', ['matrix-operations']),
  m('matrix-inverse', 'Matrix inverse', 'Matrices', ['determinants']),
  m('cramers-rule', "Cramer's rule", 'Matrices', ['determinants']),
  m('multivariable-optimization', 'Multivariable optimization (FOC/SOC)', 'Multivariable calculus', ['partial-derivatives', 'optimization', 'determinants']),
  m('antiderivatives', 'Antiderivatives', 'Integrals', ['derivatives-power-rule']),
  m('definite-integrals', 'Definite integrals', 'Integrals', ['antiderivatives']),
  m('area-between-curves', 'Area between curves', 'Integrals', ['definite-integrals']),
  m('probability-basics', 'Probability basics', 'Probability & statistics', ['linear-equations']),
  m('expected-value-variance', 'Expected value & variance', 'Probability & statistics', ['probability-basics']),
  m('normal-z-scores', 'Normal distribution & z-scores', 'Probability & statistics', ['expected-value-variance']),
  m('sampling-inference', 'Standard errors, CIs & t-tests', 'Probability & statistics', ['normal-z-scores']),
  m('trig-basics', 'Trig basics', 'Trigonometry (optional)', ['functions-basics'], true),
  // ---------- economics ----------
  e('supply-demand-equilibrium', 'Supply & demand equilibrium', 'Supply & demand', ['linear-equations']),
  e('elasticity', 'Elasticity', 'Supply & demand', ['supply-demand-equilibrium', 'derivatives-power-rule']),
  e('surplus-taxes-dwl', 'Surplus, taxes & deadweight loss', 'Supply & demand', ['supply-demand-equilibrium']),
  e('cost-profit-maximization', 'Costs & profit maximization', 'Firms', ['derivatives-power-rule', 'optimization']),
  e('monopoly-competition', 'Monopoly vs. competition', 'Firms', ['cost-profit-maximization', 'elasticity']),
  e('cournot-duopoly', 'Cournot duopoly', 'Firms', ['cost-profit-maximization', 'systems-of-equations']),
  e('cobb-douglas-production', 'Cobb-Douglas production', 'Production & utility', ['partial-derivatives', 'exponent-rules']),
  e('utility-maximization', 'Utility maximization', 'Production & utility', ['cobb-douglas-production']),
  e('lagrangian-optimization', 'Lagrangian optimization', 'Production & utility', ['utility-maximization', 'multivariable-optimization']),
  e('comparative-statics', 'Comparative statics', 'Production & utility', ['total-differential', 'cramers-rule']),
  e('present-value', 'Present value & discounting', 'Time & growth', ['exponent-rules', 'geometric-series']),
  e('growth-rates-logs', 'Growth rates & logs', 'Time & growth', ['logarithm-rules']),
  e('intertemporal-solow', 'Two-period consumption & Solow', 'Time & growth', ['present-value', 'optimization']),
  e('regression-interpretation', 'Regression interpretation', 'Data', ['growth-rates-logs', 'sampling-inference']),
  e('expected-value-risk', 'Expected value & risk', 'Data', ['expected-value-variance']),
  // Kuhn–Tucker is math, but builds on the Lagrangian, so it sits last.
  m('kuhn-tucker', 'Kuhn–Tucker conditions', 'Multivariable calculus', ['lagrangian-optimization']),
];

const byId = new Map(TREE.map((n) => [n.id, n]));

export function treeNode(id: string): TreeNode | undefined {
  return byId.get(id);
}

/** Position in the tree (topological order). Unknown ids sort last. */
export function treeIndex(id: string): number {
  const i = TREE.findIndex((n) => n.id === id);
  return i < 0 ? TREE.length : i;
}

/**
 * Nearest built ancestors: walk prerequisites, stepping through any that aren't built yet.
 * `isBuilt` is injected so this file doesn't import the skill registry (no cycles).
 */
export function resolvePrerequisites(id: string, isBuilt: (id: string) => boolean): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  const walk = (pid: string) => {
    if (seen.has(pid)) return;
    seen.add(pid);
    if (isBuilt(pid)) out.add(pid);
    else for (const p of byId.get(pid)?.prerequisites ?? []) walk(p);
  };
  for (const p of byId.get(id)?.prerequisites ?? []) walk(p);
  return [...out];
}

/** All built ancestors (transitively), for crediting prerequisites in placement. */
export function builtAncestors(id: string, isBuilt: (id: string) => boolean): string[] {
  const out = new Set<string>();
  const stack = resolvePrerequisites(id, isBuilt);
  while (stack.length) {
    const a = stack.pop()!;
    if (out.has(a)) continue;
    out.add(a);
    stack.push(...resolvePrerequisites(a, isBuilt));
  }
  return [...out];
}
