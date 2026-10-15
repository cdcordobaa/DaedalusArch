/** Value object: a positive whole quantity. */
export class Quantity {
  // VIOLATION (value-object immutability): a mutable private field behind a public `set` accessor.
  private current: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Quantity must be a positive integer');
    this.current = value;
  }

  get value(): number {
    return this.current;
  }

  set value(v: number) {
    this.current = v;
  }

  plus(other: Quantity): Quantity {
    return new Quantity(this.current + other.value);
  }
}
