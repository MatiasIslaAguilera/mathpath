// Prerequisite locks: a skill unlocks when every built prerequisite is solid (practiced or
// better). A skill you've started or been placed into never locks again.

import { activePrerequisites, getSkill, SKILLS } from '../engine/registry';
import { emptySkill, type Progress } from '../storage/progress';
import { isSolid, skillState } from './states';

/** Unmet prerequisites (empty when unlocked). */
export function lockedBy(p: Progress, skillId: string): string[] {
  const sp = p.skills[skillId];
  if (sp && (sp.attempts > 0 || sp.placedAt)) return [];
  return activePrerequisites(getSkill(skillId)).filter((pid) => !isSolid(skillState(p.skills[pid] ?? emptySkill())));
}

export const isUnlocked = (p: Progress, skillId: string) => lockedBy(p, skillId).length === 0;

export function unlockedSkills(p: Progress): string[] {
  return SKILLS.filter((s) => isUnlocked(p, s.id)).map((s) => s.id);
}
