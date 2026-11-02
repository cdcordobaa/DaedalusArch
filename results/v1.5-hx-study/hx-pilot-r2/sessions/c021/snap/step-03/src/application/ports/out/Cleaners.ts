import type { Costume } from '../../../domain/model/Costume';

/** The cleaners' answer: a ticket, or a refusal because they do not take the piece (it must be cleaned by hand). */
export type HandInResult = { readonly ticket: string; readonly readyBy: string } | { readonly byHand: true }
  | { readonly later: true; readonly retryInHours: number };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, or byHand when they will not take it. */
  handIn(costume: Costume): Promise<HandInResult>;
}
