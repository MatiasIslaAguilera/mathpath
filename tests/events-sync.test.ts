// The event log is the source of truth. These tests check that:
//   - live (incremental) progress == a full rebuild from the log
//   - merging two devices' logs is order-independent and loses nothing
//   - legacy progress migrates intact, and import/export round-trips
//   - a full sync pass against a fake Supabase converges two devices

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProblem, SKILLS } from '../src/engine/registry';
import type { Level } from '../src/engine/types';
import { recordAttempt, recordInterpretation } from '../src/learning/record';
import { mergeEvents, type LearningEvent, type Profile } from '../src/storage/events';
import { emptyProgress, emptySkill, STORAGE_KEY, type Progress } from '../src/storage/progress';
import { rebuild } from '../src/storage/replay';
import { addEvents, applySyncResult, defaultProfile, exportFile, loadStore, parseImport, progressOf, type Store } from '../src/storage/store';

// Node has no localStorage: a minimal in-memory one for the store and sync metadata.
if (typeof globalThis.localStorage === 'undefined') {
  const data = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

const HELPS = ['none', 'none', 'none', 'hint', 'guided', 'reveal'] as const;
const PROFILE: Profile = { ...defaultProfile(), updatedAt: 1 };

/** Simulate a learner: a list of (day offset, skill, level, correct, help) answered live. */
const attemptArb = fc.record({
  day: fc.integer({ min: 0, max: 30 }),
  minute: fc.integer({ min: 0, max: 600 }),
  skill: fc.integer({ min: 0, max: SKILLS.length - 1 }),
  level: fc.integer({ min: 1, max: 5 }),
  correct: fc.boolean(),
  help: fc.integer({ min: 0, max: HELPS.length - 1 }),
  interp: fc.boolean(),
});

function playLive(attempts: fc.infer<typeof attemptArb>[]) {
  // Live play happens in time order.
  const sorted = [...attempts].sort((a, b) => a.day * 1000 + a.minute - (b.day * 1000 + b.minute));
  let progress: Progress = rebuild([], PROFILE);
  const events: LearningEvent[] = [];
  sorted.forEach((a, i) => {
    const when = new Date(2026, 8, 1 + a.day, 8, a.minute, i % 60);
    const problem = makeProblem(SKILLS[a.skill], a.level as Level, 1000 + i);
    const r = recordAttempt(progress, { problem, correct: a.correct, help: HELPS[a.help], hintsUsed: 0, missedSteps: a.correct ? [] : ['x'], misconception: a.correct ? undefined : 'm' }, when);
    progress = r.progress;
    events.push(r.logged);
    if (a.interp) {
      const ri = recordInterpretation(progress, problem, a.correct, new Date(when.getTime() + 1));
      progress = ri.progress;
      events.push(ri.logged);
    }
  });
  return { progress, events };
}

describe('event log', () => {
  it('live progress equals a full rebuild from the events', () => {
    fc.assert(
      fc.property(fc.array(attemptArb, { maxLength: 60 }), (attempts) => {
        const { progress, events } = playLive(attempts);
        const rebuilt = rebuild(events, PROFILE);
        expect({ ...rebuilt, createdAt: '' }).toEqual({ ...progress, createdAt: '' });
      }),
      { numRuns: 60 },
    );
  });

  it('merging two devices is order-independent, idempotent, and equals one combined history', () => {
    fc.assert(
      fc.property(fc.array(attemptArb, { maxLength: 30 }), fc.array(attemptArb, { maxLength: 30 }), (a, b) => {
        const A = playLive(a).events;
        const B = playLive(b).events;
        const ab = mergeEvents(A, B);
        const ba = mergeEvents(B, A);
        expect(ab).toEqual(ba);
        expect(mergeEvents(ab, A)).toEqual(ab);
        expect(ab).toHaveLength(A.length + B.length);
        expect(rebuild(ab, PROFILE).days).toEqual(rebuild(ba, PROFILE).days);
        // Nothing lost: every problem from both devices is counted.
        const total = Object.values(rebuild(ab, PROFILE).days).reduce((n, d) => n + d.problems, 0);
        expect(total).toBe(a.length + b.length);
      }),
      { numRuns: 40 },
    );
  });
});

describe('store', () => {
  beforeEach(() => localStorage.clear());

  it('migrates progress saved by earlier versions into a baseline event, keeping everything', () => {
    let legacy = emptyProgress();
    legacy.skills['linear-equations'] = { ...emptySkill(), rating: 1.7, attempts: 12, correctUnassisted: 9 };
    legacy.days = { '2026-10-15': { problems: 8, xp: 120 } };
    legacy.xp = 120;
    legacy.settings.dailyGoal = 5;
    legacy.onboarding = 'skipped';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const s = loadStore();
    expect(s.events).toHaveLength(1);
    expect(s.events[0].type).toBe('baseline');
    expect(s.outbox).toEqual([s.events[0].id]); // it will upload on first sync
    const p = progressOf(s);
    expect(p.skills['linear-equations'].rating).toBe(1.7);
    expect(p.days).toEqual(legacy.days);
    expect(p.xp).toBe(120);
    expect(p.settings.dailyGoal).toBe(5);
    expect(p.onboarding).toBe('skipped');
    // And later answers apply on top of the baseline.
    const problem = makeProblem(SKILLS[0], 1, 1);
    const r = recordAttempt(p, { problem, correct: true, help: 'none', hintsUsed: 0, missedSteps: [] });
    const s2 = addEvents(s, [r.logged]);
    expect(progressOf(s2).xp).toBe(130);
    legacy = emptyProgress();
  });

  it('export → import round-trips; old v1 files still import', () => {
    const { events } = playLive([{ day: 1, minute: 3, skill: 0, level: 2, correct: true, help: 0, interp: false }]);
    const store: Store = { events, profile: PROFILE, outbox: [], profileDirty: false };
    const back = parseImport(JSON.stringify(exportFile(store)));
    expect(back.events).toEqual(events);
    const v1 = { ...progressOf(store), exportedAt: 'x' };
    const fromV1 = parseImport(JSON.stringify(v1));
    expect(fromV1.events[0].type).toBe('baseline');
    expect(() => parseImport('{"version": 99}')).toThrow();
  });

  it('a sync result never drops answers recorded while the sync was in flight', () => {
    const { events } = playLive([
      { day: 1, minute: 1, skill: 0, level: 1, correct: true, help: 0, interp: false },
      { day: 1, minute: 2, skill: 0, level: 1, correct: true, help: 0, interp: false },
    ]);
    const before: Store = { events: [events[0]], profile: PROFILE, outbox: [events[0].id], profileDirty: false };
    const during = addEvents(before, [events[1]]); // answered while the pass was running
    const { store } = applySyncResult(during, { uploaded: [events[0].id], pulled: [events[0]] });
    expect(store.events.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(store.outbox).toEqual([events[1].id]);
  });
});

// ---------- full sync against a fake Supabase ----------

interface Row {
  id: string;
  user_id: string;
  data: unknown;
  inserted_at: string;
}
const server = { events: [] as Row[], profiles: new Map<string, unknown>(), clock: 0 };

function fakeQuery(table: string) {
  let rows: Row[] = [];
  const q = {
    upsert(input: Record<string, unknown> | Record<string, unknown>[]) {
      const list = Array.isArray(input) ? input : [input];
      for (const r of list) {
        if (table === 'events') {
          if (!server.events.some((e) => e.id === r.id)) {
            server.clock += 1;
            server.events.push({ id: r.id as string, user_id: r.user_id as string, data: r.data, inserted_at: new Date(1_800_000_000_000 + server.clock).toISOString() });
          }
        } else server.profiles.set(r.user_id as string, r.data);
      }
      return Promise.resolve({ error: null });
    },
    select() {
      rows = [...server.events];
      return q;
    },
    eq(_col: string, userId: string) {
      const data = server.profiles.get(userId);
      return { maybeSingle: () => Promise.resolve({ data: data ? { data } : null, error: null }) };
    },
    gte(_col: string, value: string) {
      rows = rows.filter((r) => r.inserted_at >= value);
      return q;
    },
    order() {
      rows.sort((a, b) => (a.inserted_at < b.inserted_at ? -1 : a.inserted_at > b.inserted_at ? 1 : a.id < b.id ? -1 : 1));
      return q;
    },
    limit(n: number) {
      return Promise.resolve({ data: rows.slice(0, n), error: null });
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => fakeQuery(table),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1', email: 'me@example.com' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  }),
}));

describe('sync pass (fake Supabase)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.resetModules();
    server.events = [];
    server.profiles.clear();
    server.clock = 0;
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('two devices used separately converge to the same progress', async () => {
    const { syncNow } = await import('../src/sync/sync');
    const phone = playLive([
      { day: 2, minute: 10, skill: 0, level: 1, correct: true, help: 0, interp: false },
      { day: 3, minute: 10, skill: 0, level: 2, correct: false, help: 0, interp: false },
    ]);
    const pc = playLive([{ day: 2, minute: 30, skill: 0, level: 1, correct: true, help: 3, interp: true }]);
    let storePhone: Store = { events: phone.events, profile: { ...PROFILE, settings: { dailyGoal: 5 }, updatedAt: 50 }, outbox: phone.events.map((e) => e.id), profileDirty: true };
    let storePC: Store = { events: pc.events, profile: PROFILE, outbox: pc.events.map((e) => e.id), profileDirty: false };

    // Each device keeps its own watermark in its own localStorage: simulate with clears.
    const sync = async (s: Store, meta: string | null) => {
      localStorage.clear();
      if (meta) localStorage.setItem('mathpath.sync', meta);
      const r = await syncNow(s);
      expect(r.status.state).toBe('synced');
      return { store: applySyncResult(s, r).store, meta: localStorage.getItem('mathpath.sync') };
    };
    let phoneMeta: string | null = null;
    let pcMeta: string | null = null;
    ({ store: storePhone, meta: phoneMeta } = await sync(storePhone, phoneMeta));
    ({ store: storePC, meta: pcMeta } = await sync(storePC, pcMeta));
    ({ store: storePhone, meta: phoneMeta } = await sync(storePhone, phoneMeta));

    expect(server.events).toHaveLength(phone.events.length + pc.events.length);
    expect(storePhone.outbox).toEqual([]);
    expect(storePC.outbox).toEqual([]);
    expect(progressOf(storePhone)).toEqual(progressOf(storePC));
    expect(progressOf(storePC).settings.dailyGoal).toBe(5); // the newer profile won everywhere
    expect(Object.values(progressOf(storePC).days).reduce((n, d) => n + d.problems, 0)).toBe(3);

    // Idempotent: syncing again changes nothing and uploads nothing new.
    const before = server.events.length;
    ({ store: storePC } = await sync(storePC, pcMeta));
    expect(server.events.length).toBe(before);
    void phoneMeta;
  });
});
