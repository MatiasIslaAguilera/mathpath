// Sync with Supabase (supabase/migrations). The app is local-first: everything works offline,
// and a sync pass reconciles whenever we're online and signed in:
//   1. upload outbox events (idempotent upsert by id; events are immutable)
//   2. profile: last-writer-wins by updatedAt
//   3. pull events inserted since our watermark (server time, so device clocks don't matter)
// Merging is a union of events, so two devices used offline never lose each other's work.

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { LearningEvent, Profile } from '../storage/events';
import type { Store } from '../storage/store';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const syncConfigured = !!(URL && ANON_KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  client ??= createClient(URL!, ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mathpath.auth' } });
  return client;
}

export type SyncState = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';
export interface SyncStatus {
  state: SyncState;
  email?: string;
  lastSyncedAt?: number;
  error?: string;
  /** Events waiting to upload. */
  pending: number;
}

// ---------- auth ----------

export async function currentSession(): Promise<Session | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase()!.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

/** Returns an error message, or null. With email confirmation on, the learner must click the emailed link once. */
export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase()!.auth.signUp({ email, password });
  return { error: error ? error.message : null, needsConfirmation: !error && !data.session };
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

// ---------- the sync pass ----------

const META_KEY = 'mathpath.sync';
interface Meta {
  userId: string;
  /** Server inserted_at of the newest event we've pulled (ISO). */
  watermark: string;
  lastSyncedAt?: number;
}
function readMeta(): Meta | null {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function writeMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* next sync just pulls a bit more */
  }
}

const PAGE = 1000;

interface EventRow {
  id: string;
  data: LearningEvent;
  inserted_at: string;
}

/** What a sync pass did. Apply it to the CURRENT store with applySyncResult (storage/store.ts):
 * the learner may have answered more problems while the pass was in flight. */
export interface SyncResult {
  uploaded: string[];
  pulled: LearningEvent[];
  /** The server's profile, when it was newer than ours. */
  remoteProfile?: Profile;
  /** Our profile (as of `profileVersion`) is now on the server. */
  profilePushedAt?: number;
  status: SyncStatus;
}

export async function syncNow(store: Store): Promise<SyncResult> {
  const pending = store.outbox.length;
  const base = { uploaded: [] as string[], pulled: [] as LearningEvent[] };
  const sb = supabase();
  if (!sb) return { ...base, status: { state: 'off', pending } };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ...base, status: { state: 'offline', pending } };
  const session = await currentSession();
  if (!session) return { ...base, status: { state: 'signed-out', pending } };
  const userId = session.user.id;
  const email = session.user.email;
  const result: SyncResult = { ...base, status: { state: 'synced', email, pending: 0 } };

  try {
    // 1. Upload the outbox.
    if (store.outbox.length) {
      const outbox = new Set(store.outbox);
      const rows = store.events
        .filter((e) => outbox.has(e.id))
        .map((e) => ({ id: e.id, user_id: userId, ts: new Date(e.ts).toISOString(), type: e.type, skill_id: 'skillId' in e ? e.skillId : null, data: e }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from('events').upsert(rows.slice(i, i + 500), { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
      }
      result.uploaded = [...outbox];
    }

    // 2. Profile: last writer wins.
    const { data: profRow, error: profErr } = await sb.from('profiles').select('data').eq('user_id', userId).maybeSingle();
    if (profErr) throw profErr;
    const remoteProfile = (profRow?.data ?? null) as Profile | null;
    if (remoteProfile && remoteProfile.updatedAt > store.profile.updatedAt) {
      result.remoteProfile = remoteProfile;
    } else if (store.profileDirty || !remoteProfile) {
      const { error } = await sb.from('profiles').upsert({ user_id: userId, data: store.profile, updated_at: new Date().toISOString() });
      if (error) throw error;
      result.profilePushedAt = store.profile.updatedAt;
    }

    // 3. Pull events inserted since the watermark (>= and dedupe by id, so ties are never missed).
    const meta = readMeta();
    let watermark = meta && meta.userId === userId ? meta.watermark : '1970-01-01T00:00:00Z';
    let newest = watermark;
    for (let guard = 0; guard < 1000; guard++) {
      const { data, error } = await sb
        .from('events')
        .select('id, data, inserted_at')
        .gte('inserted_at', watermark)
        .order('inserted_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PAGE);
      if (error) throw error;
      const rows = (data ?? []) as EventRow[];
      result.pulled.push(...rows.map((r) => r.data));
      const last = rows.at(-1)?.inserted_at;
      if (last) newest = last;
      if (rows.length < PAGE || !last || last === watermark) break; // done, or a full page of ties
      watermark = last;
    }
    const lastSyncedAt = Date.now();
    writeMeta({ userId, watermark: newest, lastSyncedAt });
    result.status = { state: 'synced', email, lastSyncedAt, pending: 0 };
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    return { ...base, status: { state: 'error', email, error: message, pending } };
  }
}
