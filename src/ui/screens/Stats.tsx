import { getSkill } from '../../engine/registry';
import { milestoneProgress } from '../../learning/milestones';
import { recentMisses, redoItems } from '../../learning/notebook';
import { paceReport } from '../../learning/pace';
import { skillStats, streakCalendar, topMisconceptions, topMissedSteps, weakestSkills } from '../../learning/stats';
import { MIN_SESSION, streakReport } from '../../learning/streak';
import { dayKey, type Progress } from '../../storage/progress';
import { MathText } from '../components/MathText';
import { shortDate } from '../shortDate';

interface Props {
  progress: Progress;
  onPractice(skillId: string): void;
  /** Start a session that redoes the notebook's recent misses with new numbers. */
  onRedo(): void;
  onBack(): void;
}

/** Misses listed in the notebook (the redo session covers up to 8 distinct ones). */
const NOTEBOOK_SHOWN = 6;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Stats({ progress, onPractice, onRedo, onBack }: Props) {
  const pace = paceReport(progress);
  const milestones = milestoneProgress(progress);
  const misses = recentMisses(progress);
  const redo = redoItems(progress);
  const report = streakReport(progress.days);
  const calendar = streakCalendar(progress);
  const todayKey = dayKey();
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

      <section className="card" data-testid="road-card">
        <h2>Road to the MA</h2>
        <dl className="kv">
          <div>
            <dt>Core skills solid</dt>
            <dd>
              {pace.solid} of {pace.total}
            </dd>
          </div>
          <div>
            <dt>Pace</dt>
            <dd>{pace.perWeek !== undefined ? `${pace.perWeek.toFixed(1)} a week` : 'Too early to say'}</dd>
          </div>
          {pace.neededPerWeek !== undefined && Number.isFinite(pace.neededPerWeek) && (
            <div>
              <dt>Needed for {shortDate(pace.target!)}</dt>
              <dd>{pace.neededPerWeek.toFixed(1)} a week</dd>
            </div>
          )}
          {pace.projected && (
            <div>
              <dt>At this pace, all solid by</dt>
              <dd>{pace.projected}</dd>
            </div>
          )}
        </dl>
        <ul className="plain-list milestones">
          {milestones.map((m) => (
            <li key={m.milestone.id} className="row stack" data-testid={`milestone-${m.milestone.id}`}>
              <strong>
                {m.reached ? '✓ ' : ''}
                {m.milestone.title}
              </strong>
              <span className="fine">
                {m.milestone.goal} · {m.solid} of {m.total} solid{m.built < m.total ? ` · ${m.total - m.built} not built yet` : ''}
              </span>
              <div className="bar thin" role="progressbar" aria-valuenow={m.solid} aria-valuemax={m.total} aria-label={`${m.milestone.title}: ${m.solid} of ${m.total} skills solid`}>
                <div className="bar-fill" style={{ width: `${(m.solid / m.total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="fine">Solid means you'd likely solve a level-2 problem on your own: enough to build the next skill on.{pace.target ? '' : ' Set a target date in Settings to see the pace you need.'}</p>
      </section>

      <section className="card" data-testid="notebook-card">
        <h2>Notebook</h2>
        {misses.length === 0 ? (
          <p className="fine">Wrong answers from the last two weeks show up here, ready to redo with new numbers.</p>
        ) : (
          <>
            <ul className="plain-list">
              {misses.slice(0, NOTEBOOK_SHOWN).map((m, i) => {
                const skill = getSkill(m.skillId);
                const named = m.misconception ? skill.misconceptions[m.misconception]?.name : undefined;
                return (
                  <li key={`${m.ts}-${i}`} className="row stack">
                    <strong>
                      {skill.title} · level {m.level}
                    </strong>
                    <span className="fine">
                      {named ?? (m.input ? `You answered ${m.input}` : 'Wrong answer')}
                      {m.fixed ? ' · fixed on the second try' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="btn-row">
              <button className="btn primary" onClick={onRedo} data-testid="redo-misses">
                Redo {redo.length} {redo.length === 1 ? 'miss' : 'misses'} with new numbers
              </button>
            </div>
            <p className="fine">
              {plural(misses.length, 'wrong answer')} in the last two weeks. Each kind of mistake is redone once: same skill and level, and the same trap where one was spotted.
            </p>
          </>
        )}
      </section>

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
