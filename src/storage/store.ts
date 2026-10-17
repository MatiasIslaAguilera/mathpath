// Local persistence for the event log, the profile, and the outbox of events not yet synced.
// localStorage only (wrapped: private mode / quota never crash the app). The server copy
// (sync/sync.ts) is the durable one; locally we keep everything needed to work offline.

import { mergeEvents, newerProfile, newEventId, type BaselineEvent, type LearningEvent, type Profile } from './events';
import { emptyProgress, migrate, ProgressFormatError, STORAGE_KEY as LEGACY_KEY, type Progress } from './progress';
import { rebuild } from './replay';

const KEYS = {
  events: 'mathpath.events',
  profile: 'mathpath.profile',
  outbox: 'mathpath.outbox',
};

export interface Store {
  /** Every learning event, sorted for replay. */
  events: LearningEvent[];
  profile: Profile;
  /** Ids of events not yet uploaded. */
  outbox: string[];
  /** The profile changed since the last upload. */
  profileDirty: boolean;
}

export const defaultProfile = (): Profile => ({ settings: emptyProgress().settings, updatedAt: 0 });

const memory = new Map<string, string>();
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function write(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function parse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * A baseline event + profile from an old (pre-event-log) Progress object. The baseline is
 * stamped with when that progress BEGAN, so it replays before every event-log answer, from any
 * device (e.g. the phone used before this PC migrated its old data).
 */
export function fromLegacy(progress: Progress, now = Date.now()): { baseline: BaselineEvent; profile: Profile } {
  const began = Date.parse(progress.createdAt);
  const baseline: BaselineEvent = { id: newEventId(), ts: Number.isFinite(began) ? began : 0, type: 'baseline', progress };
  const profile: Profile = { settings: progress.settings, onboarding: progress.onboarding, welcomeShownOn: progress.welcomeShownOn, updatedAt: now };
  return { baseline, profile };
}

export function loadStore(): Store {
  const eventsText = read(KEYS.events);
  if (eventsText === null) {
    // First run with the event log: carry over progress saved by earlier versions.
    const legacyText = read(LEGACY_KEY);
    if (legacyText) {
      try {
        const { baseline, profile } = fromLegacy(migrate(JSON.parse(legacyText)));
        const store: Store = { events: [baseline], profile, outbox: [baseline.id], profileDirty: true };
        saveStore(store);
        write(`${LEGACY_KEY}.migrated`, legacyText); // keep the original, just in case
        return store;
      } catch {
        /* unreadable legacy data: start fresh (the original stays in localStorage untouched) */
      }
    }
    return { events: [], profile: defaultProfile(), outbox: [], profileDirty: false };
  }
  const events = parse<LearningEvent[]>(eventsText, []);
  const profile = { ...defaultProfile(), ...parse<Partial<Profile>>(read(KEYS.profile), {}) } as Profile;
  profile.settings = { ...defaultProfile().settings, ...profile.settings };
  const outboxState = parse<{ ids: string[]; profileDirty: boolean }>(read(KEYS.outbox), { ids: [], profileDirty: false });
  return { events: Array.isArray(events) ? events : [], profile, outbox: outboxState.ids ?? [], profileDirty: !!outboxState.profileDirty };
}

/** Returns false if the browser refused to store (the app keeps working from memory). */
export function saveStore(s: Store): boolean {
  const ok1 = write(KEYS.events, JSON.stringify(s.events));
  const ok2 = write(KEYS.profile, JSON.stringify(s.profile));
  const ok3 = write(KEYS.outbox, JSON.stringify({ ids: s.outbox, profileDirty: s.profileDirty }));
  return ok1 && ok2 && ok3;
}

export const progressOf = (s: Store): Progress => rebuild(s.events, s.profile);

/** Record new events (already applied to the caller's Progress). */
export function addEvents(s: Store, events: LearningEvent[]): Store {
  return { ...s, events: mergeEvents(s.events, events), outbox: [...s.outbox, ...events.map((e) => e.id)] };
}

export function updateProfile(s: Store, patch: Partial<Omit<Profile, 'updatedAt'>>, now = Date.now()): Store {
  return { ...s, profile: { ...s.profile, ...patch, updatedAt: Math.max(now, s.profile.updatedAt + 1) }, profileDirty: true };
}

/** Merge events/profile from elsewhere (the server or an imported file). */
export function mergeIn(s: Store, events: LearningEvent[], profile?: Profile): { store: Store; changed: boolean } {
  const known = new Set(s.events.map((e) => e.id));
  const fresh = events.filter((e) => !known.has(e.id));
  const nextProfile = profile ? newerProfile(s.profile, profile) : s.profile;
  const changed = fresh.length > 0 || nextProfile !== s.profile;
  if (!changed) return { store: s, changed };
  return { store: { ...s, events: mergeEvents(s.events, fresh), profile: nextProfile }, changed };
}

/**
 * Fold a finished sync pass into the CURRENT store (which may have new events since the pass
 * started): drop uploaded ids from the outbox, union pulled events, adopt a newer remote profile.
 */
export function applySyncResult(
  s: Store,
  r: { uploaded: string[]; pulled: LearningEvent[]; remoteProfile?: Profile; profilePushedAt?: number },
): { store: Store; changed: boolean } {
  const uploaded = new Set(r.uploaded);
  let next: Store = { ...s, outbox: s.outbox.filter((id) => !uploaded.has(id)) };
  // Profile pushed, and not edited again since: clean.
  if (r.profilePushedAt !== undefined && next.profile.updatedAt === r.profilePushedAt) next = { ...next, profileDirty: false };
  const merged = mergeIn(next, r.pulled, r.remoteProfile);
  next = merged.store;
  if (r.remoteProfile && next.profile === r.remoteProfile) next = { ...next, profileDirty: false };
  return { store: next, changed: merged.changed };
}

// ---------- export / import (progress.json) ----------

export const EXPORT_FORMAT = 'mathpath-progress';

export interface ExportFileV2 {
  format: typeof EXPORT_FORMAT;
  version: 2;
  exportedAt: string;
  profile: Profile;
  events: LearningEvent[];
  /** The derived Progress, for reading and analysis (CLAUDE.md workflow). Ignored on import. */
  progress: Progress;
}

export function exportFile(s: Store): ExportFileV2 {
  return { format: EXPORT_FORMAT, version: 2, exportedAt: new Date().toISOString(), profile: s.profile, events: s.events, progress: progressOf(s) };
}

/** Parse an exported file: the current format, or an old v1 progress file (becomes a baseline). */
export function parseImport(text: string): { events: LearningEvent[]; profile: Profile } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProgressFormatError("That file isn't valid JSON.");
  }
  const obj = raw as Partial<ExportFileV2> & { version?: unknown };
  if (obj && obj.format === EXPORT_FORMAT && obj.version === 2) {
    if (!Array.isArray(obj.events) || !obj.profile) throw new ProgressFormatError('Progress file is missing required sections.');
    return { events: obj.events, profile: obj.profile };
  }
  if (obj && typeof obj === 'object') delete (obj as Record<string, unknown>).exportedAt;
  const { baseline, profile } = fromLegacy(migrate(raw));
  return { events: [baseline], profile };
}
