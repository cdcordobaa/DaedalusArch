/** The hirer's cover for one hire, as the quote line shows it; the premium is in pounds. */
export type CoverStatus = 'bound' | 'in_review' | 'none';

export interface CoverQuote {
  /** Whether the hire is covered: bound, still with an underwriter, or not covered at all. */
  readonly cover: CoverStatus;
  readonly quoteRef: string;
  readonly premium: number;
  /** The insurer's own word for the quote, printed on the quote line as is. */
  readonly insurerState: string;
}
