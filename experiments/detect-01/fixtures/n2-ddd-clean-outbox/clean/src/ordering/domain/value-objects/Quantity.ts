/** Value object: a positive whole quantity. */
export class Quantity {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Quantity must be a positive integer');
  }
}
