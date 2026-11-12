import { useEffect, useRef, useState } from 'react';
import { recordAttempt, recordInterpretation, type AttemptResult } from '../../learning/record';
import { applyPlacementEvent, testOutEvent } from '../../learning/placement';
import { afterProblem, nextProblem, TEST_OUT_ITEMS, wrapUp, type NextUp, type Session } from '../../learning/session';
import type { LearningEvent } from '../../storage/events';
import { emptySkill, type Progress } from '../../storage/progress';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Exercise } from './Exercise';
import { LearnCard } from './LearnCard';

interface Props {
  initial: Session;
  progress: Progress;
  record(events: LearningEvent[], next: Progress): void;
  onFinish(s: Session): void;
  onQuit(s: Session): void;
  /** Increments on each back gesture (App.tsx): close the Learn card, else ask before quitting. */
  backPress?: number;
}

interface State {
  session: Session;
  current: NextUp;
  /** The learner had never attempted this skill when the problem appeared (kept after answering). */
  firstTime: boolean;
  /** Increments per problem shown; keys the Exercise so each problem starts fresh. */
  serial: number;
}

const isFirstTime = (p: Progress, n: NextUp) => !n.hideSkill && (p.skills[n.problem.skillId] ?? emptySkill()).attempts === 0;

export function SessionScreen({ initial, progress, record, onFinish, onQuit, backPress = 0 }: Props) {
  const [state, setState] = useState<State>(() => {
    const first = nextProblem(initial, progress)!; // a new session always has ≥ 3 slots
    return { session: first.session, current: first.next, firstTime: isFirstTime(progress, first.next), serial: 0 };
  });
  const [learnOpen, setLearnOpen] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const seenBack = useRef(backPress);
  const startedAt = useRef(performance.now());
  const elapsed = () => performance.now() - startedAt.current;
  useEffect(() => {
    if (backPress === seenBack.current) return;
    seenBack.current = backPress;
    if (learnOpen) setLearnOpen(false);
    else setConfirmQuit((open) => !open);
  }, [backPress, learnOpen]);
  const { session, current, firstTime, serial } = state;
  const { problem } = current;
  const rating = (progress.skills[problem.skillId] ?? emptySkill()).rating;

  const onAttempt = (r: AttemptResult) => {
    const { progress: next, xp, events, logged } = recordAttempt(progress, { ...r, retentionCheck: current.kind === 'retention' });
    record([logged], next);
    // A slip the learner caught and fixed alone needs no repeat; a diagnosed mistake still does.
    const fixedSlip = !!r.retry?.correct && !r.misconception && r.help === 'none';
    const needsFollowUp = !fixedSlip && (!r.correct || r.help !== 'none');
    setState((st) => ({ ...st, session: afterProblem(st.session, problem, r.correct && r.help === 'none', needsFollowUp, xp, events, r.misconception) }));
    return { xp, events };
  };

  const onNext = () => {
    // A timed session that has run out of time skips ahead to its finisher.
    const n = nextProblem(wrapUp(session, elapsed()), progress);
    if (!n) {
      // Tested out: both probes solved alone places the skill, like passing it on the placement test.
      if (session.testOut && session.correct >= TEST_OUT_ITEMS) {
        const placed = testOutEvent(session.testOut);
        const next = structuredClone(progress);
        applyPlacementEvent(next, placed);
        record([placed], next);
      }
      onFinish(session);
      return;
    }
    setState({ session: n.session, current: n.next, firstTime: isFirstTime(progress, n.next), serial: serial + 1 });
    window.scrollTo({ top: 0 });
  };

  const total = session.slots.length + session.followUpsUsed;
  // A timed session fills by the clock (it ends on time, not when the plan runs out).
  const done = session.timeLimitMs ? Math.min(1, elapsed() / session.timeLimitMs) : session.answered / total;

  return (
    <div className="screen session">
      <header className="session-bar">
        <button className="icon-btn" onClick={() => onQuit(session)} aria-label="End session">
          ✕
        </button>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemax={100} aria-label="Session progress">
          <div className="bar-fill" style={{ width: `${Math.min(100, done * 100)}%` }} />
        </div>
        <span className="xp-pill">{session.xp} XP</span>
      </header>
      <Exercise
        key={serial}
        problem={problem}
        rating={rating}
        kind={current.kind}
        hideSkill={current.hideSkill}
        firstTime={firstTime}
        onAttempt={onAttempt}
        onInterpretation={(ok, input, question) => {
          const { progress: next, logged } = recordInterpretation(progress, problem, ok, new Date(), { input, question });
          record([logged], next);
        }}
        onNext={onNext}
        onOpenLearn={() => setLearnOpen(true)}
      />
      {learnOpen && <LearnCard skillId={problem.skillId} onClose={() => setLearnOpen(false)} />}
      {confirmQuit && (
        <ConfirmDialog
          title="End this session?"
          body={session.answered > 0 ? 'Your answers so far are saved.' : "You haven't answered anything yet."}
          stay="Keep going"
          leave="End session"
          onStay={() => setConfirmQuit(false)}
          onLeave={() => onQuit(session)}
        />
      )}
    </div>
  );
}
