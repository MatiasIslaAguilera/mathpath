import { useRef, useState } from 'react';
import { dailyReminderIcs } from '../../reminders/ics';
import { notificationsSupported, requestNotificationPermission } from '../../reminders/notify';
import { downloadProgress, parseProgressFile } from '../../storage/exportImport';
import type { Progress } from '../../storage/progress';
import { shortDate } from '../shortDate';

const GOALS = [3, 5, 10, 15];

interface Props {
  progress: Progress;
  setProgress(p: Progress): void;
  onPlacement(): void;
  onBack(): void;
}

export function Settings({ progress, setProgress, onPlacement, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [time, setTime] = useState(progress.settings.reminderTime ?? '19:00');
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  const saveSettings = (patch: Partial<Progress['settings']>) => setProgress({ ...progress, settings: { ...progress.settings, ...patch } });

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
      const next = parseProgressFile(await file.text());
      if (!window.confirm('Replace your current progress with this file?')) return;
      setProgress(next);
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
              onClick={() => setProgress({ ...progress, settings: { ...progress.settings, dailyGoal: g } })}
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
          Your progress lives only in this browser. Export it now and then. The file also contains your mistake log, which you can drop into
          the repo for weak-spot analysis.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => downloadProgress(progress)} data-testid="export">
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
