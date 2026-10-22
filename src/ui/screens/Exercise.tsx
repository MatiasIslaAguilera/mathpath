import { useEffect, useState } from 'react';
import { checkAnswer } from '../../engine/checker';
import { matchMisconception } from '../../engine/misconceptions';
import { getSkill } from '../../engine/registry';
import type { AnswerInput as Value, Problem } from '../../engine/types';
import { prefilledSteps } from '../../learning/fading';
import type { Help } from '../../learning/mastery';
import type { AttemptResult, SkillEvent } from '../../learning/record';
import type { SlotKind } from '../../learning/session';
import { AnswerDisplay, FigureView } from '../components/AnswerDisplay';
import { AnswerInput, initialValue } from '../components/AnswerInput';
import { MathText, Tex } from '../components/MathText';
import { StepCard, StepList } from '../components/StepCard';
import { shortDate } from '../shortDate';
import { GuidedMode, type GuidedResult } from './GuidedMode';

interface Props {
  problem: Problem;
  rating: number;
  kind: SlotKind;
  /** Interleaved review: don't reveal which skill this is until it's answered. */
  hideSkill: boolean;
  /** First problem ever for this skill: show what it's for above the prompt. */
  firstTime: boolean;
  /** Called once when the main problem resolves; returns XP earned and state changes. */
  onAttempt(r: AttemptResult): { xp: number; events: SkillEvent[] };
  onInterpretation(correct: boolean): void;
  onNext(): void;
  onOpenLearn(): void;
}

interface Outcome {
  correct: boolean;
  help: Help;
  misconception?: string;
  parts?: boolean[];
  xp: number;
  events: SkillEvent[];
}

const inputText = (v: Value) => (Array.isArray(v) ? v.join(', ') : v);

export function Exercise({ problem, rating, kind, hideSkill, firstTime, onAttempt, onInterpretation, onNext, onOpenLearn }: Props) {
  const skill = getSkill(problem.skillId);
  const [phase, setPhase] = useState<'answer' | 'guided' | 'feedback'>('answer');
  const [input, setInput] = useState<Value>(() => initialValue(problem.answer));
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [interpIndex, setInterpIndex] = useState(0);
  const [interpChoice, setInterpChoice] = useState<string | null>(null);

  // Test hook for Playwright (only with ?e2e in the URL).
  useEffect(() => {
    if (new URLSearchParams(location.search).has('e2e')) (window as unknown as { __mathpath: unknown }).__mathpath = { problem };
  }, [problem]);

  const hintKeys = () => problem.steps.slice(0, hints).map((s) => s.key);

  const check = () => {
    const r = skill.check ? skill.check(problem, input) : checkAnswer(problem.answer, input);
    if ('error' in r && r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    const help: Help = hints === 0 ? 'none' : hints >= problem.steps.length ? 'reveal' : 'hint';
    const misconception = r.correct ? undefined : matchMisconception(problem, input);
    const { xp, events } = onAttempt({ problem, correct: r.correct, help, hintsUsed: hints, input: inputText(input), misconception, missedSteps: hintKeys() });
    setOutcome({ correct: r.correct, help, misconception, parts: 'parts' in r ? r.parts : undefined, xp, events });
    setPhase('feedback');
  };

  const finishGuided = (g: GuidedResult) => {
    const { xp, events } = onAttempt({ problem, correct: g.finishedAlone, help: 'guided', hintsUsed: hints, missedSteps: [...new Set([...hintKeys(), ...g.missedSteps])] });
    setOutcome({ correct: g.finishedAlone, help: 'guided', xp, events });
    setPhase('feedback');
  };

  const interp = problem.interpretation ?? [];
  const interpDone = interpIndex >= interp.length;
  const currentQ = interp[interpIndex];

  return (
    <div className="exercise" data-testid="exercise" data-problem-id={problem.id}>
      <div className="exercise-meta">
        <span className="skill-chip" data-testid="skill-chip">
          {hideSkill && phase !== 'feedback' ? 'Mixed review' : `${skill.title} · Level ${problem.level}`}
        </span>
        {/* Opening the Learn card would give away the method on an interleaved/retention item. */}
        {(!hideSkill || phase === 'feedback') && kind !== 'retention' && (
          <button className="link" onClick={onOpenLearn}>
            Learn card
          </button>
        )}
      </div>
      {kind === 'followup' && <p className="followup-note">Same method, new numbers. Try this one on your own.</p>}
      {kind === 'stretch' && phase !== 'feedback' && (
        <p className="followup-note" data-testid="stretch-note">
          Stretch: one level above your usual. A solve here moves you up faster, and a miss costs less than usual.
        </p>
      )}
      {kind === 'gre' && phase !== 'feedback' && (
        <p className="followup-note" data-testid="gre-note">
          Today's GRE question. No timer: take the time you need.
        </p>
      )}
      {kind === 'retention' && phase !== 'feedback' && (
        <p className="followup-note" data-testid="retention-note">
          Memory check: you haven't seen this skill for a few days. Solve it on your own, no hints, to confirm you've mastered it.
        </p>
      )}

      {firstTime && !hideSkill && (
        <details className="intro" open data-testid="new-skill-intro">
          <summary>New skill: {skill.title}</summary>
          <p>
            <MathText text={skill.learn.whyItMatters} />
          </p>
          <button className="btn small" onClick={onOpenLearn}>
            Open Learn card
          </button>
        </details>
      )}

      <div className="prompt" data-testid="prompt">
        <MathText text={problem.prompt} />
        {problem.figure && <FigureView figure={problem.figure} />}
      </div>

      {phase === 'answer' && (
        <>
          {hints > 0 && (
            <div className="hints" data-testid="hints">
              {problem.steps.slice(0, hints).map((s, i) => (
                <StepCard key={i} step={s} index={i} tag="hint" />
              ))}
            </div>
          )}
          <AnswerInput spec={problem.answer} value={input} onChange={setInput} onEnter={check} autoFocus />
          {error && <p className="input-error" role="alert">{error}</p>}
          <div className="btn-row three">
            <button className="btn primary" onClick={check}>
              Check
            </button>
            <button className="btn" onClick={() => setHints((h) => Math.min(h + 1, problem.steps.length))} disabled={hints >= problem.steps.length}>
              Hint{hints > 0 ? ` (${hints}/${problem.steps.length})` : ''}
            </button>
            <button className="btn subtle" onClick={() => setPhase('guided')}>
              I don't know how to solve this
            </button>
          </div>
          {hints > 0 && <p className="fine">Hints give half XP and don't count toward mastery. That's fine: learning first.</p>}
        </>
      )}

      {phase === 'guided' && (
        <GuidedMode problem={problem} prefilled={Math.min(problem.steps.length - 1, Math.max(hints, prefilledSteps(problem.steps.length, rating)))} onDone={finishGuided} />
      )}

      {phase === 'feedback' && outcome && (
        <div className="feedback" data-testid="feedback">
          <div className={`banner ${outcome.correct && outcome.help !== 'guided' ? 'good' : outcome.help === 'guided' ? 'info' : 'bad'}`} data-testid="result-banner">
            {outcome.help === 'guided'
              ? 'Worked through it with guidance. Next up: one like it on your own.'
              : outcome.correct
                ? outcome.help === 'none'
                  ? `Correct! +${outcome.xp} XP`
                  : outcome.help === 'hint'
                    ? `Correct! +${outcome.xp} XP (half, hints used)`
                    : 'Correct, with every step revealed. No XP this time.'
                : 'Not quite.'}
          </div>

          {outcome.events.map((e) =>
            e.type === 'mastered' ? (
              <div key={e.type} className="callout good" data-testid="event-mastered">
                <strong>Mastered: {skill.title}.</strong> You solved it cold, days later, without help. That's real memory, not just practice.
              </div>
            ) : e.type === 'check-failed' ? (
              <div key={e.type} className="callout info" data-testid="event-check-failed">
                The memory check on {skill.title} didn't stick this time. That's normal: it comes back on {shortDate(e.retryOn)}, and a few spaced reviews usually fix it.
              </div>
            ) : e.type === 'check-scheduled' ? (
              <div key={e.type} className="callout info" data-testid="event-check-scheduled">
                {skill.title}: memory check scheduled for {shortDate(e.due)}. You solved it on your own at the level that counts; the check confirms it stuck.
              </div>
            ) : null,
          )}

          {outcome.misconception && (
            <div className="callout warn" data-testid="misconception">
              <strong>{skill.misconceptions[outcome.misconception].name}.</strong>{' '}
              <MathText text={skill.misconceptions[outcome.misconception].explanation} />
            </div>
          )}
          {!outcome.correct && problem.verify.type === 'solve' && (
            <p className="fine" data-testid="substitute-nudge">
              Quick check: put your answer back into the original equation. Both sides should give the same number.
            </p>
          )}
          {outcome.parts && !outcome.correct && problem.answer.kind === 'tuple' && (
            <p className="parts">
              {problem.answer.labels.map((l, i) => `${l} ${outcome.parts![i] ? '✓' : '✗'}`).join('  ·  ')}
            </p>
          )}

          <div className="answer-box">
            <span className="label">Answer</span>
            <AnswerDisplay spec={problem.answer} />
          </div>

          <details className="formula" open>
            <summary>Key formula</summary>
            {skill.learn.formulas.slice(0, 2).map((f, i) => (
              <div key={i} className="formula-row">
                <Tex latex={f.latex} display />
                {f.note && <MathText text={f.note} className="fine" />}
              </div>
            ))}
          </details>

          <details className="solution" open={!outcome.correct || outcome.help !== 'none'}>
            <summary>Full worked solution</summary>
            <StepList steps={problem.steps} />
          </details>

          {currentQ && (
            <div className="interpretation" data-testid="interpretation">
              <h3>Think about it</h3>
              <p>
                <MathText text={currentQ.prompt} />
              </p>
              <AnswerInput
                spec={{ kind: 'choice', options: currentQ.options, correct: currentQ.correct }}
                value={interpChoice ?? ''}
                disabled={interpChoice !== null}
                onEnter={() => {}}
                onChange={(id) => {
                  setInterpChoice(id as string);
                  onInterpretation(id === currentQ.correct);
                }}
              />
              {interpChoice !== null && (
                <div className={`callout ${interpChoice === currentQ.correct ? 'good' : 'warn'}`}>
                  <strong>{interpChoice === currentQ.correct ? 'Yes. ' : 'Not quite. '}</strong>
                  <MathText text={currentQ.explanation} />
                </div>
              )}
              {interpChoice !== null && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setInterpIndex(interpIndex + 1);
                    setInterpChoice(null);
                  }}
                >
                  {interpIndex + 1 < interp.length ? 'Next question' : 'Done'}
                </button>
              )}
            </div>
          )}

          {interpDone && (
            <button className="btn primary wide" onClick={onNext} autoFocus data-testid="next">
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
}
