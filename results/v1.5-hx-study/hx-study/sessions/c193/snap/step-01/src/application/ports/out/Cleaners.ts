import type { Costume } from '../../../domain/model/Costume';

/** The cleaners' answer when they take the costume. */
export interface CleaningTicket {
  readonly ticket: string;
  readonly readyBy: string;
}

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, or null when the cleaners will not take its fabric. */
  handIn(costume: Costume): Promise<CleaningTicket | null>;
}
