import type { LotStore } from '../domain/LotStore';

/** When a bidder is suspended, each open lot they lead loses that bid; every lot is written on its own. */
export class StrikeSuspendedBidder {
  constructor(private readonly store: LotStore) {}

  handle(bidderId: string): void {
    for (const lotId of this.store.openLotsLedBy(bidderId)) {
      const lot = this.store.find(lotId);
      if (lot === undefined) continue;
      this.store.save(lot, lot.strikeLeaderIf(bidderId));
    }
  }
}
