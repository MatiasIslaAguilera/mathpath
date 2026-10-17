// "I don't know how to solve this": walk through the solution one step at a time.
// The first `prefilled` steps are worked for you (backward fading); you answer the rest.
// Wrong step → see that step's explanation and retry. "Show me" reveals the step.

import { useState } from 'react';
import { checkAnswer } from '../../engine/checker';
import type { Problem } from '../../engine/types';
import { AnswerInput, initialValue } from '../components/AnswerInput';
import { MathText, Tex } from '../components/MathText';
import { StepCard } from '../components/StepCard';

export interface GuidedResult {
  /** The learner entered the final step themselves (no "Show me"). */
  finishedAlone: boolean;
  missedSteps: string[];
}

export function GuidedMode({ problem, prefilled, onDone }: { problem: Problem; prefilled: number; onDone(r: GuidedResult): void }) {
  const { steps } = problem;
  const [i, setI] = useState(prefilled);
  const [input, setInput] = useState(() => (steps[prefilled]?.ask ? initialValue(steps[prefilled].ask!.answer) : ''));
  const [status, setStatus] = useState<'asking' | 'wrong' | 'shown' | 'right'>('asking');
  const [error, setError] = useState<string | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [selfDone, setSelfDone] = useState<boolean[]>([]);

  const step = steps[i];
  const isLast = i === steps.length - 1;

  const advance = (doneAlone: boolean) => {
    const done = [...selfDone];
    done[i] = doneAlone;
    setSelfDone(done);
    if (isLast) {
      onDone({ finishedAlone: doneAlone, missedSteps: missed });
      return;
    }
    const next = steps[i + 1];
    setI(i + 1);
    setInput(next.ask ? initialValue(next.ask.answer) : '');
    setStatus('asking');
    setError(null);
  };

  const check = () => {
    if (!step.ask) return;
    const r = checkAnswer(step.ask.answer, input);
    if (r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    if (r.correct) {
      setStatus('right');
    } else {
      setStatus('wrong');
      if (!missed.includes(step.key)) setMissed([...missed, step.key]);
    }
  };

  const showMe = () => {
    setStatus('shown');
    if (!missed.includes(step.key)) setMissed([...missed, step.key]);
  };

  return (
    <div className="guided" data-testid="guided">
      <p className="guided-intro">Let's do it together, one step at a time.</p>
      {steps.slice(0, i).map((s, k) => (
        <StepCard key={k} step={s} index={k} tag={k < prefilled ? 'worked for you' : selfDone[k] ? 'you did this ✓' : 'shown'} />
      ))}

      {step && (
        <div className="step current" data-testid="guided-step">
          <div className="step-head">
            <span className="step-num">{i + 1}</span>
            <MathText text={step.instruction} className="step-instruction" />
          </div>

          {!step.ask ? (
            <>
              <div className="step-math">
                <Tex latex={step.math} display />
              </div>
              <div className="step-why">
                <span className="why-label">Why:</span> <MathText text={step.why} />
              </div>
              <button className="btn primary" onClick={() => advance(false)}>
                Continue
              </button>
            </>
          ) : (
            <>
              <p className="ask-prompt">
                <MathText text={step.ask.prompt} />
              </p>
              <AnswerInput
                spec={step.ask.answer}
                value={input}
                onChange={(v) => {
                  setInput(v);
                  if (status === 'wrong') setStatus('asking');
                }}
                onEnter={check}
                disabled={status === 'shown' || status === 'right'}
                autoFocus
              />
              {error && <p className="input-error">{error}</p>}

              {status === 'wrong' && (
                <div className="callout warn" data-testid="step-wrong">
                  <strong>Not quite.</strong> <MathText text={step.why} /> Try again, or tap "Show me".
                </div>
              )}
              {(status === 'shown' || status === 'right') && (
                <div className={`callout ${status === 'right' ? 'good' : 'info'}`}>
                  {status === 'right' && <strong>Right! </strong>}
                  <div className="step-math">
                    <Tex latex={step.math} display />
                  </div>
                  <MathText text={step.why} />
                </div>
              )}

              <div className="btn-row">
                {status === 'asking' || status === 'wrong' ? (
                  <>
                    <button className="btn primary" onClick={check}>
                      Check step
                    </button>
                    <button className="btn" onClick={showMe}>
                      Show me
                    </button>
                  </>
                ) : (
                  <button className="btn primary" autoFocus onClick={() => advance(status === 'right')}>
                    {isLast ? 'Finish' : 'Next step'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
