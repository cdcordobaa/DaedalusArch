import type { Costume } from '../../../domain/model/Costume';

/** What the cleaners answered: a ticket, or that they will not take the pieces (they are cleaned by hand). */
export type HandInResult = { accepted: true; ticket: string; readyBy: string } | { accepted: false };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, or that they do not accept the fabric. */
  handIn(costume: Costume): Promise<HandInResult>;
}
