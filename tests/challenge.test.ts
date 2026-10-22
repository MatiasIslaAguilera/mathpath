// The static deck is imported from a question bank, so there are no generators to check. These
// tests protect the import boundary instead: ids, source metadata, option/key consistency, and
// the app's own answer checker accepting every stored answer.

import { describe, expect, it } from 'vitest';
import { GRE_BANK } from '../src/content';
import { checkAnswer } from '../src/engine/checker';
import type { AnswerInput, AnswerSpec } from '../src/engine/types';

const inputOf = (a: AnswerSpec): AnswerInput =>
  a.kind === 'tuple' ? a.values : a.kind === 'choice' ? a.correct : a.kind === 'multi' ? a.correct : a.value;

describe('GRE challenge bank', () => {
  it('imports the full bank with unique ids and source records', () => {
    expect(GRE_BANK).toHaveLength(200);
    expect(new Set(GRE_BANK.map((i) => i.id)).size).toBe(GRE_BANK.length);
    expect(new Set(GRE_BANK.map((i) => i.source.qid)).size).toBe(GRE_BANK.length);
    for (const item of GRE_BANK) {
      expect(item.prompt.trim(), item.id).not.toBe('');
      expect(item.explanation.trim(), item.id).not.toBe('');
      expect(item.difficulty, item.id).toBeGreaterThanOrEqual(1);
      expect(item.difficulty, item.id).toBeLessThanOrEqual(5);
      expect(item.source.bank, item.id).toBeTruthy();
      expect(item.source.url, item.id).toMatch(/^https:\/\//);
    }
  });

  it('has well-formed answer specs and accepts every stored answer', () => {
    for (const item of GRE_BANK) {
      const a = item.answer;
      if (a.kind === 'choice') {
        expect(a.options.length, item.id).toBeGreaterThanOrEqual(2);
        expect(a.options.map((o) => o.id), item.id).toContain(a.correct);
        expect(new Set(a.options.map((o) => o.id)).size, item.id).toBe(a.options.length);
      } else if (a.kind === 'multi') {
        expect(a.correct.length, item.id).toBeGreaterThan(0);
        expect(new Set(a.correct).size, item.id).toBe(a.correct.length);
        for (const id of a.correct) expect(a.options.map((o) => o.id), item.id).toContain(id);
      } else if (a.kind === 'tuple') {
        expect(a.values.length, item.id).toBe(a.labels.length);
      } else {
        expect(a.value.trim(), item.id).not.toBe('');
        expect(a.display.trim(), item.id).not.toBe('');
      }
      const result = checkAnswer(a, inputOf(a));
      expect(result.error, item.id).toBeUndefined();
      expect(result.correct, item.id).toBe(true);
    }
  });

  it('does not leave option lines inside the prompt', () => {
    for (const item of GRE_BANK) {
      if (!item.type.startsWith('Multiple Choice')) continue;
      expect(item.prompt, item.id).not.toMatch(/^\s*\([A-E]\)\s/m);
    }
  });
});
