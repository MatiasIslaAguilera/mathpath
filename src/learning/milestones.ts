// Program milestones: the core tree grouped by what the Mizzou MA needs it for (PLAN §1), and the
// syllabus weight that decides which new skill to open next.
//
// Every core (non-optional, non-GRE) tree skill belongs to exactly one milestone
// (tests/pace.test.ts enforces it), so "milestones reached" and "skills solid" always agree.

import { hasSkill } from '../engine/registry';
import { TREE } from '../skills/tree';
import { emptySkill, type Progress } from '../storage/progress';
import { isFoundation } from './states';

export interface Milestone {
  id: string;
  title: string;
  /** What reaching it means for the program. */
  goal: string;
  /** How heavily the first-year courses lean on it: 3 = a core course is built on it. */
  weight: 1 | 2 | 3;
  skills: string[];
}

export const MILESTONES: Milestone[] = [
  {
    id: 'algebra',
    title: 'Algebra foundation',
    goal: 'Everything calculus assumes',
    weight: 1,
    skills: [
      'linear-equations', 'linear-inequalities', 'systems-of-equations', 'quadratics-factoring', 'quadratic-formula', 'vertex-form',
      'functions-basics', 'function-composition', 'inverse-functions', 'function-transformations',
      'exponent-rules', 'logarithm-rules', 'exp-log-equations',
    ],
  },
  {
    id: 'calculus',
    title: 'Calculus I',
    goal: 'The admission requirement: one semester of calculus',
    weight: 2,
    skills: [
      'limits', 'derivatives-power-rule', 'derivatives-product-quotient', 'derivatives-chain-rule', 'derivatives-exp-log',
      'implicit-differentiation', 'differentials-approximation', 'concavity-second-derivative', 'optimization',
      'antiderivatives', 'definite-integrals', 'area-between-curves',
    ],
  },
  {
    id: 'linear-algebra',
    title: 'Econ 7370 · Linear algebra',
    goal: 'A quarter of Quantitative Economics',
    weight: 3,
    skills: ['matrix-operations', 'determinants', 'matrix-inverse', 'cramers-rule'],
  },
  {
    id: 'multivariable',
    title: 'Econ 7370 · Constrained optimization',
    goal: 'Partials, FOC/SOC, Lagrange, comparative statics',
    weight: 3,
    skills: ['partial-derivatives', 'total-differential', 'multivariable-optimization', 'lagrangian-optimization', 'comparative-statics', 'kuhn-tucker'],
  },
  {
    id: 'time-growth',
    title: 'Econ 7370 · Sequences & present value',
    goal: 'Series, discounting, growth rates',
    weight: 3,
    skills: ['geometric-series', 'growth-decay', 'present-value', 'growth-rates-logs'],
  },
  {
    id: 'micro',
    title: 'Econ 8451 · Micro toolkit',
    goal: 'Markets, firms, consumers',
    weight: 2,
    skills: [
      'supply-demand-equilibrium', 'elasticity', 'surplus-taxes-dwl', 'cost-profit-maximization', 'monopoly-competition', 'cournot-duopoly',
      'cobb-douglas-production', 'utility-maximization',
    ],
  },
  {
    id: 'macro',
    title: 'Econ 8453 · Macro toolkit',
    goal: 'Intertemporal choice and Solow',
    weight: 2,
    skills: ['intertemporal-solow'],
  },
  {
    id: 'econometrics',
    title: 'Econ 7371 · Econometrics',
    goal: 'Statistics and reading a regression',
    weight: 3,
    skills: ['probability-basics', 'expected-value-variance', 'normal-z-scores', 'sampling-inference', 'regression-interpretation', 'expected-value-risk'],
  },
];

export interface MilestoneProgress {
  milestone: Milestone;
  /** Skills that exist in the app. */
  built: number;
  /** Built skills solid enough to build on (states.ts `isFoundation`). */
  solid: number;
  total: number;
  /** Every skill is built and solid. */
  reached: boolean;
}

export function milestoneProgress(p: Progress): MilestoneProgress[] {
  return MILESTONES.map((milestone) => {
    const built = milestone.skills.filter(hasSkill);
    const solid = built.filter((id) => isFoundation(p.skills[id] ?? emptySkill())).length;
    const total = milestone.skills.length;
    return { milestone, built: built.length, solid, total, reached: solid === total };
  });
}

/** The first milestone not yet reached that has something built to work on. */
export function nextMilestone(p: Progress): MilestoneProgress | undefined {
  return milestoneProgress(p).find((m) => !m.reached && m.solid < m.built);
}

// ---------- which new skill to open next ----------

const weightOf = new Map(MILESTONES.flatMap((m) => m.skills.map((id) => [id, m.weight] as const)));

const dependents = new Map<string, string[]>();
for (const n of TREE) for (const pre of n.prerequisites) dependents.set(pre, [...(dependents.get(pre) ?? []), n.id]);

function descendants(id: string): Set<string> {
  const out = new Set<string>();
  const stack = [...(dependents.get(id) ?? [])];
  while (stack.length) {
    const d = stack.pop()!;
    if (out.has(d)) continue;
    out.add(d);
    stack.push(...(dependents.get(d) ?? []));
  }
  return out;
}

/** A skill that gates more than it weighs itself should still come first. */
const GATE_SHARE = 0.5;

const priorities = new Map(
  TREE.map((n) => {
    let gated = 0;
    for (const d of descendants(n.id)) gated += weightOf.get(d) ?? 0;
    return [n.id, (weightOf.get(n.id) ?? 0) + GATE_SHARE * gated] as const;
  }),
);

/**
 * How much opening this skill is worth: its own syllabus weight plus half the weight of everything
 * it gates. Limits (the door to all of calculus) outranks a leaf like transformations; skills
 * outside the core tree (GRE, optional) score 0 and keep tree order among themselves.
 */
export const skillPriority = (id: string): number => priorities.get(id) ?? 0;
