import { Payout } from "../domain/payout/Payout";
import { PayoutRepository } from "../domain/payout/PayoutRepository";

export class InMemoryPayoutRepository implements PayoutRepository {
  private readonly payouts = new Map<string, Payout>();

  save(payout: Payout): void {
    for (const other of this.payouts.values()) {
      if (other.id !== payout.id && other.reference === payout.reference) {
        throw new Error(`reference ${payout.reference} is already used`);
      }
    }
    this.payouts.set(payout.id, payout);
  }

  byId(id: string): Payout | undefined {
    return this.payouts.get(id);
  }
}
