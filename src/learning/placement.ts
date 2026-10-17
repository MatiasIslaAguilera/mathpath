// Adaptive placement test (PLAN §6): binary search over the skill tree.
//
// Repeatedly probe the middle untested skill with up to 2 level-3 problems:
//   2/2 → passed: the skill AND all its built prerequisites are credited
//   1/2 → partial: start that skill at level 2; skills that depend on it stay locked
//   0/2 or "I don't know" → failed: it and everything that depends on it are left for learning
// Placement only ever RAISES ratings and never touches mastery, so retaking it is always safe.
// Credited skills are provisional "practiced" with an FSRS card graded Good, so the first
// spaced review a few days later checks the placement.

import { Rating } from 'ts-fsrs';
import { hasSkill, makeProblem, SKILLS } from '../engine/registry';
import type { Level, Problem } from '../engine/types';
import { builtAncestors } from '../skills/tree';
import { newEventId, type PlacementEvent } from '../storage/events';
import { dateKey, emptySkill, type PlacementRecord, type PlacementResult, type Progress } from '../storage/progress';
import { reviewCard } from './scheduler';

export const PLACEMENT_LEVEL: Level = 3;
export const ITEMS_PER_SKILL = 2;
export const MAX_ITEMS = 24;
/** σ(1.2 − 0) = 0.77 at level 3: "practiced", working level 3. */
export const PLACED_RATING = 1.2;
/** Working level 2, still "learning". */
export const PARTIAL_RATING = 0.2;

export interface PlacementState {
  results: Record<string, PlacementResult>;
  probing?: { skillId: string; asked: number; correct: number };
  items: PlacementRecord['items'];
}

const ancestors = (id: string) => builtAncestors(id, hasSkill);
const NOT_SOLID: PlacementResult[] = ['failed', 'partial', 'blocked'];

export function startPlacement(): PlacementState {
  return { results: Object.fromEntries(SKILLS.map((s) => [s.id, 'untested' as PlacementResult])), items: [] };
}

/** Mark untested skills whose prerequisites aren't solid as blocked. */
function withBlocked(results: Record<string, PlacementResult>): Record<string, PlacementResult> {
  const out = { ...results };
  for (const s of SKILLS) {
    if (out[s.id] === 'untested' && ancestors(s.id).some((a) => NOT_SOLID.includes(out[a]))) out[s.id] = 'blocked';
  }
  return out;
}

/** The middle untested skill (binary search), or none when finished or out of items. */
function pickSkill(st: PlacementState): { results: Record<string, PlacementResult>; next?: string } {
  const results = withBlocked(st.results);
  const untested = SKILLS.map((s) => s.id).filter((id) => results[id] === 'untested');
  if (!untested.length || st.items.length >= MAX_ITEMS) return { results };
  return { results, next: untested[Math.floor((untested.length - 1) / 2)] };
}

export function placementDone(st: PlacementState): boolean {
  return !st.probing && !pickSkill(st).next;
}

/** The next problem, or null when the test is over. */
export function nextPlacementItem(st: PlacementState, seed: number): { state: PlacementState; problem: Problem } | null {
  let state = st;
  if (!state.probing) {
    const { results, next } = pickSkill(state);
    if (!next) return null;
    state = { ...state, results, probing: { skillId: next, asked: 0, correct: 0 } };
  }
  const skill = SKILLS.find((s) => s.id === state.probing!.skillId)!;
  return { state, problem: makeProblem(skill, PLACEMENT_LEVEL, seed) };
}

function finalize(st: PlacementState, id: string, result: PlacementResult): PlacementState {
  const results = { ...st.results, [id]: result };
  if (result === 'passed') {
    // A harder skill passed: its prerequisites are credited (even ones that looked shaky).
    for (const a of ancestors(id)) if (results[a] !== 'passed') results[a] = 'credited';
  }
  return { ...st, results: withBlocked(results), probing: undefined };
}

/** Record an answer. `skipped` = "I don't know": counts as wrong and ends this skill's probe. */
export function answerPlacementItem(st: PlacementState, problem: Problem, correct: boolean, skipped = false): PlacementState {
  if (!st.probing || st.probing.skillId !== problem.skillId) throw new Error('answer does not match the current probe');
  const probing = { ...st.probing, asked: st.probing.asked + 1, correct: st.probing.correct + (correct ? 1 : 0) };
  const state = { ...st, probing, items: [...st.items, { skillId: problem.skillId, problemId: problem.id, correct, skipped }] };
  if (skipped && !correct) return finalize(state, probing.skillId, probing.correct > 0 ? 'partial' : 'failed');
  if (probing.asked < ITEMS_PER_SKILL) return state;
  return finalize(state, probing.skillId, probing.correct === 2 ? 'passed' : probing.correct === 1 ? 'partial' : 'failed');
}

/** Progress through the test, 0..1, for the progress bar. */
export function placementProgress(st: PlacementState): number {
  const total = Object.keys(st.results).length;
  const decided = Object.values(pickSkill(st).results).filter((r) => r !== 'untested').length;
  return total ? decided / total : 1;
}

/** The finished test as an immutable event (stored and synced like any answer). */
export function placementEvent(st: PlacementState, now = new Date()): PlacementEvent {
  return { id: newEventId(), ts: now.getTime(), type: 'placement', results: pickSkill(st).results, items: st.items };
}

/** Apply a placement (mutates `p`). Only raises ratings; never lowers or un-masters anything. */
export function applyPlacementEvent(p: Progress, e: PlacementEvent): void {
  const now = new Date(e.ts);
  const today = dateKey(now);
  for (const [id, result] of Object.entries(e.results)) {
    if (result !== 'passed' && result !== 'credited' && result !== 'partial') continue;
    const sp = p.skills[id] ?? emptySkill();
    sp.rating = Math.max(sp.rating, result === 'partial' ? PARTIAL_RATING : PLACED_RATING);
    sp.placedAt = today;
    if (result !== 'partial' && !sp.fsrs) sp.fsrs = reviewCard(undefined, now, Rating.Good);
    p.skills[id] = sp;
  }
  p.onboarding = 'placed';
  p.placement = { date: today, results: e.results, items: e.items };
}

/** Write the results into a copy of Progress (tests and previews; the app records the event). */
export function applyPlacement(prev: Progress, st: PlacementState, now = new Date()): Progress {
  const p: Progress = structuredClone(prev);
  applyPlacementEvent(p, placementEvent(st, now));
  return p;
}
