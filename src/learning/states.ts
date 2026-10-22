// Skill states and illusion-of-mastery detection (PLAN §2.4).
//
//   new → learning → practiced → check-pending → mastered
//                                      ↑               ↓ (failed first-of-day review)
//                                      └── retry ──  rusty → (unassisted first-of-day success) → mastered
//
// "check-pending": you solved a level ≥ 4 problem unassisted — or a level ≥ 3 one with a strong
// recent solo record (≥ 90% over 25 attempts) — and a cold retention check is scheduled
// RETENTION_DELAY_DAYS later at the level that earned it. Only passing it makes the skill
// "mastered".
// "fragile" is an overlay flag: you do much better later in a session than on your first
// attempt of the day, which means the skill is warmed up, not remembered.

import type { SkillProgress } from '../storage/progress';
import { nextLevel, pCorrect, TARGET_P } from './mastery';

export const RETENTION_DELAY_DAYS = 3;
export const MASTERY_LEVEL = 4;
/**
 * A cold check may also start from this level when the recent solo record is strong (see
 * `strongRecentRecord`). The normal gate stays at MASTERY_LEVEL: this is the escape hatch for a
 * learner the rating moves too slowly for (a level-4 item is only served once the rating says so,
 * otherwise the check could never be earned).
 */
export const CHECK_START_LEVEL = 3;

/** Recent solo attempts the stretch and check-readiness signals look at. */
const RECENT_SOLO_WINDOW = 25;
/** A level-3 check needs this unassisted accuracy over the window. */
const STRONG_ACCURACY = 0.9;
/** The desirable-difficulty band tops out at TARGET_P + 0.1; above it, items are too easy. */
const BAND_TOP = 0.85;
/** Don't call anything "above the band" on a handful of attempts. */
const ABOVE_BAND_MIN = 10;

export type SkillState = 'new' | 'learning' | 'practiced' | 'check-pending' | 'mastered' | 'rusty';

export function skillState(sp: SkillProgress): SkillState {
  if (sp.attempts === 0 && !sp.placedAt) return 'new';
  if (sp.masteredAt) return sp.rusty ? 'rusty' : 'mastered';
  if (sp.readyAt) return 'check-pending';
  return pCorrect(sp.rating, 3) >= TARGET_P ? 'practiced' : 'learning';
}

/** States that count as "you can do this" for turning on interleaving. */
export const isSolid = (s: SkillState) => s === 'practiced' || s === 'check-pending' || s === 'mastered' || s === 'rusty';

/** A prerequisite is solid enough to build on once you'd likely solve this level unassisted. */
export const UNLOCK_LEVEL = 2;
/** Earned evidence required at UNLOCK_LEVEL or above (a placement's partial credit isn't enough). */
const UNLOCK_MIN_SOLVES = 3;

/**
 * Solid enough to open the skills that build on it: practiced or better, or likely to solve a
 * level-2 problem with at least 3 unassisted level ≥ 2 solves behind it. Waiting for "practiced"
 * (level 3) held new material hostage to a level the session never served.
 */
export function isFoundation(sp: SkillProgress): boolean {
  if (isSolid(skillState(sp))) return true;
  const earned = sp.history.filter((a) => a.level >= UNLOCK_LEVEL && a.correct && a.help === 'none').length;
  return earned >= UNLOCK_MIN_SOLVES && pCorrect(sp.rating, UNLOCK_LEVEL) >= TARGET_P;
}

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

export interface SoloAccuracy {
  accuracy: number;
  count: number;
}

/**
 * Unassisted accuracy over the last `window` solo attempts. Hinted, guided and revealed solves
 * are left out: they don't prove you can do it alone (learning/scoring.ts).
 */
export function recentSoloAccuracy(sp: SkillProgress, window = RECENT_SOLO_WINDOW): SoloAccuracy {
  const solo = sp.history.filter((a) => a.help === 'none').slice(-window);
  return {
    accuracy: solo.length ? solo.filter((a) => a.correct).length / solo.length : 0,
    count: solo.length,
  };
}

/**
 * Enough recent solo evidence to start a cold check from level 3: at least 25 unassisted
 * attempts at ≥ 90% correct. Calibrated on a real attempt log (docs: the analysis of Oct 2026):
 * the two skills at 92–96% recent solo accuracy qualified; the one at 80% correctly did not.
 */
export function strongRecentRecord(sp: SkillProgress): boolean {
  const { accuracy, count } = recentSoloAccuracy(sp);
  return count >= RECENT_SOLO_WINDOW && accuracy >= STRONG_ACCURACY;
}

/**
 * The learner is solving above the 75–85% band, so the working level is too easy: sessions
 * stretch more often (session.ts). Needs a real recent sample, not two lucky answers.
 */
export function isAboveTargetBand(sp: SkillProgress): boolean {
  const { accuracy, count } = recentSoloAccuracy(sp);
  return count >= ABOVE_BAND_MIN && accuracy > BAND_TOP;
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
