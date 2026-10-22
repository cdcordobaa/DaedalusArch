import { FastshipUnavailableError, type FastshipClient } from 'fastship-sdk';
import { RatesUnavailableError } from '../../../domain/errors/ShippingError';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async rates(parcel: Parcel): Promise<Quote[]> {
    let response;
    try {
      response = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      });
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new RatesUnavailableError(e.message);
      throw e;
    }
    return response.rates.map((r) => ({ price: Money.of(Number(r.amount.value), r.amount.currency), service: r.serviceName }));
  }
}
