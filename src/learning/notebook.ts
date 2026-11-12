// The error notebook: the learner's own recent wrong answers, and a "redo my misses" session
// built from them (same skill and level, new numbers, the same trap set when it was diagnosed).

import { hasSkill } from '../engine/registry';
import type { Level } from '../engine/types';
import type { MistakeEntry, Progress } from '../storage/progress';

export interface RedoItem {
  skillId: string;
  level: Level;
  /** The misconception the miss matched, if any: the redo sets the same trap. */
  trap?: string;
}

/** Misses older than this have had their spaced reviews; the notebook is for fresh ones. */
const NOTEBOOK_DAYS = 14;

/** Recent wrong answers, newest first (interpretation misses and helped solves are left out). */
export function recentMisses(p: Progress, now = new Date(), days = NOTEBOOK_DAYS): MistakeEntry[] {
  const since = now.getTime() - days * 86_400_000;
  return p.mistakes.filter((m) => m.kind === 'wrong' && m.ts >= since && hasSkill(m.skillId)).reverse();
}

/**
 * What to redo: one item per distinct (skill, level, trap), newest first, at most `n`. A mistake
 * made five times is redone once: the session is for coverage, the follow-ups handle repetition.
 */
export function redoItems(p: Progress, n = 8, now = new Date()): RedoItem[] {
  const seen = new Set<string>();
  const out: RedoItem[] = [];
  for (const m of recentMisses(p, now)) {
    const k = `${m.skillId}|${m.level}|${m.misconception ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ skillId: m.skillId, level: m.level, trap: m.misconception });
    if (out.length >= n) break;
  }
  return out;
}
