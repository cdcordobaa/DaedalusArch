import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const CURRENCY = 'EUR';
const HANDLING_FEE = Money.of(1.5, CURRENCY);

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const quote = await this.rates.cheapest(parcel);
    const price = quote.price.plus(HANDLING_FEE);
    return { amount: price.amount(), currency: price.currency, service: quote.service };
  }
}
