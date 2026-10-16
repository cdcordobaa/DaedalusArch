/** Value object: a positive whole quantity. */
export class Quantity {
  // VIOLATION (value-object immutability): the field is not readonly and a public setter changes it.
  constructor(public value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Quantity must be a positive integer');
  }

  plus(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }

  setValue(value: number): void {
    this.value = value;
  }
}
