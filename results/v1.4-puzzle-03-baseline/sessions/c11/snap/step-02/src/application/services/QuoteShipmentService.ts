import { RatesUnavailableError, ShippingError } from '../../domain/errors/ShippingError';
import { PriceTable } from '../../domain/services/PriceTable';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { Quote } from '../../domain/model/Quote';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const HANDLING_FEE = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly rates: RatePort,
    private readonly fallback: PriceTable,
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let cheapest: Quote | undefined;
    let estimated = false;
    try {
      const rates = await this.rates.rates(parcel);
      cheapest = rates.reduce<Quote | undefined>(
        (best, r) => (best === undefined || r.price.isLessThan(best.price) ? r : best),
        undefined,
      );
    } catch (e) {
      if (!(e instanceof RatesUnavailableError)) throw e;
      cheapest = this.fallback.quote(parcel);
      estimated = true;
    }
    if (!cheapest) throw new ShippingError('no Fastship service available for this parcel');
    const price = cheapest.price.plus(Money.of(HANDLING_FEE, cheapest.price.currency));
    return { amount: price.amount(), currency: price.currency, service: cheapest.service, estimated };
  }
}
