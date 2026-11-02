import type { Costume } from '../../../domain/model/Costume';

/** What the cleaners answered to a costume handed in. */
export type HandInResult =
  | { readonly accepted: true; readonly ticket: string; readonly readyBy: string }
  | { readonly accepted: false; readonly reason: 'fabric_not_accepted' }
  | { readonly accepted: false; readonly reason: 'queue_full'; readonly waitMinutes?: number };

/** The cleaning service, in the application's own terms. */
export interface Cleaners {
  /** Hands a costume in for cleaning; answers the cleaners' ticket, or that they will not take the fabric. */
  handIn(costume: Costume): Promise<HandInResult>;
}
