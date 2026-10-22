import { Parcel } from '../../domain/model/Parcel';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatesPort } from '../ports/out/RatesPort';

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly rates: RatesPort,
    private readonly table: PriceTable = new PriceTable(),
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    try {
      const lines = await this.rates.ratesFor(parcel.from, parcel.to, parcel.weightGrams);
      const heavy = parcel.weightGrams > 20000;
      const best = lines
        .filter((r) => (r.serviceCode === 'FREIGHT') === heavy)
        .sort((a, b) => Number(a.amount.value) - Number(b.amount.value))[0];
      if (best === undefined) throw new Error('no carrier service for this parcel');
      return { amount: Math.round((Number(best.amount.value) + 1.5) * 100) / 100, currency: best.amount.currency, service: best.serviceName, estimated: false };
    } catch (e) {
      if (!(e instanceof Error) || e.name !== 'FastshipUnavailableError') throw e;
      const quote = this.table.quote(parcel);
      return { amount: quote.price.amount(), currency: quote.price.currency, service: quote.service, estimated: true };
    }
  }
}
