import { GRE_BANK } from './greBank';
import type { ChallengeItem } from './types';

export type { ChallengeItem, ChallengeSource } from './types';
export { GRE_BANK, GRE_BANK_META } from './greBank';

/** Every imported deck. Add a new bank here when its importer lands. */
export const CHALLENGE_DECKS: { title: string; items: ChallengeItem[] }[] = [
  { title: 'GRE Quant bank', items: GRE_BANK },
];
