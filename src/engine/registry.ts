import { SKILLS as REGISTERED } from '../skills';
import { resolvePrerequisites, treeIndex } from '../skills/tree';
import { createRng } from './rng';
import type { Level, Problem, SkillDefinition } from './types';

/** Registered skills in skill-tree order (src/skills/tree.ts). */
const SKILLS = [...REGISTERED].sort((a, b) => treeIndex(a.id) - treeIndex(b.id));
const byId = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDefinition {
  const s = byId.get(id);
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}

export function hasSkill(id: string): boolean {
  return byId.has(id);
}

/** Nearest built prerequisites, resolved through skills that aren't built yet (see skills/tree.ts). */
export function activePrerequisites(skill: SkillDefinition): string[] {
  return resolvePrerequisites(skill.id, hasSkill);
}

/** Deterministic: the same (skill, level, seed) always yields the same problem. */
export function makeProblem(skill: SkillDefinition, level: Level, seed: number): Problem {
  const body = skill.generate(createRng(seed), level);
  return { id: `${skill.id}:${level}:${seed}`, skillId: skill.id, level, seed, ...body };
}

export function problemFromId(id: string): Problem {
  const [skillId, level, seed] = id.split(':');
  return makeProblem(getSkill(skillId), Number(level) as Level, Number(seed));
}

export { SKILLS };
