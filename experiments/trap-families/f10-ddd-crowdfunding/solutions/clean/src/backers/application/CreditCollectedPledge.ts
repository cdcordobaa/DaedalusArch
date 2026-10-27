import { Amount } from '../../shared-kernel/Amount';
import type { BackerRepository } from '../domain/backer/BackerRepository';
import { BackerId } from '../domain/backer/value-objects/BackerId';

/** Puts one collected pledge on its backer's record. */
export class CreditCollectedPledge {
  constructor(private readonly backers: BackerRepository) {}

  execute(backerId: string, pledgeId: string, amountCents: number): void {
    const backer = this.backers.find(BackerId.of(backerId));
    if (backer === undefined) throw new Error(`no backer ${backerId}`);
    backer.creditCollectedPledge(pledgeId, Amount.ofCents(amountCents));
    this.backers.save(backer);
  }
}
