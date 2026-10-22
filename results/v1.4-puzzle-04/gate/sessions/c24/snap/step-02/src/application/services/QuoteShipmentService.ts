import { CarrierUnavailableError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

export const QUOTE_CURRENCY = 'EUR';
const HANDLING_FEE = 1.5;

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly rates: RatePort) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    let cheapest;
    let estimated = false;
    try {
      cheapest = await this.rates.cheapest(parcel);
    } catch (e) {
      if (!(e instanceof CarrierUnavailableError)) throw e;
      cheapest = new PriceTable().quote(parcel);
      estimated = true;
    }
    const price = cheapest.price.plus(Money.of(HANDLING_FEE, QUOTE_CURRENCY));
    return { amount: price.amount(), currency: price.currency, service: cheapest.service, estimated };
  }
}
