import type { Money } from './Money';

export interface Quote {
  readonly price: Money;
  readonly service: string;
  /** True for Fastship's freight service. */
  readonly freight?: boolean;
}
