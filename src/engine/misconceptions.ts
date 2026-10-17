import { checkAnswer, evalExact } from './checker';
import type { AnswerInput, AnswerSpec, MisconceptionInstance, Problem } from './types';

/** The id of the misconception whose predicted wrong answer matches the input, if any. */
export function matchMisconception(problem: Problem, input: AnswerInput): string | undefined {
  for (const m of problem.misconceptions) {
    if (checkAnswer(m.wrong, input).correct) return m.id;
  }
  return undefined;
}

function specValues(spec: AnswerSpec): string[] {
  switch (spec.kind) {
    case 'number':
      return [spec.value];
    case 'tuple':
      return spec.values;
    case 'expression':
      return [spec.value];
    case 'choice':
      return [spec.correct];
  }
}

function asInput(spec: AnswerSpec): AnswerInput {
  return spec.kind === 'tuple' ? spec.values : specValues(spec)[0];
}

/**
 * Keep only misconceptions that are well defined and distinguishable: a predicted wrong
 * answer that equals the correct answer (or an earlier misconception) can't be diagnosed.
 * Generators pass candidates; `null` entries mean "doesn't apply to these numbers".
 */
export function distinctMisconceptions(
  correct: AnswerSpec,
  candidates: (MisconceptionInstance | null)[],
): MisconceptionInstance[] {
  const kept: MisconceptionInstance[] = [];
  for (const c of candidates) {
    if (!c) continue;
    if (c.wrong.kind !== 'expression' && c.wrong.kind !== 'choice') {
      if (specValues(c.wrong).some((v) => !Number.isFinite(evalExact(v)))) continue;
    }
    const input = asInput(c.wrong);
    if (checkAnswer(correct, input).correct) continue;
    if (kept.some((k) => checkAnswer(k.wrong, input).correct)) continue;
    kept.push(c);
  }
  return kept;
}
