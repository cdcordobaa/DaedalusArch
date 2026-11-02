import type { Costume } from '../../../domain/model/Costume';

/** The cleaners cannot take the costume now; try again after this many whole hours. */
export interface CleanersBusy {
  readonly busy: true;
  readonly retryInHours: number;
}

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, null when they will not take its fabric, or a busy answer. */
  handIn(costume: Costume): Promise<{ ticket: string; readyBy: string } | CleanersBusy | null>;
}
