import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

export const QUOTE_CURRENCY = 'EUR';
const HANDLING_FEE = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const cheapest = await this.rates.cheapest(parcel);
    const price = cheapest.price.plus(Money.of(HANDLING_FEE, QUOTE_CURRENCY));
    return { amount: price.amount(), currency: price.currency, service: cheapest.service };
  }
}
