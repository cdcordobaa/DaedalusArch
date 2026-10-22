import { FastshipUnavailableError } from 'fastship-sdk';
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
      const response = await this.rates.rates({ origin: { country: parcel.from }, destination: { country: parcel.to }, parcel: { weight: { value: parcel.weightGrams, unit: 'g' } } });
      const heavy = parcel.weightGrams > 20000;
      const best = response.rates
        .filter((r) => (r.serviceCode === 'FREIGHT') === heavy)
        .sort((a, b) => Number(a.amount.value) - Number(b.amount.value))[0];
      if (best === undefined) throw new Error('no carrier service for this parcel');
      return { amount: Math.round((Number(best.amount.value) + 1.5) * 100) / 100, currency: best.amount.currency, service: best.serviceName, estimated: false };
    } catch (e) {
      if (!(e instanceof FastshipUnavailableError)) throw e;
      const quote = this.table.quote(parcel);
      return { amount: quote.price.amount(), currency: quote.price.currency, service: quote.service, estimated: true };
    }
  }
}
