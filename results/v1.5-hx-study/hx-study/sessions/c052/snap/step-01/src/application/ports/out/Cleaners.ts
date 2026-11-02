import type { Costume } from '../../../domain/model/Costume';

/** The cleaners' answer: a ticket, or a statement that they will not take the costume and it must be cleaned by hand. */
export type HandInResult =
  | { readonly accepted: true; readonly ticket: string; readonly readyBy: string }
  | { readonly accepted: false };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning. */
  handIn(costume: Costume): Promise<HandInResult>;
}
