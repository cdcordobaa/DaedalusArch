import type { LotView } from '../contracts/LotView';
import type { LotStore } from '../domain/LotStore';

export class LotQueries {
  constructor(private readonly store: LotStore) {}

  view(lotId: string): LotView | undefined {
    const lot = this.store.find(lotId);
    if (lot === undefined) return undefined;
    const r = lot.toRecord();
    return { id: r.id, title: r.title, openingBid: r.openingBid, status: r.status, leadingBid: r.leading?.amount ?? null, leader: r.leading?.bidderId ?? null, buyer: r.status === 'sold' ? (r.leading?.bidderId ?? null) : null, nextMinimum: lot.nextMinimum() };
  }
}
