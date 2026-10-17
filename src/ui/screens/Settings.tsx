import { useRef, useState, type FormEvent } from 'react';
import { dailyReminderIcs } from '../../reminders/ics';
import { notificationsSupported, requestNotificationPermission } from '../../reminders/notify';
import type { Profile } from '../../storage/events';
import { signIn, signOut, signUp, syncConfigured, type SyncStatus } from '../../sync/sync';
import { downloadText, exportFileName } from '../../storage/exportImport';
import type { Progress } from '../../storage/progress';
import { shortDate } from '../shortDate';

const GOALS = [3, 5, 10, 15];

function ago(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function stateLine(s: SyncStatus): string {
  switch (s.state) {
    case 'synced':
      return s.lastSyncedAt ? `Synced · ${ago(s.lastSyncedAt)}` : 'Synced';
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return s.pending > 0 ? `Offline · ${s.pending} answer${s.pending === 1 ? '' : 's'} waiting to upload` : 'Offline · everything is saved on this device';
    default:
      return `Couldn't sync: ${s.error ?? 'unknown error'}. Your progress is safe on this device and will upload later.`;
  }
}

/** Sign-in form or signed-in status, depending on the sync state. */
function SyncCard({ status, onSyncNow }: { status: SyncStatus; onSyncNow(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (create: boolean) => {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      if (create) {
        const r = await signUp(email.trim(), password);
        if (r.error) return setError(r.error);
        if (r.needsConfirmation) return setNote('Check your email and tap the confirmation link, then sign in here.');
      } else {
        const err = await signIn(email.trim(), password);
        if (err) return setError(err);
      }
      setPassword('');
      onSyncNow();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      onSyncNow();
    }
  };

  let body;
  if (!syncConfigured) {
    body = (
      <p className="fine" data-testid="sync-off">
        Sync isn't set up in this build, so progress is saved on this device only.
      </p>
    );
  } else if (status.state === 'signed-out') {
    body = (
      <form
        className="sync-form"
        data-testid="sign-in-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <input type="email" className="text-input" placeholder="Email" aria-label="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          className="text-input"
          placeholder="Password (8+ characters)"
          aria-label="Password"
          autoComplete="current-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="btn-row">
          <button type="submit" className="btn primary" disabled={busy}>
            Sign in
          </button>
          <button type="button" className="btn" disabled={busy || !email || password.length < 8} onClick={() => void submit(true)}>
            Create account
          </button>
        </div>
        {error && (
          <p className="input-error" role="alert">
            {error}
          </p>
        )}
        {note && (
          <p className="fine" role="status">
            {note}
          </p>
        )}
        <p className="fine">
          Sign in on your phone and your computer with the same account and your progress follows you. It also works offline and catches up later.
        </p>
      </form>
    );
  } else {
    body = (
      <>
        <p className="sync-email">{status.email}</p>
        <p className={`fine${status.state === 'error' ? ' input-error' : ''}`} data-testid="sync-state" role="status">
          {stateLine(status)}
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={onSyncNow} disabled={status.state === 'syncing'}>
            Sync now
          </button>
          <button className="btn" onClick={() => void leave()} disabled={busy}>
            Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <section className="card" data-testid="sync-card">
      <h2>Account &amp; sync</h2>
      {body}
    </section>
  );
}

interface Props {
  progress: Progress;
  updateProfile(patch: Partial<Omit<Profile, 'updatedAt'>>): void;
  importText(text: string): void;
  exportJson(): string;
  syncStatus: SyncStatus;
  onSyncNow(): void;
  onPlacement(): void;
  onBack(): void;
}

export function Settings({ progress, updateProfile, importText, exportJson, syncStatus, onSyncNow, onPlacement, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [time, setTime] = useState(progress.settings.reminderTime ?? '19:00');
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  const saveSettings = (patch: Partial<Progress['settings']>) => updateProfile({ settings: { ...progress.settings, ...patch } });

  const onTime = (value: string) => {
    setTime(value);
    if (value) saveSettings({ reminderTime: value });
  };

  /** Download a daily-repeating calendar event (the reminder that works with the app closed). */
  const addToCalendar = () => {
    if (!time) return;
    const ics = dailyReminderIcs({ time, appUrl: location.origin + location.pathname });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mathpath-reminder.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveSettings({ reminderTime: time });
    setReminderNote('Reminder file ready. Open it to add it to your calendar.');
  };

  const onInApp = async (on: boolean) => {
    setReminderNote(null);
    if (!on) return saveSettings({ inAppReminder: false });
    if (await requestNotificationPermission()) saveSettings({ inAppReminder: true, reminderTime: time || progress.settings.reminderTime });
    else setReminderNote("Notifications are blocked for this site. That's okay: the calendar reminder works without them.");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (!window.confirm('Merge this file into your progress?')) return;
      importText(text);
      setMessage({ ok: true, text: 'Progress imported.' });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="screen settings">
      <header className="home-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1>Settings</h1>
        <span />
      </header>

      <SyncCard status={syncStatus} onSyncNow={onSyncNow} />

      <section className="card">
        <h2>Daily goal</h2>
        <p className="fine">Any day with 3+ problems counts for your streak. The goal is just a target.</p>
        <div className="seg" role="radiogroup" aria-label="Daily goal">
          {GOALS.map((g) => (
            <button
              key={g}
              role="radio"
              aria-checked={progress.settings.dailyGoal === g}
              className={`seg-btn ${progress.settings.dailyGoal === g ? 'selected' : ''}`}
              onClick={() => saveSettings({ dailyGoal: g })}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <section className="card" data-testid="reminder-card">
        <h2>Daily reminder</h2>
        <label className="field-row">
          <span>Remind me at</span>
          <input type="time" className="time-input" value={time} onChange={(e) => onTime(e.target.value)} data-testid="reminder-time" />
        </label>
        <div className="btn-row">
          <button className="btn primary" onClick={addToCalendar} disabled={!time} data-testid="reminder-ics">
            Add to my calendar
          </button>
        </div>
        <p className="fine">
          Your phone's calendar will remind you every day at this time, even when the app is closed. Importing it again later replaces the old
          one.
        </p>
        {notificationsSupported() && (
          <>
            <label className="check-row">
              <input type="checkbox" checked={!!progress.settings.inAppReminder} onChange={(e) => onInApp(e.target.checked)} data-testid="reminder-inapp" />
              <span>Also notify me while the app is open</span>
            </label>
            <p className="fine">Best effort: browsers can only notify while the app is running.</p>
          </>
        )}
        {reminderNote && (
          <p className="fine" role="status">
            {reminderNote}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Placement test</h2>
        <p className="fine">Retake it anytime. It only moves you forward; it never lowers a skill you've practiced.</p>
        {progress.placement && <p className="fine">Last taken {shortDate(progress.placement.date)}</p>}
        <div className="btn-row">
          <button className="btn" onClick={onPlacement} data-testid="retake-placement">
            Retake placement test
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="fine">
          Export a copy of everything (your full answer history and stats) as a file. Useful as an extra backup, or to share with Claude for a
          weak-spot analysis.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => downloadText(exportJson(), exportFileName())} data-testid="export">
            Export progress.json
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {message && (
          <p className={message.ok ? 'ok-text' : 'input-error'} role="status">
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
