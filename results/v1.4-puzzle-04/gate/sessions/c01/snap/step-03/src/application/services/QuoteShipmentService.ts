import { RatesUnavailableError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { Quote } from '../../domain/model/Quote';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const HANDLING_FEE = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly rates: RatePort,
    private readonly fallback: PriceTable = new PriceTable(),
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let cheapest: Quote;
    let estimated = false;
    try {
      cheapest = await this.rates.cheapest(parcel);
    } catch (e) {
      if (!(e instanceof RatesUnavailableError)) throw e;
      // The house rate is not a freight service, so it cannot stand in for one.
      if (parcel.requiresFreight()) throw e;
      cheapest = this.fallback.quote(parcel);
      estimated = true;
    }
    const price = cheapest.price.plus(Money.of(HANDLING_FEE, cheapest.price.currency));
    return { amount: price.amount(), currency: price.currency, service: cheapest.service, estimated };
  }
}
