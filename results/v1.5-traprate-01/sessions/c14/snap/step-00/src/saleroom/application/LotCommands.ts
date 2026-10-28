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

  placeBid(lotId: string, bidderId: string, amount: number): 'accepted' {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    if (!this.bidders.isRegistered(bidderId)) throw new SaleroomError(`no account ${bidderId}`);
    const events = lot.bid(bidderId, amount);
    this.store.save(lot, events);
    return 'accepted';
  }
}
