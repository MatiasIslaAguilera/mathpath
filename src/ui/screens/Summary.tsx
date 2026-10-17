import { getSkill } from '../../engine/registry';
import { nextLevel } from '../../learning/mastery';
import type { SkillEvent } from '../../learning/record';
import { todaysAgenda, type Session } from '../../learning/session';
import { currentStreak } from '../../learning/streak';
import { addDays } from '../../learning/states';
import { dateKey, emptySkill, type Progress } from '../../storage/progress';
import { shortDate } from '../shortDate';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One level-up per skill: only the highest counts. */
function dedupeLevelUps(events: SkillEvent[]): SkillEvent[] {
  const top = new Map<string, number>();
  for (const e of events) if (e.type === 'level-up') top.set(e.skillId, Math.max(top.get(e.skillId) ?? 0, e.level));
  const seen = new Set<string>();
  return events.filter((e) => {
    if (e.type !== 'level-up') return true;
    if (e.level !== top.get(e.skillId) || seen.has(e.skillId)) return false;
    seen.add(e.skillId);
    return true;
  });
}

function EventMessage({ event }: { event: SkillEvent }) {
  const title = getSkill(event.skillId).title;
  switch (event.type) {
    case 'mastered':
      return (
        <div className="callout good" data-testid="event-mastered">
          <strong>Mastered: {title}</strong>
          <div>You solved it cold, days later, without help. That's real memory, not just practice.</div>
        </div>
      );
    case 'check-failed':
      return (
        <div className="callout info" data-testid="event-check-failed">
          The memory check on {title} didn't stick this time. That's normal: it comes back on {shortDate(event.retryOn)}, and a few spaced reviews usually fix it.
        </div>
      );
    case 'check-scheduled':
      return (
        <div className="callout info" data-testid="event-check-scheduled">
          {title}: memory check scheduled for {shortDate(event.due)}. You solved a level-4 problem on your own; the check confirms it stuck.
        </div>
      );
    case 'practiced':
      return (
        <div className="callout info" data-testid="event-practiced">
          {title} is now Practiced.
        </div>
      );
    case 'level-up':
      return (
        <div className="callout info" data-testid="event-level-up">
          {title} → level {event.level}
        </div>
      );
    case 'rusty':
      return (
        <div className="callout info" data-testid="event-rusty">
          {title} needs a refresh. It's back in your reviews at an easier level.
        </div>
      );
    case 'recovered':
      return (
        <div className="callout good" data-testid="event-recovered">
          {title} is back to Mastered.
        </div>
      );
  }
}

export function Summary({ session, progress, onHome }: { session: Session; progress: Progress; onHome(): void }) {
  const streak = currentStreak(progress.days);
  const events = dedupeLevelUps(session.events);

  // Tomorrow's agenda, from the progress as it stands now.
  const tomorrow = addDays(dateKey(), 1);
  const [ty, tm, td] = tomorrow.split('-').map(Number);
  const agenda = todaysAgenda(progress, new Date(ty, tm - 1, td, 12));
  const current = session.currentSkill ? getSkill(session.currentSkill) : undefined;
  const level = session.currentSkill ? nextLevel((progress.skills[session.currentSkill] ?? emptySkill()).rating) : 0;
  const parts = [
    agenda.reviewsDue.length ? plural(agenda.reviewsDue.length, 'review') : '',
    agenda.retentionChecks.length ? plural(agenda.retentionChecks.length, 'memory check') : '',
  ].filter(Boolean);
  const lead = parts.join(' + ');

  return (
    <div className="screen summary" data-testid="summary">
      <div className="card center">
        <h1>Session done</h1>
        <p className="big-number">{session.answered}</p>
        <p>problems · {session.correct} solved on your own · {session.xp} XP</p>
        {streak > 0 && <p className="streak-line">🔥 {streak} day streak</p>}
      </div>
      {events.length > 0 && (
        <div className="events" data-testid="events">
          {events.map((e, i) => (
            <EventMessage key={i} event={e} />
          ))}
        </div>
      )}
      <div className="card">
        <h2>Tomorrow</h2>
        <p data-testid="tomorrow">
          {current ? (
            <>
              {lead ? `${lead[0].toUpperCase()}${lead.slice(1)}, then continue ` : 'Continue '}
              <strong>{current.title}</strong> at level {level}.
            </>
          ) : (
            <>Mixed review{lead ? ` (${lead})` : ''}.</>
          )}{' '}
          One tap from the home screen.
        </p>
      </div>
      <button className="btn primary wide" onClick={onHome} data-testid="home">
        Back to home
      </button>
    </div>
  );
}
