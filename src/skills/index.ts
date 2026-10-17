// Every skill is registered here (any order: the registry sorts by src/skills/tree.ts).
// A skill's id and prerequisites must match its entry in tree.ts.

import type { SkillDefinition } from '../engine/types';
import { greIntegers } from './gre/gre-integers';
import { concavitySecondDerivative } from './math/concavity-second-derivative';
import { optimization } from './math/optimization';
import { costProfitMaximization } from './econ/cost-profit-maximization';
import { supplyDemandEquilibrium } from './econ/supply-demand-equilibrium';
import { derivativesPowerRule } from './math/derivatives-power-rule';
import { linearEquations } from './math/linear-equations';
import { expLogEquations } from './math/exp-log-equations';
import { exponentRules } from './math/exponent-rules';
import { logarithmRules } from './math/logarithm-rules';
import { growthDecay } from './math/growth-decay';
import { functionsBasics } from './math/functions-basics';
import { functionComposition } from './math/function-composition';

export const SKILLS: SkillDefinition[] = [linearEquations, derivativesPowerRule, supplyDemandEquilibrium, exponentRules, logarithmRules, expLogEquations, growthDecay, functionsBasics, functionComposition, greIntegers, concavitySecondDerivative, optimization, costProfitMaximization];
