import type { Costume } from '../../../domain/model/Costume';

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, null when they will not take the fabric, or retryInHours when they are too busy now. */
  handIn(costume: Costume): Promise<{ ticket: string; readyBy: string } | { retryInHours: number } | null>;
}
