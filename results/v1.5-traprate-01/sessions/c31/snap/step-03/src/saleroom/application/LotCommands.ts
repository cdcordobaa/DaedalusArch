import { Lot } from '../domain/Lot';
import type { LotStore } from '../domain/LotStore';
import { SaleroomError } from '../domain/SaleroomError';
import type { Bidders } from './ports/Bidders';

export class LotCommands {
  constructor(
    private readonly store: LotStore,
    private readonly bidders: Bidders,
  ) {}

  open(title: string, openingBid: number, reserve: number): string {
    const [lot, events] = Lot.open(this.store.newId(), title, openingBid, reserve);
    this.store.save(lot, events);
    return lot.id;
  }

  placeBid(lotId: string, bidderId: string, amount: number): 'accepted' | 'refused' {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    if (!this.bidders.isRegistered(bidderId)) throw new SaleroomError(`no account ${bidderId}`);
    if (this.bidders.isSuspended(bidderId)) throw new SaleroomError(`account ${bidderId} is suspended`);
    const { outcome, events } = lot.bid(bidderId, amount, this.bidders.creditAvailable(bidderId));
    if (outcome === 'accepted') this.store.save(lot, events);
    return outcome;
  }

  /** A suspended bidder's leading bids on open lots are struck out. */
  withdrawBids(bidderId: string): void {
    for (const lot of this.store.all()) {
      const events = lot.withdraw(bidderId);
      if (events.length > 0) this.store.save(lot, events);
    }
  }

  close(lotId: string): void {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    const events = lot.close();
    if (events.length > 0) this.store.save(lot, events);
  }
}
