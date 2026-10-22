import type { Money } from './Money';

export interface Quote {
  readonly price: Money;
  readonly service: string;
}
