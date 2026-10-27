import type { BackerStanding } from '../../domain/campaign/value-objects/BackerStanding';

/** What campaigns need to know about the people who pledge. */
export interface BackerLookup {
  isRegistered(backerId: string): boolean;
  /** The standing the backers side gives this backer, or undefined for an unknown backer. */
  standingOf(backerId: string): BackerStanding | undefined;
}
