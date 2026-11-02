import type { Currency } from '../../../domain/model/Currency';

/** The currencies prices can be shown in, in the application's own terms. */
export interface OfferedCurrencies {
  all(): Promise<Currency[]>;
}
