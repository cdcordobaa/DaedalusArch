import type { Costume } from '../../../domain/model/Costume';

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket. */
  handIn(costume: Costume): Promise<{ ticket: string; readyBy: string }>;
}
