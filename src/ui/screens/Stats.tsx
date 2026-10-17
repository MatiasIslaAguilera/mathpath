import { getSkill } from '../../engine/registry';
import { skillStats, streakCalendar, topMisconceptions, topMissedSteps, weakestSkills } from '../../learning/stats';
import { MIN_SESSION, streakReport } from '../../learning/streak';
import { dateKey, type Progress } from '../../storage/progress';
import { MathText } from '../components/MathText';
import { shortDate } from '../shortDate';

interface Props {
  progress: Progress;
  onPractice(skillId: string): void;
  onBack(): void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Stats({ progress, onPractice, onBack }: Props) {
  const report = streakReport(progress.days);
  const calendar = streakCalendar(progress);
  const todayKey = dateKey();
  const skills = skillStats(progress);
  const weakest = weakestSkills(progress);
  const missedSteps = topMissedSteps(progress);
  const misconceptions = topMisconceptions(progress);

  return (
    <div className="screen stats">
      <header className="home-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1>Stats</h1>
        <span />
      </header>

      <section className="card">
        <h2>Streak</h2>
        <dl className="kv">
          <div>
            <dt>Current</dt>
            <dd>{plural(report.current, 'day')}</dd>
          </div>
          <div>
            <dt>Longest</dt>
            <dd>{plural(report.longest, 'day')}</dd>
          </div>
          <div>
            <dt>Freezes held</dt>
            <dd>❄ {report.freezes}</dd>
          </div>
          <div>
            <dt>Days practiced</dt>
            <dd>{report.totalDays}</dd>
          </div>
          <div>
            <dt>This week</dt>
            <dd>{report.lastSevenDays}/7</dd>
          </div>
        </dl>
        <div className="cal" data-testid="streak-calendar">
          {WEEKDAYS.map((d) => (
            <span key={d} className="cal-head">
              {d}
            </span>
          ))}
          {calendar.map((d) => {
            const kind = d.future ? 'future' : d.frozen ? 'frozen' : d.counted ? 'counted' : d.problems > 0 ? 'some' : 'empty';
            const title = d.future ? shortDate(d.date) : d.frozen ? `${shortDate(d.date)}: streak freeze` : `${shortDate(d.date)}: ${plural(d.problems, 'problem')}`;
            return (
              <span key={d.date} className={`cal-cell ${kind}${d.date === todayKey ? ' today' : ''}`} title={title}>
                {d.frozen ? '❄' : ''}
              </span>
            );
          })}
        </div>
        <p className="fine">A day counts when you do {MIN_SESSION} or more problems.</p>
      </section>

      <section className="card" data-testid="accuracy-table">
        <h2>Accuracy by skill</h2>
        {skills.length === 0 ? (
          <p className="fine">Your accuracy shows up here after your first session.</p>
        ) : (
          <ul className="acc-list">
            {skills.map((s) => (
              <li key={s.id} className="acc-item">
                <div className="acc-head">
                  <strong>{s.title}</strong>
                  {s.fragile && <span className="badge fragile">Fragile</span>}
                  <span className="fine">{plural(s.attempts, 'attempt')}</span>
                </div>
                <dl className="acc-nums">
                  <div>
                    <dd>{pct(s.unassistedAccuracy)}</dd>
                    <dt>On your own</dt>
                  </div>
                  <div>
                    <dd>{pct(s.firstOfDayAccuracy)}</dd>
                    <dt>First try of the day</dt>
                  </div>
                  <div>
                    <dd>{pct(s.helpRate)}</dd>
                    <dt>Used help</dt>
                  </div>
                  {s.interpretationAccuracy !== undefined && (
                    <div>
                      <dd>{pct(s.interpretationAccuracy)}</dd>
                      <dt>Interpretation</dt>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">First try of the day is the honest test of memory: it's what you remember, not what you've just warmed up.</p>
      </section>

      <section className="card">
        <h2>Focus next</h2>
        {weakest.length === 0 ? (
          <p className="fine">Not enough data yet: a skill needs 5 attempts.</p>
        ) : (
          <ul className="plain-list">
            {weakest.map((s) => (
              <li key={s.id} className="row">
                <div>
                  <strong>{s.title}</strong>
                  <div className="fine">{pct(s.unassistedAccuracy)} on your own</div>
                </div>
                <button className="btn small" onClick={() => onPractice(s.id)}>
                  Practice
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Most missed steps</h2>
        {missedSteps.length === 0 ? (
          <p className="fine">Nothing stands out yet. Steps you stumble on will show up here.</p>
        ) : (
          <ul className="plain-list">
            {missedSteps.map((m) => (
              <li key={`${m.skillId}/${m.id}`} className="row stack">
                <strong>{m.label}</strong>
                <span className="fine">
                  {m.skillTitle} · {m.count}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Most frequent mistakes</h2>
        {misconceptions.length === 0 ? (
          <p className="fine">No recurring mistakes yet. Patterns will show up here as you practice.</p>
        ) : (
          <div className="miscs">
            {misconceptions.map((m) => (
              <details key={`${m.skillId}/${m.id}`}>
                <summary>
                  <span>{m.label}</span>
                  <span className="fine">
                    {m.skillTitle} · {m.count}×
                  </span>
                </summary>
                <MathText text={getSkill(m.skillId).misconceptions[m.id].explanation} />
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
