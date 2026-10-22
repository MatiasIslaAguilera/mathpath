// The working pad: lines of working typed with a math keyboard (MathLive), checked line by line
// after "Check" (engine/working.ts). Each new line starts as a copy of the one above, because
// working is a series of small edits, not retyping. MathLive is loaded only when a pad is shown.

import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';
import type { LineStatus } from '../../engine/working';
import { Tex } from './MathText';

type MathLive = typeof import('mathlive');

let loading: Promise<MathLive> | null = null;

/**
 * The keys algebra working needs, digits in the middle like a phone keypad. MathLive's default
 * layout has calculus and logic keys (∫, ∀, i) and no "or" for two roots. Letters stay under "abc".
 * Placeholders: #@ = what's just before the caret, #0 = the selection, #? = an empty box.
 */
const ALGEBRA = {
  label: '123',
  tooltip: 'Algebra',
  rows: [
    ['x', 'y', '[(]', '[)]', '[7]', '[8]', '[9]', { latex: '\\frac{#0}{#?}', tooltip: 'Fraction' }, '[backspace]'],
    ['#@^2', '#@^{#?}', '\\sqrt{#0}', '\\pm', '[4]', '[5]', '[6]', '\\times', '[left]'],
    ['\\ln(#0)', 'e^{#?}', { insert: '\\text{ or }', label: 'or', tooltip: 'Two solutions: x = 2 or x = 3' }, ',', '[1]', '[2]', '[3]', '[-]', '[right]'],
    ['[hide-keyboard]', 'q', '\\cdot', '\\div', '[0]', '[.]', '[=]', '[+]', '[return]'],
  ],
};

/** Load MathLive once: KaTeX fonts come from the app's own CSS, no key sounds, the algebra keyboard. */
function loadMathLive(): Promise<MathLive> {
  loading ??= import('mathlive').then((ml) => {
    ml.MathfieldElement.fontsDirectory = null;
    ml.MathfieldElement.soundsDirectory = null;
    const kb = window.mathVirtualKeyboard;
    kb.layouts = [ALGEBRA, 'alphabetic'];
    // Keep the page scrollable above the docked keyboard (Android: it covers the bottom half).
    kb.addEventListener('geometrychange', () => {
      document.documentElement.style.setProperty('--keyboard-height', `${kb.visible ? kb.boundingRect.height : 0}px`);
    });
    return ml;
  });
  return loading;
}

export interface PadLine {
  id: number;
  latex: string;
}

const MARK: Partial<Record<LineStatus, { icon: string; label: string }>> = {
  ok: { icon: '✓', label: 'This line is right' },
  some: { icon: '✓', label: 'Right for one of the solutions' },
  wrong: { icon: '✗', label: 'This line is not right' },
  unreadable: { icon: '?', label: "Couldn't read this line" },
};

function MathLine({ ml, latex, index, autoFocus, onChange, onEnter }: {
  ml: MathLive;
  latex: string;
  index: number;
  autoFocus: boolean;
  onChange(latex: string): void;
  onEnter(): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onChange, onEnter });
  cb.current = { onChange, onEnter };
  const initial = useRef(latex);

  useEffect(() => {
    const el: MathfieldElement = new ml.MathfieldElement();
    el.value = initial.current;
    el.smartFence = true;
    el.mathVirtualKeyboardPolicy = 'auto'; // touch: MathLive's keyboard, and Gboard stays closed
    el.setAttribute('aria-label', `Working line ${index + 1}`);
    el.dataset.testid = `working-line-${index}`;
    el.addEventListener('input', () => cb.current.onChange(el.value));
    // Return on the math keyboard (or a hardware keyboard) commits the line: start the next one.
    // "change" also fires on blur, which must not add a line.
    el.addEventListener('change', () => el.hasFocus() && cb.current.onEnter());
    // Scroll only if the keyboard (and the bar on it) would cover the line: moving the page under
    // a finger that is about to tap again is worse than not scrolling.
    el.addEventListener('focus', () =>
      setTimeout(() => {
        const keyboard = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0;
        const r = el.getBoundingClientRect();
        if (r.bottom > window.innerHeight - keyboard - 64 || r.top < 64) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 300),
    );
    host.current!.appendChild(el);
    if (autoFocus) {
      requestAnimationFrame(() => {
        el.focus();
        el.executeCommand('moveToMathfieldEnd');
      });
    }
    return () => el.remove();
    // The field owns its value after mount; `index` only labels it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ml]);

  return <div className="working-field" ref={host} />;
}

export function WorkingPad({ lines, setLines, status, answerHint, onUseAnswer, onCheck, disabled }: {
  lines: PadLine[];
  setLines(update: (lines: PadLine[]) => PadLine[]): void;
  /** Per-line verdicts after Check (feedback); undefined while working. */
  status?: LineStatus[];
  /** "x = −6": shown when the last lines state an answer that isn't in the answer box yet. */
  answerHint?: string | null;
  onUseAnswer(): void;
  /** Check from the bar above the keyboard (the page's Check button is under the keyboard). */
  onCheck?(): void;
  disabled?: boolean;
}) {
  const [ml, setMl] = useState<MathLive | null>(null);
  const [failed, setFailed] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const nextId = useRef(lines.reduce((m, l) => Math.max(m, l.id), 0) + 1);

  useEffect(() => {
    if (disabled) return;
    let live = true;
    loadMathLive().then(
      (m) => live && setMl(m),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [disabled]);

  useEffect(() => {
    if (!ml || disabled) return;
    const kb = window.mathVirtualKeyboard;
    const onToggle = () => setKeyboardOpen(kb.visible);
    kb.addEventListener('virtual-keyboard-toggle', onToggle);
    return () => {
      kb.removeEventListener('virtual-keyboard-toggle', onToggle);
      kb.hide();
    };
  }, [ml, disabled]);

  const addLine = () => {
    const id = nextId.current++;
    setLines((ls) => [...ls, { id, latex: ls.at(-1)?.latex ?? '' }]);
    setFocusId(id);
  };

  // Read-only view (feedback): the lines with their verdicts.
  if (disabled) {
    if (!lines.some((l) => l.latex.trim())) return null;
    return (
      <ol className="working-lines readonly" data-testid="working-review">
        {lines.map((l, i) =>
          l.latex.trim() ? (
            <li key={l.id} className={`working-row ${status?.[i] ?? ''}`} data-status={status?.[i]}>
              <span className="working-num">{i + 1}</span>
              <Tex latex={l.latex} />
              {status?.[i] && MARK[status[i]] && (
                <span className="working-mark" aria-label={MARK[status[i]]!.label} title={MARK[status[i]]!.label}>
                  {MARK[status[i]]!.icon}
                </span>
              )}
            </li>
          ) : null,
        )}
      </ol>
    );
  }

  return (
    <section className="working" data-testid="working-pad" aria-label="Your working">
      <div className="working-head">
        <h3>Your working</h3>
        <span className="fine">Optional. Each line is checked after you press Check.</span>
      </div>
      {failed && <p className="input-error">The math keyboard didn't load. You can still type the answer below.</p>}
      {!ml && !failed && <p className="fine">Loading the math keyboard…</p>}
      {ml && (
        <ol className="working-lines">
          {lines.map((l, i) => (
            <li key={l.id} className="working-row">
              <span className="working-num">{i + 1}</span>
              <MathLine
                ml={ml}
                latex={l.latex}
                index={i}
                autoFocus={l.id === focusId}
                onChange={(latex) => setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, latex } : x)))}
                onEnter={addLine}
              />
              {lines.length > 1 && (
                <button className="icon-btn small" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Delete line ${i + 1}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {ml && (
        <div className="working-actions">
          <button className="btn small" onClick={addLine} data-testid="working-add">
            + Next line
          </button>
          {answerHint && (
            <button className="btn small primary" onClick={onUseAnswer} data-testid="working-use-answer">
              Use <Tex latex={answerHint} /> as answer ↓
            </button>
          )}
        </div>
      )}
      {/* While the math keyboard is up it covers the page's buttons: the same actions sit on top of it.
          pointerdown is cancelled so the tap doesn't blur the field (which would close the keyboard). */}
      {keyboardOpen && (
        <div className="keyboard-bar" onPointerDown={(e) => e.preventDefault()} data-testid="keyboard-bar">
          <button className="btn small" onClick={addLine}>
            + Next line
          </button>
          {answerHint && (
            <button className="btn small" onClick={onUseAnswer}>
              Use <Tex latex={answerHint} />
            </button>
          )}
          {onCheck && (
            <button
              className="btn small primary"
              onClick={() => {
                window.mathVirtualKeyboard.hide();
                onCheck();
              }}
            >
              Check
            </button>
          )}
        </div>
      )}
    </section>
  );
}
