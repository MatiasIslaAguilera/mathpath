import { getSkill, SKILLS } from '../../engine/registry';
import { masteryFraction, nextLevel } from '../../learning/mastery';
import { todaysAgenda } from '../../learning/session';
import { lockedBy } from '../../learning/unlock';
import { fragileReport, skillState, type SkillState } from '../../learning/states';
import { overallProgress } from '../../learning/stats';
import { comebackStatus, problemsToday, streakReport } from '../../learning/streak';
import type { Profile } from '../../storage/events';
import { dateKey, emptySkill, type Progress, type SkillProgress } from '../../storage/progress';
import { shortDate } from '../shortDate';

interface Props {
  progress: Progress;
  updateProfile(patch: Partial<Omit<Profile, 'updatedAt'>>): void;
  /** Starts the daily session; a goal overrides the daily goal (the welcome-back restart). */
  onStart(goal?: number): void;
  onPractice(skillId: string): void;
  onLearn(skillId: string): void;
  onSettings(): void;
  onPlacement(): void;
  onTree(): void;
  onStats(): void;
}

const FRAGILE_HINT = 'You do well later in a session but not on your first try of the day. Spaced reviews will fix this.';

function stateLabel(state: SkillState, sp: SkillProgress, todayKey: string): string {
  switch (state) {
    case 'new':
      return 'Not started';
    case 'learning':
      return 'Learning';
    case 'practiced':
      return 'Practiced';
    case 'check-pending':
      return `Memory check ${!sp.retentionDue || sp.retentionDue <= todayKey ? 'today' : shortDate(sp.retentionDue)}`;
    case 'mastered':
      return 'Mastered ✓';
    case 'rusty':
      return 'Needs a refresh';
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Home({ progress, updateProfile, onStart, onPractice, onLearn, onSettings, onPlacement, onTree, onStats }: Props) {
  const today = problemsToday(progress.days);
  const goal = progress.settings.dailyGoal;
  const report = streakReport(progress.days);
  const todayKey = dateKey();
  const overall = overallProgress(progress);
  const agenda = todaysAgenda(progress);
  const agendaParts = [
    agenda.reviewsDue.length ? plural(agenda.reviewsDue.length, 'review') + ' due' : '',
    agenda.retentionChecks.length ? plural(agenda.retentionChecks.length, 'memory check') : '',
  ].filter(Boolean);
  const ring = Math.min(1, today / goal);
  // A brand-new learner chooses between the placement test and starting from the beginning.
  const onboarding = progress.onboarding === undefined && !Object.values(progress.skills).some((sp) => sp.attempts > 0);
  // Welcome back: at most once a day, and never on top of the onboarding choice.
  const comeback = comebackStatus(progress.days);
  const showWelcome = comeback.kind !== 'none' && progress.welcomeShownOn !== todayKey && !onboarding;
  const dismissWelcome = () => updateProfile({ welcomeShownOn: todayKey });

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>MathPath</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="Settings">
          ⚙
        </button>
      </header>

      {showWelcome && comeback.kind === 'frozen' && (
        <section className="card welcome" data-testid="welcome-back">
          <p>
            ❄ A streak freeze covered {comeback.frozenDays.map(shortDate).join(', ')}. Your {comeback.streak}-day streak is safe.
          </p>
          <button className="btn small" onClick={dismissWelcome}>
            Nice
          </button>
        </section>
      )}
      {showWelcome && comeback.kind === 'restart' && (
        <section className="card welcome" data-testid="welcome-back">
          <h2>Welcome back</h2>
          <p>
            You've practiced {plural(comeback.totalDays, 'day')} in total
            {comeback.longest > 1 ? ` and your longest streak is ${comeback.longest} days` : ''}. Every day you come back counts.
            {comeback.gentle && " We'll start with an easier review to warm back up."}
          </p>
          <div className="btn-row">
            <button
              className="btn primary"
              data-testid="welcome-restart"
              onClick={() => {
                dismissWelcome();
                onStart(3);
              }}
            >
              Do 3 problems
            </button>
            <button className="btn subtle" onClick={dismissWelcome}>
              Not now
            </button>
          </div>
        </section>
      )}

      <section className="today card">
        <div className="ring" style={{ ['--p' as string]: ring }} aria-label={`${today} of ${goal} problems today`}>
          <span>
            {today}
            <small>/{goal}</small>
          </span>
        </div>
        {onboarding ? (
          <div className="onboarding" data-testid="onboarding">
            <h2>Welcome! Let's find your starting point</h2>
            <p className="fine">A short placement test skips what you already know, so practice starts at the right level.</p>
            <button className="btn primary big" onClick={onPlacement} data-testid="start-placement">
              Take the placement test
            </button>
            <button className="btn subtle" onClick={() => updateProfile({ onboarding: 'skipped' })} data-testid="skip-placement">
              Skip: start from the beginning
            </button>
          </div>
        ) : (
          <>
            <button className="btn primary big" onClick={() => onStart()} data-testid="start-session">
              {today === 0 ? "Start today's session" : today >= goal ? 'Bonus session' : "Continue today's session"}
            </button>
            {agendaParts.length > 0 && (
              <p className="fine" data-testid="agenda">
                {agendaParts.join(' · ')}
              </p>
            )}
            <p className="fine">{today >= 3 ? "Today counts. Anything more is a bonus." : `${Math.max(0, 3 - today)} problem${3 - today === 1 ? '' : 's'} keeps your streak going.`}</p>
          </>
        )}
      </section>

      <nav className="nav-row" aria-label="More">
        <button className="btn" onClick={onTree} data-testid="nav-tree">
          Skill tree
        </button>
        <button className="btn" onClick={onStats} data-testid="nav-stats">
          Stats
        </button>
      </nav>

      <section className="stats-row">
        <div className="stat card">
          <strong>{report.current}</strong>
          <span>day streak</span>
          {report.freezes > 0 && (
            <span className="stat-note" data-testid="freezes">
              ❄ {plural(report.freezes, 'freeze')}
            </span>
          )}
        </div>
        <div className="stat card">
          <strong>{report.totalDays}</strong>
          <span>days practiced</span>
          <span className="stat-note" data-testid="this-week">
            {report.lastSevenDays}/7 this week
          </span>
        </div>
        <div className="stat card">
          <strong>{progress.xp}</strong>
          <span>XP</span>
        </div>
      </section>

      <section className="card">
        <h2>
          Skills <small className="fine">{overall.mastered} of {overall.total} master's skills mastered</small>
        </h2>
        <div className="bar thin" role="progressbar" aria-valuenow={overall.mastered} aria-valuemax={overall.total} aria-label="Master's skills mastered">
          <div className="bar-fill" style={{ width: `${(overall.mastered / overall.total) * 100}%` }} />
        </div>
        <p className="fine">{overall.built} available so far</p>
        <ul className="skill-list">
          {SKILLS.map((s) => {
            const sp = progress.skills[s.id] ?? emptySkill();
            const state = skillState(sp);
            const fragile = fragileReport(sp).fragile;
            const locks = lockedBy(progress, s.id);
            const locked = locks.length > 0;
            return (
              <li key={s.id} className={`skill-item ${state}${locked ? ' locked' : ''}`} data-testid={`skill-${s.id}`}>
                <div className="skill-info">
                  <span className="skill-track">{s.track === 'math' ? 'Math' : 'Econ'}</span>
                  <strong>{s.title}</strong>
                  <span className="skill-meta">
                    {locked ? (
                      <span className="badge locked" data-testid={`lock-${s.id}`}>
                        Locked
                      </span>
                    ) : (
                      <span className={`badge ${state}`} data-testid={`badge-${s.id}`}>
                        {stateLabel(state, sp, todayKey)}
                      </span>
                    )}
                    {fragile && (
                      <span className="badge fragile" title={FRAGILE_HINT}>
                        Fragile
                      </span>
                    )}
                    {sp.attempts > 0 && <span className="fine">Level {nextLevel(sp.rating)}</span>}
                  </span>
                  {locked ? (
                    <span className="fine">Unlocks after {locks.map((id) => getSkill(id).title).join(' and ')}</span>
                  ) : (
                    <div className="bar thin">
                      <div className="bar-fill" style={{ width: `${state === 'mastered' ? 100 : sp.attempts ? masteryFraction(sp.rating) * 100 : 0}%` }} />
                    </div>
                  )}
                </div>
                <div className="skill-actions">
                  <button className="btn small" onClick={() => onLearn(s.id)}>
                    Learn
                  </button>
                  <button className="btn small" onClick={() => onPractice(s.id)} disabled={locked}>
                    Practice
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
