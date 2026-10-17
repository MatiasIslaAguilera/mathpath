import type { Step } from '../../engine/types';
import { MathText, Tex } from './MathText';

export function StepCard({ step, index, tag }: { step: Step; index: number; tag?: string }) {
  return (
    <div className="step">
      <div className="step-head">
        <span className="step-num">{index + 1}</span>
        <MathText text={step.instruction} className="step-instruction" />
        {tag && <span className="step-tag">{tag}</span>}
      </div>
      <div className="step-math">
        <Tex latex={step.math} display />
      </div>
      <div className="step-why">
        <span className="why-label">Why:</span> <MathText text={step.why} />
      </div>
    </div>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <StepCard step={s} index={i} />
        </li>
      ))}
    </ol>
  );
}
