export type FulfilmentStatus = 'filled' | 'partly filled' | 'unfilled';

/** How a request was met: units given from our own fridge, and units still missing. */
export class Fulfilment {
  private constructor(
    readonly fromStock: number,
    readonly outstanding: number,
  ) {}

  static of(requested: number, fromStock: number): Fulfilment {
    return new Fulfilment(fromStock, requested - fromStock);
  }

  status(): FulfilmentStatus {
    if (this.outstanding === 0) return 'filled';
    if (this.fromStock === 0) return 'unfilled';
    return 'partly filled';
  }
}
