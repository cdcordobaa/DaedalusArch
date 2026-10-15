import { Money } from '../domain/index.js';

export class PlaceOrder {
  total(): Money {
    return new Money(1);
  }
}
