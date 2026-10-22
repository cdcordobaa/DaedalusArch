import { RatesUnavailable } from '../../domain/errors/RatesUnavailable';
import { Parcel } from '../../domain/model/Parcel';
import type { Quote } from '../../domain/model/Quote';
import { PriceTable } from '../../domain/services/PriceTable';
import { QuotePolicy } from '../../domain/services/QuotePolicy';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { CarrierRates } from '../ports/out/CarrierRates';

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly carrier: CarrierRates,
    private readonly policy: QuotePolicy = new QuotePolicy(),
    private readonly table: PriceTable = new PriceTable(),
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const quote = await this.liveOrTable(parcel);
    return { amount: quote.price.amount(), currency: quote.price.currency, service: quote.service, estimated: quote.estimated };
  }

  private async liveOrTable(parcel: Parcel): Promise<Quote> {
    try {
      return this.policy.best(parcel, await this.carrier.ratesFor(parcel));
    } catch (e) {
      if (e instanceof RatesUnavailable) return this.table.quote(parcel);
      throw e;
    }
  }
}
