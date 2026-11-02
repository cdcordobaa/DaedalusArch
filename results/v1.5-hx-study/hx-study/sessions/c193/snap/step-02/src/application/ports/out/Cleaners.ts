import type { Costume } from '../../../domain/model/Costume';

/** The cleaners' answer when they take the costume. */
export interface CleaningTicket {
  readonly ticket: string;
  readonly readyBy: string;
}

/** The cleaners are too busy right now; try again after the given whole hours. */
export interface CleaningBusy {
  readonly busy: true;
  readonly retryInHours: number;
}

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, null when the cleaners will not take its fabric, or CleaningBusy when they have no room. */
  handIn(costume: Costume): Promise<CleaningTicket | CleaningBusy | null>;
}
