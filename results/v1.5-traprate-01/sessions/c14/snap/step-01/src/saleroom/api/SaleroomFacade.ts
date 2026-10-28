import { LotCommands } from '../application/LotCommands';
import { LotQueries } from '../application/LotQueries';
import type { Bidders } from '../application/ports/Bidders';
import type { LotView } from '../contracts/LotView';
import type { LotStore } from '../domain/LotStore';

export type { LotView } from '../contracts/LotView';
export type { BidPlacedMessage } from '../contracts/SaleroomMessages';

/** What the rest of the house may call in the saleroom. */
export interface SaleroomApi {
  openLot(title: string, openingBid: number, reserve: number): string;
  lot(lotId: string): LotView | undefined;
  placeBid(lotId: string, bidderId: string, amount: number): 'accepted' | 'refused';
}

export function createSaleroom(store: LotStore, bidders: Bidders): SaleroomApi {
  const commands = new LotCommands(store, bidders);
  const queries = new LotQueries(store);
  return {
    openLot: (title, openingBid, reserve) => commands.open(title, openingBid, reserve),
    lot: (lotId) => queries.view(lotId),
    placeBid: (lotId, bidderId, amount) => commands.placeBid(lotId, bidderId, amount),
  };
}
