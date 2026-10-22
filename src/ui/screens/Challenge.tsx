// Static challenge deck imported from a question bank (currently the 200-question GRE Quant
// bank). This is deliberately separate from the adaptive skill session: items are not
// procedurally generated, do not have skill levels, and never change the Elo/FSRS state.

import { useMemo, useState } from 'react';
import { checkAnswer } from '../../engine/checker';
import type { AnswerInput as Value } from '../../engine/types';
import { GRE_BANK, GRE_BANK_META, type ChallengeItem } from '../../content';
import { AnswerDisplay } from '../components/AnswerDisplay';
import { AnswerInput, initialValue } from '../components/AnswerInput';

const STATS_KEY = 'mathpath.challenge.v1';
const START_SIZE = 10;

interface ItemStat {
  attempts: number;
  correct: number;
}
interface ChallengeStats {
  attempts: number;
  correct: number;
  byId: Record<string, ItemStat>;
}
const emptyStats = (): ChallengeStats => ({ attempts: 0, correct: 0, byId: {} });

function loadStats(): ChallengeStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<ChallengeStats>;
    return { ...emptyStats(), ...parsed, byId: parsed.byId ?? {} };
  } catch {
    return emptyStats();
  }
}

function saveStats(stats: ChallengeStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* private mode / quota: the deck still works for this visit */
  }
}

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DIFFICULTY: Record<number, string> = { 1: 'Simple', 2: 'Middle', 3: 'Hard', 4: 'Challenging' };
const pct = (correct: number, attempts: number) => (attempts ? `${Math.round((correct / attempts) * 100)}%` : '—');

type View = 'menu' | 'run' | 'done';
interface Result {
  correct: boolean;
  error?: string;
  revealed?: boolean;
}

export function Challenge({ onBack }: { onBack(): void }) {
  const [stats, setStats] = useState<ChallengeStats>(loadStats);
  const [topic, setTopic] = useState('All');
  const [difficulty, setDifficulty] = useState(0);
  const [view, setView] = useState<View>('menu');
  const [queue, setQueue] = useState<ChallengeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState<Value>('');
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [runCorrect, setRunCorrect] = useState(0);

  const topics = useMemo(() => ['All', ...Array.from(new Set(GRE_BANK.map((i) => i.topic))).sort()], []);
  const filtered = useMemo(
    () => GRE_BANK.filter((i) => (topic === 'All' || i.topic === topic) && (difficulty === 0 || i.difficulty === difficulty)),
    [topic, difficulty],
  );
  const item = view === 'run' ? queue[index] : undefined;

  const start = (items: ChallengeItem[]) => {
    if (!items.length) return;
    const next = shuffled(items);
    setQueue(next);
    setIndex(0);
    setInput(initialValue(next[0].answer));
    setChecked(false);
    setResult(null);
    setRunCorrect(0);
    setView('run');
    window.scrollTo({ top: 0 });
  };

  const check = () => {
    if (!item || checked) return;
    try {
      const r = checkAnswer(item.answer, input);
      if (r.error) {
        setResult({ correct: false, error: r.error });
        return;
      }
      setChecked(true);
      setResult({ correct: r.correct });
      if (r.correct) setRunCorrect((n) => n + 1);
      const prev = stats.byId[item.id] ?? { attempts: 0, correct: 0 };
      const next: ChallengeStats = {
        attempts: stats.attempts + 1,
        correct: stats.correct + (r.correct ? 1 : 0),
        byId: {
          ...stats.byId,
          [item.id]: { attempts: prev.attempts + 1, correct: prev.correct + (r.correct ? 1 : 0) },
        },
      };
      setStats(next);
      saveStats(next);
    } catch {
      setResult({ correct: false, error: 'I could not read that answer. Check the brackets and operators.' });
    }
  };

  const reveal = () => {
    if (!item || checked) return;
    setChecked(true);
    setResult({ correct: false, revealed: true });
    const prev = stats.byId[item.id] ?? { attempts: 0, correct: 0 };
    const next: ChallengeStats = {
      attempts: stats.attempts + 1,
      correct: stats.correct,
      byId: { ...stats.byId, [item.id]: { attempts: prev.attempts + 1, correct: prev.correct } },
    };
    setStats(next);
    saveStats(next);
  };

  const next = () => {
    if (!queue.length) return;
    if (index + 1 >= queue.length) {
      setView('done');
      return;
    }
    const nextItem = queue[index + 1];
    setIndex(index + 1);
    setInput(initialValue(nextItem.answer));
    setChecked(false);
    setResult(null);
    window.scrollTo({ top: 0 });
  };

  const restart = () => start(queue);

  const header = (title: string) => (
    <header className="home-head">
      <button
        className="icon-btn"
        onClick={() => {
          if (view === 'run') {
            setView('menu');
            setQueue([]);
            setResult(null);
            setChecked(false);
          } else {
            onBack();
          }
        }}
        aria-label={view === 'run' ? 'Back to the bank' : 'Back'}
      >
        ←
      </button>
      <h1>{title}</h1>
      <span />
    </header>
  );

  if (view === 'menu') {
    return (
      <div className="screen challenge" data-testid="challenge">
        {header('Past papers')}
        <section className="card">
          <h2>GRE Quant bank</h2>
          <p className="fine">
            {GRE_BANK_META.count} static questions imported from{' '}
            <a href={GRE_BANK_META.url} target="_blank" rel="noreferrer">
              {GRE_BANK_META.bank}
            </a>
            . Answer keys and explanations come from the bank. This deck is separate from your mastery
            rating and streak.
          </p>
          <p className="fine" data-testid="challenge-stats">
            {stats.attempts} answered · {stats.correct} correct · {pct(stats.correct, stats.attempts)} accuracy
          </p>
          <div className="challenge-filters">
            <div className="seg" role="radiogroup" aria-label="Topic">
              {topics.map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={topic === t}
                  className={`seg-btn ${topic === t ? 'selected' : ''}`}
                  onClick={() => setTopic(t)}
                >
                  {t === 'Quantitative Comparison' ? 'QC' : t}
                </button>
              ))}
            </div>
            <div className="seg" role="radiogroup" aria-label="Difficulty">
              <button
                role="radio"
                aria-checked={difficulty === 0}
                className={`seg-btn ${difficulty === 0 ? 'selected' : ''}`}
                onClick={() => setDifficulty(0)}
              >
                All levels
              </button>
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={difficulty === d}
                  className={`seg-btn ${difficulty === d ? 'selected' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY[d]}
                </button>
              ))}
            </div>
          </div>
          <p className="fine">
            {filtered.length} question{filtered.length === 1 ? '' : 's'} in this filter.
          </p>
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => start(shuffled(filtered).slice(0, START_SIZE))}
              disabled={!filtered.length}
              data-testid="challenge-start"
            >
              Start {Math.min(START_SIZE, filtered.length)}
            </button>
            <button className="btn" onClick={() => start(filtered)} disabled={!filtered.length}>
              Start all {filtered.length}
            </button>
          </div>
        </section>
        <section className="card">
          <h2>What this is</h2>
          <p className="fine">
            A past-paper-style deck for GRE Quant: numeric entry, single and multiple choice, and quantitative
            comparison. Wrong answers show the bank's answer and explanation, so you can mine the method before
            returning to the adaptive session.
          </p>
          <p className="fine">Challenge history is saved on this device only.</p>
        </section>
      </div>
    );
  }

  if (view === 'done') {
    const last = queue[queue.length - 1];
    return (
      <div className="screen challenge" data-testid="challenge">
        {header('Deck done')}
        <section className="card center">
          <h2>
            {runCorrect} / {queue.length}
          </h2>
          <p className="fine">Correct in this run · {stats.attempts} total challenge answers</p>
          {last && (
            <p className="fine">
              Last item: {last.source.qid} · {last.topic}
            </p>
          )}
          <div className="btn-row">
            <button className="btn primary" onClick={restart}>
              Run this deck again
            </button>
            <button className="btn" onClick={() => setView('menu')}>
              Back to the bank
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="screen challenge" data-testid="challenge">
        {header('Past papers')}
        <section className="card">
          <p>This deck is empty.</p>
          <button className="btn primary" onClick={() => setView('menu')}>
            Back to the bank
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="screen challenge" data-testid="challenge">
      {header(`Past papers · ${index + 1}/${queue.length}`)}
      <div className="bar" role="progressbar" aria-valuenow={index + 1} aria-valuemax={queue.length} aria-label="Challenge progress">
        <div className="bar-fill" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
      </div>
      <div className="challenge-meta">
        <span className="skill-chip">
          {item.topic} · {DIFFICULTY[item.difficulty] ?? `Level ${item.difficulty}`}
        </span>
        <span className="fine">
          {item.source.qid} · {item.type}
        </span>
      </div>
      <div className="prompt challenge-prompt" data-testid="challenge-prompt">
        {item.prompt}
      </div>
      <AnswerInput
        key={item.id}
        spec={item.answer}
        value={input}
        onChange={(v) => {
          setInput(v);
          if (result?.error) setResult(null);
        }}
        onEnter={check}
        disabled={checked}
        autoFocus
      />
      {result?.error && (
        <p className="input-error" role="alert">
          {result.error}
        </p>
      )}
      {!checked ? (
        <div className="btn-row">
          <button className="btn primary" onClick={check} data-testid="challenge-check">
            Check
          </button>
          <button className="btn subtle" onClick={reveal}>
            Show answer
          </button>
        </div>
      ) : (
        <div className="feedback" data-testid="challenge-feedback">
          <div className={`banner ${result?.correct ? 'good' : result?.revealed ? 'info' : 'bad'}`} role="status" aria-live="polite">
            {result?.correct ? 'Correct.' : result?.revealed ? 'Answer revealed.' : 'Not quite.'}
          </div>
          <div className="answer-box">
            <span className="label">Answer</span>
            <AnswerDisplay spec={item.answer} />
          </div>
          <div className="callout info challenge-explanation">
            <strong>Explanation.</strong> {item.explanation}
          </div>
          <p className="fine">
            Source: {item.source.bank} · {item.source.qid} · {item.source.originalDifficulty} ·{' '}
            {item.source.originalType}
          </p>
          <button className="btn primary wide" onClick={next} data-testid="challenge-next" autoFocus>
            {index + 1 >= queue.length ? 'Finish deck' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
