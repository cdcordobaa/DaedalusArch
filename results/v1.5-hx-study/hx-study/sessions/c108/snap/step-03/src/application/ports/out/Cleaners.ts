import type { Costume } from '../../../domain/model/Costume';

/** What the cleaners answered: a ticket, or that the costume cannot go to them and must be cleaned by hand. */
export type CleaningOutcome =
  | { readonly kind: 'sent'; readonly ticket: string; readonly readyBy: string }
  | { readonly kind: 'by_hand' }
  | { readonly kind: 'later'; readonly retryInHours: number };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning. */
  handIn(costume: Costume): Promise<CleaningOutcome>;
}
