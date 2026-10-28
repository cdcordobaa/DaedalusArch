import { Amount } from '../../shared-kernel/Amount';
import { Backer } from '../domain/backer/Backer';
import type { BackerRepository } from '../domain/backer/BackerRepository';
import { BackerId } from '../domain/backer/value-objects/BackerId';

/** Changes to backer accounts made by the backers themselves, by support staff or by the payment desk. */
export class BackerAccounts {
  constructor(private readonly backers: BackerRepository) {}

  register(handle: string): string {
    const backer = Backer.register(this.backers.allocateId(), handle);
    this.backers.save(backer);
    return backer.id.value;
  }

  recordPastBackings(backerId: string, amount: number): void {
    const backer = this.load(backerId);
    backer.addPastBackings(Amount.ofUnits(amount));
    this.backers.save(backer);
  }

  recordMissedPayment(backerId: string): void {
    const backer = this.load(backerId);
    backer.missPayment();
    this.backers.save(backer);
  }

  /** Adds the collected pledges of a funded campaign to the backed totals of the backers who made them. */
  creditCollectedPledges(pledges: readonly { pledgeId: string; backerId: string; amountCents: number }[]): void {
    for (const p of pledges) {
      const backer = this.load(p.backerId);
      backer.creditCollectedPledge(p.pledgeId, Amount.ofCents(p.amountCents));
      this.backers.save(backer);
    }
  }

  private load(backerId: string): Backer {
    const backer = this.backers.find(BackerId.of(backerId));
    if (backer === undefined) throw new Error(`no backer ${backerId}`);
    return backer;
  }
}
