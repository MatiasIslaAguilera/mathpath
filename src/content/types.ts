// Static challenge items imported from question banks. Unlike SkillDefinition problems these are
// NOT procedurally generated and are NOT part of the mastery rating: the Challenge screen plays
// them as a separate deck.

import type { AnswerSpec, Figure } from '../engine/types';

export interface ChallengeSource {
  /** Repository or bank name, e.g. "lbcty56/GRE-Quiz-App-Python-". */
  bank: string;
  /** Source repository / dataset URL. */
  url: string;
  /** Original question id inside that bank. */
  qid: string;
  originalType: string;
  originalDifficulty: string;
}

export interface ChallengeItem {
  /** Stable id, e.g. "gre-bank:S01". */
  id: string;
  topic: string;
  /** 1 (easy) … 5 (hard). */
  difficulty: number;
  /** Original format label, for display/filtering. */
  type: string;
  /** Plain text, line breaks preserved. */
  prompt: string;
  figure?: Figure;
  answer: AnswerSpec;
  /** Source explanation, shown after answering. */
  explanation: string;
  source: ChallengeSource;
}
