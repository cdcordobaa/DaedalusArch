import { ShippingError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const HANDLING_FEE = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const rates = await this.rates.rates(parcel);
    const cheapest = rates.reduce((best, r) => (r.price.isLessThan(best.price) ? r : best), rates[0]);
    if (!cheapest) throw new ShippingError('no Fastship service available for this parcel');
    const total = cheapest.price.plus(Money.of(HANDLING_FEE, cheapest.price.currency));
    return { amount: total.amount(), currency: total.currency, service: cheapest.service };
  }
}
