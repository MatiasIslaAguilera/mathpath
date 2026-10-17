// Skill states and illusion-of-mastery detection (PLAN §2.4).
//
//   new → learning → practiced → check-pending → mastered
//                                      ↑               ↓ (failed first-of-day review)
//                                      └── retry ──  rusty → (unassisted first-of-day success) → mastered
//
// "check-pending": you solved a level ≥ 4 problem unassisted, and a cold retention check is
// scheduled RETENTION_DELAY_DAYS later. Only passing it makes the skill "mastered".
// "fragile" is an overlay flag: you do much better later in a session than on your first
// attempt of the day, which means the skill is warmed up, not remembered.

import type { SkillProgress } from '../storage/progress';
import { nextLevel, pCorrect, TARGET_P } from './mastery';

export const RETENTION_DELAY_DAYS = 3;
export const MASTERY_LEVEL = 4;

export type SkillState = 'new' | 'learning' | 'practiced' | 'check-pending' | 'mastered' | 'rusty';

export function skillState(sp: SkillProgress): SkillState {
  if (sp.attempts === 0 && !sp.placedAt) return 'new';
  if (sp.masteredAt) return sp.rusty ? 'rusty' : 'mastered';
  if (sp.readyAt) return 'check-pending';
  return pCorrect(sp.rating, 3) >= TARGET_P ? 'practiced' : 'learning';
}

/** States that count as "you can do this" for unlocking and for turning on interleaving. */
export const isSolid = (s: SkillState) => s === 'practiced' || s === 'check-pending' || s === 'mastered' || s === 'rusty';

export interface FragileReport {
  fragile: boolean;
  firstOfDayAccuracy: number;
  laterAccuracy: number;
  firstCount: number;
  laterCount: number;
}

const FRAGILE_GAP = 0.35;

/**
 * Compare unassisted accuracy on the first attempt of each day vs. later attempts.
 * Needs at least 3 first-of-day and 5 later attempts before it will call a skill fragile.
 */
export function fragileReport(sp: SkillProgress): FragileReport {
  const recent = sp.history.slice(-40);
  const ok = (a: (typeof recent)[number]) => a.correct && a.help === 'none';
  const first = recent.filter((a) => a.firstOfDay);
  const later = recent.filter((a) => !a.firstOfDay);
  const acc = (xs: typeof recent) => (xs.length ? xs.filter(ok).length / xs.length : 0);
  const firstOfDayAccuracy = acc(first);
  const laterAccuracy = acc(later);
  return {
    fragile: first.length >= 3 && later.length >= 5 && laterAccuracy - firstOfDayAccuracy >= FRAGILE_GAP,
    firstOfDayAccuracy,
    laterAccuracy,
    firstCount: first.length,
    laterCount: later.length,
  };
}

/** Working difficulty, one level gentler for a rusty skill. */
export function workingLevel(sp: SkillProgress) {
  const l = nextLevel(sp.rating);
  return sp.rusty ? (Math.max(1, l - 1) as typeof l) : l;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** A retention check is due if scheduled for today or earlier and the skill wasn't touched today. */
export function retentionCheckDue(sp: SkillProgress, today: string): boolean {
  return !!sp.readyAt && !sp.masteredAt && !!sp.retentionDue && sp.retentionDue <= today && sp.lastPracticed !== today;
}
