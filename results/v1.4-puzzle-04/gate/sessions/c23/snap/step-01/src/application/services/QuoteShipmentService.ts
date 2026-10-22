import { QuoteUnavailableError } from '../../domain/errors/ShippingError';
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
    const priced = (await this.rates.rates(parcel)).map((rate) => ({
      rate,
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
    }));
    if (priced.length === 0) throw new QuoteUnavailableError('no Fastship service for this parcel');
    const cheapest = priced.reduce((best, p) => (p.price.isLessThan(best.price) ? p : best));
    const total = cheapest.price.plus(HANDLING_FEE);
    return { amount: total.amount(), currency: total.currency, service: cheapest.rate.serviceName };
  }
}
