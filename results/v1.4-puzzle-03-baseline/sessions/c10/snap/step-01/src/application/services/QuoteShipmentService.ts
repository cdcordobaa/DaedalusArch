import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import { ShippingError } from '../../domain/errors/ShippingError';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const HANDLING_FEE_EUR = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const rate = await this.rates.cheapest(parcel);
    if (!rate) throw new ShippingError('no Fastship service available for this parcel');
    const price = rate.price.plus(Money.of(HANDLING_FEE_EUR, rate.price.currency));
    return { amount: price.amount(), currency: price.currency, service: rate.service };
  }
}
