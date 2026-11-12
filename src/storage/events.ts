// The learning event log: the source of truth for progress, and what syncs between devices.
// Events are immutable and identified by a random id, so merging two devices' logs is a plain
// union. Progress is rebuilt by replaying them in time order (storage/replay.ts).

import type { Level } from '../engine/types';
import type { Help } from '../learning/mastery';
import type { PlacementRecord, PlacementResult, Progress, Settings } from './progress';

interface EventBase {
  id: string;
  /** Milliseconds since epoch on the device that recorded it. */
  ts: number;
}

export interface AttemptEvent extends EventBase {
  type: 'attempt';
  skillId: string;
  problemId: string;
  level: Level;
  correct: boolean;
  help: Help;
  hintsUsed: number;
  input?: string;
  misconception?: string;
  missedSteps: string[];
  retentionCheck?: boolean;
  /** Time from the problem appearing to the answer, excluding time with the app in the background. */
  durationMs?: number;
  /** Lines of working typed on the working pad (any attempt). */
  workingLines?: number;
  /** Wrong attempts only: the lines (mathjs syntax) and the index of the first wrong one. */
  working?: string[];
  workingFirstWrong?: number;
  /**
   * The first answer was wrong (so `correct` is false and `input` is that first answer) and the
   * learner got one more try before the solution showed: true if that second answer was right.
   * Graded like a hinted solve: half XP, FSRS Hard, never raises the rating.
   */
  fixedOnRetry?: boolean;
  /** The second answer, when it was wrong too. */
  retryInput?: string;
}

export interface InterpretationEvent extends EventBase {
  type: 'interpretation';
  skillId: string;
  problemId: string;
  level: Level;
  correct: boolean;
  /** The option id chosen, and which of the problem's interpretation questions it answered. */
  input?: string;
  question?: number;
}

export interface PlacementEvent extends EventBase {
  type: 'placement';
  results: Record<string, PlacementResult>;
  items: PlacementRecord['items'];
  /** A one-skill test-out from the skill tree: credits the skill, leaves the placement record alone. */
  testOut?: boolean;
}

/** Progress recorded before the event log existed (or imported from an old file): replay starts from it. */
export interface BaselineEvent extends EventBase {
  type: 'baseline';
  progress: Progress;
}

export type LearningEvent = AttemptEvent | InterpretationEvent | PlacementEvent | BaselineEvent;

/** Small, last-writer-wins state that isn't history: settings and onboarding. */
export interface Profile {
  settings: Settings;
  onboarding?: 'placed' | 'skipped';
  welcomeShownOn?: string;
  /** Milliseconds since epoch of the last change, for last-writer-wins sync. */
  updatedAt: number;
}

export function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC 4122 v4 fallback for old browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Replay order: by time; at equal times a baseline goes first; then by id, so every device agrees. */
export function sortEvents(events: LearningEvent[]): LearningEvent[] {
  const rank = (e: LearningEvent) => (e.type === 'baseline' ? 0 : 1);
  return [...events].sort((a, b) => a.ts - b.ts || rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Union by id (events are immutable, so duplicates are identical). */
export function mergeEvents(a: LearningEvent[], b: LearningEvent[]): LearningEvent[] {
  const byId = new Map<string, LearningEvent>();
  for (const e of a) byId.set(e.id, e);
  for (const e of b) if (!byId.has(e.id)) byId.set(e.id, e);
  return sortEvents([...byId.values()]);
}

export const newerProfile = (a: Profile, b: Profile): Profile => (b.updatedAt > a.updatedAt ? b : a);
