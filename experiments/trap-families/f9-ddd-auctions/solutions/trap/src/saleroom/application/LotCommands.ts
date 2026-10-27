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
    const previous = lot.leader;
    const events = lot.bid(bidderId, amount);
    try {
      this.bidders.holdCredit(bidderId, `lot:${lotId}`, amount);
    } catch {
      return 'refused';
    }
    if (previous !== null) this.bidders.releaseCredit(previous, `lot:${lotId}`);
    this.store.save(lot, events);
    return 'accepted';
  }

  close(lotId: string): void {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    const leader = lot.leader;
    const amount = lot.toRecord().leading?.amount ?? 0;
    if (!lot.close()) return;
    if (lot.toRecord().buyer !== null) this.bidders.recordPurchase(leader!, lotId, amount);
    else if (leader !== null) this.bidders.releaseCredit(leader, `lot:${lotId}`);
    this.store.save(lot);
  }

  strikeLeadsOf(bidderId: string): void {
    for (const lotId of this.store.openLotsLedBy(bidderId)) {
      const lot = this.store.find(lotId)!;
      lot.strikeLeader();
      this.store.save(lot);
    }
  }
}
