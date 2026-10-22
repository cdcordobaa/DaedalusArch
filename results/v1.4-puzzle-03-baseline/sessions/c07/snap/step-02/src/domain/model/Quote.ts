import type { Money } from './Money';

export interface Quote {
  readonly price: Money;
  readonly service: string;
  /** True when the price comes from our own table rather than the carrier. */
  readonly estimated: boolean;
}
