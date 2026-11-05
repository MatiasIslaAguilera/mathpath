// Elo-style skill rating. Each difficulty level has a fixed rating; the chance of solving a
// level unassisted is σ(θ − b_level). Difficulty is the hardest level with P ≥ TARGET.
// (Batch A adds retention checks, FSRS reviews, and fragile/rusty states on top of this.)

import type { Level } from '../engine/types';
import { FITTED } from './fitted-params';

/**
 * The rating model's constants. Defaults are the hand-set spacing; `npm run fit` replaces them
 * with values fitted to the learner's own log (learning/fitted-params.ts). Progress is rebuilt by
 * replay, so a new fit re-rates the whole history the same way on every device.
 */
export interface RatingModel {
  /** b_level for levels 1..5. */
  levels: [number, number, number, number, number];
  initial: number;
  /** Learning rate k(n) = max(kMin, kMax / (1 + n / kScale)). */
  kMax: number;
  kMin: number;
  kScale: number;
}

export const DEFAULT_MODEL: RatingModel = { levels: [-2, -1, 0, 1, 2], initial: -1.5, kMax: 2.0, kMin: 0.5, kScale: 10 };
export const MODEL: RatingModel = FITTED.rating ?? DEFAULT_MODEL;

export const LEVEL_RATING: Record<Level, number> = {
  1: MODEL.levels[0],
  2: MODEL.levels[1],
  3: MODEL.levels[2],
  4: MODEL.levels[3],
  5: MODEL.levels[4],
};
export const INITIAL_RATING = MODEL.initial;
/** Pick difficulty so the predicted success rate stays in the 75–85% "desirable difficulty" band. */
export const TARGET_P = 0.75;

export type Help = 'none' | 'hint' | 'guided' | 'reveal';

const sigma = (z: number) => 1 / (1 + Math.exp(-z));

export function pCorrect(rating: number, level: Level, m: RatingModel = MODEL): number {
  return sigma(rating - m.levels[level - 1]);
}

export function nextLevel(rating: number): Level {
  let best: Level = 1;
  for (const l of [1, 2, 3, 4, 5] as Level[]) if (pCorrect(rating, l) >= TARGET_P) best = l;
  return best;
}

/** Once a level is reached, stay on it until P drops below this (hysteresis). */
export const HOLD_P = 0.6;

/**
 * Working level with hysteresis: promote at P ≥ TARGET_P, but keep a level already reached while
 * P ≥ HOLD_P. Without it, a learner who solves ~88% at level 1 (slips included) settles right at
 * the level-1/2 boundary and keeps dropping back to level 1, though level 2 sits in the band.
 * Simulated: half the level-1 items for such a learner, accuracy still ~80%, fewer level drops.
 */
export function heldLevel(rating: number, held?: Level): Level {
  const l = nextLevel(rating);
  return held && held > l && pCorrect(rating, held) >= HOLD_P ? held : l;
}

/**
 * Learning rate: big for the first attempts so the estimate settles fast, then smaller.
 * Tuned by simulation: 16 straight unassisted solves reach level 4; a steady learner's
 * estimate stays unbiased (±0.5). The placement test (batch B) sets starting ratings.
 */
function k(attempts: number, m: RatingModel): number {
  return Math.max(m.kMin, m.kMax / (1 + attempts / m.kScale));
}

export function updateRating(rating: number, attempts: number, level: Level, correct: boolean, help: Help, m: RatingModel = MODEL): number {
  const p = pCorrect(rating, level, m);
  const K = k(attempts, m);
  switch (help) {
    case 'none':
      return rating + K * ((correct ? 1 : 0) - p);
    case 'hint':
      // Partial evidence: a hinted solve never raises the rating (it doesn't count toward mastery).
      return Math.min(rating, rating + K * ((correct ? 0.3 : 0) - p));
    case 'guided':
    case 'reveal':
      return rating + 0.5 * K * (0 - p);
  }
}

/** 0..1 progress through the levels, used for fading and progress bars. */
export function masteryFraction(rating: number): number {
  return Math.min(1, Math.max(0, (rating - LEVEL_RATING[1] + 0.5) / (LEVEL_RATING[5] - LEVEL_RATING[1] + 1)));
}

export type SkillStatus = 'new' | 'learning' | 'practiced';

/** "Practiced" = you'd likely solve a level-3 problem unassisted. Batch A adds "mastered". */
export function skillStatus(rating: number, attempts: number): SkillStatus {
  if (attempts === 0) return 'new';
  return pCorrect(rating, 3) >= TARGET_P ? 'practiced' : 'learning';
}
