import type { RatewiseClient } from 'ratewise-sdk';
import type { FxRatesPort, LiveRate } from '../../../application/ports/out/FxRatesPort';

export class RatewiseFxRatesAdapter implements FxRatesPort {
  constructor(private readonly client: RatewiseClient) {}

  async ratesFor(currency: string): Promise<LiveRate[]> {
    const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    return result.rates;
  }
}
