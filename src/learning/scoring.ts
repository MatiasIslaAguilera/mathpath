import type { Level } from '../engine/types';
import type { Help } from './mastery';

/**
 * Solved alone: full XP and mastery credit. Hints: half XP, no mastery credit.
 * Guided mode or reveal: no XP, but the problem still counts toward the daily goal.
 */
export function xpFor(level: Level, correct: boolean, help: Help): number {
  if (!correct) return 0;
  if (help === 'none') return 10 * level;
  if (help === 'hint') return 5 * level;
  return 0;
}

export const countsTowardMastery = (correct: boolean, help: Help) => correct && help === 'none';
