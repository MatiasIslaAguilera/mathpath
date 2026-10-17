// The app's single source of state: the event log + profile (persisted locally, synced to the
// server), and the Progress derived from them. Screens never set Progress directly: they record
// events or update the profile.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, syncNow, type SyncStatus } from '../sync/sync';
import type { LearningEvent, Profile } from './events';
import type { Progress } from './progress';
import { overlayProfile } from './replay';
import { addEvents, applySyncResult, exportFile, loadStore, mergeIn, parseImport, progressOf, saveStore, updateProfile, type Store } from './store';

export interface LearningActions {
  /** New events, plus the Progress the caller already computed by applying them. */
  record(events: LearningEvent[], next: Progress): void;
  updateProfile(patch: Partial<Omit<Profile, 'updatedAt'>>): void;
  /** Merge an exported file (old or new format). Throws ProgressFormatError on bad input. */
  importText(text: string): void;
  exportJson(): string;
  syncNow(): void;
}

const SYNC_EVERY_MS = 2 * 60 * 1000;
const SYNC_AFTER_ANSWER_MS = 2000;

export function useLearningStore(): { progress: Progress; status: SyncStatus; storageOk: boolean; actions: LearningActions } {
  const [state, setState] = useState(() => {
    const store = loadStore();
    return { store, progress: progressOf(store) };
  });
  const [status, setStatus] = useState<SyncStatus>({ state: 'off', pending: state.store.outbox.length });
  const [storageOk, setStorageOk] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setStorageOk(saveStore(state.store)), [state.store]);

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setStatus((s) => ({ ...s, state: s.state === 'off' ? 'off' : 'syncing' }));
    try {
      const result = await syncNow(stateRef.current.store);
      setState((cur) => {
        const { store, changed } = applySyncResult(cur.store, result);
        return { store, progress: changed ? progressOf(store) : cur.progress };
      });
      setStatus({ ...result.status, pending: Math.max(0, stateRef.current.store.outbox.length - result.uploaded.length) });
    } finally {
      syncing.current = false;
    }
  }, []);

  const syncSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(runSync, SYNC_AFTER_ANSWER_MS);
  }, [runSync]);

  // Sync on load, when coming back online or to the app, on sign-in/out, and periodically.
  useEffect(() => {
    void runSync();
    const onVisible = () => document.visibilityState === 'visible' && void runSync();
    const onOnline = () => void runSync();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => document.visibilityState === 'visible' && void runSync(), SYNC_EVERY_MS);
    const sub = supabase()?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void runSync();
    });
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      clearTimeout(timer.current);
      sub?.data.subscription.unsubscribe();
    };
  }, [runSync]);

  const actions: LearningActions = {
    record: (events, next) => {
      setState((cur) => ({ store: addEvents(cur.store, events), progress: next }));
      syncSoon();
    },
    updateProfile: (patch) => {
      setState((cur) => {
        const store = updateProfile(cur.store, patch);
        return { store, progress: overlayProfile(structuredClone(cur.progress), store.profile) };
      });
      syncSoon();
    },
    importText: (text) => {
      const { events, profile } = parseImport(text); // throws on bad input, before touching state
      setState((cur) => {
        const merged = mergeIn(cur.store, events, { ...profile, updatedAt: Date.now() });
        const known = new Set(cur.store.events.map((e) => e.id));
        const store: Store = { ...merged.store, outbox: [...merged.store.outbox, ...events.filter((e) => !known.has(e.id)).map((e) => e.id)], profileDirty: true };
        return { store, progress: progressOf(store) };
      });
      syncSoon();
    },
    exportJson: () => JSON.stringify(exportFile(stateRef.current.store), null, 2),
    syncNow: () => void runSync(),
  };

  return { progress: state.progress, status, storageOk, actions };
}
