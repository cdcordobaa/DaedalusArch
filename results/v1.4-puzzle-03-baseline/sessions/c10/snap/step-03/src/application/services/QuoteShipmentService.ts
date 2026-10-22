import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import { CarrierUnavailableError, ShippingError } from '../../domain/errors/ShippingError';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const HANDLING_FEE_EUR = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(
    private readonly rates: RatePort,
    private readonly fallback: PriceTable = new PriceTable(),
  ) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let rate;
    try {
      rate = await this.rates.cheapest(parcel);
    } catch (e) {
      if (!(e instanceof CarrierUnavailableError)) throw e;
      const own = this.fallback.quote(parcel);
      return { amount: own.price.amount(), currency: own.price.currency, service: own.service, estimated: true };
    }
    if (!rate) throw new ShippingError('no Fastship service available for this parcel');
    const price = rate.price.plus(Money.of(HANDLING_FEE_EUR, rate.price.currency));
    return { amount: price.amount(), currency: price.currency, service: rate.service, estimated: false };
  }
}
