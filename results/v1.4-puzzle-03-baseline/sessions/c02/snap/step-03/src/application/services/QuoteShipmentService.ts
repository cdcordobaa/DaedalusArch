import { FastshipUnavailableError } from 'fastship-sdk';
import { ShippingError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';
import type { RatePort } from '../ports/out/RatePort';

const QUOTE_CURRENCY = 'EUR';
const FREIGHT_THRESHOLD_GRAMS = 20000;
const HANDLING_FEE = Money.of(1.5, QUOTE_CURRENCY);

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
      if (!(e instanceof FastshipUnavailableError)) throw e;
      const house = this.fallback.quote(parcel);
      return { amount: house.price.amount(), currency: house.price.currency, service: house.service, estimated: true };
    }

    let cheapest: { price: Money; service: string } | undefined;
    const freightOnly = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    for (const rate of rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
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
