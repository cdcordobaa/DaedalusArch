import type { CurrencyView, ListCurrencies } from '../ports/in/ListCurrencies';
import type { OfferedCurrencies } from '../ports/out/OfferedCurrencies';

export class ListCurrenciesService implements ListCurrencies {
  constructor(private readonly currencies: OfferedCurrencies) {}

  async offered(): Promise<CurrencyView[]> {
    const all = await this.currencies.all();
    return all.map((c) => ({ code: c.code, name: c.name, decimals: c.decimals }));
  }
}
