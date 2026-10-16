import { DomainError } from './domain-error';
import { CERTIFICATION_FEE_CENTS, RUSH_SURCHARGE_PERCENT, WordRate } from './pricing';

export class QuoteExpiredError extends DomainError {
  constructor(id: string) {
    super('QUOTE_EXPIRED', `Quote ${id} has expired; request a new one`);
  }
}

/** A priced offer for a job, valid for fourteen days. */
export class Quote {
  static readonly VALID_DAYS = 14;

  accepted: boolean;

  constructor(
    readonly id: string,
    readonly clientId: string,
    readonly pair: string,
    readonly words: number,
    readonly matchedWords: number,
    readonly rush: boolean,
    readonly certified: boolean,
    readonly totalCents: number,
    readonly issuedAt: Date,
    accepted: boolean,
  ) {
    this.accepted = accepted;
  }

  static price(rate: WordRate, words: number, matchedWords: number, rush: boolean, certified: boolean): number {
    const base = rate.priceFor(words, matchedWords);
    const withRush = rush ? Math.round((base * (100 + RUSH_SURCHARGE_PERCENT)) / 100) : base;
    return withRush + (certified ? CERTIFICATION_FEE_CENTS : 0);
  }

  accept(today: Date): void {
    const expires = this.issuedAt.getTime() + Quote.VALID_DAYS * 24 * 60 * 60 * 1000;
    if (today.getTime() > expires) {
      throw new QuoteExpiredError(this.id);
    }
    this.accepted = true;
  }
}
