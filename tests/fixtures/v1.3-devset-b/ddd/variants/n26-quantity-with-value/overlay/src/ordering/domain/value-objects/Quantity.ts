/** Value object: a positive whole quantity. */
export class Quantity {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Quantity must be a positive integer');
  }

  plus(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }

  withValue(value: number): Quantity {
    return new Quantity(value);
  }

  minus(other: Quantity): Quantity {
    return new Quantity(this.value - other.value);
  }
}
