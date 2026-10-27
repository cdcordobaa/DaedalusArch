import type { BackersFacade } from '../../backers';
import type { BackerLookup } from '../application/ports/BackerLookup';
import { parseStanding, type BackerStanding } from '../domain/campaign/value-objects/BackerStanding';

/** Answers what campaigns ask about backers, from the profiles the backers side publishes. */
export class BackersAdapter implements BackerLookup {
  constructor(private readonly backers: BackersFacade) {}

  isRegistered(backerId: string): boolean {
    return this.backers.profile(backerId) !== undefined;
  }

  standingOf(backerId: string): BackerStanding | undefined {
    const profile = this.backers.profile(backerId);
    return profile === undefined ? undefined : parseStanding(profile.standing);
  }
}
