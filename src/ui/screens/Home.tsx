import { useEffect, useMemo, useState } from 'react';
import { getSkill, SKILLS } from '../../engine/registry';
import { masteryFraction, nextLevel } from '../../learning/mastery';
import { todaysAgenda } from '../../learning/session';
import { lockedBy } from '../../learning/unlock';
import { fragileReport, skillState, type SkillState } from '../../learning/states';
import { catMood, catSays, gardenPlots, gardenSummary, ratchet, weekDots, type Stage } from '../../learning/garden';
import { attemptLog, dailyActivity, overallProgress, weeklyAccuracy } from '../../learning/stats';
import { comebackStatus, problemsToday, streakReport } from '../../learning/streak';
import type { LearningEvent, Profile } from '../../storage/events';
import { syncConfigured, type SyncStatus } from '../../sync/sync';
import { dateKey, emptySkill, type Progress, type SkillProgress } from '../../storage/progress';
import { Cat } from '../components/Cat';
import { AccuracyChart, ActivityChart } from '../components/Charts';
import { Garden } from '../components/Garden';
import { shortDate } from '../shortDate';

interface Props {
  progress: Progress;
  /** The full event log: the accuracy chart reads it (per-skill history is capped). */
  events: LearningEvent[];
  syncStatus: SyncStatus;
  updateProfile(patch: Partial<Omit<Profile, 'updatedAt'>>): void;
  /** Starts the daily session; a goal overrides the daily goal (the welcome-back restart). */
  onStart(goal?: number): void;
  onPractice(skillId: string): void;
  onLearn(skillId: string): void;
  onSettings(): void;
  onPlacement(): void;
  onTree(): void;
  onStats(): void;
  onChallenge(): void;
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

/** The highest stage each plot has shown on this device: plants never shrink (learning/garden.ts `ratchet`). */
const SEEN_KEY = 'mathpath.garden.v1';
function loadSeen(): Record<string, Stage> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, Stage>;
  } catch {
    return {};
  }
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const DOT: Record<string, { cls: string; label: string }> = {
  synced: { cls: 'good', label: 'Synced' },
  syncing: { cls: 'accent', label: 'Syncing' },
  offline: { cls: 'muted', label: 'Offline' },
  error: { cls: 'warn', label: 'Sync problem' },
  'signed-out': { cls: 'hollow', label: 'Not signed in' },
};

export function Home({ progress, events, syncStatus, updateProfile, onStart, onPractice, onLearn, onSettings, onPlacement, onTree, onStats, onChallenge }: Props) {
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
  // Plants never shrink; the ones that grew since the last visit animate once.
  const [seenBefore] = useState(loadSeen);
  const { plots, grew, seen } = useMemo(() => ratchet(gardenPlots(progress), seenBefore), [progress, seenBefore]);
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* private mode: the garden just won't remember its tallest plants */
    }
  }, [seen]);
  const garden = gardenSummary(plots);
  const weeks = useMemo(() => weeklyAccuracy(attemptLog(events)), [events]);
  const mood = catMood(progress, onboarding);
  const says = catSays(progress, onboarding);
  const week = weekDots(progress);
  const gardenLabel = `Your garden: ${garden.bloom} in bloom, ${garden.growing} growing, ${garden.thirsty} need water, ${garden.toPlant} ready to plant. Open the skill tree.`;

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>MathPath</h1>
        <div className="head-actions">
          {syncConfigured && DOT[syncStatus.state] && (
            <button className="icon-btn" onClick={onSettings} aria-label={DOT[syncStatus.state].label} data-testid="sync-dot">
              <span className={`sync-dot ${DOT[syncStatus.state].cls}`} />
            </button>
          )}
          <button className="icon-btn" onClick={onSettings} aria-label="Settings">
            <GearIcon />
          </button>
        </div>
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

      {/* The garden button and the cat share one grid cell; the cat sits outside the button so its words are read aloud. */}
      <section className={`garden-hero mood-${mood}`}>
        <button className="garden-btn" onClick={onTree} data-testid="garden" aria-label={gardenLabel}>
          <Garden plots={plots} grew={grew} />
          <span className="hero-link" aria-hidden="true">
            Skill tree ›
          </span>
        </button>
        <div className="cat-col">
          <p className="bubble" data-testid="cat-says">
            {says}
          </p>
          <Cat mood={mood} />
        </div>
      </section>
      <p className="garden-legend fine" aria-hidden="true">
        {[`${garden.bloom} in bloom`, `${garden.growing} growing`, garden.thirsty ? `${garden.thirsty} need water` : '', `${garden.toPlant} ready to plant`].filter(Boolean).join(' · ')}
      </p>

      <section className="today">
        {onboarding ? (
          <div className="onboarding card" data-testid="onboarding">
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
            {/* Once the goal is met, more is a bonus, not the main ask. */}
            <button className={`btn big${today >= goal ? '' : ' primary'}`} onClick={() => onStart()} data-testid="start-session">
              {today === 0 ? "Start today's session" : today >= goal ? 'Bonus session' : "Continue today's session"}
            </button>
            <div className="goal-line">
              <div className="bar thin" role="progressbar" aria-valuenow={today} aria-valuemax={goal} aria-label={`${today} of ${goal} problems today`}>
                <div className="bar-fill" style={{ width: `${ring * 100}%` }} />
              </div>
              <span className="fine">
                {today}/{goal} today
                {agendaParts.length > 0 && <span data-testid="agenda"> · {agendaParts.join(' · ')}</span>}
              </span>
            </div>
          </>
        )}
      </section>

      {/* Streak, total days and this week weigh the same (PLAN §2.2): a break never erases visible progress. */}
      <section className="card streak-card">
        <div className="hero-figures">
          <div className="hero-figure">
            <strong>{report.current}</strong>
            <span>day streak</span>
            {report.freezes > 0 && (
              <span className="stat-note" data-testid="freezes">
                ❄ {plural(report.freezes, 'freeze')}
              </span>
            )}
          </div>
          <div className="hero-figure">
            <strong>{report.totalDays}</strong>
            <span>days practiced</span>
            <span className="stat-note" data-testid="this-week">
              {report.lastSevenDays}/7 this week
            </span>
          </div>
        </div>
        <ol className="week" aria-label="The last 7 days">
          {week.map((d) => (
            <li key={d.date} className={d.state} aria-label={d.label}>
              <span className="week-day" aria-hidden="true">
                {d.weekday}
              </span>
              <span className="week-dot" aria-hidden="true">
                {d.state === 'done' ? '✓' : d.state === 'frozen' ? '❄' : ''}
              </span>
            </li>
          ))}
        </ol>
        <p className="fine streak-foot">
          {overall.mastered} of {overall.built} available skills mastered ·{' '}
          <span className="stat">
            <strong>{progress.xp.toLocaleString('en-US')}</strong> XP
          </span>
        </p>
      </section>

      {!onboarding && (
        <section className="card charts">
          <ActivityChart days={dailyActivity(progress)} goal={goal} />
          <AccuracyChart weeks={weeks} />
        </section>
      )}

      <nav className="nav-row three" aria-label="More">
        <button className="btn" onClick={onTree} data-testid="nav-tree">
          Skill tree
        </button>
        <button className="btn" onClick={onStats} data-testid="nav-stats">
          Stats
        </button>
        <button className="btn" onClick={onChallenge} data-testid="nav-challenge">
          Past papers
        </button>
      </nav>

      <section className="card">
        <h2>
          Skills <small className="fine">{overall.built} of {overall.total} available so far</small>
        </h2>
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
