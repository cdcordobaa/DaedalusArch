import { QuoteUnavailableError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import { PriceTable } from '../../domain/services/PriceTable';
import type { RatePort } from '../ports/out/RatePort';

const CURRENCY = 'EUR';
/** Parcels heavier than this travel as freight only; lighter or equal ones never do. */
const FREIGHT_THRESHOLD_GRAMS = 20_000;
const HANDLING_FEE = Money.of(1.5, CURRENCY);

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly rates: RatePort,
    private readonly fallback: PriceTable = new PriceTable(),
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let rates;
    try {
      rates = await this.rates.rates(parcel);
    } catch (e) {
      if (!(e instanceof QuoteUnavailableError)) throw e;
      const q = this.fallback.quote(parcel);
      return { amount: q.price.amount(), currency: q.price.currency, service: q.service, estimated: true };
    }
    const freight = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    const allowed = rates.filter((rate) => (rate.serviceCode === 'FREIGHT') === freight);
    const priced = allowed.map((rate) => ({
      rate,
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
    }));
    if (priced.length === 0) throw new QuoteUnavailableError('no Fastship service for this parcel');
    const cheapest = priced.reduce((best, p) => (p.price.isLessThan(best.price) ? p : best));
    const total = cheapest.price.plus(HANDLING_FEE);
    return { amount: total.amount(), currency: total.currency, service: cheapest.rate.serviceName, estimated: false };
  }
}
