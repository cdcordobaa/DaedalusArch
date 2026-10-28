import type { BackersFacade } from '../../backers';
import type { BackerLookup } from '../application/ports/BackerLookup';

/** Answers what campaigns ask about backers, from the profiles the backers side publishes. */
export class BackersAdapter implements BackerLookup {
  constructor(private readonly backers: BackersFacade) {}

  isRegistered(backerId: string): boolean {
    return this.backers.profile(backerId) !== undefined;
  }
}
