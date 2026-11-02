import type { Costume } from '../../../domain/model/Costume';

/** The cleaners' answer to a costume handed in: taken with a ticket, or not taken because they will not clean that fabric. */
export type HandInResult =
  | { readonly accepted: true; readonly ticket: string; readonly readyBy: string }
  | { readonly accepted: false };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, or that they would not take it. */
  handIn(costume: Costume): Promise<HandInResult>;
}
