/** Value object: a tax rate as a fraction between 0 and 1. */
export class TaxRate {
  constructor(readonly value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Tax rate must be a fraction between 0 and 1');
  }
}
