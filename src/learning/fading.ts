// Worked-example fading for guided mode (Renkl & Atkinson "backward fading"): on a new skill
// most steps are shown worked out and you do the last one; as mastery grows the worked part
// shrinks from the end, so you do more of the solution yourself. You always do at least one step.

import { masteryFraction } from './mastery';

export function prefilledSteps(stepCount: number, rating: number): number {
  const m = masteryFraction(rating);
  const k = Math.floor((stepCount - 1) * (1 - m));
  return Math.max(0, Math.min(stepCount - 1, k));
}
