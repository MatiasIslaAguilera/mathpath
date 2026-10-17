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
}

export interface InterpretationEvent extends EventBase {
  type: 'interpretation';
  skillId: string;
  problemId: string;
  level: Level;
  correct: boolean;
}

export interface PlacementEvent extends EventBase {
  type: 'placement';
  results: Record<string, PlacementResult>;
  items: PlacementRecord['items'];
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

/** Replay order: by time, ties broken by id so every device replays identically. */
export function sortEvents(events: LearningEvent[]): LearningEvent[] {
  return [...events].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Union by id (events are immutable, so duplicates are identical). */
export function mergeEvents(a: LearningEvent[], b: LearningEvent[]): LearningEvent[] {
  const byId = new Map<string, LearningEvent>();
  for (const e of a) byId.set(e.id, e);
  for (const e of b) if (!byId.has(e.id)) byId.set(e.id, e);
  return sortEvents([...byId.values()]);
}

export const newerProfile = (a: Profile, b: Profile): Profile => (b.updatedAt > a.updatedAt ? b : a);
