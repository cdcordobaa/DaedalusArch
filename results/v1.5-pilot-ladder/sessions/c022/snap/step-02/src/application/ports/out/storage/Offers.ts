import type { PlotOffer } from '../../../../domain/model/PlotOffer';

export interface Offers {
  save(offer: PlotOffer): Promise<void>;
  get(plotId: string): Promise<PlotOffer | null>;
}
