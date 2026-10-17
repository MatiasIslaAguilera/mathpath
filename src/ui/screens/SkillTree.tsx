import { useState } from 'react';
import { getSkill } from '../../engine/registry';
import { treeView, type TreeItem, type TreeStatus, type TreeUnit } from '../../learning/stats';
import type { Progress } from '../../storage/progress';

interface Props {
  progress: Progress;
  onPractice(skillId: string): void;
  onLearn(skillId: string): void;
  onBack(): void;
}

const LEGEND: { status: TreeStatus; label: string }[] = [
  { status: 'new', label: 'Not started' },
  { status: 'learning', label: 'Learning' },
  { status: 'practiced', label: 'Practiced' },
  { status: 'mastered', label: 'Mastered' },
  { status: 'locked', label: 'Locked' },
  { status: 'coming-soon', label: 'Coming soon' },
];

function statusLine(item: TreeItem): string {
  switch (item.status) {
    case 'coming-soon':
      return 'Coming soon';
    case 'locked':
      return `🔒 Unlocks after ${item.lockedBy.map((id) => getSkill(id).title).join(' and ')}`;
    case 'new':
      return 'Not started';
    case 'learning':
      return 'Learning';
    case 'practiced':
      return 'Practiced';
    case 'check-pending':
      return 'Memory check pending';
    case 'mastered':
      return 'Mastered ✓';
    case 'rusty':
      return 'Needs a refresh';
  }
}

export function SkillTree({ progress, onPractice, onLearn, onBack }: Props) {
  const view = treeView(progress);
  // One tile open at a time, to show its Learn / Practice buttons.
  const [open, setOpen] = useState<string | null>(null);

  const section = (title: string, units: TreeUnit[]) => (
    <section className="card">
      <h2>{title}</h2>
      {units.map((u) => (
        <div key={u.unit}>
          <h3 className="tree-unit">{u.unit}</h3>
          <div className="tree-grid">
            {u.items.map((item) => {
              const { node, status } = item;
              const built = status !== 'coming-soon';
              const selected = open === node.id;
              return (
                <div key={node.id} className={`tree-tile ${status}${selected ? ' open' : ''}`} data-testid={`tree-item-${node.id}`} data-status={status}>
                  <button className="tree-tap" disabled={!built} aria-expanded={built ? selected : undefined} onClick={() => setOpen(selected ? null : node.id)}>
                    <strong>{node.title}</strong>
                    <span className="tree-status">{statusLine(item)}</span>
                    {node.optional && <span className="tree-optional">Optional</span>}
                  </button>
                  {built && selected && (
                    <div className="tree-actions">
                      <button className="btn small" onClick={() => onLearn(node.id)}>
                        Learn
                      </button>
                      {status !== 'locked' && (
                        <button className="btn small" onClick={() => onPractice(node.id)}>
                          Practice
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div className="screen tree">
      <header className="home-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1>Skill tree</h1>
        <span />
      </header>

      <ul className="tree-legend" aria-label="Legend">
        {LEGEND.map((l) => (
          <li key={l.status}>
            <span className={`dot ${l.status}`} aria-hidden="true" /> {l.label}
          </li>
        ))}
      </ul>

      {section('Math', view.math)}
      {section('Economics', view.econ)}
    </div>
  );
}
