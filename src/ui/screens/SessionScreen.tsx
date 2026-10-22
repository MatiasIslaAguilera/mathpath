import { useEffect, useRef, useState } from 'react';
import { recordAttempt, recordInterpretation, type AttemptResult } from '../../learning/record';
import { afterProblem, nextProblem, type NextUp, type Session } from '../../learning/session';
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
    const needsFollowUp = !r.correct || r.help !== 'none';
    setState((st) => ({ ...st, session: afterProblem(st.session, problem, r.correct && r.help === 'none', needsFollowUp, xp, events) }));
    return { xp, events };
  };

  const onNext = () => {
    const n = nextProblem(session, progress);
    if (!n) {
      onFinish(session);
      return;
    }
    setState({ session: n.session, current: n.next, firstTime: isFirstTime(progress, n.next), serial: serial + 1 });
    window.scrollTo({ top: 0 });
  };

  const total = session.slots.length + session.followUpsUsed;

  return (
    <div className="screen session">
      <header className="session-bar">
        <button className="icon-btn" onClick={() => onQuit(session)} aria-label="End session">
          ✕
        </button>
        <div className="bar" role="progressbar" aria-valuenow={session.answered} aria-valuemax={total} aria-label="Session progress">
          <div className="bar-fill" style={{ width: `${Math.min(100, (session.answered / total) * 100)}%` }} />
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
        onInterpretation={(ok) => {
          const { progress: next, logged } = recordInterpretation(progress, problem, ok);
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
