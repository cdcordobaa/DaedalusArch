/** The hirer's cover for one hire, as the quote line shows it; the premium is in pounds. */
export interface CoverQuote {
  readonly quoteRef: string;
  readonly premium: number;
  /** The insurer's own word for the quote, printed on the quote line as is. */
  readonly insurerState: string;
  /** What the quote means for a hire: bound (cover in place), referred (underwriter looking), or none. */
  readonly cover: 'bound' | 'referred' | 'none';
}
