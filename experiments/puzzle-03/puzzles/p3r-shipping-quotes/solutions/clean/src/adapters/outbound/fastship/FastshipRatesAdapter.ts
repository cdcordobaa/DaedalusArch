import { FastshipUnavailableError, type FastshipClient } from 'fastship-sdk';
import type { CarrierRates } from '../../../application/ports/out/CarrierRates';
import { RatesUnavailable } from '../../../domain/errors/RatesUnavailable';
import type { CarrierRate } from '../../../domain/model/CarrierRate';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';

export class FastshipRatesAdapter implements CarrierRates {
  constructor(private readonly client: FastshipClient) {}

  async ratesFor(parcel: Parcel): Promise<CarrierRate[]> {
    try {
      const response = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      });
      return response.rates.map((r) => ({ service: r.serviceName, price: Money.of(Number(r.amount.value), r.amount.currency), freight: r.serviceCode === 'FREIGHT' }));
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new RatesUnavailable(e.message);
      throw e;
    }
  }
}
