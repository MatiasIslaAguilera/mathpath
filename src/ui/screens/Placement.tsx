import { useEffect, useState } from 'react';
import { checkAnswer } from '../../engine/checker';
import { SKILLS } from '../../engine/registry';
import { randomSeed } from '../../engine/rng';
import type { AnswerInput as Value, Problem } from '../../engine/types';
import {
  answerPlacementItem,
  applyPlacementEvent,
  MAX_ITEMS,
  nextPlacementItem,
  placementEvent,
  placementProgress,
  startPlacement,
  type PlacementState,
} from '../../learning/placement';
import type { LearningEvent } from '../../storage/events';
import type { PlacementResult, Progress } from '../../storage/progress';
import { AnswerDisplay, FigureView } from '../components/AnswerDisplay';
import { AnswerInput, initialValue } from '../components/AnswerInput';
import { MathText } from '../components/MathText';

interface Props {
  progress: Progress;
  record(events: LearningEvent[], next: Progress): void;
  onDone(): void;
}

type View =
  | { name: 'intro' }
  | { name: 'question'; state: PlacementState; problem: Problem }
  | { name: 'results'; results: Record<string, PlacementResult> };

const RESULT_TEXT: Record<PlacementResult, string> = {
  passed: "Placed: you're set to keep practicing at level 3",
  credited: "Placed: you're set to keep practicing at level 3",
  partial: 'Start here, at level 2',
  failed: 'Start here',
  blocked: 'Unlocks after its prerequisites',
  untested: 'Not tested',
};

export function Placement({ progress, record, onDone }: Props) {
  const [view, setView] = useState<View>({ name: 'intro' });
  const [input, setInput] = useState<Value>('');
  const [error, setError] = useState<string | null>(null);
  // Set after a graded answer: the state with that answer recorded, shown until "Next".
  const [graded, setGraded] = useState<{ state: PlacementState; correct: boolean } | null>(null);

  // Test hook for Playwright (only with ?e2e in the URL).
  const current = view.name === 'question' ? view.problem : null;
  useEffect(() => {
    if (current && new URLSearchParams(location.search).has('e2e')) (window as unknown as { __mathpath: unknown }).__mathpath = { problem: current };
  }, [current]);

  /** Apply the placement to progress exactly once, from the event that ends the test. */
  const finish = (state: PlacementState) => {
    const logged = placementEvent(state);
    const next = structuredClone(progress);
    applyPlacementEvent(next, logged);
    record([logged], next);
    setGraded(null);
    setView({ name: 'results', results: next.placement!.results });
  };

  const advance = (state: PlacementState) => {
    const item = nextPlacementItem(state, randomSeed());
    setGraded(null);
    setError(null);
    if (!item) return finish(state);
    setInput(initialValue(item.problem.answer));
    setView({ name: 'question', state: item.state, problem: item.problem });
  };

  if (view.name === 'intro') {
    return (
      <div className="screen placement" data-testid="placement-intro">
        <header className="home-head">
          <h1>Find your starting point</h1>
        </header>
        <section className="card">
          <p>
            This asks a few problems per topic and jumps up or down the skill tree depending on your answers, so you skip what you already
            know without skipping prerequisites. "I don't know" is a perfectly good answer here. It only ever moves you forward, never lowers
            a skill.
          </p>
          <p className="fine">
            At most {MAX_ITEMS} questions, and it takes a few minutes now. More skills will be added over time, which will make it longer.
          </p>
          <div className="btn-row">
            <button className="btn primary" onClick={() => advance(startPlacement())} data-testid="placement-start">
              Start
            </button>
            <button className="btn" onClick={onDone}>
              Not now
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (view.name === 'results') {
    return (
      <div className="screen placement" data-testid="placement-results">
        <header className="home-head">
          <h1>Your starting point</h1>
        </header>
        <section className="card">
          <ul className="skill-list">
            {SKILLS.map((s) => {
              const r = view.results[s.id] ?? 'untested';
              return (
                <li key={s.id} className="skill-item" data-testid={`placement-result-${s.id}`}>
                  <div className="skill-info">
                    <strong>{s.title}</strong>
                    <span className={`placement-note ${r}`}>{RESULT_TEXT[r]}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <button className="btn primary big" onClick={onDone} data-testid="placement-finish">
          Start learning
        </button>
      </div>
    );
  }

  const { problem } = view;
  const shownState = graded?.state ?? view.state;
  const fraction = placementProgress(shownState);

  const check = () => {
    if (graded) return;
    const r = checkAnswer(problem.answer, input);
    if ('error' in r && r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    setGraded({ state: answerPlacementItem(view.state, problem, r.correct), correct: r.correct });
  };

  return (
    <div className="screen placement" data-testid="placement-question" data-problem-id={problem.id}>
      <header className="placement-head">
        <div className="bar" role="progressbar" aria-valuenow={Math.round(fraction * 100)} aria-valuemax={100} aria-label="Placement progress">
          <div className="bar-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
        <button className="link" onClick={() => finish(shownState)}>
          Stop here
        </button>
      </header>

      <div className="prompt" data-testid="prompt">
        <MathText text={problem.prompt} />
        {problem.figure && <FigureView figure={problem.figure} />}
      </div>

      <AnswerInput key={problem.id} spec={problem.answer} value={input} onChange={setInput} onEnter={check} disabled={!!graded} autoFocus />
      {error && (
        <p className="input-error" role="alert">
          {error}
        </p>
      )}

      {graded ? (
        <div className="feedback" data-testid="placement-feedback">
          <div className={`banner ${graded.correct ? 'good' : 'bad'}`}>
            {graded.correct ? (
              'Correct'
            ) : (
              <>
                Not quite. The answer is{' '}
                <AnswerDisplay spec={problem.answer} display={false} />
              </>
            )}
          </div>
          <button className="btn primary wide" onClick={() => advance(graded.state)} autoFocus data-testid="placement-next">
            Next
          </button>
        </div>
      ) : (
        <div className="btn-row">
          <button className="btn primary" onClick={check}>
            Check
          </button>
          <button className="btn" onClick={() => advance(answerPlacementItem(view.state, problem, false, true))} data-testid="placement-skip">
            I don't know
          </button>
        </div>
      )}
    </div>
  );
}
