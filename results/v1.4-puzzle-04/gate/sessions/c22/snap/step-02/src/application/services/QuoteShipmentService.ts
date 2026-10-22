import { ShippingError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const CURRENCY = 'EUR';
const HANDLING_FEE = Money.of(1.5, CURRENCY);

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let rates;
    try {
      rates = await this.rates.rates(parcel);
    } catch {
      // Fastship unavailable: fall back to our own price table.
      const fallback = new PriceTable().quote(parcel);
      return { amount: fallback.price.amount(), currency: fallback.price.currency, service: fallback.service, estimated: true };
    }

    let cheapest: { price: Money; service: string } | undefined;
    for (const rate of rates) {
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      const price = Money.of(value, rate.amount.currency);
      if (!cheapest || price.isLessThan(cheapest.price)) cheapest = { price, service: rate.serviceName };
    }
    if (!cheapest) throw new ShippingError('no Fastship service available for this parcel');

    const total = cheapest.price.plus(HANDLING_FEE);
    return { amount: total.amount(), currency: total.currency, service: cheapest.service, estimated: false };
  }
}
