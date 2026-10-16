import { DomainError } from './domain-error';

/** Rush jobs (under three working days) carry a surcharge; certified (sworn) translations a flat fee. */
export const RUSH_SURCHARGE_PERCENT = 40;
export const CERTIFICATION_FEE_CENTS = 3500;
export const MIN_WORDS = 1;
export const MAX_WORDS_PER_JOB = 120_000;

export class JobTooLargeError extends DomainError {
  constructor(words: number) {
    super('JOB_TOO_LARGE', `${String(words)} words exceed one job (${String(MAX_WORDS_PER_JOB)}); split it into batches`);
  }
}

export class WordRate {
  readonly centsPerWord: number;

  constructor(centsPerWord: number) {
    this.centsPerWord = centsPerWord;
  }

  /** Price in cents for `words`, with translation-memory matches billed at a third. */
  priceFor(words: number, matchedWords: number): number {
    const fresh = Math.max(words - matchedWords, 0);
    return Math.round(fresh * this.centsPerWord + (matchedWords * this.centsPerWord) / 3);
  }
}
