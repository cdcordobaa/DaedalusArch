import type { Money } from './Money';

export interface Quote {
  readonly price: Money;
  readonly service: string;
  /** True when the price comes from our own table instead of the carrier. */
  readonly estimated: boolean;
}
