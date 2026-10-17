import { useEffect, useMemo } from 'react';
import { getSkill, makeProblem } from '../../engine/registry';
import { MathText, Tex } from '../components/MathText';
import { StepList } from '../components/StepCard';

export function LearnCard({ skillId, onClose }: { skillId: string; onClose(): void }) {
  const skill = getSkill(skillId);
  const example = useMemo(() => makeProblem(skill, skill.learn.example.level, skill.learn.example.seed), [skill]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Learn: ${skill.title}`} onClick={(e) => e.stopPropagation()} data-testid="learn-card">
        <div className="modal-head">
          <h2>{skill.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <h3 className="first">What it's for</h3>
        <p data-testid="why-it-matters">
          <MathText text={skill.learn.whyItMatters} />
        </p>

        <p>
          <MathText text={skill.learn.summary} />
        </p>

        <h3>Key formulas</h3>
        {skill.learn.formulas.map((f, i) => (
          <div key={i} className="formula-row">
            <Tex latex={f.latex} display />
            {f.note && <MathText text={f.note} className="fine" />}
          </div>
        ))}

        <h3>Worked example</h3>
        <div className="prompt small">
          <MathText text={example.prompt} />
        </div>
        <StepList steps={example.steps} />

        <h3>Common mistakes</h3>
        <ul className="mistakes">
          {Object.entries(skill.misconceptions).map(([id, m]) => (
            <li key={id}>
              <strong>{m.name}.</strong> <MathText text={m.explanation} />
            </li>
          ))}
        </ul>

        {skill.learn.tips && (
          <>
            <h3>Tips</h3>
            <ul>
              {skill.learn.tips.map((t, i) => (
                <li key={i}>
                  <MathText text={t} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
