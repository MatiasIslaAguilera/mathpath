import { useRef } from 'react';
import { previewLatex } from '../../engine/checker';
import type { AnswerInput as Value, AnswerSpec } from '../../engine/types';
import { MathText, Tex } from './MathText';

interface Props {
  spec: AnswerSpec;
  value: Value;
  onChange(v: Value): void;
  onEnter(): void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function initialValue(spec: AnswerSpec): Value {
  return spec.kind === 'tuple' ? spec.labels.map(() => '') : '';
}

const KEYS = ['^', '(', ')', '/', '√(', '-'];

function TextField(props: {
  value: string;
  onChange(v: string): void;
  onEnter(): void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={props.inputRef}
      className="answer-field"
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={props.label ?? 'Your answer'}
      placeholder={props.placeholder ?? 'Your answer'}
      value={props.value}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onEnter();
      }}
    />
  );
}

export function AnswerInput({ spec, value, onChange, onEnter, disabled, autoFocus }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  if (spec.kind === 'choice') {
    return (
      <div className="choices" role="radiogroup">
        {spec.options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            data-option-id={o.id}
            className={`choice ${value === o.id ? 'selected' : ''}`}
            disabled={disabled}
            onClick={() => onChange(o.id)}
          >
            <MathText text={o.label} />
          </button>
        ))}
      </div>
    );
  }

  if (spec.kind === 'tuple') {
    const vals = Array.isArray(value) ? value : spec.labels.map(() => '');
    return (
      <div className="tuple">
        {spec.labels.map((label, i) => (
          <label key={label} className="tuple-row">
            <span className="tuple-label">{label}</span>
            <TextField
              label={label}
              placeholder={label}
              value={vals[i] ?? ''}
              disabled={disabled}
              autoFocus={autoFocus && i === 0}
              onEnter={onEnter}
              onChange={(v) => onChange(vals.map((old, k) => (k === i ? v : old)))}
            />
          </label>
        ))}
      </div>
    );
  }

  const text = typeof value === 'string' ? value : '';
  const isExpr = spec.kind === 'expression';
  const preview = isExpr && text.trim() ? previewLatex(text, spec.variables) : null;

  const insert = (key: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + key + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + key.length, start + key.length);
    });
  };

  return (
    <div className="single">
      <TextField
        inputRef={ref}
        value={text}
        onChange={onChange}
        onEnter={onEnter}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={isExpr ? `e.g. 3${spec.variables[0]}^2 - 4` : 'e.g. 7, -2, 3/4'}
      />
      {isExpr && !disabled && (
        <div className="keyrow" aria-label="Math keys">
          {[spec.variables[0], ...KEYS].map((k) => (
            <button key={k} type="button" className="key" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(k)}>
              {k === '√(' ? '√' : k}
            </button>
          ))}
        </div>
      )}
      {preview && (
        <div className="preview" aria-label="Preview">
          <Tex latex={preview} />
        </div>
      )}
    </div>
  );
}
