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

  close(lotId: string): void {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    this.store.save(lot, lot.close());
  }

  /** Removes the bidder's leading bid from every open lot; returns those lots. */
  withdrawBidsOf(bidderId: string): string[] {
    const withdrawn: string[] = [];
    for (const lot of this.store.all()) {
      if (!lot.withdrawLead(bidderId)) continue;
      this.store.save(lot);
      withdrawn.push(lot.id);
    }
    return withdrawn;
  }

  placeBid(lotId: string, bidderId: string, amount: number): 'accepted' | 'refused' {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    if (!this.bidders.isRegistered(bidderId)) throw new SaleroomError(`no account ${bidderId}`);
    if (this.bidders.isSuspended(bidderId)) throw new SaleroomError(`account ${bidderId} is suspended`);
    lot.assertCanBid(bidderId, amount);
    if (amount > this.bidders.creditAvailable(bidderId)) return 'refused';
    const events = lot.bid(bidderId, amount);
    this.store.save(lot, events);
    return 'accepted';
  }
}
