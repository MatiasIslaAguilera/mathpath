// Builders for AnswerSpec / MisconceptionInstance so skill files stay short.

import { Q } from './rational';
import type { AnswerSpec, ChoiceOption, MisconceptionInstance } from './types';

export function numberAnswer(v: Q | number): AnswerSpec {
  const x = Q.of(v);
  return { kind: 'number', value: x.toString(), display: x.toLatex() };
}

export function expressionAnswer(value: string, display: string, variables: string[] = ['x']): AnswerSpec {
  return { kind: 'expression', value, variables, display };
}

export function tupleAnswer(labels: string[], values: (Q | number)[], displayLabels: string[] = labels): AnswerSpec {
  const qs = values.map((v) => Q.of(v));
  return {
    kind: 'tuple',
    labels,
    values: qs.map((v) => v.toString()),
    display: qs.map((v, i) => `${displayLabels[i]} = ${v.toLatex()}`).join(',\\; '),
  };
}

export function choiceAnswer(options: ChoiceOption[], correct: string): AnswerSpec {
  return { kind: 'choice', options, correct };
}

/** A misconception's predicted wrong number; null if the computation is undefined. */
export function wrongNumber(id: string, compute: () => Q | number): MisconceptionInstance | null {
  try {
    return { id, wrong: numberAnswer(compute()) };
  } catch {
    return null; // e.g. division by zero: this misconception can't occur with these numbers
  }
}

/** The four fixed GRE quantitative-comparison options, always in this order (as on the test). */
export const QC_OPTIONS: ChoiceOption[] = [
  { id: 'a', label: 'Quantity A is greater.' },
  { id: 'b', label: 'Quantity B is greater.' },
  { id: 'c', label: 'The two quantities are equal.' },
  { id: 'd', label: 'The relationship cannot be determined from the information given.' },
];
export type QcRelation = 'a' | 'b' | 'c' | 'd';

export function qcAnswer(relation: QcRelation): AnswerSpec {
  return { kind: 'choice', options: QC_OPTIONS, correct: relation };
}

/** Select-all-that-apply. */
export function multiAnswer(options: ChoiceOption[], correct: string[]): AnswerSpec {
  return { kind: 'multi', options, correct };
}
