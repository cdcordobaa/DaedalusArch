import type { PlotOffer } from '../../../domain/model/PlotOffer';
import type { Offers } from '../../../application/ports/out/Offers';

export class InMemoryOffers implements Offers {
  private readonly rows = new Map<string, PlotOffer>();

  async save(offer: PlotOffer): Promise<void> {
    this.rows.set(offer.plotId, offer);
  }

  async get(plotId: string): Promise<PlotOffer | null> {
    return this.rows.get(plotId) ?? null;
  }
}
