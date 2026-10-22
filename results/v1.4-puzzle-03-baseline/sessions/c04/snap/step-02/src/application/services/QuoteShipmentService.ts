import { ShippingError } from '../../domain/errors/ShippingError';
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
    let rates: Quote[];
    let estimated = false;
    try {
      rates = await this.rates.rates(parcel);
    } catch {
      // Fastship unavailable: fall back to our own price table.
      rates = [this.fallback.quote(parcel)];
      estimated = true;
    }
    const cheapest = rates.reduce((best, r) => (r.price.isLessThan(best.price) ? r : best), rates[0]);
    if (!cheapest) throw new ShippingError('no Fastship service available for this parcel');
    const total = cheapest.price.plus(Money.of(HANDLING_FEE, cheapest.price.currency));
    return { amount: total.amount(), currency: total.currency, service: cheapest.service, estimated };
  }
}
