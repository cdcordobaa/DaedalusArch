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
    const lot = this.load(lotId);
    const standing = this.bidders.standing(bidderId);
    if (standing === undefined) throw new SaleroomError(`no account ${bidderId}`);
    const outcome = lot.bid(bidderId, amount, standing);
    if (outcome.result === 'accepted') this.store.save(lot, outcome.events);
    return outcome.result;
  }

  close(lotId: string): void {
    const lot = this.load(lotId);
    this.store.save(lot, lot.close());
  }

  private load(lotId: string): Lot {
    const lot = this.store.find(lotId);
    if (lot === undefined) throw new SaleroomError(`no lot ${lotId}`);
    return lot;
  }
}
