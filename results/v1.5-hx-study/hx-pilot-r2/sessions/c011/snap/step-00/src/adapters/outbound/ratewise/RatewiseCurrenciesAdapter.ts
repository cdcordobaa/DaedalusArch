import type { RatewiseClient } from 'ratewise-sdk';
import type { OfferedCurrencies } from '../../../application/ports/out/OfferedCurrencies';
import type { Currency } from '../../../domain/model/Currency';

export class RatewiseCurrenciesAdapter implements OfferedCurrencies {
  constructor(private readonly client: RatewiseClient) {}

  async all(): Promise<Currency[]> {
    const currencies = await this.client.currencies({ status: 'ACTIVE' });
    return currencies.map((c) => ({ code: c.isoCode, name: c.displayName, decimals: c.minorUnits }));
  }
}
